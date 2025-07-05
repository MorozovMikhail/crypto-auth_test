import React, { useState } from "react";
import { Button, TextField, Typography, Box, Alert, CircularProgress, MenuItem, Select, FormControl, InputLabel, List, ListItem, ListItemText, Divider } from "@mui/material";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8080/api/auth";

const EcpAuth = () => {
  const [challenge, setChallenge] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [certLoading, setCertLoading] = useState(false);
  const [consoleLogging, setConsoleLogging] = useState(false);
  const [sessionId] = useState(() => Math.random().toString(36).substring(2));
  const [certificates, setCertificates] = useState([]);
  const [selectedCertIndex, setSelectedCertIndex] = useState("");
  const [certInfo, setCertInfo] = useState(null);

  // Получение challenge с сервера
  const getChallenge = async () => {
    setStatus("");
    setLoading(true);
    setChallenge("");
    const res = await fetch(`${API_URL}/challenge?sessionId=${sessionId}`);
    const data = await res.json();
    setChallenge(data.challenge);
    setLoading(false);
  };

  // Получение сертификатов пользователя
  const getCertificates = async () => {
    setCertLoading(true);
    setCertificates([]);
    setSelectedCertIndex("");
    setCertInfo(null);
    try {
      await window.cadesplugin;
      const store = await window.cadesplugin.CreateObjectAsync("CAdESCOM.Store");
      await store.Open(
        window.cadesplugin.CAPICOM_CURRENT_USER_STORE,
        window.cadesplugin.CAPICOM_MY_STORE,
        window.cadesplugin.CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED
      );
      const certs = await store.Certificates;
      const count = await certs.Count;
      if (count === 0) {
        setStatus("Нет доступных сертификатов.");
        setCertLoading(false);
        return;
      }
      const certList = [];
      for (let i = 1; i <= count; i++) {
        const cert = await certs.Item(i);
        const subjectName = await cert.SubjectName;
        const issuerName = await cert.IssuerName;
        const validFrom = await cert.ValidFromDate;
        const validTo = await cert.ValidToDate;
        certList.push({ cert, subjectName, issuerName, validFrom, validTo });
      }
      setCertificates(certList);
    } catch (e) {
      setStatus("Ошибка при получении сертификатов: " + e.message);
    }
    setCertLoading(false);
  };

  // Новая функция для вывода всех сертификатов в консоль
  const logAllCertificatesToConsole = async () => {
    try {
      setConsoleLogging(true);
      setStatus("");

      console.log('=== НАЧАЛО ВЫВОДА ВСЕХ СЕРТИФИКАТОВ (EcpAuth) ===');
      
      await window.cadesplugin;
      const store = await window.cadesplugin.CreateObjectAsync("CAdESCOM.Store");
      await store.Open(
        window.cadesplugin.CAPICOM_CURRENT_USER_STORE,
        window.cadesplugin.CAPICOM_MY_STORE,
        window.cadesplugin.CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED
      );
      
      const certs = await store.Certificates;
      const count = await certs.Count;
      
      console.log(`Найдено сертификатов: ${count}`);
      
      if (count === 0) {
        console.log('Сертификаты не найдены');
        setStatus('Сертификаты не найдены');
        return;
      }

      // Выводим информацию о каждом сертификате
      for (let i = 1; i <= count; i++) {
        const cert = await certs.Item(i);
        console.log(`\n--- Сертификат ${i} ---`);
        
        try {
          const subjectName = await cert.SubjectName;
          console.log('Subject Name:', subjectName);
        } catch (e) {
          console.log('Subject Name: Ошибка получения -', e.message);
        }
        
        try {
          const issuerName = await cert.IssuerName;
          console.log('Issuer Name:', issuerName);
        } catch (e) {
          console.log('Issuer Name: Ошибка получения -', e.message);
        }
        
        try {
          const validFrom = await cert.ValidFromDate;
          console.log('Valid From:', validFrom);
        } catch (e) {
          console.log('Valid From: Ошибка получения -', e.message);
        }
        
        try {
          const validTo = await cert.ValidToDate;
          console.log('Valid To:', validTo);
        } catch (e) {
          console.log('Valid To: Ошибка получения -', e.message);
        }
        
        try {
          const serialNumber = await cert.SerialNumber;
          console.log('Serial Number:', serialNumber);
        } catch (e) {
          console.log('Serial Number: Ошибка получения -', e.message);
        }
        
        try {
          const thumbprint = await cert.Thumbprint;
          console.log('Thumbprint:', thumbprint);
        } catch (e) {
          console.log('Thumbprint: Ошибка получения -', e.message);
        }
        
        // Попробуем получить дополнительные свойства
        console.log('Доступные методы сертификата:', Object.getOwnPropertyNames(Object.getPrototypeOf(cert)));
        console.log('Полный объект сертификата:', cert);
      }

      console.log('\n=== КОНЕЦ ВЫВОДА ВСЕХ СЕРТИФИКАТОВ (EcpAuth) ===');
      
      // Также выводим в alert для удобства
      alert(`Найдено ${count} сертификатов. Подробная информация выведена в консоль браузера (F12 -> Console)`);
      
    } catch (e) {
      console.error('Ошибка при выводе сертификатов в консоль:', e);
      setStatus('Ошибка при выводе сертификатов: ' + e.message);
    } finally {
      setConsoleLogging(false);
    }
  };

  // При выборе сертификата
  const handleCertChange = (event) => {
    const idx = event.target.value;
    setSelectedCertIndex(idx);
    setCertInfo(certificates[idx]);
  };

  // Подпись challenge через КриптоПро
  const signChallenge = async () => {
    setStatus("");
    setLoading(true);
    try {
      const cert = certificates[selectedCertIndex].cert;
      const signer = await window.cadesplugin.CreateObjectAsync("CAdESCOM.CPSigner");
      await signer.propset_Certificate(cert);
      const signedData = await window.cadesplugin.CreateObjectAsync("CAdESCOM.CadesSignedData");
      await signedData.propset_Content(challenge);
      const signature = await signedData.SignCades(
        signer,
        window.cadesplugin.CADES_BES,
        true
      );
      const certBase64 = await cert.Export(window.cadesplugin.CAPICOM_ENCODE_BASE64);
      const res = await fetch(`${API_URL}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, challenge, signature, certificate: certBase64 }),
      });
      const result = await res.json();
      setStatus(result.success ? "Успешная авторизация" : `Ошибка: ${result.message}`);
    } catch (e) {
      setStatus("Ошибка при подписании: " + e.message);
    }
    setLoading(false);
  };

  return (
    <Box sx={{ maxWidth: 500, mx: "auto", mt: 8, p: 4, boxShadow: 3, borderRadius: 2 }}>
      <Typography variant="h5" gutterBottom>Вход с помощью ЭЦП</Typography>
      
      {/* Кнопка для вывода всех сертификатов в консоль */}
      <Button 
        variant="outlined" 
        color="secondary" 
        fullWidth 
        onClick={logAllCertificatesToConsole} 
        sx={{ mb: 2 }} 
        disabled={consoleLogging}
      >
        {consoleLogging ? <CircularProgress size={24} /> : "Вывести все сертификаты в консоль"}
      </Button>

      <Divider sx={{ mb: 2 }} />

      <Button variant="contained" fullWidth onClick={getChallenge} sx={{ mb: 2 }} disabled={loading}>
        {loading ? <CircularProgress size={24} /> : "Получить challenge"}
      </Button>
      {challenge && (
        <>
          <TextField
            label="Challenge"
            value={challenge}
            fullWidth
            InputProps={{ readOnly: true }}
            sx={{ mb: 2 }}
          />
          <Button variant="outlined" fullWidth onClick={getCertificates} sx={{ mb: 2 }} disabled={certLoading}>
            {certLoading ? <CircularProgress size={24} /> : "Показать сертификаты"}
          </Button>
          {certificates.length > 0 && (
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="cert-select-label">Выберите сертификат</InputLabel>
              <Select
                labelId="cert-select-label"
                value={selectedCertIndex}
                label="Выберите сертификат"
                onChange={handleCertChange}
              >
                {certificates.map((c, idx) => (
                  <MenuItem value={idx} key={idx}>
                    {c.subjectName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {certInfo && (
            <List dense sx={{ mb: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
              <ListItem>
                <ListItemText primary="Владелец" secondary={certInfo.subjectName} />
              </ListItem>
              <ListItem>
                <ListItemText primary="Издатель" secondary={certInfo.issuerName} />
              </ListItem>
              <ListItem>
                <ListItemText primary="Действителен с" secondary={certInfo.validFrom} />
              </ListItem>
              <ListItem>
                <ListItemText primary="Действителен до" secondary={certInfo.validTo} />
              </ListItem>
            </List>
          )}
          <Button
            variant="contained"
            color="success"
            fullWidth
            onClick={signChallenge}
            disabled={loading || selectedCertIndex === ""}
          >
            {loading ? <CircularProgress size={24} /> : "Подписать и войти"}
          </Button>
        </>
      )}
      {status && <Alert severity={status.startsWith("Успеш") ? "success" : "error"} sx={{ mt: 2 }}>{status}</Alert>}
    </Box>
  );
};

export default EcpAuth; 