const { AIProviderFactory, providerFactory } = require('../../../../src/services/aiProviders/providerFactory');

describe('AIProviderFactory', () => {
  let factory;

  beforeEach(() => {
    factory = new AIProviderFactory();
  });

  describe('Constructor', () => {
    it('should initialize with registered providers', () => {
      expect(factory.llmProviders.size).toBeGreaterThan(0);
      expect(factory.diffusionProviders.size).toBeGreaterThan(0);
      expect(factory.llmProviders.has('openai')).toBe(true);
      expect(factory.llmProviders.has('gemini')).toBe(true);
      expect(factory.diffusionProviders.has('openai')).toBe(true);
      expect(factory.diffusionProviders.has('ideogram')).toBe(true);
    });
  });

  describe('createLLMProvider', () => {
    it('should create OpenAI LLM provider with valid config', () => {
      const config = { apiKey: 'test-key', model: 'gpt-4' };
      const provider = factory.createLLMProvider('openai', config);
      
      expect(provider).toBeDefined();
      expect(provider.apiKey).toBe('test-key');
      expect(provider.model).toBe('gpt-4');
    });

    it('should throw error for unknown provider', () => {
      expect(() => factory.createLLMProvider('unknown'))
        .toThrow("LLM provider 'unknown' not found");
    });

    it('should throw error for invalid config', () => {
      expect(() => factory.createLLMProvider('openai', {}))
        .toThrow("OpenAI API key is required");
    });
  });

  describe('createDiffusionProvider', () => {
    it('should create OpenAI diffusion provider with valid config', () => {
      const config = { apiKey: 'test-key', model: 'dall-e-3' };
      const provider = factory.createDiffusionProvider('openai', config);
      
      expect(provider).toBeDefined();
      expect(provider.apiKey).toBe('test-key');
      expect(provider.model).toBe('dall-e-3');
    });

    it('should throw error for unknown provider', () => {
      expect(() => factory.createDiffusionProvider('unknown'))
        .toThrow("Diffusion provider 'unknown' not found");
    });
  });

  describe('getAvailableProviders', () => {
    it('should return available LLM providers', () => {
      const providers = factory.getAvailableLLMProviders();
      expect(providers).toContain('openai');
      expect(providers).toContain('gemini');
    });

    it('should return available diffusion providers', () => {
      const providers = factory.getAvailableDiffusionProviders();
      expect(providers).toContain('openai');
      expect(providers).toContain('ideogram');
    });
  });

  describe('createProvidersFromConfig', () => {
    it('should create providers from configuration', () => {
      const aiConfig = {
        llm: {
          openai: { apiKey: 'test-key', model: 'gpt-4' }
        },
        diffusion: {
          openai: { apiKey: 'test-key', model: 'dall-e-3' }
        }
      };

      const providers = factory.createProvidersFromConfig(aiConfig);

      expect(providers.llm.openai).toBeDefined();
      expect(providers.diffusion.openai).toBeDefined();
    });

    it('should skip disabled providers', () => {
      const aiConfig = {
        llm: {
          openai: { apiKey: 'test-key', enabled: false }
        }
      };

      const providers = factory.createProvidersFromConfig(aiConfig);

      expect(providers.llm.openai).toBeUndefined();
    });
  });

  describe('getDefaultConfig', () => {
    it('should return default configuration', () => {
      const config = factory.getDefaultConfig();

      expect(config.llm.openai).toBeDefined();
      expect(config.llm.gemini).toBeDefined();
      expect(config.diffusion.openai).toBeDefined();
      expect(config.diffusion.ideogram).toBeDefined();
    });
  });
});

describe('providerFactory singleton', () => {
  it('should export singleton instance', () => {
    expect(providerFactory).toBeInstanceOf(AIProviderFactory);
  });
});