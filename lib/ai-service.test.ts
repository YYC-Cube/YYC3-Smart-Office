import type { AIProviderConfig } from './ai-service';

interface AIInternals {
  cache: Map<string, { response: unknown; expires: number }>;
}

const openAIProvider: AIProviderConfig = {
  name: 'openai',
  apiKey: 'test-key',
  baseUrl: 'https://ai.test/v1',
  models: ['gpt-4o-mini'],
  defaultModel: 'gpt-4o-mini',
};

function mockResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Server Error',
    json: async () => body,
  } as unknown as Response;
}

describe('AI Service', () => {
  let aiService: typeof import('./ai-service').aiService;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    jest.resetModules();
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    global.fetch = jest.fn() as unknown as typeof fetch;
    ({ aiService } = await import('./ai-service'));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
  });

  it('exposes and updates configuration', () => {
    expect(aiService.getConfig().defaultProvider).toBe('mock');
    aiService.updateConfig({ rateLimitPerMinute: 5 });
    expect(aiService.getConfig().rateLimitPerMinute).toBe(5);
  });

  it('configures OpenAI provider from environment', async () => {
    process.env.OPENAI_API_KEY = 'env-key';
    process.env.OPENAI_BASE_URL = 'https://env.test/v1';
    jest.resetModules();
    const fresh = await import('./ai-service');
    expect(fresh.aiService.getConfig().providers[0]).toMatchObject({
      name: 'openai',
      apiKey: 'env-key',
      baseUrl: 'https://env.test/v1',
    });
    expect(fresh.aiService.getConfig().fallbackChain).toEqual(['openai', 'mock']);
  });

  it('uses cached responses after a successful provider call', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse({
      choices: [{ message: { content: 'answer' } }],
    }));
    aiService.updateConfig({
      providers: [openAIProvider],
      fallbackChain: ['openai'],
      cacheEnabled: true,
      cacheTTL: 60000,
    });
    const first = await aiService.chat([{ role: 'user', content: '你好' }]);
    const second = await aiService.chat([{ role: 'user', content: '你好' }]);
    expect(first.provider).toBe('openai');
    expect(second.provider).toBe('openai (cached)');
    expect(first.model).toBe('gpt-4o-mini');
  });

  it('moves unconfigured and unimplemented providers to fallback', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    aiService.updateConfig({ fallbackChain: ['missing'] });
    const missing = await aiService.chat([{ role: 'user', content: '问题' }]);
    expect(missing.provider).toContain('fallback: Provider missing not configured');

    aiService.updateConfig({
      providers: [{ name: 'other', apiKey: 'x', models: [], defaultModel: 'm' }],
      fallbackChain: ['other'],
    });
    const unimplemented = await aiService.chat([{ role: 'user', content: '问题' }]);
    expect(unimplemented.provider).toContain('handler not implemented');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('rejects OpenAI provider without API key and falls back', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    aiService.updateConfig({
      providers: [{ name: 'openai', models: [], defaultModel: 'gpt-4o-mini' }],
      fallbackChain: ['openai'],
    });
    const result = await aiService.chat([{ role: 'user', content: '问题' }]);
    expect(result.provider).toContain('No API key');
    warnSpy.mockRestore();
  });

  it('calls OpenAI with usage data', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse({
      choices: [{ message: { content: 'AI answer' } }],
      usage: { prompt_tokens: 3, completion_tokens: 5, total_tokens: 8 },
    }));
    aiService.updateConfig({ providers: [openAIProvider], fallbackChain: ['openai'] });

    const result = await aiService.chat(
      [{ role: 'user', content: '你好' }],
      { provider: 'openai', model: 'gpt-4o-mini', temperature: 0.2 },
    );

    expect(result).toEqual({
      content: 'AI answer',
      provider: 'openai',
      model: 'gpt-4o-mini',
      usage: { promptTokens: 3, completionTokens: 5, totalTokens: 8 },
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://ai.test/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('handles OpenAI response without usage', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse({
      choices: [{ message: { content: 'answer' } }],
    }));
    aiService.updateConfig({ providers: [openAIProvider], fallbackChain: ['openai'] });
    const result = await aiService.chat([{ role: 'user', content: '你好' }]);
    expect(result.usage).toBeUndefined();
  });

  it('falls back when OpenAI request fails', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse({}, false));
    aiService.updateConfig({ providers: [openAIProvider], fallbackChain: ['openai'] });
    const result = await aiService.chat([{ role: 'user', content: '你好' }]);
    expect(result.provider).toContain('OpenAI API error');
    warnSpy.mockRestore();
  });

  it('uses fallback chain when preferred provider does not exist', async () => {
    aiService.updateConfig({ providers: [openAIProvider], fallbackChain: ['mock'] });
    const result = await aiService.chat(
      [{ role: 'user', content: '你好' }],
      { provider: 'unknown' },
    );
    expect(result.provider).toContain('mock (fallback:');
  });

  it('enforces rate limit', async () => {
    aiService.updateConfig({ rateLimitPerMinute: 1 });
    await aiService.chat([{ role: 'user', content: 'one' }]);
    await expect(aiService.chat([{ role: 'user', content: 'two' }]))
      .rejects.toThrow('Rate limit exceeded');
  });

  it('cleans expired cache entries when cache grows beyond threshold', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse({
      choices: [{ message: { content: 'ok' } }],
    }));
    aiService.updateConfig({
      providers: [openAIProvider],
      fallbackChain: ['openai'],
      cacheEnabled: true,
      cacheTTL: 60000,
    });
    const internals = aiService as unknown as AIInternals;
    for (let i = 0; i < 1001; i += 1) {
      internals.cache.set(`expired-${i}`, { response: {}, expires: Date.now() - 1 });
    }
    await aiService.chat([{ role: 'user', content: 'cleanup' }]);
    const expiredRemaining = [...internals.cache.values()]
      .filter((entry) => entry.expires <= Date.now()).length;
    expect(expiredRemaining).toBe(0);
  });
});
