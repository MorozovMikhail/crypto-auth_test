import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import cadesplugin from 'crypto-pro-cadesplugin';

const CertificateList = () => {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pluginStatus, setPluginStatus] = useState('checking');

  useEffect(() => {
    checkPlugin();
  }, []);

  const checkPlugin = async () => {
    try {
      const cadesPluginInitFunction = await cadesplugin;
      const certsApi = await cadesPluginInitFunction();
      
      if (certsApi && typeof certsApi.getCertsList === 'function') {
        setPluginStatus('ready');
      } else {
        setPluginStatus('error');
        setError('API методы недоступны. Убедитесь, что плагин КриптоПро установлен.');
      }
    } catch (err) {
      setPluginStatus('not_found');
      setError('Плагин не найден: ' + err.message);
    }
  };

  const loadCertificates = async () => {
    setLoading(true);
    setError(null);
    setCertificates([]);
    // 1. Пробуем window.crypto_pro.getCertificates
    if (window.crypto_pro && typeof window.crypto_pro.getCertificates === 'function') {
      try {
        console.log('Используется window.crypto_pro.getCertificates');
        window.crypto_pro.getCertificates(function(certs) {
          if (!certs || certs.length === 0) {
            setError('Нет доступных сертификатов (crypto_pro.getCertificates)');
            setCertificates([]);
            setLoading(false);
            return;
          }
          console.log('Сертификаты (crypto_pro):', certs);
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
          setLoading(false);
        });
        return;
      } catch (e) {
        console.error('Ошибка при работе с crypto_pro.getCertificates:', e);
        setError('Ошибка при работе с crypto_pro.getCertificates: ' + e.message);
        setLoading(false);
        return;
      }
    }
    // 2. Fallback: CAdESCOM.Store (без CAPICOM_*)
    try {
      const certList = [];
      // Обычное хранилище (контейнеры)
      try {
        console.log('Пробуем открыть контейнеры (MAXIMUM_ALLOWED)');
        const store1 = await window.cadesplugin.CreateObjectAsync("CAdESCOM.Store");
        // CAPICOM_CURRENT_USER_STORE = 2, CAPICOM_MY_STORE = "My", CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED = 2
        await store1.Open(2, "My", 2);
        const certs1 = await store1.Certificates;
        const count1 = await certs1.Count;
        console.log(`Найдено сертификатов в контейнерах: ${count1}`);
        for (let i = 1; i <= count1; i++) {
          const cert = await certs1.Item(i);
          const thumbprint = await cert.Thumbprint;
          const subjectName = await cert.SubjectName;
          const issuerInfo = await cert.IssuerName;
          const validFrom = await cert.ValidFromDate;
          const validTo = await cert.ValidToDate;
          const serialNumber = await cert.SerialNumber;
          certList.push({
            thumbprint,
            subjectName,
            issuerInfo,
            validFrom,
            validTo,
            serialNumber,
            source: 'Контейнер (личное хранилище)',
            rawCert: cert
          });
          console.log('[Контейнер] thumbprint:', thumbprint, 'subject:', subjectName, 'issuer:', issuerInfo, 'valid:', validFrom, '-', validTo, 'serial:', serialNumber);
        }
      } catch (e) {
        console.error('Ошибка открытия контейнеров:', e);
      }
      // Внешние устройства (токены) — перебор всех возможных типов
      const tokenStoreTypes = [3, 4, 5, 6]; // CAPICOM_STORE_OPEN_EXTERNAL_PROVIDER = 3, ...
      for (const type of tokenStoreTypes) {
        try {
          console.log(`Пробуем открыть токены (тип ${type})`);
          const store = await window.cadesplugin.CreateObjectAsync("CAdESCOM.Store");
          await store.Open(2, "My", type);
          const certs = await store.Certificates;
          const count = await certs.Count;
          console.log(`Найдено сертификатов в токенах (тип ${type}): ${count}`);
          for (let i = 1; i <= count; i++) {
            const cert = await certs.Item(i);
            const thumbprint = await cert.Thumbprint;
            const subjectName = await cert.SubjectName;
            const issuerInfo = await cert.IssuerName;
            const validFrom = await cert.ValidFromDate;
            const validTo = await cert.ValidToDate;
            const serialNumber = await cert.SerialNumber;
            certList.push({
              thumbprint,
              subjectName,
              issuerInfo,
              validFrom,
              validTo,
              serialNumber,
              source: `Токен (тип ${type})`,
              rawCert: cert
            });
            console.log(`[${type}] thumbprint:`, thumbprint, 'subject:', subjectName, 'issuer:', issuerInfo, 'valid:', validFrom, '-', validTo, 'serial:', serialNumber);
          }
        } catch (e) {
          if (e && (e.message?.includes('0x80070057') || String(e).includes('0x80070057'))) {
            console.warn(`Тип токена ${type} не поддерживается или не готов (0x80070057)`);
            continue;
          } else {
            console.error(`Ошибка открытия токенов (тип ${type}):`, e);
          }
        }
      }
      if (certList.length === 0) {
        setError('Сертификаты не найдены');
        setCertificates([]);
        return;
      }
      setCertificates(certList); // Без удаления дубликатов!
      // Подробный вывод в консоль для отладки
      console.log('Загружено сертификатов (всего, с возможными дублями):', certList.length);
      console.log('Сертификаты:', certList);
    } catch (err) {
      console.error('Ошибка загрузки сертификатов:', err);
      setError('Ошибка загрузки сертификатов: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString || dateString === 'Не указан') return dateString;
    try {
      return new Date(dateString).toLocaleString('ru-RU');
    } catch {
      return dateString;
    }
  };

  const isExpired = (validTo) => {
    if (!validTo || validTo === 'Не указан') return false;
    try {
      return new Date(validTo) < new Date();
    } catch {
      return false;
    }
  };

  if (pluginStatus === 'checking') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (pluginStatus === 'not_found' || pluginStatus === 'error') {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 2 }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        Список сертификатов
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        Если вы только что вставили токен, подождите несколько секунд и нажмите <b>«Обновить сертификаты»</b>.<br/>
        Если сертификаты не появились — попробуйте ещё раз.
      </Alert>
      <Tooltip title="Если вы только что вставили токен, подождите пару секунд и нажмите ещё раз!">
        <Button
          variant="contained"
          onClick={loadCertificates}
          disabled={loading}
          sx={{ mb: 3, width: '100%' }}
        >
          {loading ? <CircularProgress size={24} /> : 'Обновить сертификаты'}
        </Button>
      </Tooltip>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {certificates.length > 0 && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Найдено сертификатов: {certificates.length}
          </Typography>
          
          {certificates.map((cert, index) => (
            <Card key={cert.id} sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" component="h2">
                    Сертификат {index + 1}
                  </Typography>
                  <Chip 
                    label={isExpired(cert.validTo) ? 'Истек' : 'Действителен'} 
                    color={isExpired(cert.validTo) ? 'error' : 'success'}
                    size="small"
                  />
                </Box>

                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle1">
                      {cert.subjectName}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <List dense>
                      <ListItem>
                        <ListItemText 
                          primary="Владелец" 
                          secondary={cert.subjectName}
                          primaryTypographyProps={{ fontWeight: 'bold' }}
                        />
                      </ListItem>
                      <Divider />
                      <ListItem>
                        <ListItemText 
                          primary="Издатель" 
                          secondary={cert.issuerInfo}
                          primaryTypographyProps={{ fontWeight: 'bold' }}
                        />
                      </ListItem>
                      <Divider />
                      <ListItem>
                        <ListItemText 
                          primary="Серийный номер" 
                          secondary={cert.serialNumber}
                          primaryTypographyProps={{ fontWeight: 'bold' }}
                        />
                      </ListItem>
                      <Divider />
                      <ListItem>
                        <ListItemText 
                          primary="Thumbprint" 
                          secondary={cert.thumbprint}
                          primaryTypographyProps={{ fontWeight: 'bold' }}
                          secondaryTypographyProps={{ 
                            fontFamily: 'monospace',
                            fontSize: '0.8rem'
                          }}
                        />
                      </ListItem>
                      <Divider />
                      <ListItem>
                        <ListItemText 
                          primary="Действителен с" 
                          secondary={formatDate(cert.validFrom)}
                          primaryTypographyProps={{ fontWeight: 'bold' }}
                        />
                      </ListItem>
                      <Divider />
                      <ListItem>
                        <ListItemText 
                          primary="Действителен до" 
                          secondary={formatDate(cert.validTo)}
                          primaryTypographyProps={{ fontWeight: 'bold' }}
                        />
                      </ListItem>
                    </List>
                  </AccordionDetails>
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default CertificateList; 