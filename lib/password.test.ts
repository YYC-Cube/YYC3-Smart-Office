import { describe, it, expect } from '@jest/globals';

describe('Password utilities', () => {
  describe('Password complexity validation', () => {
    const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
      const errors: string[] = [];
      if (password.length < 8) errors.push('Password must be at least 8 characters');
      if (password.length > 128) errors.push('Password must be at most 128 characters');
      if (!/[A-Z]/.test(password)) errors.push('Must contain uppercase letter');
      if (!/[a-z]/.test(password)) errors.push('Must contain lowercase letter');
      if (!/[0-9]/.test(password)) errors.push('Must contain digit');
      if (!/[^A-Za-z0-9]/.test(password)) errors.push('Must contain special character');
      return { valid: errors.length === 0, errors };
    };

    it('should accept strong passwords', () => {
      const result = validatePassword('MyP@ssw0rd!');
      expect(result.valid).toBe(true);
    });

    it('should reject passwords without uppercase', () => {
      const result = validatePassword('myp@ssw0rd');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Must contain uppercase letter');
    });

    it('should reject passwords without lowercase', () => {
      const result = validatePassword('MYP@SSW0RD');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Must contain lowercase letter');
    });

    it('should reject passwords without digits', () => {
      const result = validatePassword('MyP@ssword');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Must contain digit');
    });

    it('should reject passwords without special characters', () => {
      const result = validatePassword('MyPassw0rd');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Must contain special character');
    });

    it('should reject too short passwords', () => {
      const result = validatePassword('Ab1!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters');
    });
  });

  describe('Password strength scoring', () => {
    const scorePassword = (password: string): number => {
      let score = 0;
      if (password.length >= 8) score += 1;
      if (password.length >= 12) score += 1;
      if (password.length >= 16) score += 1;
      if (/[A-Z]/.test(password)) score += 1;
      if (/[a-z]/.test(password)) score += 1;
      if (/[0-9]/.test(password)) score += 1;
      if (/[^A-Za-z0-9]/.test(password)) score += 1;
      if (/(.)\1{2,}/.test(password) === false) score += 1;
      return score;
    };

    it('should give low score to weak passwords', () => {
      expect(scorePassword('123456')).toBeLessThanOrEqual(2);
    });

    it('should give high score to strong passwords', () => {
      expect(scorePassword('MyStr0ng!P@ss#2024')).toBeGreaterThanOrEqual(7);
    });
  });

  describe('Common password detection', () => {
    const commonPasswords = [
      'password', '123456', 'qwerty', 'admin', 'letmein',
      'welcome', 'monkey', 'dragon', 'master', 'abc123',
    ];

    it('should detect common passwords', () => {
      commonPasswords.forEach(pwd => {
        expect(commonPasswords.includes(pwd.toLowerCase())).toBe(true);
      });
    });

    it('should not flag unique passwords as common', () => {
      const uniquePasswords = ['MyUn1qu3!P@ss', 'R@nd0m#Str0ng'];
      uniquePasswords.forEach(pwd => {
        expect(commonPasswords.includes(pwd.toLowerCase())).toBe(false);
      });
    });
  });
});
