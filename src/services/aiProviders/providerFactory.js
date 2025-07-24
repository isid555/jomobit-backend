const { OpenAILLMProvider, OpenAIDiffusionProvider } = require('./openaiProvider');
const { GeminiLLMProvider } = require('./geminiProvider');
const { IdeogramDiffusionProvider } = require('./ideogramProvider');

/**
 * AI Provider Factory
 * Factory class for creating and managing AI provider instances
 */
class AIProviderFactory {
  constructor() {
    this.llmProviders = new Map();
    this.diffusionProviders = new Map();
    this.providerConfigs = new Map();
    
    // Register default providers
    this.registerProviders();
  }

  /**
   * Register all available providers
   */
  registerProviders() {
    // Register LLM providers
    this.registerLLMProvider('openai', OpenAILLMProvider);
    this.registerLLMProvider('gemini', GeminiLLMProvider);
    
    // Register Diffusion providers
    this.registerDiffusionProvider('openai', OpenAIDiffusionProvider);
    this.registerDiffusionProvider('ideogram', IdeogramDiffusionProvider);
  }

  /**
   * Register an LLM provider
   * @param {string} name - Provider name
   * @param {Class} ProviderClass - Provider class
   */
  registerLLMProvider(name, ProviderClass) {
    this.llmProviders.set(name, ProviderClass);
  }

  /**
   * Register a diffusion provider
   * @param {string} name - Provider name
   * @param {Class} ProviderClass - Provider class
   */
  registerDiffusionProvider(name, ProviderClass) {
    this.diffusionProviders.set(name, ProviderClass);
  }

  /**
   * Set configuration for a provider
   * @param {string} providerName - Provider name
   * @param {Object} config - Provider configuration
   */
  setProviderConfig(providerName, config) {
    this.providerConfigs.set(providerName, config);
  }

  /**
   * Create an LLM provider instance
   * @param {string} providerName - Name of the LLM provider
   * @param {Object} config - Optional configuration override
   * @returns {LLMProvider} LLM provider instance
   */
  createLLMProvider(providerName, config = {}) {
    const ProviderClass = this.llmProviders.get(providerName);
    
    if (!ProviderClass) {
      throw new Error(`LLM provider '${providerName}' not found. Available providers: ${Array.from(this.llmProviders.keys()).join(', ')}`);
    }

    const providerConfig = {
      ...this.providerConfigs.get(providerName),
      ...config
    };

    const provider = new ProviderClass(providerConfig);
    
    if (!provider.validateConfig()) {
      throw new Error(`Invalid configuration for LLM provider '${providerName}'`);
    }

    return provider;
  }

  /**
   * Create a diffusion provider instance
   * @param {string} providerName - Name of the diffusion provider
   * @param {Object} config - Optional configuration override
   * @returns {DiffusionProvider} Diffusion provider instance
   */
  createDiffusionProvider(providerName, config = {}) {
    const ProviderClass = this.diffusionProviders.get(providerName);
    
    if (!ProviderClass) {
      throw new Error(`Diffusion provider '${providerName}' not found. Available providers: ${Array.from(this.diffusionProviders.keys()).join(', ')}`);
    }

    const providerConfig = {
      ...this.providerConfigs.get(providerName),
      ...config
    };

    const provider = new ProviderClass(providerConfig);
    
    if (!provider.validateConfig()) {
      throw new Error(`Invalid configuration for diffusion provider '${providerName}'`);
    }

    return provider;
  }

  /**
   * Get available LLM providers
   * @returns {string[]} Array of available LLM provider names
   */
  getAvailableLLMProviders() {
    return Array.from(this.llmProviders.keys());
  }

  /**
   * Get available diffusion providers
   * @returns {string[]} Array of available diffusion provider names
   */
  getAvailableDiffusionProviders() {
    return Array.from(this.diffusionProviders.keys());
  }

  /**
   * Get provider capabilities
   * @param {string} providerName - Provider name
   * @param {string} type - Provider type ('llm' or 'diffusion')
   * @returns {Object} Provider capabilities
   */
  getProviderCapabilities(providerName, type) {
    let ProviderClass;
    
    if (type === 'llm') {
      ProviderClass = this.llmProviders.get(providerName);
    } else if (type === 'diffusion') {
      ProviderClass = this.diffusionProviders.get(providerName);
    } else {
      throw new Error(`Invalid provider type '${type}'. Must be 'llm' or 'diffusion'`);
    }

    if (!ProviderClass) {
      throw new Error(`Provider '${providerName}' of type '${type}' not found`);
    }

    // Create a temporary instance to get capabilities
    try {
      const tempProvider = new ProviderClass({});
      return tempProvider.getCapabilities();
    } catch (error) {
      // If we can't create an instance due to missing config, return basic info
      return {
        error: 'Configuration required to get full capabilities',
        providerName,
        type
      };
    }
  }

  /**
   * Create providers based on configuration
   * @param {Object} aiConfig - AI configuration object
   * @returns {Object} Object containing LLM and diffusion providers
   */
  createProvidersFromConfig(aiConfig) {
    const providers = {
      llm: {},
      diffusion: {}
    };

    // Create LLM providers
    if (aiConfig.llm) {
      for (const [name, config] of Object.entries(aiConfig.llm)) {
        if (config.enabled !== false) {
          try {
            providers.llm[name] = this.createLLMProvider(name, config);
          } catch (error) {
            console.warn(`Failed to create LLM provider '${name}': ${error.message}`);
          }
        }
      }
    }

    // Create diffusion providers
    if (aiConfig.diffusion) {
      for (const [name, config] of Object.entries(aiConfig.diffusion)) {
        if (config.enabled !== false) {
          try {
            providers.diffusion[name] = this.createDiffusionProvider(name, config);
          } catch (error) {
            console.warn(`Failed to create diffusion provider '${name}': ${error.message}`);
          }
        }
      }
    }

    return providers;
  }

  /**
   * Get default provider configuration
   * @returns {Object} Default configuration for all providers
   */
  getDefaultConfig() {
    return {
      llm: {
        openai: {
          enabled: true,
          model: 'gpt-4',
          apiKey: process.env.OPENAI_API_KEY
        },
        gemini: {
          enabled: true,
          model: 'gemini-1.5-flash',
          apiKey: process.env.GEMINI_API_KEY
        }
      },
      diffusion: {
        openai: {
          enabled: true,
          model: 'dall-e-3',
          apiKey: process.env.OPENAI_API_KEY
        },
        ideogram: {
          enabled: true,
          apiKey: process.env.IDEOGRAM_API_KEY
        }
      }
    };
  }
}

// Export singleton instance
const providerFactory = new AIProviderFactory();

module.exports = {
  AIProviderFactory,
  providerFactory
};