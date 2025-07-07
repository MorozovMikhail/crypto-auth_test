import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Box, 
  Typography, 
  Button, 
  Paper,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Divider,
  Tabs,
  Tab,
  Tooltip
} from '@mui/material';
import EcpAuth from './components/EcpAuth';
// Удаляю импорт CertificateList
// import CertificateList from './components/CertificateList';

// Определяем API URL для разных окружений
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [certificates, setCertificates] = useState([]);
  const [selectedCert, setSelectedCert] = useState('');
  const [pluginStatus, setPluginStatus] = useState('checking');
  const [consoleLogging, setConsoleLogging] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const checkPlugin = () => {
      if (window.cadesplugin && window.cadesplugin.CreateObjectAsync) {
        setPluginStatus('ready');
      } else {
        setPluginStatus('not_found');
      }
    };
    checkPlugin();
  }, []);

  const loadCertificates = async () => {
    setLoading(true);
    setError(null);
    setCertificates([]);
    // Проверка наличия плагина — до любых логов и обращений
    if (!window.cadesplugin || !window.cadesplugin.CreateObjectAsync) {
      setError('Плагин КриптоПро не найден или не инициализирован.');
      setLoading(false);
      return;
    }
    try {
      // 1. Пробуем window.crypto_pro.getCertificates
      if (window.crypto_pro && typeof window.crypto_pro.getCertificates === 'function') {
        try {
          window.crypto_pro.getCertificates(function(certs) {
            if (!certs || certs.length === 0) {
              setError('Нет доступных сертификатов (crypto_pro.getCertificates)');
              setCertificates([]);
              setLoading(false);
              return;
            }
            const certList = certs.map((c, idx) => ({
              thumbprint: c.thumbprint || c.Thumbprint || '',
              subjectName: c.subject || c.subjectName || `Сертификат ${idx+1}`,
              issuerInfo: c.issuer || c.issuerName || '',
              validFrom: c.validFrom || '',
              validTo: c.validTo || '',
              serialNumber: c.serialNumber || '',
              source: 'crypto_pro.getCertificates',
              rawCert: c
            }));
            setCertificates(certList);
            setSelectedCert(certList[0]?.thumbprint || '');
            setError(null);
            setLoading(false);
          });
          return;
        } catch (e) {
          setError('Ошибка при работе с crypto_pro.getCertificates: ' + e.message);
          setLoading(false);
          return;
        }
      }
      // 2. Fallback: CAdESCOM.Store (без CAPICOM_*)
      const certList = [];
      // Обычное хранилище (контейнеры)
      try {
        const store1 = await window.cadesplugin.CreateObjectAsync("CAdESCOM.Store");
        await store1.Open(2, "My", 2);
        const certs1 = await store1.Certificates;
        const count1 = await certs1.Count;
        for (let i = 1; i <= count1; i++) {
          const cert = await certs1.Item(i);
          const thumbprint = await cert.Thumbprint;
          const subjectName = await cert.SubjectName;
          certList.push({ thumbprint, subjectName, source: 'Контейнер (личное хранилище)' });
        }
      } catch (e) {
        setError('Ошибка открытия контейнеров: ' + (e.message || String(e)));
      }
      // Внешние устройства (токены) — перебор всех возможных типов
      const tokenStoreTypes = [3, 4, 5, 6];
      for (const type of tokenStoreTypes) {
        try {
          const store = await window.cadesplugin.CreateObjectAsync("CAdESCOM.Store");
          await store.Open(2, "My", type);
          const certs = await store.Certificates;
          const count = await certs.Count;
          for (let i = 1; i <= count; i++) {
            const cert = await certs.Item(i);
            const thumbprint = await cert.Thumbprint;
            const subjectName = await cert.SubjectName;
            certList.push({ thumbprint, subjectName, source: `Токен (тип ${type})` });
          }
        } catch (e) {
          if (e && (e.message?.includes('0x80070057') || String(e).includes('0x80070057'))) {
            continue;
          } else {
            setError(`Ошибка открытия токенов (тип ${type}): ` + (e.message || String(e)));
          }
        }
      }
      if (certList.length === 0) {
        setError('Сертификаты не найдены. Убедитесь, что у вас есть установленные и действительные сертификаты.');
      } else {
        setCertificates(certList); // Без удаления дубликатов!
        setSelectedCert(certList[0]?.thumbprint || '');
        setError(null);
      }
    } catch (err) {
      setError('Ошибка при загрузке сертификатов: ' + (err.message || err.toString()));
    } finally {
      setLoading(false);
    }
  };

  // Новая функция для вывода всех сертификатов в консоль
  const logAllCertificatesToConsole = async () => {
    try {
      setConsoleLogging(true);
      setError(null);
      // Проверка наличия плагина
      if (!window.cadesplugin || !window.cadesplugin.CreateObjectAsync) {
        setError('Плагин КриптоПро не найден или не инициализирован.');
        setConsoleLogging(false);
        return;
      }
      console.log('=== НАЧАЛО ВЫВОДА ВСЕХ СЕРТИФИКАТОВ ===');
      // Обычное хранилище
      const store = await window.cadesplugin.CreateObjectAsync("CAdESCOM.Store");
      await store.Open(2, "My", 2); // CAPICOM_CURRENT_USER_STORE = 2, CAPICOM_MY_STORE = "My", CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED = 2
      const certs = await store.Certificates;
      const count = await certs.Count;
      // Внешние устройства (токены)
      const tokenStoreTypes = [3, 4, 5, 6]; // CAPICOM_STORE_OPEN_EXTERNAL_PROVIDER = 3, ...
      let allCerts = [];
      for (let i = 1; i <= count; i++) {
        allCerts.push(await certs.Item(i));
      }
      for (const type of tokenStoreTypes) {
        try {
          if (!window.cadesplugin || !window.cadesplugin.CreateObjectAsync) throw new Error('Плагин не инициализирован');
          const storeToken = await window.cadesplugin.CreateObjectAsync("CAdESCOM.Store");
          await storeToken.Open(2, "My", type);
          const certsToken = await storeToken.Certificates;
          const countToken = await certsToken.Count;
          for (let i = 1; i <= countToken; i++) {
            allCerts.push(await certsToken.Item(i));
          }
        } catch (e) {
          console.warn(`Ошибка открытия токенов (тип ${type}):`, e);
        }
      }
      console.log(`Найдено сертификатов: ${allCerts.length}`);
      if (allCerts.length === 0) {
        console.log('Сертификаты не найдены');
        setError('Сертификаты не найдены');
        return;
      }
      for (let i = 0; i < allCerts.length; i++) {
        const cert = allCerts[i];
        console.log(`\n--- Сертификат ${i + 1} ---`);
        try { console.log('Subject Name:', await cert.SubjectName); } catch (e) {}
        try { console.log('Issuer Name:', await cert.IssuerName); } catch (e) {}
        try { console.log('Valid From:', await cert.ValidFromDate); } catch (e) {}
        try { console.log('Valid To:', await cert.ValidToDate); } catch (e) {}
        try { console.log('Serial Number:', await cert.SerialNumber); } catch (e) {}
        try { console.log('Thumbprint:', await cert.Thumbprint); } catch (e) {}
        console.log('Доступные методы сертификата:', Object.getOwnPropertyNames(Object.getPrototypeOf(cert)));
        console.log('Полный объект сертификата:', cert);
      }
      console.log('\n=== КОНЕЦ ВЫВОДА ВСЕХ СЕРТИФИКАТОВ ===');
      alert(`Найдено ${allCerts.length} сертификатов. Подробная информация выведена в консоль браузера (F12 -> Console)`);
    } catch (err) {
      console.error('Ошибка при выводе сертификатов в консоль:', err);
      setError('Ошибка при выводе сертификатов: ' + (err.message || err.toString()));
    } finally {
      setConsoleLogging(false);
    }
  };

  const handleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!selectedCert) {
        throw new Error('Выберите сертификат');
      }
      // Проверка наличия плагина
      if (!window.cadesplugin || !window.cadesplugin.CreateObjectAsync) {
        setError('Плагин КриптоПро не найден или не инициализирован.');
        setLoading(false);
        return;
      }
      // Генерируем уникальный идентификатор сессии
      const sessionId = Math.random().toString(36).substring(7);
      // Получаем challenge от сервера
      const response = await fetch(`${API_BASE_URL}/api/auth/challenge?sessionId=${sessionId}`);
      const { challenge } = await response.json();
      // Находим сертификат по отпечатку
      let certObj = null;
      // Обычное хранилище
      const store = await window.cadesplugin.CreateObjectAsync("CAdESCOM.Store");
      await store.Open(2, "My", 2);
      const certs = await store.Certificates;
      const count = await certs.Count;
      for (let i = 1; i <= count; i++) {
        const cert = await certs.Item(i);
        const thumbprint = await cert.Thumbprint;
        if (thumbprint === selectedCert) {
          certObj = cert;
          break;
        }
      }
      // Если не найдено — ищем в токенах
      if (!certObj) {
        const tokenStoreTypes = [3, 4, 5, 6];
        for (const type of tokenStoreTypes) {
          try {
            if (!window.cadesplugin || !window.cadesplugin.CreateObjectAsync) throw new Error('Плагин не инициализирован');
            const storeToken = await window.cadesplugin.CreateObjectAsync("CAdESCOM.Store");
            await storeToken.Open(2, "My", type);
            const certsToken = await storeToken.Certificates;
            const countToken = await certsToken.Count;
            for (let i = 1; i <= countToken; i++) {
              const cert = await certsToken.Item(i);
              const thumbprint = await cert.Thumbprint;
              if (thumbprint === selectedCert) {
                certObj = cert;
                break;
              }
            }
            if (certObj) break;
          } catch (e) {}
        }
      }
      if (!certObj) throw new Error('Сертификат не найден');
      // Подписываем challenge
      const signer = await window.cadesplugin.CreateObjectAsync("CAdESCOM.CPSigner");
      await signer.propset_Certificate(certObj);
      const signedData = await window.cadesplugin.CreateObjectAsync("CAdESCOM.CadesSignedData");
      await signedData.propset_Content(challenge);
      const signature = await signedData.SignCades(
        signer,
        window.cadesplugin.CADES_BES,
        true
      );
      const certBase64 = await certObj.Export(window.cadesplugin.CAPICOM_ENCODE_BASE64);
      // Отправляем подпись на сервер
      const verifyResponse = await fetch(`${API_BASE_URL}/api/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          challenge,
          signature,
          certificate: certBase64
        }),
      });
      const result = await verifyResponse.json();
      if (result.success) {
        console.log('Авторизация успешна');
      } else {
        setError(result.message || 'Ошибка авторизации');
      }
    } catch (err) {
      console.error('Sign in error:', err);
      setError('Ошибка при подписи: ' + (err.message || err.toString()));
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const renderTabContent = () => {
    // Оставляем только альтернативную авторизацию, переименованную в 'Авторизация'
    return <EcpAuth />;
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            Авторизация
          </Typography>
          {pluginStatus === 'checking' && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Проверка плагина CryptoPro...
            </Alert>
          )}
          {pluginStatus === 'not_found' && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Плагин CryptoPro не установлен или произошла ошибка при его инициализации. Пожалуйста, убедитесь, что КриптоПро ЭЦП Browser plug-in установлен и корректно настроен.
            </Alert>
          )}
          {pluginStatus === 'ready' && (
            <>
              {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {error}
                </Alert>
              )}
              {certificates.length > 0 && (
                <>
                  {/* Здесь может быть рендер списка сертификатов или другой UI */}
                </>
              )}
              {renderTabContent()}
            </>
          )}
        </Paper>
      </Box>
    </Container>
  );
}

export default App; 