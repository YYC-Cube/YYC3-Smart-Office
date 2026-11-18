import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { validateCsrfToken } from '@/lib/csrf';
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

const mockNextResponseJson = jest.requireMock('next/server').NextResponse.json as jest.Mock;
const mockValidateCsrfToken = validateCsrfToken as jest.Mock;

function makeRequest(
  method: string,
  body: unknown = {},
  url = 'http://localhost/api/test',
): NextRequest {
  return {
    method,
    url,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as NextRequest;
}

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
    mockValidateCsrfToken.mockReturnValue(true);
  });

  test('rejects unsupported methods', async () => {
    const handler = jest.fn();
    const wrapped = withApiHandler(handler as never, { method: 'POST' });
    const response = await wrapped(makeRequest('GET'));
    expect(response.status).toBe(405);
    expect(handler).not.toHaveBeenCalled();
  });

  test('handles OPTIONS preflight', async () => {
    const wrapped = withApiHandler(jest.fn() as never);
    const response = await wrapped(makeRequest('OPTIONS'));
    expect(response.status).toBe(200);
  });

  test('handles invalid JSON body', async () => {
    const request = makeRequest('POST');
    (request.json as jest.Mock).mockRejectedValueOnce(new Error('bad json'));
    const wrapped = withApiHandler(jest.fn() as never);
    const response = await wrapped(request);
    expect(response.status).toBe(400);
  });

  test('rejects invalid CSRF token', async () => {
    mockValidateCsrfToken.mockReturnValue(false);
    const wrapped = withApiHandler(jest.fn() as never, { validateCsrf: true });
    const response = await wrapped(makeRequest('POST', { csrfToken: 'bad', name: 'ok' }));
    expect(response.status).toBe(403);
  });

  test('accepts valid CSRF token', async () => {
    const handler = jest.fn().mockResolvedValue({ status: 200, json: () => ({}) });
    const wrapped = withApiHandler(handler as never, { validateCsrf: true });
    await wrapped(makeRequest('POST', { csrfToken: 'good', name: 'ok' }));
    expect(mockValidateCsrfToken).toHaveBeenCalledWith('good');
    expect(handler).toHaveBeenCalled();
  });

  test('returns 400 for schema validation failure', async () => {
    const handler = jest.fn();
    const wrapped = withApiHandler(handler as never, { schema });
    const response = await wrapped(makeRequest('POST', { name: 'x' }));
    expect(response.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });

  test('passes parsed schema data to handler', async () => {
    const handler = jest.fn().mockResolvedValue({ status: 200, json: () => ({}) });
    const wrapped = withApiHandler(handler as never, { schema });
    await wrapped(makeRequest('POST', { name: 'valid' }));
    expect(handler).toHaveBeenCalledWith(expect.anything(), { name: 'valid' });
  });

  test('passes raw body when no schema is configured', async () => {
    const handler = jest.fn().mockResolvedValue({ status: 200, json: () => ({}) });
    const wrapped = withApiHandler(handler as never);
    await wrapped(makeRequest('POST', { any: 'value' }));
    expect(handler).toHaveBeenCalledWith(expect.anything(), { any: 'value' });
  });

  test('reads GET query parameters', async () => {
    const handler = jest.fn().mockResolvedValue({ status: 200, json: () => ({}) });
    const wrapped = withApiHandler(handler as never);
    await wrapped(makeRequest('GET', undefined, 'http://localhost/api/test?q=abc'));
    expect(handler).toHaveBeenCalledWith(expect.anything(), { q: 'abc' });
  });

  test('maps ApiError status and message', async () => {
    const handler = jest.fn().mockRejectedValue(new ApiError('forbidden', 403));
    const wrapped = withApiHandler(handler as never);
    const response = await wrapped(makeRequest('POST'));
    expect(response.status).toBe(403);
  });

  test('maps unknown errors to 500', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const handler = jest.fn().mockRejectedValue(new Error('boom'));
    const wrapped = withApiHandler(handler as never);
    const response = await wrapped(makeRequest('POST'));
    expect(response.status).toBe(500);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
