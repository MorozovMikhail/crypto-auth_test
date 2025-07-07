import React, { useState, useEffect } from "react";
import { Button, TextField, Typography, Box, Alert, CircularProgress, MenuItem, Select, FormControl, InputLabel, List, ListItem, ListItemText, Divider, Tooltip } from "@mui/material";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8080/api/auth";

const EcpAuth = () => {
  const [challenge, setChallenge] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [certLoading, setCertLoading] = useState(false);
  const [sessionId] = useState(() => Math.random().toString(36).substring(2));
  const [certificates, setCertificates] = useState([]);
  const [selectedCertIndex, setSelectedCertIndex] = useState("");
  const [certInfo, setCertInfo] = useState(null);
  const [certsRequested, setCertsRequested] = useState(false);

  // Гарантированный сброс статуса и certsRequested при первом рендере и при каждом рендере, если certsRequested === false
  useEffect(() => {
    if (!certsRequested) {
      setStatus("");
    }
  }, [certsRequested]);

  // Получение challenge с сервера
  const getChallenge = async () => {
    setStatus("");
    setCertsRequested(false); // Сброс флага при получении challenge
    setCertificates([]);      // Сброс найденных сертификатов
    setSelectedCertIndex("");
    setCertInfo(null);
    setLoading(true);
    setChallenge("");
    const res = await fetch(`${API_URL}/challenge?sessionId=${sessionId}`);
    const data = await res.json();
    setChallenge(data.challenge);
    setLoading(false);
  };

  // Универсальная функция получения сертификатов
  const getCertificates = async (showNotFound = true) => {
    setCertLoading(true);
    setCertificates([]);
    setSelectedCertIndex("");
    setCertInfo(null);
    let found = false;
    // 1. Пробуем window.crypto_pro.getCertificates
    if (window.crypto_pro && typeof window.crypto_pro.getCertificates === 'function') {
      try {
        window.crypto_pro.getCertificates(function(certs) {
          if (!certs || certs.length === 0) {
            if (showNotFound) setStatus('Нет доступных сертификатов (crypto_pro.getCertificates)');
            setCertLoading(false);
            return;
          }
          const certList = certs.map((c, idx) => ({
            subjectName: c.subject || c.subjectName || `Сертификат ${idx+1}`,
            issuerName: c.issuer || c.issuerName || '',
            validFrom: c.validFrom || '',
            validTo: c.validTo || '',
            source: 'crypto_pro.getCertificates',
            cert: c
          }));
          setCertificates(certList);
          setStatus("");
          setCertLoading(false);
        });
        return;
      } catch (e) {
        setStatus('Ошибка при работе с crypto_pro.getCertificates: ' + e.message);
        setCertLoading(false);
        return;
      }
    }
    // 2. Fallback: CAdESCOM.Store (без CAPICOM_*)
    try {
      const certList = [];
      // Обычное хранилище (контейнеры)
      try {
        const store1 = await window.cadesplugin.CreateObjectAsync("CAdESCOM.Store");
        await store1.Open(2, "My", 2);
        const certs1 = await store1.Certificates;
        const count1 = await certs1.Count;
        for (let i = 1; i <= count1; i++) {
          const cert = await certs1.Item(i);
          const subjectName = await cert.SubjectName;
          const issuerName = await cert.IssuerName;
          const validFrom = await cert.ValidFromDate;
          const validTo = await cert.ValidToDate;
          certList.push({ cert, subjectName, issuerName, validFrom, validTo, source: 'Контейнер (личное хранилище)' });
        }
      } catch (e) {}
      // Внешние устройства (токены)
      const tokenStoreTypes = [3, 4, 5, 6];
      for (const type of tokenStoreTypes) {
        try {
          const store = await window.cadesplugin.CreateObjectAsync("CAdESCOM.Store");
          await store.Open(2, "My", type);
          const certs = await store.Certificates;
          const count = await certs.Count;
          for (let i = 1; i <= count; i++) {
            const cert = await certs.Item(i);
            const subjectName = await cert.SubjectName;
            const issuerName = await cert.IssuerName;
            const validFrom = await cert.ValidFromDate;
            const validTo = await cert.ValidToDate;
            certList.push({ cert, subjectName, issuerName, validFrom, validTo, source: `Токен (тип ${type})` });
          }
        } catch (e) {}
      }
      if (certList.length === 0) {
        if (showNotFound) setStatus("Сертификаты не найдены. Убедитесь, что у вас есть установленные и действительные сертификаты.");
        setCertLoading(false);
        return;
      }
      setCertificates(certList);
      setStatus("");
    } catch (e) {
      setStatus("Ошибка при получении сертификатов: " + e.message);
    }
    setCertLoading(false);
  };

  // При выборе сертификата
  const handleCertChange = (event) => {
    setStatus(""); // сбросить статус при выборе сертификата
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
          <Alert severity="info" sx={{ mb: 2 }}>
            Если вы только что вставили токен, подождите несколько секунд и нажмите <b>«Обновить сертификаты»</b>.<br/>
            Если сертификаты не появились — попробуйте ещё раз.
          </Alert>
          <Tooltip title="Если вы только что вставили токен, подождите пару секунд и нажмите ещё раз!">
            <Button variant="outlined" fullWidth onClick={() => { setCertsRequested(true); getCertificates(true); }} sx={{ mb: 2 }} disabled={certLoading}>
              {certLoading ? <CircularProgress size={24} /> : "Обновить сертификаты"}
            </Button>
          </Tooltip>
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
                    {c.subjectName} ({c.source})
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
              <ListItem>
                <ListItemText primary="Источник" secondary={certInfo.source} />
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
      {status && certsRequested && <Alert severity={status.startsWith("Успеш") ? "success" : "error"} sx={{ mt: 2 }}>{status}</Alert>}
    </Box>
  );
};

export default EcpAuth; 