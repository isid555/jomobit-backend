const DiffusionProvider = require('./diffusionProvider');

/**
 * Ideogram Diffusion Provider
 * Implements Ideogram-based image generation
 */
class IdeogramDiffusionProvider extends DiffusionProvider {
  constructor(config = {}) {
    super(config);
    this.apiKey = config.apiKey || process.env.IDEOGRAM_API_KEY;
    this.baseURL = 'https://api.ideogram.ai/v1';

    if (!this.apiKey) {
      throw new Error('Ideogram API key is required');
    }
  }

  /**
   * Generate image using Ideogram
   * @param {string} prompt - Text prompt for image generation
   * @param {Object} parameters - Generation parameters
   * @returns {Promise<Object>} Generation job result
   */
  async generateImage(prompt, parameters = {}) {
    try {
      const validatedParams = this.validateParameters(parameters);
      const enhancedPrompt = this.enhancePrompt(prompt, validatedParams);

      const response = await this.makeAPICall('/generate', {
        prompt: enhancedPrompt,
        aspect_ratio: this.convertSizeToAspectRatio(validatedParams.size),
        model: parameters.model || 'V_2',
        magic_prompt_option: parameters.magicPrompt || 'AUTO',
        seed: parameters.seed || null,
        style_type: this.mapStyleType(validatedParams.style),
        negative_prompt: parameters.negativePrompt || null
      });

      // Ideogram returns a job ID for async processing
      return {
        jobId: response.request_id,
        status: 'processing',
        metadata: {
          model: parameters.model || 'V_2',
          aspectRatio: this.convertSizeToAspectRatio(validatedParams.size),
          styleType: this.mapStyleType(validatedParams.style)
        }
      };
    } catch (error) {
      throw new Error(`Ideogram image generation failed: ${error.message}`);
    }
  }

  /**
   * Get job status from Ideogram
   * @param {string} jobId - The Ideogram request ID
   * @returns {Promise<Object>} Job status and result data
   */
  async getJobStatus(jobId) {
    try {
      const response = await this.makeAPICall(`/retrieve/${jobId}`, null, 'GET');

      const status = this.mapIdeogramStatus(response.status);

      const result = {
        jobId,
        status,
        message: response.message || null
      };

      if (status === 'completed' && response.data && response.data.length > 0) {
        result.imageUrl = response.data[0].url;
        result.metadata = {
          seed: response.data[0].seed,
          isPublic: response.data[0].is_public,
          safetyScore: response.data[0].safety_score
        };
      } else if (status === 'failed') {
        result.error = response.message || 'Generation failed';
      }

      return result;
    } catch (error) {
      throw new Error(`Failed to get Ideogram job status: ${error.message}`);
    }
  }

  /**
   * Validate Ideogram configuration
   * @returns {boolean} True if configuration is valid
   */
  validateConfig() {
    return !!this.apiKey;
  }

  /**
   * Get Ideogram diffusion capabilities
   * @returns {Object} Provider capabilities
   */
  getCapabilities() {
    return {
      ...super.getCapabilities(),
      supportedSizes: ['1:1', '16:10', '10:16', '16:9', '9:16', '3:2', '2:3'],
      supportedModels: ['V_2', 'V_1'],
      supportedStyles: ['GENERAL', 'REALISTIC', 'DESIGN', 'RENDER_3D', 'ANIME'],
      maxPromptLength: 2000,
      isAsynchronous: true,
      supportsMagicPrompt: true,
      supportsNegativePrompt: true
    };
  }

  /**
   * Convert size format to Ideogram aspect ratio
   * @param {string} size - Size in format '1024x1024'
   * @returns {string} Aspect ratio in format '1:1'
   */
  convertSizeToAspectRatio(size) {
    const sizeMap = {
      '1024x1024': '1:1',
      '1024x768': '4:3',
      '768x1024': '3:4',
      '1920x1080': '16:9',
      '1080x1920': '9:16',
      '1600x1000': '16:10',
      '1000x1600': '10:16',
      '1536x1024': '3:2',
      '1024x1536': '2:3'
    };

    return sizeMap[size] || '1:1';
  }

  /**
   * Map style parameter to Ideogram style type
   * @param {string} style - Style parameter
   * @returns {string} Ideogram style type
   */
  mapStyleType(style) {
    const styleMap = {
      'natural': 'GENERAL',
      'realistic': 'REALISTIC',
      'design': 'DESIGN',
      'render': 'RENDER_3D',
      'anime': 'ANIME',
      'professional': 'DESIGN',
      'artistic': 'GENERAL'
    };

    return styleMap[style] || 'GENERAL';
  }

  /**
   * Map Ideogram status to standard status
   * @param {string} ideogramStatus - Ideogram status
   * @returns {string} Standard status
   */
  mapIdeogramStatus(ideogramStatus) {
    const statusMap = {
      'pending': 'processing',
      'processing': 'processing',
      'completed': 'completed',
      'failed': 'failed',
      'success': 'completed'
    };

    return statusMap[ideogramStatus] || 'processing';
  }

  /**
   * Enhance prompt for Ideogram
   * @param {string} prompt - Original prompt
   * @param {Object} parameters - Generation parameters
   * @returns {string} Enhanced prompt
   */
  enhancePrompt(prompt, parameters = {}) {
    let enhanced = super.enhancePrompt(prompt, parameters);

    // Add Ideogram-specific enhancements
    enhanced += ', professional poster design, marketing material';

    // Add style-specific modifiers
    if (parameters.style === 'realistic') {
      enhanced += ', photorealistic, high detail';
    } else if (parameters.style === 'design') {
      enhanced += ', clean design, modern layout, typography';
    }

    return enhanced;
  }

  /**
   * Make API call to Ideogram
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   * @param {string} method - HTTP method
   * @returns {Promise<Object>} API response
   */
  async makeAPICall(endpoint, data, method = 'POST') {
    const fetch = require('node-fetch');

    const options = {
      method,
      headers: {
        'Api-Key': this.apiKey,
        'Content-Type': 'application/json'
      }
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, options);

    if (!response.ok) {
      let errorMessage = `Ideogram API request failed: ${response.status}`;
      try {
        const error = await response.json();
        errorMessage = error.message || error.error || errorMessage;
      } catch (e) {
        // If we can't parse the error response, use the default message
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  }
}

module.exports = {
  IdeogramDiffusionProvider
};