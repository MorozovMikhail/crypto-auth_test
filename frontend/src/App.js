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
  Tab
} from '@mui/material';
import cadesplugin from 'crypto-pro-cadesplugin';
import EcpAuth from './components/EcpAuth';
import CertificateList from './components/CertificateList';

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
    const checkPluginAndLoadCertificates = async () => {
      try {
        // Получаем функцию инициализации плагина
        const cadesPluginInitFunction = await cadesplugin;
        // Вызываем эту функцию, чтобы получить объект API плагина
        const certsApi = await cadesPluginInitFunction();

        console.log('Полученный объект cadesplugin API:', certsApi);
        // Проверяем, доступны ли основные методы API
        if (certsApi && typeof certsApi.getCertsList === 'function') {
          setPluginStatus('ready');
          await loadCertificates(certsApi);
        } else {
          setPluginStatus('error');
          setError('Ошибка инициализации плагина CryptoPro: API методы недоступны. Убедитесь, что КриптоПро ЭЦП Browser plug-in установлен и корректно настроен.');
        }
      } catch (err) {
        console.error('Plugin check error:', err);
        setPluginStatus('not_found');
        setError('Плагин CryptoPro не установлен или произошла ошибка при его инициализации. Пожалуйста, убедитесь, что КриптоПро ЭЦП Browser plug-in установлен и корректно настроен.\nОшибка: ' + (err.message || err.toString()));
      }
    };

    checkPluginAndLoadCertificates();
  }, []);

  const loadCertificates = async (certsApi) => {
    try {
      // Обычное хранилище
      const store = await window.cadesplugin.CreateObjectAsync("CAdESCOM.Store");
      await store.Open(
        window.cadesplugin.CAPICOM_CURRENT_USER_STORE,
        window.cadesplugin.CAPICOM_MY_STORE,
        window.cadesplugin.CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED
      );
      const certs = await store.Certificates;
      const count = await certs.Count;
      // Внешние устройства (токены)
      const storeToken = await window.cadesplugin.CreateObjectAsync("CAdESCOM.Store");
      await storeToken.Open(
        window.cadesplugin.CAPICOM_CURRENT_USER_STORE,
        window.cadesplugin.CAPICOM_MY_STORE,
        window.cadesplugin.CAPICOM_STORE_OPEN_EXTERNAL_PROVIDER
      );
      const certsToken = await storeToken.Certificates;
      const countToken = await certsToken.Count;
      // Собираем все сертификаты
      const certList = [];
      for (let i = 1; i <= count; i++) {
        const cert = await certs.Item(i);
        const thumbprint = await cert.Thumbprint;
        const subjectName = await cert.SubjectName;
        certList.push({ thumbprint, subjectName, source: 'Личное хранилище' });
      }
      for (let i = 1; i <= countToken; i++) {
        const cert = await certsToken.Item(i);
        const thumbprint = await cert.Thumbprint;
        const subjectName = await cert.SubjectName;
        certList.push({ thumbprint, subjectName, source: 'Токен/смарт-карта' });
      }
      if (certList.length === 0) {
        setError('Сертификаты не найдены. Убедитесь, что у вас есть установленные и действительные сертификаты.');
      } else {
        setCertificates(certList);
        setSelectedCert(certList[0].thumbprint);
        setError(null);
      }
    } catch (err) {
      console.error('Certificate loading error:', err);
      setError('Ошибка при загрузке сертификатов: ' + (err.message || err.toString()));
    }
  };

  // Новая функция для вывода всех сертификатов в консоль
  const logAllCertificatesToConsole = async () => {
    try {
      setConsoleLogging(true);
      setError(null);

      // Получаем функцию инициализации плагина
      const cadesPluginInitFunction = await cadesplugin;
      const certsApi = await cadesPluginInitFunction();

      console.log('=== НАЧАЛО ВЫВОДА ВСЕХ СЕРТИФИКАТОВ ===');
      
      // Получаем список всех сертификатов
      const certList = await certsApi.getCertsList();
      
      console.log(`Найдено сертификатов: ${certList.length}`);
      
      if (certList.length === 0) {
        console.log('Сертификаты не найдены');
        setError('Сертификаты не найдены');
        return;
      }

      // Выводим информацию о каждом сертификате
      certList.forEach((cert, index) => {
        console.log(`\n--- Сертификат ${index + 1} ---`);
        console.log('Thumbprint:', cert.thumbprint);
        console.log('Subject Name:', cert.subjectInfo);
        
        // Попробуем получить дополнительную информацию, если доступна
        if (cert.issuerInfo) {
          console.log('Issuer Name:', cert.issuerInfo);
        }
        if (cert.validFrom) {
          console.log('Valid From:', cert.validFrom);
        }
        if (cert.validTo) {
          console.log('Valid To:', cert.validTo);
        }
        if (cert.serialNumber) {
          console.log('Serial Number:', cert.serialNumber);
        }
        
        // Выводим все доступные свойства сертификата
        console.log('Все свойства сертификата:', Object.keys(cert));
        console.log('Полный объект сертификата:', cert);
      });

      console.log('\n=== КОНЕЦ ВЫВОДА ВСЕХ СЕРТИФИКАТОВ ===');
      
      // Также выводим в alert для удобства
      alert(`Найдено ${certList.length} сертификатов. Подробная информация выведена в консоль браузера (F12 -> Console)`);
      
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

      // Генерируем уникальный идентификатор сессии
      const sessionId = Math.random().toString(36).substring(7);
      
      // Получаем challenge от сервера
      const response = await fetch(`${API_BASE_URL}/api/auth/challenge?sessionId=${sessionId}`);
      const { challenge } = await response.json();

      // Используем методы пакета для подписи
      const certsApi = await (await cadesplugin)();
      const signature = await certsApi.signBase64(selectedCert, btoa(challenge), 0); // 0 для CAPICOM_BASE64_ENCODING
      
      // Получаем сертификат в формате Base64 (пакет не предоставляет прямого метода, поэтому оставим это как есть, если это работает)
      // Возможно, потребуется дополнительная логика для получения certBase64, если пакет не возвращает его.
      // Для тестовых целей, пока не меняем эту часть, если она работала ранее.
      const cert = (await certsApi.getCertsList()).find(c => c.thumbprint === selectedCert);
      const certBase64 = cert ? await cert.Export(0) : null; // Экспорт сертификата

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
          certificate: certBase64 // Передаем base64 сертификата
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
    switch (activeTab) {
      case 0:
        return (
          <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Кнопка для вывода всех сертификатов в консоль */}
            <Button
              variant="outlined"
              color="secondary"
              onClick={logAllCertificatesToConsole}
              disabled={consoleLogging}
              sx={{ mb: 3, width: '100%' }}
            >
              {consoleLogging ? <CircularProgress size={24} /> : 'Вывести все сертификаты в консоль'}
            </Button>

            <Divider sx={{ width: '100%', mb: 3 }} />

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Выберите сертификат</InputLabel>
              <Select
                value={selectedCert}
                onChange={(e) => setSelectedCert(e.target.value)}
                label="Выберите сертификат"
              >
                {certificates.map((cert) => (
                  <MenuItem key={cert.thumbprint} value={cert.thumbprint}>
                    {cert.subjectName} ({cert.source})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              variant="contained"
              color="primary"
              onClick={handleSignIn}
              disabled={loading || !selectedCert}
              sx={{ mt: 2 }}
            >
              {loading ? <CircularProgress size={24} /> : 'Войти с помощью ЭЦП'}
            </Button>
          </Box>
        );
      case 1:
        return <EcpAuth />;
      case 2:
        return <CertificateList />;
      default:
        return null;
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            Авторизация с помощью ЭЦП
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
              <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 3 }}>
                <Tab label="Основная авторизация" />
                <Tab label="Альтернативная авторизация" />
                <Tab label="Список сертификатов" />
              </Tabs>
              
              {renderTabContent()}
            </>
          )}
          
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Paper>
      </Box>
    </Container>
  );
}

export default App; 