import {
  validatePassword,
  sanitizeInput,
  generateCSRFToken,
  secureHeaders,
  rateLimit,
  validateEmail,
  encryptPayload,
  decryptPayload,
  sanitizeErrorMessage
} from '../../utils/security';

describe('Security Utils', () => {
  describe('Password Validation', () => {
    it('validates password requirements correctly', () => {
      // Valid password
      expect(validatePassword('ValidPass123!')).toEqual({ isValid: true });

      // Invalid passwords
      const testCases = [
        { password: 'short1!', error: 'Password must be at least 8 characters long' },
        { password: 'nouppercase123!', error: 'Password must contain at least one uppercase letter' },
        { password: 'NOLOWERCASE123!', error: 'Password must contain at least one lowercase letter' },
        { password: 'NoNumbers!', error: 'Password must contain at least one number' },
        { password: 'NoSpecialChar123', error: 'Password must contain at least one special character' }
      ];

      testCases.forEach(({ password, error }) => {
        expect(validatePassword(password)).toEqual({ isValid: false, error });
      });
    });
  });

  describe('Input Sanitization', () => {
    it('removes dangerous characters and HTML tags', () => {
      const testCases = [
        {
          input: '<script>alert("xss")</script>',
          expected: 'alert("xss")'
        },
        {
          input: 'Normal text with <b>HTML tags</b>',
          expected: 'Normal text with HTML tags'
        },
        {
          input: '   Spaces   ',
          expected: 'Spaces'
        },
        {
          input: '<img src="x" onerror="alert(1)">',
          expected: 'img src="x" onerror="alert(1)"'
        }
      ];

      testCases.forEach(({ input, expected }) => {
        expect(sanitizeInput(input)).toBe(expected);
      });
    });
  });

  describe('CSRF Token Generation', () => {
    it('generates unique tokens of correct length', () => {
      const token1 = generateCSRFToken();
      const token2 = generateCSRFToken();

      expect(token1).toHaveLength(64); // 32 bytes in hex = 64 characters
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2);
    });
  });

  describe('Secure Headers', () => {
    it('contains all required security headers', () => {
      expect(secureHeaders).toEqual({
        'Content-Security-Policy': expect.any(String),
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
      });
    });

    it('has correct CSP directives', () => {
      const csp = secureHeaders['Content-Security-Policy'];
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      // Reset rate limit for each test
      rateLimit.resetLimit('test-key');
    });

    it('allows requests within limit', () => {
      const results = Array(5).fill(null)
        .map(() => rateLimit.checkLimit('test-key'));
      
      expect(results.every(result => result === true)).toBe(true);
    });

    it('blocks requests after limit exceeded', () => {
      // Use up all attempts
      Array(5).fill(null).forEach(() => rateLimit.checkLimit('test-key'));
      
      // Next attempt should be blocked
      expect(rateLimit.checkLimit('test-key')).toBe(false);
    });

    it('resets limit after window expires', () => {
      jest.useFakeTimers();
      
      // Use up all attempts
      Array(5).fill(null).forEach(() => rateLimit.checkLimit('test-key'));
      expect(rateLimit.checkLimit('test-key')).toBe(false);

      // Advance time by 15 minutes
      jest.advanceTimersByTime(15 * 60 * 1000);

      // Should be allowed again
      expect(rateLimit.checkLimit('test-key')).toBe(true);

      jest.useRealTimers();
    });
  });

  describe('Email Validation', () => {
    it('validates email formats correctly', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.com'
      ];

      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user@.com',
        'user@domain.'
      ];

      validEmails.forEach(email => {
        expect(validateEmail(email)).toBe(true);
      });

      invalidEmails.forEach(email => {
        expect(validateEmail(email)).toBe(false);
      });
    });
  });

  describe('Payload Encryption/Decryption', () => {
    const testKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const testPayload = {
      userId: 123,
      email: 'test@example.com',
      timestamp: Date.now()
    };

    it('successfully encrypts and decrypts payload', () => {
      const encrypted = encryptPayload(testPayload, testKey);
      const decrypted = decryptPayload(encrypted, testKey);

      expect(decrypted).toEqual(testPayload);
    });

    it('produces different ciphertexts for same payload', () => {
      const encrypted1 = encryptPayload(testPayload, testKey);
      const encrypted2 = encryptPayload(testPayload, testKey);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('throws error on invalid decryption', () => {
      const encrypted = encryptPayload(testPayload, testKey);
      const wrongKey = 'f'.repeat(64);

      expect(() => decryptPayload(encrypted, wrongKey)).toThrow();
    });
  });

  describe('Error Message Sanitization', () => {
    it('removes sensitive information from error messages', () => {
      const testCases = [
        {
          input: 'Invalid password for user@example.com',
          expected: 'Invalid [REDACTED] for user@example.com'
        },
        {
          input: 'Authentication token expired',
          expected: '[REDACTED] expired'
        },
        {
          input: 'API key not found',
          expected: 'API [REDACTED] not found'
        },
        {
          input: 'Invalid credentials provided',
          expected: 'Invalid [REDACTED] provided'
        }
      ];

      testCases.forEach(({ input, expected }) => {
        expect(sanitizeErrorMessage(input)).toBe(expected);
      });
    });

    it('preserves non-sensitive error messages', () => {
      const message = 'Network connection failed';
      expect(sanitizeErrorMessage(message)).toBe(message);
    });
  });
});
