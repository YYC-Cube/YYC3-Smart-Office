// YYC³ · 言启象限
// Copyright (c) 2026 YanYuCloudCube™（YYC³）. All rights reserved.
import { spawnSync } from 'node:child_process';

const SECRET_NAME = 'yyc-smart-office-secrets';
const DEPLOYMENT = 'yyc-smart-office';
const REQUIRED_KEYS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'CSRF_SECRET',
  'IP_HASH_SALT',
  'CORS_ORIGIN',
];
const OPTIONAL_KEYS = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'];

function parseArgs(argv) {
  const command = argv[0] ?? 'help';
  const options = {};
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--namespace' || arg === '--context') {
      options[arg.slice(2)] = argv[i + 1];
      i += 1;
    } else if (arg === '--rollout') {
      options.rollout = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }
  return { command, options };
}

function kubectl(args, input, capture = false) {
  return spawnSync('kubectl', args, {
    encoding: 'utf8',
    input,
    stdio: capture || input !== undefined ? ['pipe', 'pipe', 'pipe'] : 'inherit',
  });
}

function currentContext() {
  const result = spawnSync('kubectl', ['config', 'current-context'], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '';
}

function validateValues() {
  const missing = REQUIRED_KEYS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
  if (!process.env.DATABASE_URL.startsWith('postgres')) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection string');
  }
  if (!/^https?:\/\//.test(process.env.CORS_ORIGIN)) {
    throw new Error('CORS_ORIGIN must be an http(s) URL');
  }
}

function applySecret(options) {
  validateValues();
  const context = options.context;
  const current = currentContext();
  if (!context) {
    throw new Error(`Refusing to apply without --context. Current context is "${current || 'unknown'}".`);
  }
  if (context !== current) {
    throw new Error(`--context ${context} does not match current context ${current || 'unknown'}.`);
  }

  const namespace = options.namespace ?? 'yyc';
  const fromLiterals = [...REQUIRED_KEYS, ...OPTIONAL_KEYS]
    .filter((key) => process.env[key])
    .flatMap((key) => ['--from-literal', `${key}=${process.env[key]}`]);

  const dryRun = kubectl([
    '-n', namespace,
    'create', 'secret', 'generic', SECRET_NAME,
    ...fromLiterals,
    '--dry-run=client',
    '-o', 'yaml',
  ], undefined, true);
  if (dryRun.status !== 0) {
    throw new Error('kubectl create secret --dry-run failed');
  }
  if (options.dryRun) {
    console.log(`Dry-run OK: Secret ${SECRET_NAME} would be applied in namespace ${namespace}`);
    return;
  }

  const applied = kubectl(['-n', namespace, 'apply', '-f', '-'], dryRun.stdout);
  if (applied.status !== 0) {
    throw new Error(applied.stderr || 'kubectl apply failed');
  }
  console.log(`Secret ${SECRET_NAME} applied in namespace ${namespace}`);
}

function verifySecret(options) {
  const namespace = options.namespace ?? 'yyc';
  const contextArgs = options.context ? ['--context', options.context] : [];
  const result = kubectl([
    ...contextArgs,
    '-n', namespace,
    'get', 'deployment', DEPLOYMENT,
    '-o', 'json',
  ]);
  if (result.status !== 0) {
    throw new Error(result.stderr || `Deployment ${DEPLOYMENT} not found`);
  }

  const deployment = JSON.parse(result.stdout);
  const env = deployment?.spec?.template?.spec?.containers?.[0]?.env ?? [];
  const refs = env
    .map((item) => item?.valueFrom?.secretKeyRef)
    .filter(Boolean)
    .filter((ref) => ref.name === SECRET_NAME)
    .map((ref) => ref.key);

  const missing = REQUIRED_KEYS.filter((key) => !refs.includes(key));
  if (missing.length > 0) {
    throw new Error(`Deployment missing required secret keys: ${missing.join(', ')}`);
  }
  console.log(`Deployment env references verified: ${REQUIRED_KEYS.join(', ')}`);
  console.log(`Optional keys present in manifest: ${OPTIONAL_KEYS.filter((key) => refs.includes(key)).join(', ') || 'none'}`);

  if (options.rollout) {
    const rollout = kubectl([...contextArgs, '-n', namespace, 'rollout', 'status', `deployment/${DEPLOYMENT}`, '--timeout=120s']);
    if (rollout.status !== 0) {
      throw new Error('Rollout verification failed');
    }
  }
}

function printHelp() {
  console.log([
    'Usage:',
    '  node scripts/k8s-secrets.mjs apply --context <kube-context> [--namespace yyc] [--dry-run]',
    '  node scripts/k8s-secrets.mjs verify [--context <kube-context>] [--namespace yyc] [--rollout]',
    '',
    'apply reads values from environment variables only; no secrets are written to files.',
    `Required: ${REQUIRED_KEYS.join(', ')}`,
    `Optional: ${OPTIONAL_KEYS.join(', ')}`,
  ].join('\n'));
}

const { command, options } = parseArgs(process.argv.slice(2));
try {
  if (command === 'apply') applySecret(options);
  else if (command === 'verify') verifySecret(options);
  else printHelp();
} catch (error) {
  console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
