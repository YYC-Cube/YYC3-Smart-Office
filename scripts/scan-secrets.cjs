// YYC³ · 言启象限
// Copyright (c) 2026 YanYuCloudCube™（YYC³）. All rights reserved.
const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { extname } = require('node:path');

const SKIP_SUFFIXES = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.gz']);
const SKIP_FILES = new Set(['.env.example', 'pnpm-lock.yaml']);
const HIGH_CONFIDENCE = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['OpenAI-style key', /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
  ['Tailscale IP', /\b100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}\b/],
  ['DB password in URL', /(?:postgres(?:ql)?|redis|mongodb(?:\+srv)?):\/\/[^:\s]+:[^@\s]+@/i],
];
const GENERIC_ASSIGNMENT = /\b(?:password|passwd|pwd|secret|api[_-]?key|private[_-]?key|client[_-]?secret|auth[_-]?token|access[_-]?token|refresh[_-]?token)\s*[:=]\s*["']?([^"'\s,;}]+)/i;
const ALLOWED_VALUE = /(?:replace|placeholder|example|dummy|test|ci-|redacted|process\.env|secrets\.|\$\{\{|\$)/i;

function shouldSkipFile(filePath) {
  if (SKIP_FILES.has(filePath)) return true;
  if (SKIP_SUFFIXES.has(extname(filePath).toLowerCase())) return true;
  if (filePath.startsWith('docs/') || filePath.endsWith('.md')) return true;
  // 测试夹具常含合成密钥，跳过以避免误报；高危模式仍由 CI 全仓规则覆盖非测试代码。
  return filePath.includes('.test.') || filePath.includes('/__tests__/');
}

function scanContent(filePath, content) {
  if (content.includes('\0')) return [];
  const findings = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const [label, pattern] of HIGH_CONFIDENCE) {
      const allowedDbFixture = label === 'DB password in URL'
        && /(?:ci|test|build|example|dummy|placeholder):[^@\s]+@/i.test(line);
      if (pattern.test(line) && !allowedDbFixture) findings.push(`${filePath}:${index + 1}: ${label}`);
    }
    const match = GENERIC_ASSIGNMENT.exec(line);
    if (match) {
      const value = match[1];
      const appearsQuoted = /[:=]\s*["']/.test(match[0]);
      const looksLikeLongLiteral = value.length >= 24 && /^[A-Za-z0-9_\-./+=]+$/.test(value);
      if ((appearsQuoted || looksLikeLongLiteral) && !ALLOWED_VALUE.test(value)) {
        findings.push(`${filePath}:${index + 1}: hardcoded credential assignment`);
      }
    }
  });

  return findings;
}

function gitFiles(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) return [];
  return result.stdout.split('\n').map((line) => line.trim()).filter(Boolean);
}

function run() {
  const scanAll = process.argv.includes('--all');
  const files = scanAll
    ? gitFiles(['ls-files'])
    : gitFiles(['diff', '--cached', '--name-only', '--diff-filter=ACMR']);
  const findings = [];

  for (const file of files) {
    if (shouldSkipFile(file)) continue;
    let content;
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    findings.push(...scanContent(file, content));
  }

  if (findings.length > 0) {
    console.error('Secret scan failed:');
    for (const finding of findings) console.error(`  ${finding}`);
    process.exit(1);
  }

  console.log(scanAll ? `Secret scan passed (${files.length} tracked files)` : 'Secret scan passed (staged files)');
}

if (require.main === module) run();

module.exports = { scanContent, shouldSkipFile };
