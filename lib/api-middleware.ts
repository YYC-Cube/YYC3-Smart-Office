import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateCsrfToken } from '@/lib/csrf';
import { verifyToken, type TokenPayload } from './auth';

export interface ApiHandlerOptions<T extends z.ZodTypeAny> {
  schema?: T;
  requireAuth?: boolean;
  validateCsrf?: boolean;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS';
}

export type AuthenticatedRequest = NextRequest & { user?: TokenPayload };

export interface ApiResponse<T = null> {
  success: boolean;
  message: string;
  data: T;
}

export type ApiHandler<T extends z.ZodTypeAny, R = null> = (
  req: AuthenticatedRequest,
  data: z.infer<T>,
) => Promise<NextResponse<ApiResponse<R>>>;

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string>;

  constructor(message: string, status: number, errors?: Record<string, string>) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export function createApiResponse<T = null>(
  data: T,
  options?: { status?: number; message?: string },
) {
  const {
    status = 200 as number,
    message = (options?.status ?? 200) < 300 ? '操作成功' : '操作失败',
  } = options || {};

  return NextResponse.json(
    {
      success: status < 400,
      message,
      data,
    } as ApiResponse<T>,
    { status },
  );
}

function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.substring(7);
  return req.cookies.get('auth_token')?.value ?? null;
}

function getCsrfToken(req: NextRequest, data: unknown): string | null {
  if (data && typeof data === 'object' && 'csrfToken' in data) {
    const value = (data as { csrfToken?: unknown }).csrfToken;
    if (typeof value === 'string' && value) return value;
  }
  return req.headers.get('x-csrf-token');
}

export function withApiHandler<T extends z.ZodTypeAny, R = null>(
  handler: ApiHandler<T, R>,
  options?: ApiHandlerOptions<T>,
) {
  return async (req: NextRequest) => {
    try {
      if (options?.method && req.method !== options.method) {
        return createApiResponse(null, {
          status: 405,
          message: `不支持的方法: ${req.method}`,
        });
      }

      if (req.method === 'OPTIONS') {
        return NextResponse.json({}, { status: 200 });
      }

      let data: unknown = null;

      if (options?.requireAuth) {
        const token = getBearerToken(req);
        if (!token) {
          return createApiResponse(null, { status: 401, message: '未认证' });
        }
        try {
          (req as AuthenticatedRequest).user = verifyToken(token);
        } catch {
          return createApiResponse(null, { status: 401, message: '认证无效或已过期' });
        }
      }

      if (req.method !== 'GET') {
        try {
          data = await req.json();
        } catch {
          return createApiResponse(null, { status: 400, message: '请求体格式无效' });
        }

        if (options?.validateCsrf) {
          const csrfToken = getCsrfToken(req, data);
          if (!csrfToken || !(await validateCsrfToken(csrfToken))) {
            return createApiResponse(null, { status: 403, message: '无效的CSRF令牌' });
          }
        }
      } else {
        const searchParams = new URL(req.url).searchParams;
        data = Object.fromEntries(searchParams.entries());
      }

      if (options?.schema) {
        try {
          const parsedData = options.schema.parse(data);
          return await handler(req as AuthenticatedRequest, parsedData as z.infer<T>);
        } catch (error) {
          if (error instanceof z.ZodError) {
            return createApiResponse(null, {
              status: 400,
              message: '请求参数验证失败',
            });
          }
          throw error;
        }
      }

      return await handler(req as AuthenticatedRequest, data as z.infer<T>);
    } catch (error) {
      console.error('API处理错误:', error);

      if (error instanceof ApiError) {
        return createApiResponse(null, {
          status: error.status,
          message: error.message,
        });
      }

      return createApiResponse(null, {
        status: 500,
        message: '服务器内部错误，请稍后重试',
      });
    }
  };
}
