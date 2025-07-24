const LLMProvider = require('./llmProvider');
const DiffusionProvider = require('./diffusionProvider');

/**
 * OpenAI LLM Provider
 * Implements GPT-based prompt generation
 */
class OpenAILLMProvider extends LLMProvider {
  constructor(config = {}) {
    super(config);
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    this.model = config.model || 'gpt-4';
    this.baseURL = 'https://api.openai.com/v1';
    
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }
  }

  /**
   * Generate marketing prompt using GPT
   * @param {Object} businessProfile - Business profile data
   * @param {Object} template - Template data
   * @returns {Promise<string>} Generated prompt
   */
  async generatePrompt(businessProfile, template) {
    try {
      const systemPrompt = this.buildSystemPrompt(businessProfile, template);
      
      const userPrompt = `Create a compelling marketing message for a poster that:
- Highlights the unique value proposition
- Includes a strong call-to-action
- Fits the ${template.style || 'professional'} style
- Is concise and impactful (max 50 words)
- Appeals to the target audience for ${businessProfile.products?.join(', ') || businessProfile.name}`;

      const response = await this.makeAPICall('/chat/completions', {
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 200,
        temperature: 0.7
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      throw new Error(`OpenAI prompt generation failed: ${error.message}`);
    }
  }

  /**
   * Validate OpenAI configuration
   * @returns {boolean} True if configuration is valid
   */
  validateConfig() {
    return !!(this.apiKey && this.model);
  }

  /**
   * Get OpenAI LLM capabilities
   * @returns {Object} Provider capabilities
   */
  getCapabilities() {
    return {
      ...super.getCapabilities(),
      maxPromptLength: 8000,
      supportedModels: ['gpt-4', 'gpt-3.5-turbo'],
      supportedLanguages: ['en', 'es', 'fr', 'de', 'it']
    };
  }  /**

   * Make API call to OpenAI
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   * @returns {Promise<Object>} API response
   */
  async makeAPICall(endpoint, data) {
    const fetch = require('node-fetch');
    
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'OpenAI API request failed');
    }

    return await response.json();
  }
}

/**
 * OpenAI DALL-E Provider
 * Implements DALL-E based image generation
 */
class OpenAIDiffusionProvider extends DiffusionProvider {
  constructor(config = {}) {
    super(config);
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    this.model = config.model || 'dall-e-3';
    this.baseURL = 'https://api.openai.com/v1';
    
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }
  }

  /**
   * Generate image using DALL-E
   * @param {string} prompt - Text prompt for image generation
   * @param {Object} parameters - Generation parameters
   * @returns {Promise<Object>} Generation result with image URL
   */
  async generateImage(prompt, parameters = {}) {
    try {
      const validatedParams = this.validateParameters(parameters);
      const enhancedPrompt = this.enhancePrompt(prompt, validatedParams);

      const response = await this.makeAPICall('/images/generations', {
        model: this.model,
        prompt: enhancedPrompt,
        size: validatedParams.size,
        quality: validatedParams.quality === 'high' ? 'hd' : 'standard',
        n: 1
      });

      return {
        jobId: `openai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        status: 'completed',
        imageUrl: response.data[0].url,
        revisedPrompt: response.data[0].revised_prompt,
        metadata: {
          model: this.model,
          size: validatedParams.size,
          quality: validatedParams.quality
        }
      };
    } catch (error) {
      throw new Error(`OpenAI image generation failed: ${error.message}`);
    }
  }  /**
 
  * Get job status (DALL-E is synchronous, so always return completed)
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} Job status
   */
  async getJobStatus(jobId) {
    // DALL-E is synchronous, so we don't have actual job tracking
    // This method is for compatibility with async providers
    return {
      jobId,
      status: 'completed',
      message: 'OpenAI DALL-E generates images synchronously'
    };
  }

  /**
   * Validate OpenAI configuration
   * @returns {boolean} True if configuration is valid
   */
  validateConfig() {
    return !!(this.apiKey && this.model);
  }

  /**
   * Get OpenAI diffusion capabilities
   * @returns {Object} Provider capabilities
   */
  getCapabilities() {
    return {
      ...super.getCapabilities(),
      supportedSizes: ['1024x1024', '1792x1024', '1024x1792'],
      supportedModels: ['dall-e-3', 'dall-e-2'],
      maxPromptLength: 4000,
      isAsynchronous: false
    };
  }

  /**
   * Make API call to OpenAI
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   * @returns {Promise<Object>} API response
   */
  async makeAPICall(endpoint, data) {
    const fetch = require('node-fetch');
    
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'OpenAI API request failed');
    }

    return await response.json();
  }
}

module.exports = {
  OpenAILLMProvider,
  OpenAIDiffusionProvider
};