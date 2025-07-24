const DiffusionProvider = require('../../../../src/services/aiProviders/diffusionProvider');

describe('DiffusionProvider', () => {
  describe('Constructor', () => {
    it('should throw error when instantiated directly', () => {
      expect(() => new DiffusionProvider()).toThrow('DiffusionProvider is an abstract class and cannot be instantiated directly');
    });

    it('should allow subclass instantiation', () => {
      class TestDiffusionProvider extends DiffusionProvider {
        async generateImage() { return {}; }
        async getJobStatus() { return {}; }
        validateConfig() { return true; }
      }

      const provider = new TestDiffusionProvider({ model: 'test-model' });
      expect(provider).toBeInstanceOf(DiffusionProvider);
      expect(provider.config).toEqual({ model: 'test-model' });
    });
  });

  describe('Abstract Methods', () => {
    let TestDiffusionProvider;
    let provider;

    beforeEach(() => {
      TestDiffusionProvider = class extends DiffusionProvider {};
      provider = new TestDiffusionProvider();
    });

    it('should throw error for generateImage if not implemented', async () => {
      await expect(provider.generateImage('test prompt'))
        .rejects.toThrow('generateImage method must be implemented by diffusion provider subclass');
    });

    it('should throw error for getJobStatus if not implemented', async () => {
      await expect(provider.getJobStatus('job123'))
        .rejects.toThrow('getJobStatus method must be implemented by diffusion provider subclass');
    });
  });

  describe('getCapabilities', () => {
    it('should return diffusion-specific capabilities', () => {
      class TestDiffusionProvider extends DiffusionProvider {
        async generateImage() { return {}; }
        async getJobStatus() { return {}; }
        validateConfig() { return true; }
      }

      const provider = new TestDiffusionProvider();
      const capabilities = provider.getCapabilities();

      expect(capabilities).toEqual({
        supportsPromptGeneration: false,
        supportsImageGeneration: true,
        supportsJobStatus: true,
        supportedSizes: ['512x512', '1024x1024'],
        supportedFormats: ['png', 'jpg'],
        maxPromptLength: 1000
      });
    });
  });

  describe('validateParameters', () => {
    let provider;

    beforeEach(() => {
      class TestDiffusionProvider extends DiffusionProvider {
        async generateImage() { return {}; }
        async getJobStatus() { return {}; }
        validateConfig() { return true; }
      }
      provider = new TestDiffusionProvider();
    });

    it('should return default parameters when none provided', () => {
      const validated = provider.validateParameters();

      expect(validated).toEqual({
        size: '1024x1024',
        quality: 'standard',
        style: 'natural',
        format: 'png'
      });
    });

    it('should validate and normalize provided parameters', () => {
      const parameters = {
        size: '512x512',
        quality: 'high',
        style: 'artistic',
        format: 'jpg'
      };

      const validated = provider.validateParameters(parameters);

      expect(validated).toEqual({
        size: '512x512',
        quality: 'high',
        style: 'artistic',
        format: 'jpg'
      });
    });

    it('should fallback to supported values for invalid parameters', () => {
      const parameters = {
        size: '2048x2048', // Not supported
        format: 'gif' // Not supported
      };

      const validated = provider.validateParameters(parameters);

      expect(validated.size).toBe('512x512'); // First supported size
      expect(validated.format).toBe('png'); // First supported format
    });
  });

  describe('enhancePrompt', () => {
    let provider;

    beforeEach(() => {
      class TestDiffusionProvider extends DiffusionProvider {
        async generateImage() { return {}; }
        async getJobStatus() { return {}; }
        validateConfig() { return true; }
      }
      provider = new TestDiffusionProvider();
    });

    it('should enhance prompt with default modifiers', () => {
      const prompt = 'A beautiful landscape';
      const enhanced = provider.enhancePrompt(prompt);

      expect(enhanced).toContain('A beautiful landscape');
      expect(enhanced).toContain('poster design');
      expect(enhanced).toContain('marketing material');
      expect(enhanced).toContain('clean composition');
    });

    it('should add quality modifiers for high quality', () => {
      const prompt = 'A beautiful landscape';
      const parameters = { quality: 'high' };
      const enhanced = provider.enhancePrompt(prompt, parameters);

      expect(enhanced).toContain('high quality');
      expect(enhanced).toContain('detailed');
      expect(enhanced).toContain('professional');
    });

    it('should add style modifiers', () => {
      const prompt = 'A beautiful landscape';
      const parameters = { style: 'artistic' };
      const enhanced = provider.enhancePrompt(prompt, parameters);

      expect(enhanced).toContain('artistic style');
    });

    it('should combine multiple enhancements', () => {
      const prompt = 'A beautiful landscape';
      const parameters = { 
        quality: 'high',
        style: 'modern'
      };
      const enhanced = provider.enhancePrompt(prompt, parameters);

      expect(enhanced).toContain('A beautiful landscape');
      expect(enhanced).toContain('high quality');
      expect(enhanced).toContain('modern style');
      expect(enhanced).toContain('poster design');
    });
  });
});