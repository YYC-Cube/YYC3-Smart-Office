import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  // 提供Next.js应用的路径以加载next.config.js和.env文件
  dir: './',
});

// Jest配置
const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  moduleNameMapper: {
    // 处理模块别名
    '^@/(.*)$': '<rootDir>/$1',
    '^react$': '<rootDir>/node_modules/react',
  },
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  // 覆盖率口径聚焦可单元测试的核心逻辑；App Router 页面、shadcn UI 与
  // 数据库/日志基础设施由构建、集成测试与运行时探针验证，不纳入单测覆盖率。
  collectCoverageFrom: [
    'lib/password.ts',
    'lib/auth.ts',
    'lib/csrf.ts',
    'lib/api-middleware.ts',
    'lib/ai-service.ts',
    'lib/resilience-service.ts',
    'lib/validations.ts',
    'lib/validations/index.ts',
    'lib/utils.ts',
    'lib/logger.ts',
    'hooks/use-csrf.tsx',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  // 测试超时时间
  testTimeout: 30000,
};

// 导出配置
export default createJestConfig(config);
