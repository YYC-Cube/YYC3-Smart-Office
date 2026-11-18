// YYC³ · 言启象限
// Copyright (c) 2026 YanYuCloudCube™（YYC³）. All rights reserved.
import { spawnSync } from 'node:child_process';

const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const result = spawnSync(pnpmCommand, [
  'audit',
  '--prod',
  '--audit-level=high',
  '--config.registry=https://registry.npmjs.org',
], {
  stdio: 'inherit',
  env: {
    ...process.env,
    npm_config_registry: 'https://registry.npmjs.org',
  },
});

process.exit(result.status ?? 1);
