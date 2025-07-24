const { OpenAILLMProvider, OpenAIDiffusionProvider } = require('../../../../src/services/aiProviders/openaiProvider');

// Mock node-fetch
const mockFetch = jest.fn();
jest.mock('node-fetch', () => mockFetch);

describe('OpenAILLMProvider', () => {
  let provider;
  const mockConfig = {
    apiKey: 'test-api-key',
    model: 'gpt-4'
  };

  beforeEach(() => {
    provider = new OpenAILLMProvider(mockConfig);
    mockFetch.mockClear();
  });

  describe('Constructor', () => {
    it('should initialize with provided config', () => {
      expect(provider.apiKey).toBe('test-api-key');
      expect(provider.model).toBe('gpt-4');
      expect(provider.baseURL).toBe('https://api.openai.com/v1');
    });

    it('should use environment variables as fallback', () => {
      process.env.OPENAI_API_KEY = 'env-api-key';
      const envProvider = new OpenAILLMProvider();
      expect(envProvider.apiKey).toBe('env-api-key');
      expect(envProvider.model).toBe('gpt-4');
      delete process.env.OPENAI_API_KEY;
    });

    it('should throw error if no API key provided', () => {
      expect(() => new OpenAILLMProvider({})).toThrow('OpenAI API key is required');
    });
  });

  describe('generatePrompt', () => {
    const businessProfile = {
      name: 'Acme Corp',
      tagline: 'Quality Products',
      description: 'We make great stuff',
      products: ['Widget A', 'Widget B']
    };
    const template = { style: 'professional' };

    it('should generate prompt successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Generated marketing prompt for Acme Corp'
          }
        }]
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await provider.generatePrompt(businessProfile, template);

      expect(result).toBe('Generated marketing prompt for Acme Corp');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json'
          },
          body: expect.stringContaining('gpt-4')
        })
      );
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({
          error: { message: 'API rate limit exceeded' }
        })
      });

      await expect(provider.generatePrompt(businessProfile, template))
        .rejects.toThrow('OpenAI prompt generation failed: API rate limit exceeded');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(provider.generatePrompt(businessProfile, template))
        .rejects.toThrow('OpenAI prompt generation failed: Network error');
    });
  });

  describe('validateConfig', () => {
    it('should return true for valid config', () => {
      expect(provider.validateConfig()).toBe(true);
    });

    it('should return false for missing API key', () => {
      provider.apiKey = null;
      expect(provider.validateConfig()).toBe(false);
    });

    it('should return false for missing model', () => {
      provider.model = null;
      expect(provider.validateConfig()).toBe(false);
    });
  });

  describe('getCapabilities', () => {
    it('should return OpenAI LLM capabilities', () => {
      const capabilities = provider.getCapabilities();

      expect(capabilities).toEqual({
        supportsPromptGeneration: false,
        supportsImageGeneration: false,
        supportsJobStatus: false,
        supportsPromptGeneration: true,
        supportsPromptVariations: true,
        maxPromptLength: 8000,
        supportedModels: ['gpt-4', 'gpt-3.5-turbo'],
        supportedLanguages: ['en', 'es', 'fr', 'de', 'it']
      });
    });
  });
});

describe('OpenAIDiffusionProvider', () => {
  let provider;
  const mockConfig = {
    apiKey: 'test-api-key',
    model: 'dall-e-3'
  };

  beforeEach(() => {
    provider = new OpenAIDiffusionProvider(mockConfig);
    mockFetch.mockClear();
  });

  describe('Constructor', () => {
    it('should initialize with provided config', () => {
      expect(provider.apiKey).toBe('test-api-key');
      expect(provider.model).toBe('dall-e-3');
      expect(provider.baseURL).toBe('https://api.openai.com/v1');
    });

    it('should throw error if no API key provided', () => {
      expect(() => new OpenAIDiffusionProvider({})).toThrow('OpenAI API key is required');
    });
  });

  describe('generateImage', () => {
    const prompt = 'A beautiful marketing poster';
    const parameters = { size: '1024x1024', quality: 'high' };

    it('should generate image successfully', async () => {
      const mockResponse = {
        data: [{
          url: 'https://example.com/generated-image.png',
          revised_prompt: 'Enhanced marketing poster with professional design'
        }]
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await provider.generateImage(prompt, parameters);

      expect(result.status).toBe('completed');
      expect(result.imageUrl).toBe('https://example.com/generated-image.png');
      expect(result.revisedPrompt).toBe('Enhanced marketing poster with professional design');
      expect(result.jobId).toMatch(/^openai_\d+_[a-z0-9]+$/);
      expect(result.metadata.model).toBe('dall-e-3');
      expect(result.metadata.size).toBe('1024x1024');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/images/generations',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json'
          },
          body: expect.stringContaining('dall-e-3')
        })
      );
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({
          error: { message: 'Content policy violation' }
        })
      });

      await expect(provider.generateImage(prompt, parameters))
        .rejects.toThrow('OpenAI image generation failed: Content policy violation');
    });

    it('should enhance prompt before generation', async () => {
      const mockResponse = {
        data: [{
          url: 'https://example.com/generated-image.png',
          revised_prompt: 'Enhanced prompt'
        }]
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await provider.generateImage(prompt, parameters);

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.prompt).toContain('poster design');
      expect(requestBody.prompt).toContain('marketing material');
      expect(requestBody.prompt).toContain('high quality');
    });
  });

  describe('getJobStatus', () => {
    it('should return completed status for any job ID', async () => {
      const result = await provider.getJobStatus('test-job-id');

      expect(result).toEqual({
        jobId: 'test-job-id',
        status: 'completed',
        message: 'OpenAI DALL-E generates images synchronously'
      });
    });
  });

  describe('validateConfig', () => {
    it('should return true for valid config', () => {
      expect(provider.validateConfig()).toBe(true);
    });

    it('should return false for missing API key', () => {
      provider.apiKey = null;
      expect(provider.validateConfig()).toBe(false);
    });
  });

  describe('getCapabilities', () => {
    it('should return OpenAI diffusion capabilities', () => {
      const capabilities = provider.getCapabilities();

      expect(capabilities).toEqual({
        supportsPromptGeneration: false,
        supportsImageGeneration: true,
        supportsJobStatus: true,
        supportedSizes: ['1024x1024', '1792x1024', '1024x1792'],
        supportedFormats: ['png', 'jpg'],
        maxPromptLength: 4000,
        supportedModels: ['dall-e-3', 'dall-e-2'],
        isAsynchronous: false
      });
    });
  });
});