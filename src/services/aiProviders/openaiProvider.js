// const LLMProvider = require('./llmProvider');
// const DiffusionProvider = require('./diffusionProvider');
// const logger = require('../../utils/logger');

// /**
//  * OpenAI LLM Provider
//  * Implements GPT-based prompt generation
//  */
// class OpenAILLMProvider extends LLMProvider {
//   constructor(config = {}) {
//     super(config);
//     this.apiKey = config.apiKey || process.env.OPENAI_API_KEY;
//     this.model = config.model || 'gpt-4';
//     this.baseURL = 'https://api.openai.com/v1';
    
//     if (!this.apiKey) {
//       throw new Error('OpenAI API key is required');
//     }
//   }

//   /**
//    * Generate marketing prompt using GPT
//    * @param {Object} businessProfile - Business profile data
//    * @param {Object} template - Template data
//    * @returns {Promise<string>} Generated prompt
//    */
//   async generatePrompt(businessProfile, template) {
//     try {
//       const systemPrompt = this.buildSystemPrompt(businessProfile, template);
      
//       const userPrompt = `Create a compelling marketing message for a poster that:
// - Highlights the unique value proposition
// - Includes a strong call-to-action
// - Fits the ${template.style || 'professional'} style
// - Is concise and impactful (max 50 words)
// - Appeals to the target audience for ${businessProfile.products?.join(', ') || businessProfile.name}`;

//       const response = await this.makeAPICall('/chat/completions', {
//         model: this.model,
//         messages: [
//           { role: 'system', content: systemPrompt },
//           { role: 'user', content: userPrompt }
//         ],
//         max_tokens: 200,
//         temperature: 0.7
//       });

//       return response.choices[0].message.content.trim();
//     } catch (error) {
//       throw new Error(`OpenAI prompt generation failed: ${error.message}`);
//     }
//   }

//   /**
//    * Validate OpenAI configuration
//    * @returns {boolean} True if configuration is valid
//    */
//   validateConfig() {
//     return !!(this.apiKey && this.model);
//   }

//   /**
//    * Get OpenAI LLM capabilities
//    * @returns {Object} Provider capabilities
//    */
//   getCapabilities() {
//     return {
//       ...super.getCapabilities(),
//       maxPromptLength: 8000,
//       supportedModels: ['gpt-4', 'gpt-3.5-turbo'],
//       supportedLanguages: ['en', 'es', 'fr', 'de', 'it']
//     };
//   }  /**

//    * Make API call to OpenAI
//    * @param {string} endpoint - API endpoint
//    * @param {Object} data - Request data
//    * @returns {Promise<Object>} API response
//    */
//   async makeAPICall(endpoint, data) {
//     // const fetch = require('node-fetch');
    
//     const response = await fetch(`${this.baseURL}${endpoint}`, {
//       method: 'POST',
//       headers: {
//         'Authorization': `Bearer ${this.apiKey}`,
//         'Content-Type': 'application/json'
//       },
//       body: JSON.stringify(data)
//     });

//     if (!response.ok) {
//       const error = await response.json();
//       throw new Error(error.error?.message || 'OpenAI API request failed');
//     }

//     return await response.json();
//   }
// }

// /**
//  * OpenAI DALL-E Provider
//  * Implements DALL-E based image generation
//  */
// class OpenAIDiffusionProvider extends DiffusionProvider {
//   constructor(config = {}) {
//     super(config);
//     this.apiKey = config.apiKey || process.env.OPENAI_API_KEY;
//     this.model = config.model || 'gpt-image-1';
//     this.baseURL = 'https://api.openai.com/v1';
    
//     if (!this.apiKey) {
//       throw new Error('OpenAI API key is required');
//     }
//   }

//   /**
//    * Generate image using DALL-E
//    * @param {string} prompt - Text prompt for image generation
//    * @param {Object} parameters - Generation parameters
//    * @returns {Promise<Object>} Generation result with image URL
//    */
//   async generateImage(prompt, parameters = {}) {
//     try {
//       const validatedParams = this.validateParameters(parameters);
//       const enhancedPrompt = this.enhancePrompt(prompt, validatedParams);

//       const response = await this.makeAPICall('/images/generations', {
//         model: this.model,
//         prompt: enhancedPrompt,
//         size: validatedParams.size,
//         quality: validatedParams.quality === 'high' ? 'high' : 'low',
//         n: 1
//       });

//       logger.info("Response: ", response);
//       return {
//         jobId: `openai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
//         status: 'completed',
//         imageUrl: response.data[0].url,
//         revisedPrompt: response.data[0].revised_prompt,
//         metadata: {
//           model: this.model,
//           size: validatedParams.size,
//           quality: validatedParams.quality
//         }
//       };
//     } catch (error) {
//       throw new Error(`OpenAI image generation failed: ${error.message}`);
//     }
//   }  /**
 
//   * Get job status (DALL-E is synchronous, so always return completed)
//    * @param {string} jobId - Job ID
//    * @returns {Promise<Object>} Job status
//    */
//   async getJobStatus(jobId) {
//     // DALL-E is synchronous, so we don't have actual job tracking
//     // This method is for compatibility with async providers
//     return {
//       jobId,
//       status: 'completed',
//       message: 'OpenAI DALL-E generates images synchronously'
//     };
//   }

//   /**
//    * Validate OpenAI configuration
//    * @returns {boolean} True if configuration is valid
//    */
//   validateConfig() {
//     return !!(this.apiKey && this.model);
//   }

//   /**
//    * Get OpenAI diffusion capabilities
//    * @returns {Object} Provider capabilities
//    */
//   getCapabilities() {
//     return {
//       ...super.getCapabilities(),
//       supportedSizes: ['1024x1024', '1792x1024', '1024x1792'],
//       supportedModels: ['dall-e-3', 'dall-e-2'],
//       maxPromptLength: 4000,
//       isAsynchronous: false
//     };
//   }

//   /**
//    * Make API call to OpenAI
//    * @param {string} endpoint - API endpoint
//    * @param {Object} data - Request data
//    * @returns {Promise<Object>} API response
//    */
//   async makeAPICall(endpoint, data) {
//     // const fetch = require('node-fetch');
    
//     const response = await fetch(`${this.baseURL}${endpoint}`, {
//       method: 'POST',
//       headers: {
//         'Authorization': `Bearer ${this.apiKey}`,
//         'Content-Type': 'application/json'
//       },
//       body: JSON.stringify(data)
//     });

//     if (!response.ok) {
//       const error = await response.json();
//       throw new Error(error.error?.message || 'OpenAI API request failed');
//     }

//     return await response.json();
//   }
// }

// module.exports = {
//   OpenAILLMProvider,
//   OpenAIDiffusionProvider
// };


const LLMProvider = require("./llmProvider");
const DiffusionProvider = require("./diffusionProvider");

// To Upload the Generated Image
const ImageKitService = require("./ImageKitService");
const ImageDownloader = require("./ImageDownloader");
const path = require("path");

/**
 * OpenAI LLM Provider
 * Implements GPT-based prompt generation
 */
class OpenAILLMProvider extends LLMProvider {
  constructor(config = {}) {
    super(config);
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    this.model = config.model || "gpt-4";
    this.baseURL = "https://api.openai.com/v1";

    if (!this.apiKey) {
      throw new Error("OpenAI API key is required");
    }
  }

  /**
   * Generate marketing prompt using GPT
   * @param {Object} businessProfile - Business profile data
   * @param {Object} template - Template data
   * @param {string} posterType - Type of poster: 'wish', 'cta', or 'awareness'
   * @returns {Promise<string>} Generated prompt
   */
  async generatePrompt(businessProfile, template, posterType = 'wish') {
    try {
      const systemPrompt = this.buildSystemPrompt(businessProfile, template, posterType);
      console.log(systemPrompt);
      const userPrompt = `Create a compelling marketing message for a poster that:
- Highlights the unique value proposition
- Includes a strong call-to-action
- Fits the ${template.style || "professional"} style
- Appeals to the target audience for ${
        businessProfile.products?.join(", ") || businessProfile.name
      }`;

      const response = await this.makeAPICall("/chat/completions", {
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 500,
        temperature: 0.7,
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
      supportedModels: ["gpt-4", "gpt-3.5-turbo"],
      supportedLanguages: ["en", "es", "fr", "de", "it"],
    };
  } /**

   * Make API call to OpenAI
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   * @returns {Promise<Object>} API response
   */
  async makeAPICall(endpoint, data) {
    // const fetch = require('node-fetch');

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "OpenAI API request failed");
    }

    return await response.json();
  }
}

/**
 * OpenAI DALL-E Provider
 * Implements DALL-E based image generation
 */
// class OpenAIDiffusionProvider extends DiffusionProvider {
//   constructor(config = {}) {
//     super(config);
//     this.apiKey = config.apiKey || process.env.OPENAI_API_KEY;
//     this.model = config.model || 'dall-e-3';
//     this.baseURL = 'https://api.openai.com/v1';

//     if (!this.apiKey) {
//       throw new Error('OpenAI API key is required');
//     }
//   }

//   /**
//    * Generate image using DALL-E
//    * @param {string} prompt - Text prompt for image generation
//    * @param {Object} parameters - Generation parameters
//    * @returns {Promise<Object>} Generation result with image URL
//    */
//   async generateImage(prompt, parameters = {}) {
//     try {
//       const validatedParams = this.validateParameters(parameters);
//       const enhancedPrompt = this.enhancePrompt(prompt, validatedParams);

//       const response = await this.makeAPICall('/images/generations', {
//         model: this.model,
//         prompt: enhancedPrompt,
//         size: validatedParams.size,
//         quality: validatedParams.quality === 'high' ? 'hd' : 'standard',
//         n: 1
//       });

//       return {
//         jobId: `openai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
//         status: 'completed',
//         imageUrl: response.data[0].url,
//         revisedPrompt: response.data[0].revised_prompt,
//         metadata: {
//           model: this.model,
//           size: validatedParams.size,
//           quality: validatedParams.quality
//         }
//       };
//     } catch (error) {
//       throw new Error(`OpenAI image generation failed: ${error.message}`);
//     }
//   }  /**

//   * Get job status (DALL-E is synchronous, so always return completed)
//    * @param {string} jobId - Job ID
//    * @returns {Promise<Object>} Job status
//    */
//   async getJobStatus(jobId) {
//     // DALL-E is synchronous, so we don't have actual job tracking
//     // This method is for compatibility with async providers
//     return {
//       jobId,
//       status: 'completed',
//       message: 'OpenAI DALL-E generates images synchronously'
//     };
//   }

//   /**
//    * Validate OpenAI configuration
//    * @returns {boolean} True if configuration is valid
//    */
//   validateConfig() {
//     return !!(this.apiKey && this.model);
//   }

//   /**
//    * Get OpenAI diffusion capabilities
//    * @returns {Object} Provider capabilities
//    */
//   getCapabilities() {
//     return {
//       ...super.getCapabilities(),
//       supportedSizes: ['1024x1024', '1792x1024', '1024x1792'],
//       supportedModels: ['dall-e-3', 'dall-e-2'],
//       maxPromptLength: 4000,
//       isAsynchronous: false
//     };
//   }

//   /**
//    * Make API call to OpenAI
//    * @param {string} endpoint - API endpoint
//    * @param {Object} data - Request data
//    * @returns {Promise<Object>} API response
//    */
//   async makeAPICall(endpoint, data) {
//     const fetch = require('node-fetch');

//     const response = await fetch(`${this.baseURL}${endpoint}`, {
//       method: 'POST',
//       headers: {
//         'Authorization': `Bearer ${this.apiKey}`,
//         'Content-Type': 'application/json'
//       },
//       body: JSON.stringify(data)
//     });

//     if (!response.ok) {
//       const error = await response.json();
//       throw new Error(error.error?.message || 'OpenAI API request failed');
//     }

//     return await response.json();
//   }
// }

/**
 * OpenAI DALL-E Provider
 * Implements DALL-E based image generation
 */
class OpenAIDiffusionProvider extends DiffusionProvider {
  constructor(config = {}) {
    super(config);
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    this.model = "gpt-image-1";
    this.baseURL = "https://api.openai.com/v1";
    this.imageKit = new ImageKitService(config.imageKit);

    if (!this.apiKey) {
      throw new Error("OpenAI API key is required");
    }
  }

  /**
   * Generate image using GPT Image 1
   * @param {string} prompt - Text prompt for image generation
   * @param {Object} parameters - Generation parameters
   * @returns {Promise<Object>} Generation result with image URL
   */
  async generateImage(prompt, parameters = {}) {
    try {
      const validatedParams = this.validateParameters(parameters);
      const enhancedPrompt = this.enhancePrompt(prompt, validatedParams);

      let endpoint;
      let body;

      if (validatedParams.template === null) {
        endpoint = "/images/generations";
        body = {
          model: this.model,
          prompt: enhancedPrompt,
          size: validatedParams.size,
          quality: validatedParams.quality,
          n: 1,
        };
      } else {

        // Handle template URL if provided
        if (validatedParams.template && validatedParams.template.startsWith("http")) {
          validatedParams.template = await ImageDownloader.downloadAsBase64(
            validatedParams.template
          );
        }

        // Handle logo URL if provided
        if (validatedParams.logo && validatedParams.logo.startsWith("http")) {
          validatedParams.logo = await ImageDownloader.downloadAsBase64(
            validatedParams.logo
          );
        }

        endpoint = "/images/edits";
        body = {
          model: this.model,
          template_ref: validatedParams.template,
          prompt: enhancedPrompt,
          size: validatedParams.size,
          quality: validatedParams.quality,
          n: 1,
        };

        if (validatedParams.logo) {
          body.logo = validatedParams.logo;
        }
      }

      const response = await this.makeAPICall(endpoint, body);

      // Upload to ImageKit
      const fileName = `generated_${Date.now()}.png`;
      const imageKitResponse = await this.imageKit.uploadImage(
        response.data[0].b64_json,
        fileName
      );

      return {
        jobId: `openai_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        status: "completed",
        imageUrl: imageKitResponse.url,
        thumbnailUrl: imageKitResponse.thumbnailUrl,
        revisedPrompt: response.data[0].revised_prompt,
        metadata: {
          model: this.model,
          size: validatedParams.size,
          quality: validatedParams.quality,
        },
      };
    } catch (error) {
      throw new Error(`OpenAI image generation failed: ${error.message}`);
    }
  }

  /**
   * Get job status (DALL-E is synchronous, so always return completed)
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} Job status
   */
  async getJobStatus(jobId) {
    // DALL-E is synchronous, so we don't have actual job tracking
    // This method is for compatibility with async providers
    return {
      jobId,
      status: "completed",
      message: "OpenAI GPT IMAGE 1 generates images synchronously",
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
      supportedSizes: ["1024x1024", "1024x1536", "1536x1024"],
      supportedModels: ["gpt-image-1"],
      qualityOptions: ["low", "medium", "high", "auto"],
      outputFormat: ["png", "jpeg", "webp"],
      backgroundOptions: ["transparent", "opaque"], //transparency only supported with PNG and WebP formats.
      moderation: ["auto", "low"],
      maxPromptLength: 4000,
      isAsynchronous: false,
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
      size: parameters.size || "1024x1024",
      quality: parameters.quality || "medium",
      // style: parameters.style || "natural",
      format: parameters.format || "png",
      template: parameters.image_url.template || null,
      logo: parameters.image_url.logo || null,
    };

    // Validate size
    if (!capabilities.supportedSizes.includes(validated.size)) {
      validated.size = capabilities.supportedSizes[0];
    }

    // Validate format
    if (!capabilities.supportedFormats.includes(validated.format)) {
      validated.format = capabilities.supportedFormats[0];
    }

    // Validate Quality
    if (!capabilities.qualityOptions.includes(validated.quality)) {
      validated.quality = capabilities.qualityOptions[0];
    }

    return validated;
  }

  // helper method to convert base64 to Blob
  base64ToBlob(base64String) {
    // Remove data URI prefix if present
    const base64Data = base64String.includes(";base64,")
      ? base64String.split(";base64,")[1]
      : base64String;

    const byteCharacters = atob(base64Data);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
      const slice = byteCharacters.slice(offset, offset + 1024);
      const byteNumbers = new Array(slice.length);

      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    return new Blob(byteArrays, { type: "image/png" });
  }

  /**
   * Make API call to OpenAI
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   * @returns {Promise<Object>} API response
   */
  // async makeAPICall(endpoint, data) {
  //   // const fetch = require("node-fetch");

  //   const response = await fetch(`${this.baseURL}${endpoint}`, {
  //     method: "POST",
  //     headers: {
  //       Authorization: `Bearer ${this.apiKey}`,
  //       "Content-Type": "application/json",
  //     },
  //     body: JSON.stringify(data),
  //   });

  //   if (!response.ok) {
  //     const error = await response.json();
  //     throw new Error(error.error?.message || "OpenAI API request failed");
  //   }

  //   return await response.json();
  // }

  /**
   * Make API call to OpenAI
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   * @returns {Promise<Object>} API response
   */
  async makeAPICall(endpoint, data) {
    try {
      let response;

      if (endpoint === "/images/edits") {
        const formData = new FormData();

        // Loop through all keys in the data object
        Object.keys(data).forEach((key) => {
          const value = data[key];

          if (typeof value === "string" && value.startsWith("data:image")) {
            const imageBlob = this.base64ToBlob(value);
            // Use the key as the field name and create a dynamic filename
            formData.append(key, imageBlob, `${key}.png`);
          } else {
            // Append non-image fields as usual
            formData.append(key, value);
          }
        });

        response = await fetch(`${this.baseURL}${endpoint}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            // Content-Type is set automatically by the browser for FormData
          },
          body: formData,
        });
      } else {
        // Regular JSON endpoints (no changes here)
        response = await fetch(`${this.baseURL}${endpoint}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "API request failed");
      }

      console.log("Generation successful!");
      return await response.json();
    } catch (error) {
      throw new Error(`API call failed: ${error.message}`);
    }
  }
}

module.exports = {
  OpenAILLMProvider,
  OpenAIDiffusionProvider,
};
