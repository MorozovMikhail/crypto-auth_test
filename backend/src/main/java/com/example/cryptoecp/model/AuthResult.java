package com.example.cryptoecp.model;

public class AuthResult {
    private boolean success;
    private String message;
    public AuthResult() {}
    public AuthResult(boolean success, String message) {
        this.success = success;
        this.message = message;
    }
    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
} 