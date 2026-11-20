import fs from 'fs';

import { Logger, redactLogData } from './logger';
import { LogType } from '../models/log';

jest.mock('fs', () => ({
  __esModule: true,
  default: {
    existsSync: jest.fn(() => true),
    mkdirSync: jest.fn(),
    appendFileSync: jest.fn(),
  },
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  appendFileSync: jest.fn(),
}));

jest.mock('./db', () => {
  const values = jest.fn();
  const insert = jest.fn(() => ({ values }));
  return { db: { insert }, __mockValues: values };
});

const mockDb = jest.requireMock('./db') as {
  __mockValues: jest.Mock;
  db: { insert: jest.Mock };
};
const mockValues = mockDb.__mockValues;
const appendFileSync = fs.appendFileSync as jest.Mock;

describe('log redaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValues.mockResolvedValue(undefined);
  });

  it('redacts sensitive keys in nested objects and arrays', () => {
    const result = redactLogData({
      password: 'secret-pw',
      nested: { csrfToken: 'csrf-secret-value' },
      list: [{ apiKey: 'sk-abcdefghijklmnop' }],
      ip: '192.168.1.24',
      safe: 'ok',
    }) as Record<string, unknown>;

    expect(result.password).toBe('[REDACTED]');
    expect((result.nested as Record<string, unknown>).csrfToken).toBe('[REDACTED]');
    expect(((result.list as unknown[])[0] as Record<string, unknown>).apiKey).toBe('[REDACTED]');
    expect(result.ip).toBe('192.168.1.***');
    expect(result.safe).toBe('ok');
  });

  it('redacts token patterns, provider keys, DB URLs, inline secrets and IPs in strings', () => {
    const value = [
      'Authorization: Bearer abcdef123456',
      'token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signaturevalue',
      'key sk-abcdefghijklmnopqrstuvwx',
      'postgresql://postgres:weakpass@localhost:5432/yyc',
      '10.20.30.40',
    ].join(' | ');
    const result = redactLogData(value) as string;

    expect(result).not.toContain('abcdef123456');
    expect(result).not.toContain('signaturevalue');
    expect(result).not.toContain('sk-abcdefghijklmnopqrstuvwx');
    expect(result).not.toContain('weakpass');
    expect(result).not.toContain('eyJhbGci');
    expect(result).toContain('10.20.30.***');
  });

  it('handles circular references and Error objects', () => {
    const circular: Record<string, unknown> = { name: 'node' };
    circular.self = circular;
    const result = redactLogData(circular) as Record<string, unknown>;
    expect(result.self).toBe('[CIRCULAR]');

    const errorResult = redactLogData(new Error('password=secret-value')) as Record<string, unknown>;
    expect(errorResult.name).toBe('Error');
    expect(errorResult.message).not.toContain('secret-value');
  });

  it('writes redacted data to file and database', async () => {
    await Logger.info(LogType.AUTH, 'login attempt', {
      password: 'plain-password',
      csrfToken: 'plain-token',
      ip: '203.0.113.9',
    });

    const fileContent = appendFileSync.mock.calls[0][1] as string;
    expect(fileContent).toContain('[REDACTED]');
    expect(fileContent).not.toContain('plain-password');
    expect(fileContent).toContain('203.0.113.***');

    const dbPayload = mockValues.mock.calls[0][0] as { details: string };
    expect(dbPayload.details).toContain('[REDACTED]');
    expect(dbPayload.details).not.toContain('plain-token');
  });

  it('falls back to redacted file log when DB write fails', async () => {
    mockValues.mockRejectedValueOnce(new Error('db down'));
    await Logger.warn(LogType.SYSTEM, 'db failure', {
      password: 'fallback-secret',
    });

    const fileContent = appendFileSync.mock.calls.at(-1)?.[1] as string;
    expect(fileContent).toContain('DB write failed');
    expect(fileContent).toContain('[REDACTED]');
    expect(fileContent).not.toContain('fallback-secret');
  });
});
