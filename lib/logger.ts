import { LogLevel, LogType } from '../models/log';
import fs from 'fs';
import path from 'path';
import { db } from './db';
import { logs } from './schema';

const LOG_DIR = path.join(process.cwd(), 'logs');
const REDACTED = '[REDACTED]';
const SENSITIVE_KEY = /(password|passwd|pwd|secret|token|api[_-]?key|authorization|cookie|private[_-]?key|client[_-]?secret|database_url|jwt_secret|csrf_secret|ip_hash_salt|upstash)/i;
const IP_KEY = /^(ip|ipaddress|clientip)$/i;
const BEARER = /\b(bearer\s+)[^\s]+/gi;
const JWT = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
const PROVIDER_KEY = /\bsk-[A-Za-z0-9_-]{16,}/g;
const DB_URL = /(postgres(?:ql)?:\/\/[^:\s]+:)[^@\s]+(@)/gi;
const INLINE_SECRET = /(password|passwd|token|secret|api[_-]?key)\s*[:=]\s*["']?[^"'\s,;}]+/gi;
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const formatTimestamp = (): string => new Date().toISOString();

const generateLogFilename = (level: LogLevel): string => {
  const date = new Date().toISOString().split('T')[0];
  return path.join(LOG_DIR, `${date}_${level}.log`);
};

function redactString(value: string): string {
  return value
    .replace(BEARER, '$1[REDACTED]')
    .replace(JWT, '[REDACTED_JWT]')
    .replace(PROVIDER_KEY, '[REDACTED_KEY]')
    .replace(DB_URL, '$1[REDACTED]$2')
    .replace(INLINE_SECRET, '$1=[REDACTED]')
    .replace(IPV4, (ip) => {
      const parts = ip.split('.');
      return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
    });
}

export function redactLogData(value: unknown, seen = new WeakSet<object>(), depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return value;
  if (depth > 6) return '[TRUNCATED]';
  if (seen.has(value as object)) return '[CIRCULAR]';
  seen.add(value as object);

  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message) };
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactLogData(item, seen, depth + 1));
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(key)) {
        result[key] = REDACTED;
      } else if (IP_KEY.test(key) && typeof item === 'string') {
        result[key] = redactString(item);
      } else {
        result[key] = redactLogData(item, seen, depth + 1);
      }
    }
    return result;
  }

  return String(value);
}

function safeStringify(value: unknown): string {
  return JSON.stringify(value, (_key, item) => (
    typeof item === 'bigint' ? item.toString() : item
  ));
}

const writeToFile = (level: LogLevel, message: string, data?: unknown) => {
  try {
    const filename = generateLogFilename(level);
    const redactedData = data === undefined ? '' : ` ${safeStringify(redactLogData(data))}`;
    const logEntry = `${formatTimestamp()} [${level.toUpperCase()}] ${redactString(message)}${redactedData}\n`;
    fs.appendFileSync(filename, logEntry);
  } catch (error) {
    console.error('写入日志文件失败:', error);
  }
};

const writeToDatabase = async (level: LogLevel, type: LogType, message: string, data?: unknown) => {
  const safeData = data === undefined ? undefined : redactLogData(data);
  try {
    await db.insert(logs).values({
      action: `${type}:${level}`,
      details: redactString(message) + (safeData === undefined ? '' : ` | ${safeStringify(safeData)}`),
      createdAt: new Date(),
    });
  } catch (dbError) {
    writeToFile(level, `${message} (DB write failed)`, {
      error: dbError instanceof Error ? dbError.message : String(dbError),
      originalData: safeData,
    });
  }
};

class LoggerService {
  async debug(type: LogType, message: string, data?: unknown) {
    writeToFile(LogLevel.DEBUG, message, data);
  }

  async info(type: LogType, message: string, data?: unknown) {
    writeToFile(LogLevel.INFO, message, data);
    await writeToDatabase(LogLevel.INFO, type, message, data);
  }

  async warn(type: LogType, message: string, data?: unknown) {
    writeToFile(LogLevel.WARN, message, data);
    await writeToDatabase(LogLevel.WARN, type, message, data);
  }

  async error(type: LogType, message: string, data?: unknown) {
    writeToFile(LogLevel.ERROR, message, data);
    await writeToDatabase(LogLevel.ERROR, type, message, data);
  }
}

export const Logger = new LoggerService();
