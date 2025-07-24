/**
 * Base AI Provider Interface
 * Abstract base class that defines the interface for all AI providers
 */
class AIProvider {
  constructor(config = {}) {
    if (this.constructor === AIProvider) {
      throw new Error('AIProvider is an abstract class and cannot be instantiated directly');
    }
    this.config = config;
    this.name = this.constructor.name;
  }

  /**
   * Generate a prompt based on business profile and template
   * @param {Object} businessProfile - The business profile data
   * @param {Object} template - The template data
   * @returns {Promise<string>} Generated prompt
   */
  async generatePrompt(businessProfile, template) {
    throw new Error('generatePrompt method must be implemented by subclass');
  }

  /**
   * Generate an image based on prompt and parameters
   * @param {string} prompt - The text prompt for image generation
   * @param {Object} parameters - Generation parameters (size, style, etc.)
   * @returns {Promise<Object>} Generation job result with jobId and status
   */
  async generateImage(prompt, parameters = {}) {
    throw new Error('generateImage method must be implemented by subclass');
  }

  /**
   * Get the status of a generation job
   * @param {string} jobId - The external job ID
   * @returns {Promise<Object>} Job status and result data
   */
  async getJobStatus(jobId) {
    throw new Error('getJobStatus method must be implemented by subclass');
  }

  /**
   * Validate the provider configuration
   * @returns {boolean} True if configuration is valid
   */
  validateConfig() {
    throw new Error('validateConfig method must be implemented by subclass');
  }

  /**
   * Get provider capabilities
   * @returns {Object} Provider capabilities (supports prompts, images, etc.)
   */
  getCapabilities() {
    return {
      supportsPromptGeneration: false,
      supportsImageGeneration: false,
      supportsJobStatus: false
    };
  }
}

module.exports = AIProvider;