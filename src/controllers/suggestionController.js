// We will create and import this service in the next step
const SuggestionService = require("../services/suggestionService");
const logger = require("../utils/logger");

/**
 * Suggestions Controller
 * Handles suggestions endpoints
 */
class SuggestionsController {
  constructor() {
    // Bind 'this' to ensure context is correct when methods are used as route handlers
    this.getBusinessNames = this.getBusinessNames.bind(this);
    this.getTaglines = this.getTaglines.bind(this);
    this.getColorPalettes = this.getColorPalettes.bind(this);
    this.getFonts = this.getFontPairs.bind(this);
    this.getProducts = this.getProducts.bind(this);
    this.getDescription = this.getDescription.bind(this);
    this.genLogo = this.genLogo.bind(this);
  }

  /**
   * @desc    Get a map of all available suggestion endpoints
   * @route   GET /api/suggestions/
   * @access  Public
   */
  async getAvailableEndpoints(req, res) {
    const endpoints = {
      "/api/suggestions/business-names": {
        method: "POST",
        description:
          "Generate creative business name suggestions based on the selected niche.",
        requestBody: {
          niche: {
            type: "string",
            required: true,
            description: "The business niche/industry.",
            supportedValues: [
              "tech",
              "food",
              "fashion",
              "health",
              "education",
              "finance",
              "real-estate",
              "creative",
              "retail",
              "other",
            ],
          },
        },
        responseSchema: {
          suggestions: {
            type: "string[]",
            example: ["TechVision", "InnovateLab", "CodeCraft"],
            description: "Array of 5-10 business name suggestions.",
          },
        },
      },
      "/api/suggestions/taglines": {
        method: "POST",
        description:
          "Generate catchy tagline suggestions based on business name and niche.",
        requestBody: {
          niche: {
            type: "string",
            required: true,
            description: "The business niche/industry.",
          },
          businessName: {
            type: "string",
            required: true,
            description: "The name of the business.",
          },
        },
        responseSchema: {
          suggestions: {
            type: "string[]",
            example: ["Innovation at its finest", "Building the future, today"],
            description: "Array of 5-10 tagline suggestions.",
          },
        },
      },
      "/api/suggestions/color-palettes": {
        method: "POST",
        description:
          "Generate color palette suggestions based on business niche and psychology.",
        requestBody: {
          niche: {
            type: "string",
            required: true,
            description: "The business niche/industry.",
          },
        },
        responseSchema: {
          palettes: {
            type: "ColorPalette[]",
            description: "Array of 6-10 color palettes.",
            itemSchema: {
              id: "string",
              name: "string",
              colors: {
                primary: "string (hex code)",
                secondary: "string (hex code)",
                accent: "string (hex code)",
              },
            },
          },
        },
      },
      "/api/suggestions/font-pairs": {
        method: "POST",
        description: "Generate typography pairings (heading + body fonts).",
        requestBody: {
          description: "This endpoint accepts an empty request body.",
        },
        responseSchema: {
          fontPairs: {
            type: "FontPair[]",
            description: "Array of 6-10 font pairs.",
            itemSchema: {
              id: "string",
              name: "string",
              primary: "string (font name)",
              secondary: "string (font name)",
            },
          },
        },
      },
      "/api/suggestions/products": {
        method: "POST",
        description:
          "Suggest relevant products or services based on business niche.",
        requestBody: {
          niche: {
            type: "string",
            required: true,
            description: "The business niche/industry.",
          },
        },
        responseSchema: {
          products: {
            type: "string[]",
            example: ["Software Development", "Web Design", "Mobile Apps"],
            description: "Array of 8-15 product/service suggestions.",
          },
        },
      },
      "/api/suggestions/generate/logo": {
        method: "POST",
        description: "Generate a custom logo using AI.",
        requestBody: {
          businessName: {
            type: "string",
            required: true,
            description: "Name to incorporate in logo.",
          },
          style: {
            type: "string",
            required: true,
            description: "Style preference for the logo.",
            supportedValues: [
              "modern",
              "classic",
              "minimal",
              "playful",
              "elegant",
              "bold",
            ],
          },
          niche: {
            type: "string",
            required: true,
            description: "Business niche for context.",
          },
        },
        responseSchema: {
          url: {
            type: "string",
            description: "CDN URL of generated logo image.",
          },
          id: {
            type: "string",
            description: "Unique identifier for the logo.",
          },
        },
      },
    };

    res.status(200).json({
      success: true,
      endpoints: endpoints,
    });
  }

  /**
   * @desc    Generate business name suggestions
   * @route   POST /api/suggestions/business-names
   * @access  Private (Auth required)
   */
  async getBusinessNames(req, res) {
    try {
      // 1. Get the entire body as 'options' for flexibility
      const options = req.body;

      // 2. Validate the *minimum* required parameters
      // The docs specify 'niche' is required for this endpoint.
      if (
        !options.niche ||
        typeof options.niche !== "string" ||
        options.niche.trim() === ""
      ) {
        logger.warn(
          "Validation failed for getBusinessNames: 'niche' is required.",
          { body: req.body }
        );
        return res.status(400).json({
          success: false,
          error: "BAD_REQUEST",
          message:
            "The 'niche' parameter is required and must be a non-empty string.",
        });
      }

      // 3. Delegate to the service layer
      // We pass the *entire* 'options' object for future-proof flexibility
      const suggestions = await SuggestionService.generateBusinessNames(
        options
      );

      // 4. Send the successful response
      res.status(200).json({
        suggestions: suggestions, // Per the API documentation response schema
      });
    } catch (err) {
      // 5. Handle errors thrown by the service layer
      logger.error("Error in getBusinessNames controller:", {
        error: err.message,
        stack: err.stack,
      });

      // Check for specific, known errors (e.g., from the AI service)
      if (err.name === "AIServiceError") {
        return res.status(503).json({
          // 503 Service Unavailable is appropriate if the AI service is down
          success: false,
          error: "SERVICE_UNAVAILABLE",
          message:
            "The suggestion service is temporarily unavailable. Please try again later.",
        });
      }

      // Generic internal server error fallback
      res.status(500).json({
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch business names",
      });
    }
  }

  /**
   * @desc    Generate tagline suggestions
   * @route   POST /api/suggestions/taglines
   * @access  Private (Auth required)
   */
  async getTaglines(req, res) {
    try {
      // 1. Get the entire body as 'options'
      const options = req.body;

      // 2. Validate the *minimum* required parameters
      // Docs specify 'niche' and 'businessName' are required
      if (
        !options.niche ||
        typeof options.niche !== "string" ||
        options.niche.trim() === ""
      ) {
        logger.warn("Validation failed for getTaglines: 'niche' is required.", {
          body: req.body,
        });
        return res.status(400).json({
          success: false,
          error: "BAD_REQUEST",
          message:
            "The 'niche' parameter is required and must be a non-empty string.",
        });
      }
      if (
        !options.businessName ||
        typeof options.businessName !== "string" ||
        options.businessName.trim() === ""
      ) {
        logger.warn(
          "Validation failed for getTaglines: 'businessName' is required.",
          { body: req.body }
        );
        return res.status(400).json({
          success: false,
          error: "BAD_REQUEST",
          message:
            "The 'businessName' parameter is required and must be a non-empty string.",
        });
      }

      // 3. Delegate to the service layer
      const suggestions = await SuggestionService.generateTaglines(options);

      // 4. Send the successful response
      res.status(200).json({
        suggestions: suggestions, // Per the API documentation
      });
    } catch (err) {
      // 5. Handle errors from the service layer
      logger.error("Error in getTaglines controller:", {
        error: err.message,
        stack: err.stack,
      });

      if (err.name === "AIServiceError") {
        return res.status(err.status || 503).json({
          success: false,
          error: "SERVICE_UNAVAILABLE",
          message:
            "The suggestion service is temporarily unavailable. Please try again later.",
        });
      }

      // Generic internal server error
      res.status(500).json({
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch taglines",
      });
    }
  }

  /**
   * @desc    Generate color palette suggestions
   * @route   POST /api/suggestions/color-palettes
   * @access  Private (Auth required)
   */
  async getColorPalettes(req, res) {
    try {
      // 1. Get the entire body as 'options'
      const options = req.body;

      // 2. Validate the *minimum* required parameters
      // Docs specify 'niche' is required
      if (
        !options.niche ||
        typeof options.niche !== "string" ||
        options.niche.trim() === ""
      ) {
        logger.warn(
          "Validation failed for getColorPalettes: 'niche' is required.",
          { body: req.body }
        );
        return res.status(400).json({
          success: false,
          error: "BAD_REQUEST",
          message:
            "The 'niche' parameter is required and must be a non-empty string.",
        });
      }

      // 3. Delegate to the service layer
      // The service will return an array of palette objects
      const palettes = await SuggestionService.generateColorPalettes(options);

      // 4. Send the successful response
      // We wrap the array in an object with the 'palettes' key
      // to match the API documentation
      res.status(200).json({
        palettes: palettes,
      });
    } catch (err) {
      // 5. Handle errors from the service layer
      logger.error("Error in getColorPalettes controller:", {
        error: err.message,
        stack: err.stack,
      });

      if (err.name === "AIServiceError") {
        return res.status(err.status || 503).json({
          success: false,
          error: "SERVICE_UNAVAILABLE",
          message:
            "The suggestion service is temporarily unavailable. Please try again later.",
        });
      }

      // Generic internal server error
      res.status(500).json({
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch color palettes",
      });
    }
  }

  /**
   * @desc    Generate font pair suggestions
   * @route   POST /api/suggestions/font-pairs
   * @access  Private (Auth required)
   */
  async getFontPairs(req, res) {
    // Renamed from getFonts for clarity
    try {
      // 1. Get the entire body as 'options'.
      // Docs say no params are required, but we pass for flexibility.
      const options = req.body;

      // 2. No validation needed, per docs

      // 3. Delegate to the service layer
      const fontPairs = await SuggestionService.generateFontPairs(options);

      // 4. Send the successful response
      // Wrap the array in an object with the 'fontPairs' key
      // to match the API documentation
      res.status(200).json({
        fontPairs: fontPairs,
      });
    } catch (err) {
      // 5. Handle errors from the service layer
      logger.error("Error in getFontPairs controller:", {
        error: err.message,
        stack: err.stack,
      });

      if (err.name === "AIServiceError") {
        return res.status(err.status || 503).json({
          success: false,
          error: "SERVICE_UNAVAILABLE",
          message:
            "The suggestion service is temporarily unavailable. Please try again later.",
        });
      }

      // Generic internal server error
      res.status(500).json({
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch font pairs",
      });
    }
  }

  /**
   * @desc    Suggest products or services
   * @route   POST /api/suggestions/products
   * @access  Private (Auth required)
   */
  async getProducts(req, res) {
    try {
      // 1. Get the entire body as 'options'
      const options = req.body;

      // 2. Validate the *minimum* required parameters
      // Docs specify 'niche' is required
      if (
        !options.niche ||
        typeof options.niche !== "string" ||
        options.niche.trim() === ""
      ) {
        logger.warn("Validation failed for getProducts: 'niche' is required.", {
          body: req.body,
        });
        return res.status(400).json({
          success: false,
          error: "BAD_REQUEST",
          message:
            "The 'niche' parameter is required and must be a non-empty string.",
        });
      }

      // 3. Delegate to the service layer
      const products = await SuggestionService.generateProducts(options);

      // 4. Send the successful response
      // Wrap the array in an object with the 'products' key
      // to match the API documentation
      res.status(200).json({
        products: products,
      });
    } catch (err) {
      // 5. Handle errors from the service layer
      logger.error("Error in getProducts controller:", {
        error: err.message,
        stack: err.stack,
      });

      if (err.name === "AIServiceError") {
        return res.status(err.status || 503).json({
          success: false,
          error: "SERVICE_UNAVAILABLE",
          message:
            "The suggestion service is temporarily unavailable. Please try again later.",
        });
      }

      // Generic internal server error
      res.status(500).json({
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch product suggestions",
      });
    }
  }

  /**
   * @desc    Generate a business description
   * @route   POST /api/suggestions/description (Assuming this route)
   * @access  Private (Auth required)
   */
  async getDescription(req, res) {
    try {
      // 1. Get the entire body as 'options'
      const options = req.body;

      // 2. Validate the *minimum* required parameters
      // User specified: niche, name (using businessName), tagline, products
      const required = ["niche", "businessName", "tagline", "products"];
      for (const param of required) {
        if (!options[param]) {
          const message = `The '${param}' parameter is required.`;
          logger.warn(`Validation failed for getDescription: ${message}`, {
            body: req.body,
          });
          return res.status(400).json({
            success: false,
            error: "BAD_REQUEST",
            message: message,
          });
        }
      }

      // Specific check for 'products' array
      if (!Array.isArray(options.products) || options.products.length === 0) {
        const message = "The 'products' parameter must be a non-empty array.";
        logger.warn(`Validation failed for getDescription: ${message}`, {
          body: req.body,
        });
        return res.status(400).json({
          success: false,
          error: "BAD_REQUEST",
          message: message,
        });
      }

      // 3. Delegate to the service layer
      // The service will return a single string
      const description = await SuggestionService.generateDescription(options);

      // 4. Send the successful response
      // We wrap the string in an object with the 'description' key
      res.status(200).json({
        description: description,
      });
    } catch (err) {
      // 5. Handle errors from the service layer
      logger.error("Error in getDescription controller:", {
        error: err.message,
        stack: err.stack,
      });

      if (err.name === "AIServiceError") {
        return res.status(err.status || 503).json({
          success: false,
          error: "SERVICE_UNAVAILABLE",
          message:
            "The suggestion service is temporarily unavailable. Please try again later.",
        });
      }

      // Generic internal server error
      res.status(500).json({
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch description",
      });
    }
  }

  /**
   * @desc    Generate a logo
   * @route   POST /api/suggestions/generate/logo
   * @access  Private (Auth required)
   */
  async genLogo(req, res) {
    try {
      // 1. Get the entire body as 'options'
      const options = req.body;

      // 2. Validate the *minimum* required parameters
      const required = ["businessName", "style", "niche"];
      for (const param of required) {
        if (
          !options[param] ||
          typeof options[param] !== "string" ||
          options[param].trim() === ""
        ) {
          const message = `The '${param}' parameter is required and must be a non-empty string.`;
          logger.warn(`Validation failed for genLogo: ${message}`, {
            body: req.body,
          });
          return res.status(400).json({
            success: false,
            error: "BAD_REQUEST",
            message: message,
          });
        }
      }

      // 3. Delegate to the service layer
      // The service will return an object { url, id }
      const logoData = await SuggestionService.generateLogo(options);

      // 4. Send the successful response
      // The response format matches the API documentation
      res.status(200).json({
        url: logoData.url,
        id: logoData.id,
      });
    } catch (err) {
      // 5. Handle errors from the service layer
      logger.error("Error in genLogo controller:", {
        error: err.message,
        stack: err.stack,
      });

      if (err.name === "AIServiceError") {
        return res.status(err.status || 503).json({
          success: false,
          error: "SERVICE_UNAVAILABLE",
          message:
            "The suggestion service is temporarily unavailable. Please try again later.",
        });
      }

      // Generic internal server error
      res.status(500).json({
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "Failed to generate logo",
      });
    }
  }
}

// Export a singleton instance
module.exports = new SuggestionsController();
