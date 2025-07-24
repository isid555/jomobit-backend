const LLMProvider = require('../../../../src/services/aiProviders/llmProvider');

describe('LLMProvider', () => {
  describe('Constructor', () => {
    it('should throw error when instantiated directly', () => {
      expect(() => new LLMProvider()).toThrow('LLMProvider is an abstract class and cannot be instantiated directly');
    });

    it('should allow subclass instantiation', () => {
      class TestLLMProvider extends LLMProvider {
        async generatePrompt() { return 'test'; }
        validateConfig() { return true; }
      }

      const provider = new TestLLMProvider({ model: 'test-model' });
      expect(provider).toBeInstanceOf(LLMProvider);
      expect(provider.config).toEqual({ model: 'test-model' });
    });
  });

  describe('Abstract Methods', () => {
    let TestLLMProvider;
    let provider;

    beforeEach(() => {
      TestLLMProvider = class extends LLMProvider {};
      provider = new TestLLMProvider();
    });

    it('should throw error for generatePrompt if not implemented', async () => {
      await expect(provider.generatePrompt({}, {}))
        .rejects.toThrow('generatePrompt method must be implemented by LLM provider subclass');
    });
  });

  describe('generatePromptVariations', () => {
    let provider;

    beforeEach(() => {
      class TestLLMProvider extends LLMProvider {
        async generatePrompt(businessProfile, template) {
          return `Generated prompt for ${businessProfile.name}`;
        }
        validateConfig() { return true; }
      }
      provider = new TestLLMProvider();
    });

    it('should generate multiple prompt variations', async () => {
      const businessProfile = { name: 'Test Business' };
      const template = { style: 'professional' };

      const variations = await provider.generatePromptVariations(businessProfile, template, 3);

      expect(variations).toHaveLength(3);
      expect(variations[0]).toBe('Generated prompt for Test Business');
      expect(variations[1]).toBe('Generated prompt for Test Business');
      expect(variations[2]).toBe('Generated prompt for Test Business');
    });

    it('should default to 3 variations if count not specified', async () => {
      const businessProfile = { name: 'Test Business' };
      const template = { style: 'professional' };

      const variations = await provider.generatePromptVariations(businessProfile, template);

      expect(variations).toHaveLength(3);
    });
  });

  describe('getCapabilities', () => {
    it('should return LLM-specific capabilities', () => {
      class TestLLMProvider extends LLMProvider {
        async generatePrompt() { return 'test'; }
        validateConfig() { return true; }
      }

      const provider = new TestLLMProvider();
      const capabilities = provider.getCapabilities();

      expect(capabilities).toEqual({
        supportsPromptGeneration: false,
        supportsImageGeneration: false,
        supportsJobStatus: false,
        supportsPromptGeneration: true,
        supportsPromptVariations: true,
        maxPromptLength: 4000,
        supportedLanguages: ['en']
      });
    });
  });

  describe('buildSystemPrompt', () => {
    let provider;

    beforeEach(() => {
      class TestLLMProvider extends LLMProvider {
        async generatePrompt() { return 'test'; }
        validateConfig() { return true; }
      }
      provider = new TestLLMProvider();
    });

    it('should build comprehensive system prompt', () => {
      const businessProfile = {
        name: 'Acme Corp',
        tagline: 'Quality Products',
        description: 'We make great stuff',
        products: ['Widget A', 'Widget B']
      };
      const template = {
        style: 'Modern'
      };

      const systemPrompt = provider.buildSystemPrompt(businessProfile, template);

      expect(systemPrompt).toContain('Acme Corp');
      expect(systemPrompt).toContain('Quality Products');
      expect(systemPrompt).toContain('We make great stuff');
      expect(systemPrompt).toContain('Widget A, Widget B');
      expect(systemPrompt).toContain('Modern');
      expect(systemPrompt).toContain('marketing copywriter');
    });

    it('should handle missing products gracefully', () => {
      const businessProfile = {
        name: 'Acme Corp',
        tagline: 'Quality Products',
        description: 'We make great stuff'
      };
      const template = {
        style: 'Professional'
      };

      const systemPrompt = provider.buildSystemPrompt(businessProfile, template);

      expect(systemPrompt).toContain('Not specified');
      expect(systemPrompt).toContain('Professional');
    });

    it('should handle missing template style', () => {
      const businessProfile = {
        name: 'Acme Corp',
        tagline: 'Quality Products',
        description: 'We make great stuff',
        products: ['Widget A']
      };
      const template = {};

      const systemPrompt = provider.buildSystemPrompt(businessProfile, template);

      expect(systemPrompt).toContain('Professional');
    });
  });
});