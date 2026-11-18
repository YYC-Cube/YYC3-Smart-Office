import { randomBytes } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { env } from './env';

export interface TokenPayload {
  id: string;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
  iat: number;
  exp: number;
}

function getJwtSecret(): string {
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured. Set it in your environment variables.');
  }
  return env.JWT_SECRET;
}

export function generateToken(payload: Omit<TokenPayload, 'iat' | 'exp'>, expiresIn: string = '24h') {
  const jwtSecret = getJwtSecret();
  const options = { expiresIn };
  return jwt.sign(payload, jwtSecret, options as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  const jwtSecret = getJwtSecret();

  try {
    const decoded = jwt.verify(token, jwtSecret) as TokenPayload;
    return decoded;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      }
      throw error;
    }
    throw new Error('Failed to verify token');
  }
}

export function refreshToken(oldToken: string) {
  try {
    const jwtSecret = getJwtSecret();
    const decoded = jwt.verify(oldToken, jwtSecret, { ignoreExpiration: true }) as TokenPayload;

    // 创建新的令牌，保留原始信息但更新过期时间
    const newToken = generateToken({
      id: decoded.id,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role,
      isActive: decoded.isActive,
    });

    return newToken;
  } catch (error) {
    console.error('刷新令牌失败:', error);
    throw new Error('Failed to refresh token');
  }
}

// 凭据校验统一由 app/api/auth/login/route.ts 查询数据库并调用 verifyPassword 完成。
// 本模块不再保留任何模拟账号、硬编码哈希或绕过密码校验的实现。

// 从请求头或cookie中获取令牌
export function getTokenFromRequest(request: { headers?: { authorization?: string }, cookies?: { auth_token?: string } }): string | null {
  // 尝试从Authorization头获取
  const authHeader = request.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // 尝试从cookie中获取
  if (request.cookies && request.cookies.auth_token) {
    return request.cookies.auth_token;
  }

  return null;
}

// 生成安全的随机字符串（用于CSRF令牌等）
export function generateSecureToken(length: number = 32): string {
  return randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}
