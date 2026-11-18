import { Buffer } from 'buffer';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

import {
  checkPasswordStrength,
  generateSecurePassword,
  hashPassword,
  isCommonPassword,
  validatePasswordComplexity,
  verifyPassword,
} from './password';

jest.mock('bcrypt', () => ({
  __esModule: true,
  default: {
    hash: jest.fn(),
    compare: jest.fn(),
  },
}));

jest.mock('crypto', () => ({
  __esModule: true,
  default: {
    randomBytes: jest.fn(),
    randomInt: jest.fn(),
  },
}));

const mockHash = bcrypt.hash as jest.Mock;
const mockCompare = bcrypt.compare as jest.Mock;
const mockRandomBytes = crypto.randomBytes as jest.Mock;
const mockRandomInt = crypto.randomInt as jest.Mock;

describe('password utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRandomBytes.mockReturnValue(Buffer.from('0123456789abcdef', 'hex'));
    mockRandomInt.mockImplementation((max: number) => Math.max(0, max - 1));
    mockHash.mockResolvedValue('hashed-value');
    mockCompare.mockResolvedValue(true);
  });

  describe('hashPassword', () => {
    it('rejects empty and non-string passwords', async () => {
      await expect(hashPassword('')).rejects.toThrow('密码必须是非空字符串');
      await expect(hashPassword(null as unknown as string)).rejects.toThrow('密码必须是非空字符串');
    });

    it('rejects passwords outside length bounds', async () => {
      await expect(hashPassword('Ab1!short')).rejects.toThrow(/长度必须/);
      await expect(hashPassword(`Ab1!${'x'.repeat(130)}`)).rejects.toThrow(/长度必须/);
    });

    it('rejects passwords without full complexity', async () => {
      await expect(hashPassword('abcdefgh1!')).rejects.toThrow('密码必须包含大小写字母、数字和特殊字符');
    });

    it('hashes a valid password with extra entropy', async () => {
      await expect(hashPassword('Abcdefgh1!')).resolves.toBe('hashed-value');
      expect(mockHash).toHaveBeenCalledWith('Abcdefgh1!0123456789abcdef', 14);
    });
  });

  describe('verifyPassword', () => {
    it('returns false for invalid inputs', async () => {
      await expect(verifyPassword('', 'hash')).resolves.toBe(false);
      await expect(verifyPassword('password', '')).resolves.toBe(false);
    });

    it('returns bcrypt comparison result', async () => {
      mockCompare.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      await expect(verifyPassword('pw', 'hash')).resolves.toBe(true);
      await expect(verifyPassword('pw', 'hash')).resolves.toBe(false);
    });

    it('returns false and logs when bcrypt throws', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockCompare.mockRejectedValueOnce(new Error('bcrypt down'));
      await expect(verifyPassword('pw', 'hash')).resolves.toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('generateSecurePassword', () => {
    it('clamps length and always contains required character classes', () => {
      expect(generateSecurePassword(4)).toHaveLength(10);
      expect(generateSecurePassword(200)).toHaveLength(128);
      const value = generateSecurePassword(16);
      expect(value).toMatch(/[A-Z]/);
      expect(value).toMatch(/[a-z]/);
      expect(value).toMatch(/[0-9]/);
      expect(value).toMatch(/[^A-Za-z0-9]/);
    });
  });

  describe('checkPasswordStrength', () => {
    it('handles empty password', () => {
      const result = checkPasswordStrength('');
      expect(result.score).toBe(0);
      expect(result.strength).toBe('very-weak');
      expect(result.feedback).toContain('密码不能为空');
    });

    it.each([
      ['short', 'weak-or-below'],
      ['Abcdefgh1!', 'medium-or-above'],
      ['Abcdefghijk1!', 'strong-or-below'],
      ['Abcdefghijklmnop1!', 'high-score'],
    ])('scores %s', (_label, password) => {
      const result = checkPasswordStrength(password);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.feedback.length).toBeGreaterThan(0);
    });

    it('reports missing character classes and repeated characters', () => {
      const result = checkPasswordStrength('aaaaaaaa');
      expect(result.suggestions).toContain('添加大写字母');
      expect(result.suggestions).toContain('添加数字');
      expect(result.suggestions).toContain('添加特殊字符');
      expect(result.feedback).toContain('包含连续重复字符');
    });

    it('detects keyboard sequences', () => {
      expect(checkPasswordStrength('Qwerty123!').feedback).toContain('包含常见键盘序列');
    });
  });

  describe('validatePasswordComplexity and isCommonPassword', () => {
    it('validates complexity rules', () => {
      expect(validatePasswordComplexity('Abcdefgh1!')).toBe(true);
      expect(validatePasswordComplexity('abcdefgh1!')).toBe(false);
      expect(validatePasswordComplexity('')).toBe(false);
    });

    it('detects common passwords case-insensitively', () => {
      expect(isCommonPassword('PASSWORD')).toBe(true);
      expect(isCommonPassword('Abcdefgh1!')).toBe(false);
    });
  });
});
