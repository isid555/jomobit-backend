// We will create and import this AIProvider in the next step
const AIProvider = require("./aiProviders/AISuggestion");
const {
  FalAIDiffusionProvider,
} = require("./aiProviders/falaiProvider");
const logger = require("../utils/logger");


/**
 * Service layer for handling suggestion logic.
 * Orchestrates data generation (e.g., from AI providers) and caching.
 */
class SuggestionService {
  constructor() {
    // Instantiate the providers
    // AIProvider is already a singleton, so we just reference it
    this.llmProvider = AIProvider;

    // Create an instance of the new diffusion provider
    // This will pick up API keys from process.env
    try {
      this.diffusionProvider = new FalAIDiffusionProvider();
    } catch (err) {
      logger.error("Failed to initialize FalAIDiffusionProvider:", err.message);
      // We can let it fail. The first call to genLogo will throw an error.
    }
  }

  /**
   * Generates business name suggestions by calling the AI provider.
   * * @param {object} options - The full options object from the request body.
   * Must contain 'niche', but can contain any other
   * flexible parameters (e.g., style, keywords).
   * @returns {Promise<string[]>} A promise that resolves to an array of suggestions.
   * @throws {AIServiceError} Throws an error if the AI provider fails.
   */
  async generateBusinessNames(options) {
    logger.info("SuggestionService: Calling AIProvider for 'businessNames'", {
      options,
    });

    try {
      // 1. Delegate generation to the AI provider
      // We pass the entire 'options' object for flexible prompt generation.
      const suggestions = await this.llmProvider.generate(
        "businessNames",
        options
      );

      // 2. Validate AI output (basic)
      if (!Array.isArray(suggestions) || suggestions.length === 0) {
        logger.warn(
          "AIProvider returned an empty or invalid response for businessNames",
          { response: suggestions }
        );
        // Throw an error that the controller can catch
        throw new Error("AI provider returned an empty or invalid response.");
      }

      // 3. Return the suggestions
      return suggestions;
    } catch (err) {
      logger.error("Error in SuggestionService.generateBusinessNames:", {
        error: err.message,
        stack: err.stack,
      });

      // Re-throw the error for the controller to handle.
      // This allows the controller to set the correct HTTP status code.
      // We can wrap it in a custom error class if we want to be more specific.
      if (err.name !== "AIServiceError") {
        // Wrap generic errors into our custom type so controller can identify it
        const serviceError = new Error(
          `AI service failed to generate suggestions: ${err.message}`
        );
        serviceError.name = "AIServiceError";
        throw serviceError;
      }

      // If it's already an 'AIServiceError', just re-throw it
      throw err;
    }
  }

  /**
   * Generates tagline suggestions by calling the AI provider.
   * @param {object} options - The full options object from the request body.
   * Must contain 'niche' and 'businessName'.
   * @returns {Promise<string[]>} A promise that resolves to an array of taglines.
   * @throws {AIServiceError} Throws an error if the AI provider fails.
   */
  async generateTaglines(options) {
    logger.info("SuggestionService: Calling AIProvider for 'taglines'", {
      options,
    });

    try {
      // 1. Delegate generation to the AI provider
      const suggestions = await this.llmProvider.generate("taglines", options);

      // 2. Validate AI output
      if (!Array.isArray(suggestions) || suggestions.length === 0) {
        logger.warn(
          "AIProvider returned an empty or invalid response for taglines",
          { response: suggestions }
        );
        throw new Error("AI provider returned an empty or invalid response.");
      }

      // 3. Return the suggestions
      return suggestions;
    } catch (err) {
      logger.error("Error in SuggestionService.generateTaglines:", {
        error: err.message,
        stack: err.stack,
      });

      // Re-throw the error for the controller to handle
      if (err.name !== "AIServiceError") {
        const serviceError = new Error(
          `AI service failed to generate suggestions: ${err.message}`
        );
        serviceError.name = "AIServiceError";
        serviceError.status = err.status; // Preserve status from AIProvider if it exists
        throw serviceError;
      }

      throw err;
    }
  }

  /**
   * Generates color palette suggestions by calling the AI provider.
   * @param {object} options - The full options object from the request body.
   * Must contain 'niche'.
   * @returns {Promise<object[]>} A promise that resolves to an array of palette objects.
   * @throws {AIServiceError} Throws an error if the AI provider fails.
   */
  async generateColorPalettes(options) {
    logger.info("SuggestionService: Calling AIProvider for 'colorPalettes'", {
      options,
    });

    try {
      // 1. Delegate generation to the AI provider
      const palettes = await this.llmProvider.generate(
        "colorPalettes",
        options
      );

      // 2. Validate AI output
      if (!Array.isArray(palettes) || palettes.length === 0) {
        logger.warn(
          "AIProvider returned an empty or invalid response for colorPalettes",
          { response: palettes }
        );
        throw new Error("AI provider returned an empty or invalid response.");
      }

      // 3. Return the array of palettes
      return palettes;
    } catch (err) {
      logger.error("Error in SuggestionService.generateColorPalettes:", {
        error: err.message,
        stack: err.stack,
      });

      // Re-throw the error for the controller to handle
      if (err.name !== "AIServiceError") {
        const serviceError = new Error(
          `AI service failed to generate suggestions: ${err.message}`
        );
        serviceError.name = "AIServiceError";
        serviceError.status = err.status;
        throw serviceError;
      }

      throw err;
    }
  }

  /**
   * Generates font pair suggestions by calling the AI provider.
   * @param {object} options - The full options object from the request body.
   * Can be empty, but may contain optional filters like 'style'.
   * @returns {Promise<object[]>} A promise that resolves to an array of font pair objects.
   * @throws {AIServiceError} Throws an error if the AI provider fails.
   */
  async generateFontPairs(options) {
    logger.info("SuggestionService: Calling AIProvider for 'fontPairs'", {
      options,
    });

    try {
      // 1. Delegate generation to the AI provider
      const fontPairs = await this.llmProvider.generate("fontPairs", options);

      // 2. Validate AI output
      if (!Array.isArray(fontPairs) || fontPairs.length === 0) {
        logger.warn(
          "AIProvider returned an empty or invalid response for fontPairs",
          { response: fontPairs }
        );
        throw new Error("AI provider returned an empty or invalid response.");
      }

      // 3. Return the array of font pairs
      return fontPairs;
    } catch (err) {
      logger.error("Error in SuggestionService.generateFontPairs:", {
        error: err.message,
        stack: err.stack,
      });

      // Re-throw the error for the controller to handle
      if (err.name !== "AIServiceError") {
        const serviceError = new Error(
          `AI service failed to generate suggestions: ${err.message}`
        );
        serviceError.name = "AIServiceError";
        serviceError.status = err.status;
        throw serviceError;
      }

      throw err;
    }
  }

  /**
   * Generates product/service suggestions by calling the AI provider.
   * @param {object} options - The full options object from the request body.
   * Must contain 'niche'.
   * @returns {Promise<string[]>} A promise that resolves to an array of product/service strings.
   * @throws {AIServiceError} Throws an error if the AI provider fails.
   */
  async generateProducts(options) {
    logger.info("SuggestionService: Calling AIProvider for 'products'", {
      options,
    });

    try {
      // 1. Delegate generation to the AI provider
      const products = await this.llmProvider.generate("products", options);

      // 2. Validate AI output
      if (!Array.isArray(products) || products.length === 0) {
        logger.warn(
          "AIProvider returned an empty or invalid response for products",
          { response: products }
        );
        throw new Error("AI provider returned an empty or invalid response.");
      }

      // 3. Return the array of products
      return products;
    } catch (err) {
      logger.error("Error in SuggestionService.generateProducts:", {
        error: err.message,
        stack: err.stack,
      });

      // Re-throw the error for the controller to handle
      if (err.name !== "AIServiceError") {
        const serviceError = new Error(
          `AI service failed to generate suggestions: ${err.message}`
        );
        serviceError.name = "AIServiceError";
        serviceError.status = err.status;
        throw serviceError;
      }

      throw err;
    }
  }

  /**
   * Generates a business description by calling the AI provider.
   * @param {object} options - The full options object from the request body.
   * Must contain 'niche', 'businessName', 'tagline', 'products'.
   * @returns {Promise<string>} A promise that resolves to a single description string.
   * @throws {AIServiceError} Throws an error if the AI provider fails.
   */
  async generateDescription(options) {
    logger.info("SuggestionService: Calling AIProvider for 'description'", {
      options,
    });

    try {
      // 1. Delegate generation to the AI provider
      const description = await this.llmProvider.generate(
        "description",
        options
      );

      // 2. Validate AI output
      if (typeof description !== "string" || description.trim() === "") {
        logger.warn(
          "AIProvider returned an empty or invalid response for description",
          { response: description }
        );
        throw new Error("AI provider returned an empty or invalid response.");
      }

      // 3. Return the description string
      return description;
    } catch (err) {
      logger.error("Error in SuggestionService.generateDescription:", {
        error: err.message,
        stack: err.stack,
      });

      // Re-throw the error for the controller to handle
      if (err.name !== "AIServiceError") {
        const serviceError = new Error(
          `AI service failed to generate suggestions: ${err.message}`
        );
        serviceError.name = "AIServiceError";
        serviceError.status = err.status;
        throw serviceError;
      }

      throw err;
    }
  }

  /**
   * Generates a logo by orchestrating prompt generation and image generation.
   * @param {object} options - The full options object from the request body.
   * Must contain 'businessName', 'style', and 'niche'.
   * @returns {Promise<{url: string, id: string}>} A promise that resolves to the logo URL and ID.
   * @throws {AIServiceError} Throws an error if any step fails.
   */
  async generateLogo(options) {
    logger.info("SuggestionService: Orchestrating logo generation...", {
      options,
    });

    if (!this.diffusionProvider) {
      throw new AIServiceError("Diffusion provider is not initialized.", 500);
    }

    try {
      // 1. Generate the logo prompt using our LLM provider
      logger.info("Generating logo prompt...");
      const logoPrompt = await this.llmProvider.generate("logoPrompt", options);

      // 2. Prepare parameters for the Fal-AI diffusion provider
      const imageParams = {
        // Per docs: 1:1 aspect ratio
        aspect_ratio: "1:1",
        // Per docs: PNG with transparency
        // This overrides your provider's "jpeg" default.
        output_format: "png",
        num_images: 1,
      };

      // 3. Generate the image using the diffusion provider
      logger.info("Generating logo image with diffusion provider...", {
        logoPrompt,
      });
      const imageResult = await this.diffusionProvider.generateImage(
        logoPrompt,
        imageParams
      );

      // 4. Format the response to match API documentation
      return {
        url: imageResult.imageUrl, // From FalAIDiffusionProvider response
        id: imageResult.jobId, // From FalAIDiffusionProvider response
      };
    } catch (err) {
      logger.error("Error in SuggestionService.generateLogo:", {
        error: err.message,
        stack: err.stack,
      });

      if (err.name !== "AIServiceError") {
        const serviceError = new Error(
          `AI service failed to generate logo: ${err.message}`
        );
        serviceError.name = "AIServiceError";
        serviceError.status = err.status || 503;
        throw serviceError;
      }

      throw err;
    }
  }
}

// Export a singleton instance
module.exports = new SuggestionService();
