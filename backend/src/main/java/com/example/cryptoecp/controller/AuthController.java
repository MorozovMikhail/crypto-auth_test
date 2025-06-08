package com.example.cryptoecp.controller;

import com.example.cryptoecp.model.*;
import com.example.cryptoecp.service.GostSignatureVerifier;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.bouncycastle.cert.X509CertificateHolder;
import org.bouncycastle.util.encoders.Base64;

import java.util.*;
import java.util.concurrent.*;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {
    private final Map<String, ChallengeData> challenges = new ConcurrentHashMap<>();
    // Пример базы пользователей (в реальном проекте можно использовать БД)
    private final Set<String> validEmails = Set.of("user@example.com");

    @GetMapping("/challenge")
    public ResponseEntity<ChallengeResponse> getChallenge(@RequestParam String sessionId) {
        String challenge = UUID.randomUUID() + "-" + System.currentTimeMillis();
        challenges.put(sessionId, new ChallengeData(challenge, System.currentTimeMillis()));
        return ResponseEntity.ok(new ChallengeResponse(challenge));
    }

    @PostMapping("/verify")
    public ResponseEntity<AuthResult> verifySignature(@RequestBody VerifyRequest request) {
        ChallengeData data = challenges.get(request.getSessionId());
        if (data == null || System.currentTimeMillis() - data.timestamp > 2 * 60 * 1000) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new AuthResult(false, "Challenge expired"));
        }
        boolean valid = GostSignatureVerifier.verify(request.getChallenge(), request.getSignature(), request.getCertificate());
        if (!valid) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new AuthResult(false, "Invalid signature"));
        }
        // Извлекаем email из сертификата и проверяем его
        try {
            byte[] certBytes = Base64.decode(request.getCertificate());
            X509CertificateHolder certHolder = new X509CertificateHolder(certBytes);
            String email = GostSignatureVerifier.extractEmail(certHolder);
            if (email == null || !validEmails.contains(email)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new AuthResult(false, "User not found"));
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new AuthResult(false, "Invalid certificate"));
        }
        return ResponseEntity.ok(new AuthResult(true, "Success"));
    }

    private static class ChallengeData {
        String challenge;
        long timestamp;
        ChallengeData(String challenge, long timestamp) {
            this.challenge = challenge;
            this.timestamp = timestamp;
        }
    }
} 