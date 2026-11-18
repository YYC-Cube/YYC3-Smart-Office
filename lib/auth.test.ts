import { Buffer } from 'buffer';
import crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

import { env } from './env';
import {
  generateSecureToken,
  generateToken,
  getTokenFromRequest,
  refreshToken,
  verifyToken,
} from './auth';

jest.mock('./env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-key',
  },
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

jest.mock('crypto', () => ({
  randomBytes: jest.fn(),
}));

const mockSign = jwt.sign as jest.Mock;
const mockVerify = jwt.verify as jest.Mock;
const mockRandomBytes = crypto.randomBytes as jest.Mock;

const payload = {
  id: '1',
  username: 'tester',
  email: 'tester@example.com',
  role: 'user',
  isActive: true,
};

describe('auth utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    env.JWT_SECRET = 'test-jwt-secret-key';
    mockRandomBytes.mockReturnValue(Buffer.from('0123456789abcdef'));
  });

  describe('getJwtSecret and generateToken', () => {
    it('throws when JWT_SECRET is not configured', () => {
      env.JWT_SECRET = '';
      expect(() => generateToken(payload)).toThrow('JWT_SECRET is not configured');
    });

    it('signs token with configured secret and expiry', () => {
      mockSign.mockReturnValue('signed-token');
      expect(generateToken(payload, '1h')).toBe('signed-token');
      expect(mockSign).toHaveBeenCalledWith(payload, 'test-jwt-secret-key', { expiresIn: '1h' });
    });
  });

  describe('verifyToken', () => {
    it('returns decoded payload', () => {
      mockVerify.mockReturnValue({ ...payload, iat: 1, exp: 2 });
      expect(verifyToken('token').username).toBe('tester');
    });

    it('maps expired and invalid token errors', () => {
      const expired = new Error('expired');
      expired.name = 'TokenExpiredError';
      mockVerify.mockImplementationOnce(() => { throw expired; });
      expect(() => verifyToken('token')).toThrow('Token expired');

      const invalid = new Error('invalid');
      invalid.name = 'JsonWebTokenError';
      mockVerify.mockImplementationOnce(() => { throw invalid; });
      expect(() => verifyToken('token')).toThrow('Invalid token');
    });

    it('rethrows unknown Error and wraps non-Error', () => {
      mockVerify.mockImplementationOnce(() => { throw new Error('boom'); });
      expect(() => verifyToken('token')).toThrow('boom');

      mockVerify.mockImplementationOnce(() => { throw 'bad'; });
      expect(() => verifyToken('token')).toThrow('Failed to verify token');
    });
  });

  describe('refreshToken', () => {
    it('re-signs decoded payload', () => {
      mockVerify.mockReturnValue({ ...payload, iat: 1, exp: 2 });
      mockSign.mockReturnValue('refreshed-token');
      expect(refreshToken('old-token')).toBe('refreshed-token');
      expect(mockSign).toHaveBeenCalledWith(payload, 'test-jwt-secret-key', { expiresIn: '24h' });
    });

    it('wraps refresh failures', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockVerify.mockImplementationOnce(() => { throw new Error('bad token'); });
      expect(() => refreshToken('old-token')).toThrow('Failed to refresh token');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getTokenFromRequest', () => {
    it('prefers Authorization Bearer token', () => {
      expect(getTokenFromRequest({
        headers: { authorization: 'Bearer abc' },
        cookies: { auth_token: 'cookie-token' },
      })).toBe('abc');
    });

    it('falls back to cookie and null', () => {
      expect(getTokenFromRequest({ cookies: { auth_token: 'cookie-token' } })).toBe('cookie-token');
      expect(getTokenFromRequest({})).toBeNull();
    });
  });

  describe('generateSecureToken', () => {
    it('generates hex token with requested length', () => {
      expect(generateSecureToken(16)).toHaveLength(16);
      expect(mockRandomBytes).toHaveBeenCalledWith(8);
    });
  });
});
