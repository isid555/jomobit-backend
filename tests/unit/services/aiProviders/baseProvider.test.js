const AIProvider = require('../../../../src/services/aiProviders/baseProvider');

describe('AIProvider', () => {
  describe('Constructor', () => {
    it('should throw error when instantiated directly', () => {
      expect(() => new AIProvider()).toThrow('AIProvider is an abstract class and cannot be instantiated directly');
    });

    it('should allow subclass instantiation', () => {
      class TestProvider extends AIProvider {
        async generatePrompt() { return 'test'; }
        async generateImage() { return {}; }
        async getJobStatus() { return {}; }
        validateConfig() { return true; }
      }

      const provider = new TestProvider({ test: 'config' });
      expect(provider).toBeInstanceOf(AIProvider);
      expect(provider.config).toEqual({ test: 'config' });
      expect(provider.name).toBe('TestProvider');
    });
  });

  describe('Abstract Methods', () => {
    let TestProvider;
    let provider;

    beforeEach(() => {
      TestProvider = class extends AIProvider {};
      provider = new TestProvider();
    });

    it('should throw error for generatePrompt if not implemented', async () => {
      await expect(provider.generatePrompt({}, {}))
        .rejects.toThrow('generatePrompt method must be implemented by subclass');
    });

    it('should throw error for generateImage if not implemented', async () => {
      await expect(provider.generateImage('test prompt'))
        .rejects.toThrow('generateImage method must be implemented by subclass');
    });

    it('should throw error for getJobStatus if not implemented', async () => {
      await expect(provider.getJobStatus('job123'))
        .rejects.toThrow('getJobStatus method must be implemented by subclass');
    });

    it('should throw error for validateConfig if not implemented', () => {
      expect(() => provider.validateConfig())
        .toThrow('validateConfig method must be implemented by subclass');
    });
  });

  describe('getCapabilities', () => {
    it('should return default capabilities', () => {
      class TestProvider extends AIProvider {
        async generatePrompt() { return 'test'; }
        async generateImage() { return {}; }
        async getJobStatus() { return {}; }
        validateConfig() { return true; }
      }

      const provider = new TestProvider();
      const capabilities = provider.getCapabilities();

      expect(capabilities).toEqual({
        supportsPromptGeneration: false,
        supportsImageGeneration: false,
        supportsJobStatus: false
      });
    });

    it('should allow subclass to override capabilities', () => {
      class TestProvider extends AIProvider {
        async generatePrompt() { return 'test'; }
        async generateImage() { return {}; }
        async getJobStatus() { return {}; }
        validateConfig() { return true; }
        
        getCapabilities() {
          return {
            ...super.getCapabilities(),
            supportsPromptGeneration: true,
            customFeature: true
          };
        }
      }

      const provider = new TestProvider();
      const capabilities = provider.getCapabilities();

      expect(capabilities).toEqual({
        supportsPromptGeneration: true,
        supportsImageGeneration: false,
        supportsJobStatus: false,
        customFeature: true
      });
    });
  });
});