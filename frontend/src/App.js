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
  Alert
} from '@mui/material';
import cadesplugin from 'crypto-pro-cadesplugin';

function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [certificates, setCertificates] = useState([]);
  const [selectedCert, setSelectedCert] = useState('');
  const [pluginStatus, setPluginStatus] = useState('checking');

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
      const certList = await certsApi.getCertsList();
      
      if (certList.length === 0) {
        setError('Сертификаты не найдены. Убедитесь, что у вас есть установленные и действительные сертификаты.');
      } else {
        setCertificates(certList.map(cert => ({
          thumbprint: cert.thumbprint,
          subjectName: cert.subjectInfo // Используем subjectInfo, как в документации пакета
        })));
        setSelectedCert(certList[0].thumbprint);
        setError(null);
      }
    } catch (err) {
      console.error('Certificate loading error:', err);
      setError('Ошибка при загрузке сертификатов: ' + (err.message || err.toString()));
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
      const response = await fetch(`http://localhost:8080/api/auth/challenge?sessionId=${sessionId}`);
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
      const verifyResponse = await fetch('http://localhost:8080/api/auth/verify', {
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

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8 }}>
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
            <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Выберите сертификат</InputLabel>
                <Select
                  value={selectedCert}
                  onChange={(e) => setSelectedCert(e.target.value)}
                  label="Выберите сертификат"
                >
                  {certificates.map((cert) => (
                    <MenuItem key={cert.thumbprint} value={cert.thumbprint}>
                      {cert.subjectName}
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