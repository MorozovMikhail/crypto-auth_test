package com.example.cryptoecp.service;

import org.bouncycastle.cert.X509CertificateHolder;
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter;
import org.bouncycastle.cms.*;
import org.bouncycastle.cms.jcajce.JcaSimpleSignerInfoVerifierBuilder;
import org.bouncycastle.operator.ContentVerifierProvider;
import org.bouncycastle.operator.jcajce.JcaContentVerifierProviderBuilder;
import org.bouncycastle.util.Store;
import org.bouncycastle.util.encoders.Base64;

import java.security.cert.X509Certificate;
import java.util.Collection;
import java.util.Iterator;

public class GostSignatureVerifier {
    public static boolean verify(String data, String signature, String certificate) {
        try {
            // Декодируем подпись и сертификат из Base64
            byte[] signatureBytes = Base64.decode(signature);
            byte[] certBytes = Base64.decode(certificate);
            
            // Создаем объект сертификата
            X509CertificateHolder certHolder = new X509CertificateHolder(certBytes);
            X509Certificate cert = new JcaX509CertificateConverter().getCertificate(certHolder);
            
            // Создаем CMS SignedData
            CMSSignedData signedData = new CMSSignedData(signatureBytes);
            
            // Получаем хранилище сертификатов
            Store certStore = signedData.getCertificates();
            
            // Получаем информацию о подписи
            SignerInformationStore signers = signedData.getSignerInfos();
            Collection<SignerInformation> c = signers.getSigners();
            Iterator<SignerInformation> it = c.iterator();
            
            if (it.hasNext()) {
                SignerInformation signer = it.next();
                
                // Создаем верификатор подписи
                JcaSimpleSignerInfoVerifierBuilder verifierBuilder = new JcaSimpleSignerInfoVerifierBuilder();
                SignerInformationVerifier verifier = verifierBuilder.build(cert);
                
                // Проверяем подпись
                return signer.verify(verifier);
            }
            
            return false;
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }

    public static String extractEmail(X509CertificateHolder certHolder) {
        try {
            String dn = certHolder.getSubject().toString();
            // Ищем email в DN
            int emailIndex = dn.indexOf("EMAILADDRESS=");
            if (emailIndex != -1) {
                int startIndex = emailIndex + 12;
                int endIndex = dn.indexOf(",", startIndex);
                if (endIndex == -1) {
                    endIndex = dn.length();
                }
                return dn.substring(startIndex, endIndex);
            }
            return null;
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }
} 