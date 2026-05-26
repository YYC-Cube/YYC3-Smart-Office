export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  content: string;
  provider: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIProviderConfig {
  name: string;
  apiKey?: string;
  baseUrl?: string;
  models: string[];
  defaultModel: string;
}

export interface AIServiceConfig {
  providers: AIProviderConfig[];
  fallbackChain: string[];
  defaultProvider: string;
  cacheEnabled: boolean;
  cacheTTL: number;
  rateLimitPerMinute: number;
}

interface CacheEntry {
  response: ChatResponse;
  expires: number;
}

const defaultConfig: AIServiceConfig = {
  providers: [],
  fallbackChain: [],
  defaultProvider: 'mock',
  cacheEnabled: true,
  cacheTTL: 300000,
  rateLimitPerMinute: 20,
};

class AIService {
  private config: AIServiceConfig;
  private cache = new Map<string, CacheEntry>();
  private requestTimestamps: number[] = [];

  constructor(config?: Partial<AIServiceConfig>) {
    this.config = { ...defaultConfig, ...config };
  }

  async chat(
    messages: ChatMessage[],
    options?: { model?: string; provider?: string; temperature?: number }
  ): Promise<ChatResponse> {
    this.enforceRateLimit();

    const cacheKey = this.getCacheKey(messages, options);
    if (this.config.cacheEnabled) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expires > Date.now()) {
        return { ...cached.response, provider: cached.response.provider + ' (cached)' };
      }
    }

    const providerChain = this.buildProviderChain(options?.provider);
    let lastError: Error | null = null;

    for (const providerName of providerChain) {
      try {
        const response = await this.callProvider(providerName, messages, options);
        if (this.config.cacheEnabled) {
          this.cache.set(cacheKey, { response, expires: Date.now() + this.config.cacheTTL });
        }
        this.cleanupCache();
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[AI Service] Provider ${providerName} failed: ${lastError.message}`);
      }
    }

    return this.mockFallback(messages, lastError);
  }

  private buildProviderChain(preferred?: string): string[] {
    if (preferred) {
      const exists = this.config.providers.find(p => p.name === preferred);
      if (exists) return [preferred, ...this.config.fallbackChain.filter(n => n !== preferred)];
    }
    return this.config.fallbackChain.length > 0
      ? this.config.fallbackChain
      : [this.config.defaultProvider];
  }

  private async callProvider(
    providerName: string,
    messages: ChatMessage[],
    options?: { model?: string; temperature?: number }
  ): Promise<ChatResponse> {
    const provider = this.config.providers.find(p => p.name === providerName);
    if (!provider) throw new Error(`Provider ${providerName} not configured`);

    const model = options?.model || provider.defaultModel;

    if (!provider.apiKey && providerName !== 'mock') {
      throw new Error(`No API key for provider ${providerName}`);
    }

    if (providerName === 'openai') {
      return this.callOpenAI(provider, messages, model, options?.temperature);
    }

    throw new Error(`Provider ${providerName} handler not implemented`);
  }

  private async callOpenAI(
    provider: AIProviderConfig,
    messages: ChatMessage[],
    model: string,
    temperature?: number
  ): Promise<ChatResponse> {
    const baseUrl = provider.baseUrl || 'https://api.openai.com/v1';
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0]?.message?.content || '',
      provider: 'openai',
      model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }

  private mockFallback(messages: ChatMessage[], error: Error | null): ChatResponse {
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    const userContent = lastUserMessage?.content || '';

    const responses = [
      `我理解您的问题："${userContent}"。让我为您分析一下这个问题。`,
      `关于"${userContent.substring(0, 20)}..."，这是一个很好的问题。以下是我的建议。`,
      `感谢您的提问。关于这个问题，我建议您可以从以下几个角度来考虑。`,
    ];

    return {
      content: responses[Math.floor(Math.random() * responses.length)],
      provider: 'mock' + (error ? ` (fallback: ${error.message})` : ''),
      model: 'mock-v1',
    };
  }

  private getCacheKey(messages: ChatMessage[], options?: { model?: string }): string {
    const key = JSON.stringify({ messages, model: options?.model });
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return String(Math.abs(hash));
  }

  private enforceRateLimit(): void {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(t => now - t < 60000);
    if (this.requestTimestamps.length >= this.config.rateLimitPerMinute) {
      throw new Error(`Rate limit exceeded: ${this.config.rateLimitPerMinute} requests per minute`);
    }
    this.requestTimestamps.push(now);
  }

  private cleanupCache(): void {
    if (this.cache.size > 1000) {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (entry.expires <= now) this.cache.delete(key);
      }
    }
  }

  updateConfig(config: Partial<AIServiceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): Readonly<AIServiceConfig> {
    return this.config;
  }
}

function createAIService(): AIService {
  const providers: AIProviderConfig[] = [];
  const fallbackChain: string[] = ['mock'];

  if (process.env.OPENAI_API_KEY) {
    providers.push({
      name: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL,
      models: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
      defaultModel: 'gpt-4o-mini',
    });
    fallbackChain.unshift('openai');
  }

  return new AIService({
    providers,
    fallbackChain,
    defaultProvider: fallbackChain[0],
    cacheEnabled: true,
    cacheTTL: 300000,
    rateLimitPerMinute: 20,
  });
}

export const aiService = createAIService();
