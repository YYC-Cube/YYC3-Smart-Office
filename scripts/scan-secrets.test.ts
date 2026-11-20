import scanner from './scan-secrets.cjs';

const { scanContent, shouldSkipFile } = scanner;

describe('secret scanner', () => {
  it('detects high-confidence secrets', () => {
    const content = [
      'const key = "sk-abcdefghijklmnopqrstuvwxyz";',
      'const url = "postgresql://postgres:weakpass@localhost:5432/yyc";',
      'const ip = "100.64.12.34";',
      'const token = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signaturevalue";',
    ].join('\n');

    const findings = scanContent('src/config.ts', content);
    expect(findings.some((line: string) => line.includes('OpenAI-style key'))).toBe(true);
    expect(findings.some((line: string) => line.includes('DB password in URL'))).toBe(true);
    expect(findings.some((line: string) => line.includes('Tailscale IP'))).toBe(true);
    expect(findings.some((line: string) => line.includes('JWT'))).toBe(true);
  });

  it('detects generic hardcoded credential assignments', () => {
    const findings = scanContent('src/config.ts', 'const apiKey = "real-production-key";');
    expect(findings).toContain('src/config.ts:1: hardcoded credential assignment');
  });

  it('allows placeholders and environment references', () => {
    const content = [
      'const apiKey = process.env.API_KEY;',
      'const password = "REPLACE_WITH_PASSWORD";',
      'const token = "ci-test-token";',
    ].join('\n');
    expect(scanContent('src/config.ts', content)).toEqual([]);
  });

  it('skips docs and env template', () => {
    expect(shouldSkipFile('docs/README.md')).toBe(true);
    expect(shouldSkipFile('.env.example')).toBe(true);
    expect(shouldSkipFile('lib/config.test.ts')).toBe(true);
    expect(shouldSkipFile('src/config.ts')).toBe(false);
  });
});
