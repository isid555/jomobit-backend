const DiffusionProvider = require('./diffusionProvider');

const logger = require('../../utils/logger');

/**
 * Ideogram Diffusion Provider
 * Implements Ideogram-based image generation
 */
class IdeogramDiffusionProvider extends DiffusionProvider {
  constructor(config = {}) {
    super(config);
    this.apiKey = config.apiKey || process.env.IDEOGRAM_API_KEY;
    this.baseURL = 'https://api.ideogram.ai';

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

      // Build the request object, only including non-null optional fields
      const imageRequest = {
        prompt: enhancedPrompt,
        aspect_ratio: this.convertSizeToAspectRatio(validatedParams.size),
        model: parameters.model || 'V_2',
        magic_prompt_option: parameters.magicPrompt || 'AUTO',
        style_type: this.mapStyleType(validatedParams.style)
      };

      // Only add optional fields if they have valid values
      if (parameters.seed !== undefined && parameters.seed !== null) {
        imageRequest.seed = parameters.seed;
      }

      if (parameters.negativePrompt && parameters.negativePrompt.trim() !== '') {
        imageRequest.negative_prompt = parameters.negativePrompt;
      }

      // Fix: Wrap request in image_request object as per API documentation
      const response = await this.makeAPICall('/generate', {
        image_request: imageRequest
      });

      logger.info("Response: ", response);

      // For the legacy /generate endpoint, images are returned immediately
      // Check if we have data array with generated images
      if (response.data && response.data.length > 0) {
        const imageData = response.data[0];
        return {
          jobId: `sync_${Date.now()}`, // Create a synthetic job ID for consistency
          status: 'completed',
          imageUrl: imageData.url,
          metadata: {
            model: parameters.model || 'V_2',
            aspectRatio: this.convertSizeToAspectRatio(validatedParams.size),
            styleType: this.mapStyleType(validatedParams.style),
            seed: imageData.seed,
            isPublic: imageData.is_public || false,
            resolution: imageData.resolution,
            isImageSafe: imageData.is_image_safe
          }
        };
      } else {
        throw new Error('No image data returned from Ideogram API');
      }
    } catch (error) {
      throw new Error(`Ideogram image generation failed: ${error.message}`);
    }
  }

  /**
   * Get job status from Ideogram
   * Note: The legacy /generate endpoint is synchronous, so this method
   * is mainly for compatibility with the async interface
   * @param {string} jobId - The job ID
   * @returns {Promise<Object>} Job status and result data
   */
  async getJobStatus(jobId) {
    // For synchronous generations, we can't really check status
    // This is mainly here for interface compatibility
    if (jobId.startsWith('sync_')) {
      return {
        jobId,
        status: 'completed',
        message: 'Synchronous generation completed immediately'
      };
    }
    
    throw new Error('Job status checking not supported for legacy synchronous endpoint');
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
      supportedModels: ['V_2', 'V_1', 'V_2_TURBO', 'V_1_TURBO'],
      supportedStyles: ['GENERAL', 'REALISTIC', 'DESIGN', 'RENDER_3D', 'ANIME'],
      maxPromptLength: 2000,
      isAsynchronous: false, // Legacy endpoint is synchronous
      supportsMagicPrompt: true,
      supportsNegativePrompt: true
    };
  }

  /**
   * Convert size format to Ideogram aspect ratio
   * @param {string} size - Size in format '1024x1024'
   * @returns {string} Aspect ratio in format 'ASPECT_1_1'
   */
  convertSizeToAspectRatio(size) {
    const sizeMap = {
      '1024x1024': 'ASPECT_1_1',
      '1024x768': 'ASPECT_4_3',
      '768x1024': 'ASPECT_3_4',
      '1920x1080': 'ASPECT_16_9',
      '1080x1920': 'ASPECT_9_16',
      '1600x1000': 'ASPECT_16_10',
      '1000x1600': 'ASPECT_10_16',
      '1536x1024': 'ASPECT_3_2',
      '1024x1536': 'ASPECT_2_3'
    };

    return sizeMap[size] || 'ASPECT_1_1';
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

    console.log("Response status:", response.status);
    console.log("Response headers:", [...response.headers.entries()]);

    if (!response.ok) {
      let errorMessage = `Ideogram API request failed: ${response.status}`;
      try {
        const error = await response.json();
        console.log("Error response body:", error);
        errorMessage = error.detail || error.message || error.error || errorMessage;
      } catch (e) {
        // If we can't parse the error response, use the default message
        console.log("Could not parse error response");
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  }
}

module.exports = {
  IdeogramDiffusionProvider
};