import { LogLevel, LogType } from '../models/log';
import fs from 'fs';
import path from 'path';
import { db } from './db';
import { logs } from './schema';

const LOG_DIR = path.join(process.cwd(), 'logs');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const formatTimestamp = (): string => {
  return new Date().toISOString();
};

const generateLogFilename = (level: LogLevel): string => {
  const date = new Date().toISOString().split('T')[0];
  return path.join(LOG_DIR, `${date}_${level}.log`);
};

const writeToFile = (level: LogLevel, message: string, data?: unknown) => {
  try {
    const filename = generateLogFilename(level);
    const logEntry = `${formatTimestamp()} [${level.toUpperCase()}] ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;
    fs.appendFileSync(filename, logEntry);
  } catch (error) {
    console.error('写入日志文件失败:', error);
  }
};

const writeToDatabase = async (level: LogLevel, type: LogType, message: string, data?: unknown) => {
  try {
    await db.insert(logs).values({
      action: `${type}:${level}`,
      details: message + (data ? ` | ${JSON.stringify(data)}` : ''),
      createdAt: new Date(),
    });
  } catch (dbError) {
    writeToFile(level, `${message} (DB write failed)`, {
      error: dbError instanceof Error ? dbError.message : String(dbError),
      originalData: data,
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