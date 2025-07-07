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
  AccordionDetails
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
    try {
      setLoading(true);
      setError(null);
      const certList = [];
      // Обычное хранилище (контейнеры)
      try {
        const store1 = await window.cadesplugin.CreateObjectAsync("CAdESCOM.Store");
        await store1.Open(
          window.cadesplugin.CAPICOM_CURRENT_USER_STORE,
          window.cadesplugin.CAPICOM_MY_STORE,
          window.cadesplugin.CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED
        );
        const certs1 = await store1.Certificates;
        const count1 = await certs1.Count;
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
        }
      } catch (e) {}
      // Внешние устройства (токены)
      try {
        const store2 = await window.cadesplugin.CreateObjectAsync("CAdESCOM.Store");
        await store2.Open(
          window.cadesplugin.CAPICOM_CURRENT_USER_STORE,
          window.cadesplugin.CAPICOM_MY_STORE,
          window.cadesplugin.CAPICOM_STORE_OPEN_EXTERNAL_PROVIDER
        );
        const certs2 = await store2.Certificates;
        const count2 = await certs2.Count;
        for (let i = 1; i <= count2; i++) {
          const cert = await certs2.Item(i);
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
            source: 'Внешний токен/смарт-карта',
            rawCert: cert
          });
        }
      } catch (e) {}
      // Удаляем дубликаты по thumbprint
      const uniqueCerts = certList.filter((cert, index, self) =>
        index === self.findIndex((c) => c.thumbprint === cert.thumbprint)
      );
      if (uniqueCerts.length === 0) {
        setError('Сертификаты не найдены');
        setCertificates([]);
        return;
      }
      setCertificates(uniqueCerts);
      // Также выводим в консоль для отладки
      console.log('Загружено сертификатов:', uniqueCerts.length);
      console.log('Сертификаты:', uniqueCerts);
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
      
      <Button
        variant="contained"
        onClick={loadCertificates}
        disabled={loading}
        sx={{ mb: 3, width: '100%' }}
      >
        {loading ? <CircularProgress size={24} /> : 'Загрузить сертификаты'}
      </Button>

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