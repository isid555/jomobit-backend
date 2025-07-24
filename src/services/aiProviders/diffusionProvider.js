const AIProvider = require('./baseProvider');

/**
 * Diffusion Provider Abstract Class
 * Specialized abstract class for image generation (diffusion model) providers
 */
class DiffusionProvider extends AIProvider {
  constructor(config = {}) {
    super(config);
    if (this.constructor === DiffusionProvider) {
      throw new Error('DiffusionProvider is an abstract class and cannot be instantiated directly');
    }
  }

  /**
   * Generate an image based on prompt and parameters
   * @param {string} prompt - The text prompt for image generation
   * @param {Object} parameters - Generation parameters
   * @param {string} parameters.size - Image size (e.g., '1024x1024')
   * @param {string} parameters.style - Image style
   * @param {number} parameters.quality - Quality setting
   * @returns {Promise<Object>} Generation job result
   */
  async generateImage(prompt, parameters = {}) {
    throw new Error('generateImage method must be implemented by diffusion provider subclass');
  }

  /**
   * Get the status of an image generation job
   * @param {string} jobId - The external job ID
   * @returns {Promise<Object>} Job status with image URL if completed
   */
  async getJobStatus(jobId) {
    throw new Error('getJobStatus method must be implemented by diffusion provider subclass');
  }

  /**
   * Get provider capabilities - Diffusion providers support image generation
   * @returns {Object} Provider capabilities
   */
  getCapabilities() {
    return {
      ...super.getCapabilities(),
      supportsImageGeneration: true,
      supportsJobStatus: true,
      supportedSizes: ['512x512', '1024x1024'],
      supportedFormats: ['png', 'jpg'],
      maxPromptLength: 1000
    };
  }

  /**
   * Validate image generation parameters
   * @param {Object} parameters - Generation parameters to validate
   * @returns {Object} Validated and normalized parameters
   */
  validateParameters(parameters = {}) {
    const capabilities = this.getCapabilities();
    
    // Default parameters
    const validated = {
      size: parameters.size || '1024x1024',
      quality: parameters.quality || 'standard',
      style: parameters.style || 'natural',
      format: parameters.format || 'png'
    };

    // Validate size
    if (!capabilities.supportedSizes.includes(validated.size)) {
      validated.size = capabilities.supportedSizes[0];
    }

    // Validate format
    if (!capabilities.supportedFormats.includes(validated.format)) {
      validated.format = capabilities.supportedFormats[0];
    }

    return validated;
  }

  /**
   * Enhance prompt for better image generation
   * @param {string} prompt - Original prompt
   * @param {Object} parameters - Generation parameters
   * @returns {string} Enhanced prompt
   */
  enhancePrompt(prompt, parameters = {}) {
    let enhanced = prompt;

    // Add quality modifiers
    if (parameters.quality === 'high') {
      enhanced += ', high quality, detailed, professional';
    }

    // Add style modifiers
    if (parameters.style) {
      enhanced += `, ${parameters.style} style`;
    }

    // Add poster-specific enhancements
    enhanced += ', poster design, marketing material, clean composition';

    return enhanced;
  }
}

module.exports = DiffusionProvider;