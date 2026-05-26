export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',

  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_EXPIRATION: process.env.JWT_EXPIRATION || '24h',
  CSRF_SECRET: process.env.CSRF_SECRET || '',

  DATABASE_URL: process.env.DATABASE_URL || '',

  PORT: process.env.PORT || '3000',

  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',

  LOG_LEVEL: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
};

export function validateEnv() {
  const requiredEnvVars = [
    'JWT_SECRET',
    'DATABASE_URL',
  ];

  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingVars.length > 0) {
    if (env.NODE_ENV === 'production') {
      throw new Error(
        `Production environment requires: ${missingVars.join(', ')}. ` +
        `Please set them in your deployment environment.`
      );
    }
    console.warn(
      `[ENV] Missing recommended variables: ${missingVars.join(', ')}. ` +
      `Using empty defaults for development.`
    );
  }

  if (env.NODE_ENV === 'production' && env.JWT_SECRET.length < 32) {
    throw new Error(
      'JWT_SECRET must be at least 32 characters in production.'
    );
  }

  console.log('[ENV] Environment validation completed');
}
