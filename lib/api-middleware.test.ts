import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { validateCsrfToken } from '@/lib/csrf';
import { verifyToken } from './auth';
import { ApiError, createApiResponse, withApiHandler } from './api-middleware';

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, options) => ({
      ...options,
      json: () => data,
    })),
  },
}));

jest.mock('@/lib/csrf', () => ({
  validateCsrfToken: jest.fn(),
}));

jest.mock('./auth', () => ({
  verifyToken: jest.fn(),
}));

const mockNextResponseJson = jest.requireMock('next/server').NextResponse.json as jest.Mock;
const mockValidateCsrfToken = validateCsrfToken as jest.Mock;
const mockVerifyToken = verifyToken as jest.Mock;

interface RequestOptions {
  token?: string;
  cookieToken?: string;
  csrfHeader?: string;
}

function makeRequest(
  method: string,
  body: unknown = {},
  url = 'http://localhost/api/test',
  options: RequestOptions = {},
): NextRequest {
  return {
    method,
    url,
    json: jest.fn().mockResolvedValue(body),
    headers: {
      get: (name: string) => {
        const key = name.toLowerCase();
        if (key === 'authorization') return options.token ? `Bearer ${options.token}` : null;
        if (key === 'x-csrf-token') return options.csrfHeader ?? null;
        return null;
      },
    },
    cookies: {
      get: (name: string) => (
        name === 'auth_token' && options.cookieToken ? { value: options.cookieToken } : undefined
      ),
    },
  } as unknown as NextRequest;
}

const okHandler = () => jest.fn().mockResolvedValue({ status: 200, json: () => ({}) });

describe('ApiError', () => {
  test('creates ApiError with default properties', () => {
    const error = new ApiError('Test error', 500);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Test error');
    expect(error.status).toBe(500);
  });

  test('creates ApiError with custom properties', () => {
    const errors = { username: 'Invalid username' };
    const error = new ApiError('Validation failed', 400, errors);
    expect(error.errors).toEqual(errors);
  });
});

describe('createApiResponse', () => {
  beforeEach(() => mockNextResponseJson.mockClear());

  test('uses success defaults', () => {
    createApiResponse({ id: 1 });
    expect(mockNextResponseJson).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: '操作成功', data: { id: 1 } }),
      { status: 200 },
    );
  });

  test('uses failure message for error status without explicit message', () => {
    createApiResponse(null, { status: 500 });
    expect(mockNextResponseJson).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: '操作失败' }),
      { status: 500 },
    );
  });

  test('honors explicit message and status', () => {
    createApiResponse(null, { status: 404, message: '未找到' });
    expect(mockNextResponseJson).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: '未找到' }),
      { status: 404 },
    );
  });
});

describe('withApiHandler', () => {
  const schema = z.object({ name: z.string().min(2) });

  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateCsrfToken.mockResolvedValue(true);
  });

  test('rejects unsupported methods', async () => {
    const handler = okHandler();
    const response = await withApiHandler(handler as never, { method: 'POST' })(makeRequest('GET'));
    expect(response.status).toBe(405);
    expect(handler).not.toHaveBeenCalled();
  });

  test('handles OPTIONS preflight without auth', async () => {
    const response = await withApiHandler(okHandler() as never, { requireAuth: true })(makeRequest('OPTIONS'));
    expect(response.status).toBe(200);
  });

  test('handles invalid JSON body', async () => {
    const request = makeRequest('POST');
    (request.json as jest.Mock).mockRejectedValueOnce(new Error('bad json'));
    const response = await withApiHandler(okHandler() as never)(request);
    expect(response.status).toBe(400);
  });

  test('awaits CSRF validation from body token', async () => {
    mockValidateCsrfToken.mockResolvedValue(false);
    const response = await withApiHandler(okHandler() as never, { validateCsrf: true })(
      makeRequest('POST', { csrfToken: 'bad', name: 'ok' }),
    );
    expect(response.status).toBe(403);
    expect(mockValidateCsrfToken).toHaveBeenCalledWith('bad');
  });

  test('accepts CSRF token from request header', async () => {
    const handler = okHandler();
    await withApiHandler(handler as never, { validateCsrf: true })(
      makeRequest('POST', { name: 'ok' }, 'http://localhost/api/test', { csrfHeader: 'header-token' }),
    );
    expect(mockValidateCsrfToken).toHaveBeenCalledWith('header-token');
    expect(handler).toHaveBeenCalled();
  });

  test('rejects request without CSRF token', async () => {
    const response = await withApiHandler(okHandler() as never, { validateCsrf: true })(makeRequest('POST', {}));
    expect(response.status).toBe(403);
    expect(mockValidateCsrfToken).not.toHaveBeenCalled();
  });

  test('returns 400 for schema validation failure', async () => {
    const handler = okHandler();
    const response = await withApiHandler(handler as never, { schema })(makeRequest('POST', { name: 'x' }));
    expect(response.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });

  test('passes parsed schema data to handler', async () => {
    const handler = okHandler();
    await withApiHandler(handler as never, { schema })(makeRequest('POST', { name: 'valid' }));
    expect(handler).toHaveBeenCalledWith(expect.anything(), { name: 'valid' });
  });

  test('passes raw body when no schema is configured', async () => {
    const handler = okHandler();
    await withApiHandler(handler as never)(makeRequest('POST', { any: 'value' }));
    expect(handler).toHaveBeenCalledWith(expect.anything(), { any: 'value' });
  });

  test('reads GET query parameters', async () => {
    const handler = okHandler();
    await withApiHandler(handler as never)(makeRequest('GET', undefined, 'http://localhost/api/test?q=abc'));
    expect(handler).toHaveBeenCalledWith(expect.anything(), { q: 'abc' });
  });

  test('rejects requireAuth without token', async () => {
    const response = await withApiHandler(okHandler() as never, { requireAuth: true })(makeRequest('GET'));
    expect(response.status).toBe(401);
  });

  test('rejects requireAuth with invalid token', async () => {
    mockVerifyToken.mockImplementationOnce(() => { throw new Error('invalid'); });
    const response = await withApiHandler(okHandler() as never, { requireAuth: true })(
      makeRequest('GET', undefined, 'http://localhost/api/test', { token: 'bad-token' }),
    );
    expect(response.status).toBe(401);
  });

  test('attaches verified user for requireAuth', async () => {
    const user = { id: '1', username: 'tester', role: 'user' };
    mockVerifyToken.mockReturnValue(user);
    const handler = okHandler();
    await withApiHandler(handler as never, { requireAuth: true })(
      makeRequest('GET', undefined, 'http://localhost/api/test', { cookieToken: 'cookie-token' }),
    );
    expect(mockVerifyToken).toHaveBeenCalledWith('cookie-token');
    expect((handler.mock.calls[0][0] as { user?: unknown }).user).toBe(user);
  });

  test('maps ApiError status and message', async () => {
    const handler = jest.fn().mockRejectedValue(new ApiError('forbidden', 403));
    const response = await withApiHandler(handler as never)(makeRequest('POST'));
    expect(response.status).toBe(403);
  });

  test('maps unknown errors to 500', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const handler = jest.fn().mockRejectedValue(new Error('boom'));
    const response = await withApiHandler(handler as never)(makeRequest('POST'));
    expect(response.status).toBe(500);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
