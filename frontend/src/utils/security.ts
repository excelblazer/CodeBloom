import crypto from 'crypto';

export const validatePassword = (password: string): { isValid: boolean; error?: string } => {
  if (password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters long' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one number' };
  }
  if (!/[!@#$%^&*]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one special character (!@#$%^&*)' };
  }
  return { isValid: true };
};

export const sanitizeInput = (input: string): string => {
  // Remove any potentially dangerous characters or scripts
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>]/g, '') // Remove < and >
    .trim();
};

export const generateCSRFToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const secureHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
};

export const rateLimit = (() => {
  const attempts = new Map<string, { count: number; resetTime: number }>();
  const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  const MAX_ATTEMPTS = 5;

  return {
    checkLimit: (key: string): boolean => {
      const now = Date.now();
      const attempt = attempts.get(key);

      if (!attempt) {
        attempts.set(key, { count: 1, resetTime: now + WINDOW_MS });
        return true;
      }

      if (now > attempt.resetTime) {
        attempts.set(key, { count: 1, resetTime: now + WINDOW_MS });
        return true;
      }

      if (attempt.count >= MAX_ATTEMPTS) {
        return false;
      }

      attempt.count++;
      return true;
    },
    resetLimit: (key: string): void => {
      attempts.delete(key);
    }
  };
})();

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

export const encryptPayload = (payload: any, key: string): string => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  
  let encrypted = cipher.update(JSON.stringify(payload), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return JSON.stringify({
    iv: iv.toString('hex'),
    encryptedData: encrypted,
    authTag: authTag.toString('hex')
  });
};

export const decryptPayload = (encryptedPayload: string, key: string): any => {
  const { iv, encryptedData, authTag } = JSON.parse(encryptedPayload);
  
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(key, 'hex'),
    Buffer.from(iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return JSON.parse(decrypted);
};

export const sanitizeErrorMessage = (error: string): string => {
  // Remove any sensitive information from error messages
  const sensitivePatterns = [
    /password/i,
    /token/i,
    /key/i,
    /secret/i,
    /credential/i,
    /auth/i
  ];

  let sanitizedError = error;
  sensitivePatterns.forEach(pattern => {
    sanitizedError = sanitizedError.replace(pattern, '[REDACTED]');
  });

  return sanitizedError;
};
