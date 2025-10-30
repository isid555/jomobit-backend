const DiffusionProvider = require("./diffusionProvider");
const ImageKit = require("../../utils/imageKit");
const { fal } = require("@fal-ai/client");

/**
 * Fal-AI Diffusion Provider
 * Implements Fal-AI based image generation and editing using the nano-banana models.
 */
class FalAIDiffusionProvider extends DiffusionProvider {
  /**
   * Initializes the Fal-AI provider.
   * @param {object} config - Configuration object.
   * @param {string} [config.apiKey] - Fal-AI API key. Defaults to process.env.FAL_KEY.
   * @param {object} [config.imageKit] - Configuration for the ImageKitService.
   */
  constructor(config = {}) {
    super(config);
    this.apiKey = config.apiKey || process.env.FAL_KEY;
    this.imageKit = new ImageKit(config.imageKit);

    if (!this.apiKey) {
      throw new Error("Fal-AI API key (FAL_KEY) is required");
    }

    // Configure the fal client with the provided API key
    fal.config({
      credentials: this.apiKey,
    });
  }

  /**
   * Generates or edits an image using the appropriate Fal-AI model.
   * @param {string} prompt - Text prompt for image generation or editing.
   * @param {object} parameters - Generation parameters like aspect_ratio, num_images, etc.
   * @returns {Promise<object>} A promise that resolves to the generation result, including ImageKit URLs.
   */
  async generateImage(prompt, parameters = {}) {
    try {
      const validatedParams = this.validateParameters(parameters);
      const model = validatedParams.model;

      const input = {
        prompt,
        aspect_ratio: validatedParams.aspect_ratio,
        num_images: validatedParams.num_images,
        output_format: validatedParams.output_format,
      };

      // Add image_urls to the input if the edit model is being used
      if (model === "fal-ai/nano-banana/edit" && validatedParams.image_urls) {
        input.image_urls = validatedParams.image_urls;
      }

      console.log(`Sending request to Fal-AI model: ${model}`);

      // Call the Fal-AI service
      const result = await fal.subscribe(model, {
        input: input,
        logs: process.env.NODE_ENV === "development", // Show logs only in dev
      });

      // The result contains an array of generated images with their URLs
      const generatedImages = result.data.images;
      const requestID = result.requestId;

      // Upload all generated images to ImageKit in parallel for efficiency
      const uploadPromises = generatedImages.map((image) =>
        this.saveImage(image.url)
      );

      const uploadedImages = await Promise.all(uploadPromises);

      // Return a structured response consistent with other providers
      return {
        jobId: `fal_${result.requestId || Date.now()}`,
        status: "completed",
        imageUrl: uploadedImages[0].url,
        thumbnailUrl: uploadedImages[0].thumbnailUrl,
        revisedPrompt: prompt,
        metadata: {
          model,
          ...validatedParams,
          falRequestId: requestID,
        },
      };
    } catch (error) {
      console.error("Fal-AI image generation failed:", error);
      throw new Error(`Fal-AI image generation failed: ${error.message}`);
    }
  }

  /**
   * Uploads an image from a URL to ImageKit.
   * @param {string} imageUrl - The URL of the generated image to upload.
   * @returns {Promise<any>} A promise that resolves to the ImageKit upload response.
   */
  async saveImage(imageUrl) {
    const fileName = `jomobit_generation_${Date.now()}`;
    // The ImageKitService is expected to handle uploads directly from a URL
    return this.imageKit.uploadImage(imageUrl, fileName);
  }

  /**
   * Get job status (DALL-E is synchronous, so always return completed)
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} Job status
   */
  async getJobStatus(jobId) {
    // This method is for compatibility with async providers
    return {
      jobId,
      status: "completed",
      message: "Fal AI nano-banana generates images synchronously",
    };
  }

  /**
   * Validate OpenAI configuration
   * @returns {boolean} True if configuration is valid
   */
  validateConfig() {
    return !!(this.apiKey);
  }

  /**
   * Provides the capabilities of the Fal-AI diffusion provider.
   * @returns {object} An object describing the provider's capabilities.
   */
  getCapabilities() {
    return {
      ...super.getCapabilities(),
      supportedModels: ["fal-ai/nano-banana", "fal-ai/nano-banana/edit"],
      supportedAspectRatios: [
        "1:1",
        "16:9",
        "9:16",
        "4:3",
        "3:4",
        "3:2",
        "2:3",
        "21:9",
        "5:4",
        "4:5",
      ],
      supportedOutputFormats: ["jpeg", "png"],
      maxImages: 4,
      isAsynchronous: true,
    };
  }

  /**
   * Validates and normalizes the incoming image generation parameters.
   * @param {object} parameters - The parameters to validate.
   * @returns {object} The validated and defaulted parameters.
   */
  validateParameters(parameters = {}) {
    const capabilities = this.getCapabilities();

    const validated = {
      image_urls: null,
      aspect_ratio: parameters.aspect_ratio || "1:1",
      output_format: parameters.output_format || "jpeg",
      num_images: parameters.num_images || 1,
      model: "fal-ai/nano-banana", // Default to the generation model
    };

    // 1. Validate image_urls to determine if we should use the 'edit' model
    // Check if image_urls is a non-null object
    if (parameters.image_urls && typeof parameters.image_urls === "object") {
      // Get an array of the URLs from the object's values
      const urlArray = Object.values(parameters.image_urls);

      // Now, filter the array of URLs just like before
      const validUrls = urlArray.filter(
        (url) => typeof url === "string" && url.startsWith("http")
      );

      // If any valid URLs were found, update the 'validated' object
      if (validUrls.length > 0) {
        validated.image_urls = validUrls; // This will be an array like ["http://...", "http://..."]
        validated.model = "fal-ai/nano-banana/edit"; // Switch to the edit model
      }
    }

    // 2. Validate aspect_ratio against the supported list
    if (!capabilities.supportedAspectRatios.includes(validated.aspect_ratio)) {
      validated.aspect_ratio = "1:1";
    }

    // 3. Validate output_format
    if (
      !capabilities.supportedOutputFormats.includes(validated.output_format)
    ) {
      validated.output_format = "jpeg";
    }

    // 4. Validate and cap the number of images
    const num = Number(validated.num_images);
    if (isNaN(num) || num < 1 || num > capabilities.maxImages) {
      validated.num_images = 1;
    } else {
      validated.num_images = Math.floor(num);
    }

    return validated;
  }
}

module.exports = { FalAIDiffusionProvider };