import React, { useState } from "react";
import { Button, Typography, Box, CircularProgress, Alert, MenuItem, Select, FormControl, InputLabel } from "@mui/material";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8080/api/auth";

const EcpAuth = () => {
  const [challenge, setChallenge] = useState("");
  const [certs, setCerts] = useState([]);
  const [selectedCertIdx, setSelectedCertIdx] = useState("");
  const [loading, setLoading] = useState(false);
  const [certsLoading, setCertsLoading] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  // Получить challenge с backend
  const getChallenge = async () => {
    setError("");
    setStatus("");
    setChallenge("");
    setSelectedCertIdx("");
    setCerts([]);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/challenge?sessionId=${Math.random().toString(36).substring(2)}`);
      const data = await res.json();
      setChallenge(data.challenge);
      setStatus("Challenge получен");
    } catch (e) {
      setError("Ошибка получения challenge: " + (e.message || e.toString()));
    }
    setLoading(false);
  };

  // Получить сертификаты с токена (только через window.cadesplugin)
  const loadCerts = async () => {
    setError("");
    setStatus("");
    setCerts([]);
    setSelectedCertIdx("");
    setCertsLoading(true);
    try {
      await window.cadesplugin;
      const allCerts = [];
      // 1. Контейнеры Windows (личное хранилище)
      const store1 = await window.cadesplugin.CreateObjectAsync("CAdESCOM.Store");
      await store1.Open(window.cadesplugin.CADESCOM_CURRENT_USER_STORE, "My", 0);
      const certs1 = await store1.Certificates;
      const count1 = await certs1.Count;
      for (let i = 1; i <= count1; i++) {
        const cert = await certs1.Item(i);
        allCerts.push({
          subject: await cert.SubjectName,
          issuer: await cert.IssuerName,
          thumbprint: await cert.Thumbprint,
          validTo: new Date(await cert.ValidToDate).toLocaleDateString(),
          certObj: cert,
          source: 'Контейнер Windows'
        });
      }
      await store1.Close();
      // 2. Токен/смарт-карта
      const store2 = await window.cadesplugin.CreateObjectAsync("CAdESCOM.Store");
      await store2.Open(window.cadesplugin.CADESCOM_SMART_CARD_USER_STORE, "My", 0);
      const certs2 = await store2.Certificates;
      const count2 = await certs2.Count;
      for (let i = 1; i <= count2; i++) {
        const cert = await certs2.Item(i);
        allCerts.push({
          subject: await cert.SubjectName,
          issuer: await cert.IssuerName,
          thumbprint: await cert.Thumbprint,
          validTo: new Date(await cert.ValidToDate).toLocaleDateString(),
          certObj: cert,
          source: 'Токен/смарт-карта'
        });
      }
      await store2.Close();
      if (allCerts.length === 0) throw new Error("Сертификаты не найдены");
      setCerts(allCerts);
      setStatus("Сертификаты получены");
    } catch (e) {
      setError(e.message || "Ошибка получения сертификатов");
    }
    setCertsLoading(false);
  };

  // Подписать challenge выбранным сертификатом и отправить на backend
  const signAndAuth = async () => {
    setError("");
    setStatus("");
    setSigning(true);
    try {
      if (!challenge) throw new Error("Сначала получите challenge");
      if (selectedCertIdx === "") throw new Error("Выберите сертификат");
      const cert = certs[selectedCertIdx].certObj;
      // Подпись challenge
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
      // Отправка подписи на backend
      const res = await fetch(`${API_URL}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge, signature, certificate: certBase64 })
      });
      const result = await res.json();
      if (result.success) {
        setStatus("Успешная авторизация!");
      } else {
        setError("Ошибка авторизации: " + (result.message || ""));
      }
    } catch (e) {
      let msg = e.message || e.toString();
      if (msg.includes('0x80070057') || msg.includes('Параметр задан неверно')) {
        msg = 'Выбранный сертификат не подходит для подписи. Пожалуйста, выберите сертификат с токена/смарт-карты, предназначенный для ЭЦП.';
      }
      setError("Ошибка при подписании/авторизации: " + msg);
    }
    setSigning(false);
  };

  return (
    <Box sx={{ maxWidth: 600, mx: "auto", mt: 8, p: 4, boxShadow: 3, borderRadius: 2 }}>
      <Typography variant="h5" gutterBottom>Авторизация с помощью ЭЦП</Typography>
      <Button variant="contained" fullWidth onClick={getChallenge} disabled={loading} sx={{ mb: 2 }}>
        {loading ? <CircularProgress size={24} /> : "Получить challenge"}
      </Button>
      {challenge && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>Challenge: {challenge}</Typography>
        </Box>
      )}
      <Button variant="outlined" fullWidth onClick={loadCerts} disabled={certsLoading} sx={{ mb: 2 }}>
        {certsLoading ? <CircularProgress size={24} /> : "Получить сертификаты"}
      </Button>
      {certs.length > 0 && (
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel id="cert-select-label">Выберите сертификат</InputLabel>
          <Select
            labelId="cert-select-label"
            value={selectedCertIdx}
            label="Выберите сертификат"
            onChange={e => setSelectedCertIdx(e.target.value)}
          >
            {certs.map((cert, idx) => (
              <MenuItem value={idx} key={idx}>
                {cert.subject} (до {cert.validTo}) — {cert.source}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
      {selectedCertIdx !== "" && certs[selectedCertIdx] && (
        <Box sx={{ mb: 2, bgcolor: '#f5f5f5', borderRadius: 1, p: 2 }}>
          <div><b>Субъект:</b> {certs[selectedCertIdx].subject}</div>
          <div><b>Издатель:</b> {certs[selectedCertIdx].issuer}</div>
          <div><b>Отпечаток:</b> {certs[selectedCertIdx].thumbprint}</div>
          <div><b>Действует до:</b> {certs[selectedCertIdx].validTo}</div>
          <div><b>Источник:</b> {certs[selectedCertIdx].source}</div>
        </Box>
      )}
      <Button
        variant="contained"
        color="success"
        fullWidth
        onClick={signAndAuth}
        disabled={signing || !challenge || selectedCertIdx === ""}
        sx={{ mb: 2 }}
      >
        {signing ? <CircularProgress size={24} /> : "Подписать и войти"}
      </Button>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {status && <Alert severity="success" sx={{ mb: 2 }}>{status}</Alert>}
    </Box>
  );
};

export default EcpAuth; 