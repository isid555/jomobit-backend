const AIProvider = require('./baseProvider');

/**
 * LLM Provider Abstract Class
 * Specialized abstract class for Large Language Model providers
 */
class LLMProvider extends AIProvider {
  constructor(config = {}) {
    super(config);
    if (this.constructor === LLMProvider) {
      throw new Error('LLMProvider is an abstract class and cannot be instantiated directly');
    }
  }

  /**
   * Generate a marketing prompt based on business profile and template
   * @param {Object} businessProfile - Business profile containing name, tagline, products, etc.
   * @param {Object} template - Template data with style and requirements
   * @returns {Promise<string>} Generated marketing prompt
   */
  async generatePrompt(businessProfile, template) {
    throw new Error('generatePrompt method must be implemented by LLM provider subclass');
  }

  /**
   * Generate multiple prompt variations
   * @param {Object} businessProfile - Business profile data
   * @param {Object} template - Template data
   * @param {number} count - Number of variations to generate
   * @returns {Promise<string[]>} Array of generated prompts
   */
  async generatePromptVariations(businessProfile, template, count = 3) {
    const prompts = [];
    for (let i = 0; i < count; i++) {
      const prompt = await this.generatePrompt(businessProfile, template);
      prompts.push(prompt);
    }
    return prompts;
  }

  /**
   * Get provider capabilities - LLM providers support prompt generation
   * @returns {Object} Provider capabilities
   */
  getCapabilities() {
    return {
      ...super.getCapabilities(),
      supportsPromptGeneration: true,
      supportsPromptVariations: true,
      maxPromptLength: 4000,
      supportedLanguages: ['en']
    };
  }

  /**
   * Build system prompt for marketing content generation
   * @param {Object} businessProfile - Business profile data
   * @param {Object} template - Template requirements
   * @returns {string} System prompt
   */
  buildSystemPrompt(businessProfile, template) {
    return `You are an expert marketing copywriter specializing in creating compelling poster content.
    
Business Context:
- Business Name: ${businessProfile.name}
- Tagline: ${businessProfile.tagline}
- Description: ${businessProfile.description}
- Products/Services: ${businessProfile.products?.join(', ') || 'Not specified'}
- Target Style: ${template.style || 'Professional'}

Create engaging, concise marketing copy that captures the business essence and appeals to the target audience.
Focus on benefits, emotional connection, and clear call-to-action.
Keep the tone consistent with the business brand and template style.`;
  }
}

module.exports = LLMProvider;