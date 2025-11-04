const logger = require("../../utils/logger");
// Import the classes from the file you provided
// Assumes 'openaiProvider.js' is in the same directory
const { OpenAILLMProvider } = require("./openaiProvider");

// Define a custom error class for AI-specific failures.
class AIServiceError extends Error {
  constructor(message, status = 503) {
    super(message);
    this.name = "AIServiceError";
    this.status = status; // HTTP status code to suggest
  }
}

/**
 * Provides an abstraction layer for interacting with AI models.
 * Handles prompt generation, AI calls, and response parsing.
 * This class adapts our simple service to your more complex providers.
 */
class AIProvider {
  constructor() {
    // Instantiate your LLM provider.
    // It will automatically pick up the API key from process.env.OPENAI_API_KEY
    try {
      this.llmProvider = new OpenAILLMProvider({
        model: "gpt-4", // We can override the model if needed
      });
    } catch (err) {
      logger.error("Failed to initialize OpenAILLMProvider:", err.message);
      throw new Error(
        `AIProvider setup failed: ${err.message}. Is OPENAI_API_KEY set?`
      );
    }
  }

  /**
   * Main generation method.
   * @param {string} type - The type of content to generate (e.g., "businessNames", "taglines").
   * @param {object} options - The full options object from the request.
   * @returns {Promise<any>} A promise that resolves to the parsed AI response.
   */
  async generate(type, options) {
    let promptObject;
    let model;
    let isJsonOutput = true; // Default to JSON output
    let maxTokens = 1500;

    // 1. Build the prompt dynamically based on the 'type'
    try {
      switch (type) {
        case "businessNames":
          promptObject = this._buildBusinessNamePrompt(options);
          model = this.llmProvider.model || "gpt-4"; // Use model from provider
          break;
        case "taglines":
          promptObject = this._buildTaglinePrompt(options);
          model = this.llmProvider.model || "gpt-4";
          break;
        case "colorPalettes":
          promptObject = this._buildColorPalettePrompt(options);
          model = this.llmProvider.model || "gpt-4";
          break;
        case "fontPairs":
          promptObject = this._buildFontPairPrompt(options);
          model = this.llmProvider.model || "gpt-4";
          break;
        case "products":
          promptObject = this._buildProductPrompt(options);
          model = this.llmProvider.model || "gpt-4";
          break;
        case "description":
          promptObject = this._buildDescriptionPrompt(options);
          model = this.llmProvider.model || "gpt-4";
          isJsonOutput = false; // Flag for raw text output
          break;
        case "logoPrompt":
          promptObject = this._buildLogoPrompt(options);
          model = this.llmProvider.model || "gpt-4";
          isJsonOutput = false; // We just want the raw prompt string
          maxTokens = 300; // For a short prompt
          break;
        default:
          logger.warn(`AIProvider: Unknown generation type requested: ${type}`);
          throw new AIServiceError(`Unknown generation type: ${type}`, 400); // 400 Bad Request
      }
    } catch (err) {
      logger.error(`AIProvider: Error building prompt for ${type}`, {
        error: err.message,
      });
      throw new AIServiceError(
        `Invalid options for ${type}: ${err.message}`,
        400
      ); // 400 Bad Request
    }

    // 2. Call the AI service
    let rawResponse; // This will be the JSON *string* we need
    try {
      // Prepare the request body for the OpenAI chat/completions endpoint
      const apiData = {
        model: model,
        messages: [
          { role: "system", content: promptObject.systemPrompt },
          { role: "user", content: promptObject.userPrompt },
        ],
        max_tokens: maxTokens, // Enough for a list of names
        temperature: 0.9, // Creative temperature
      };

      // Use the makeAPICall method from your OpenAILLMProvider
      const response = await this.llmProvider.makeAPICall(
        "/chat/completions",
        apiData
      );

      // Extract the raw content
      if (
        !response.choices ||
        !response.choices[0] ||
        !response.choices[0].message
      ) {
        throw new Error("Invalid response structure from OpenAI API");
      }

      rawResponse = response.choices[0].message.content;

      if (typeof rawResponse !== "string" || rawResponse.trim() === "") {
        throw new Error("AI returned an empty or non-string response.");
      }
    } catch (err) {
      logger.error(`AIProvider: AI service call failed: ${err.message}`, {
        options,
      });
      // Pass the error message from the underlying provider
      throw new AIServiceError(`AI service call failed: ${err.message}`); // 503
    }

    // 3. Parse the AI response
    try {
      if (isJsonOutput) {
        // All JSON responses are expected to have a 'suggestions' key
        const jsonObject = JSON.parse(rawResponse);
        const suggestions = jsonObject.suggestions;

        if (!Array.isArray(suggestions)) {
          throw new Error("AI response was not a valid JSON array.");
        }
        return suggestions;
      }
      return rawResponse.trim();
    } catch (err) {
      logger.error(`AIProvider: Failed to parse AI response: ${err.message}`, {
        rawResponse,
      });
      throw new AIServiceError(
        `AI returned a malformed response: ${err.message}`
      ); // 503
    }
  }

  /**
   * Private helper to build the prompt for 'businessNames'.
   * Returns an object with system and user prompts.
   * @param {object} options - The request options (e.g., { niche: "tech", style: "modern" }).
   * @returns {{systemPrompt: string, userPrompt: string}}
   */
  _buildBusinessNamePrompt(options) {
    const systemPrompt = `You are a creative branding expert. You respond *only* with valid JSON.
      The names should be:
      - Easy to pronounce and remember
      - Relevant to the niche
      - Unique and brandable`;

    // Start with the base user prompt
    let userPrompt = [
      `Generate 10 creative, unique, and brandable business names for a new business.`,
      "The names should be 1-3 words long and easy to remember.",
    ];

    // 1. Add the *required* 'niche' parameter
    if (options.niche) {
      userPrompt.push(`The business niche is: "${options.niche}".`);
    } else {
      throw new Error("'niche' is required to build the prompt.");
    }

    // 2. Add *flexible, future* parameters
    if (options.style) {
      userPrompt.push(`The desired brand style is: "${options.style}".`);
    }
    if (
      options.keywords &&
      Array.isArray(options.keywords) &&
      options.keywords.length > 0
    ) {
      userPrompt.push(
        `Incorporate themes from these keywords: ${options.keywords.join(
          ", "
        )}.`
      );
    }

    // 3. Add final formatting instructions
    userPrompt.push(
      'Return the list in a JSON object, under a single key named "suggestions".'
    );
    userPrompt.push('Example: { "suggestions": ["Name1", "Name2", ...] }');

    return {
      systemPrompt: systemPrompt,
      userPrompt: userPrompt.join("\n"),
    };
  }

  /**
   * Private helper to build the prompt for 'taglines'.
   * @param {object} options - The request options (e.g., { niche: "tech", businessName: "TechVision" }).
   * @returns {{systemPrompt: string, userPrompt: string}}
   */
  _buildTaglinePrompt(options) {
    const systemPrompt = `You are a creative marketing and branding expert. You respond *only* with valid JSON.
      The taglines should be:
      - Complement the business name
      - Catch attention
      - Reflect the niche/industry
      - Are memorable and concise (5-10 words)
      - Convey value proposition
      - Are emotionally resonant, the reader should be drawn in
      - Are unique and brandable`;

    let userPrompt = [
      `Generate 5-10 catchy and creative taglines.`,
      "Taglines should be concise, memorable, and 5-10 words long.",
    ];

    // 1. Add *required* parameters
    if (options.businessName) {
      userPrompt.push(`The business name is: "${options.businessName}".`);
    } else {
      throw new Error("'businessName' is required to build the prompt.");
    }

    if (options.niche) {
      userPrompt.push(`The business niche is: "${options.niche}".`);
    } else {
      throw new Error("'niche' is required to build the prompt.");
    }

    // 2. Add *flexible, future* parameters
    if (options.style) {
      userPrompt.push(
        `The desired brand style is: "${options.style}" (e.g., playful, professional, bold).`
      );
    }
    if (
      options.keywords &&
      Array.isArray(options.keywords) &&
      options.keywords.length > 0
    ) {
      userPrompt.push(
        `Incorporate these keywords or themes: ${options.keywords.join(", ")}.`
      );
    }
    if (options.targetAudience) {
      userPrompt.push(`The target audience is: "${options.targetAudience}".`);
    }

    // 3. Add final formatting instructions
    userPrompt.push(
      '\nReturn the list in a JSON object, under a single key named "suggestions".'
    );
    userPrompt.push(
      'Example: { "suggestions": ["Tagline one", "Tagline two", ...] }'
    );

    return {
      systemPrompt: systemPrompt,
      userPrompt: userPrompt.join("\n"),
    };
  }

  /**
   * --- ADD THIS NEW METHOD ---
   * Private helper to build the prompt for 'colorPalettes'.
   * @param {object} options - The request options (e.g., { niche: "health" }).
   * @returns {{systemPrompt: string, userPrompt: string}}
   */
  _buildColorPalettePrompt(options) {
    const systemPrompt = `You are a professional brand designer and color theory expert. You respond *only* with valid JSON.
      The color palettes should follow these guidelines:
      - Color psychology for the niche
      - Industry standards and trends
      - Accessibility (WCAG AA compliance)
      - Contrast ratios for readability
      - Consider cultural color meanings
      - Ensure colors work well together
      - Color harmony and balance`;

    let userPrompt = [
      `Generate 6-10 color palettes.`,
      "Each palette must include a 'primary', 'secondary', and 'accent' color, all as hex codes.",
      "Each palette object must also have a unique 'id' (string) and 'name' (string).",
    ];

    // 1. Add *required* parameters
    if (options.niche) {
      userPrompt.push(`The business niche is: "${options.niche}".`);
      userPrompt.push(`Base the palettes on color psychology for this niche.`);
      // Add guidance from docs
      userPrompt.push(
        "For example: 'health' (greens/blues), 'food' (reds/greens), 'tech' (blues/purples), 'finance' (blues/greens)."
      );
    } else {
      throw new Error("'niche' is required to build the prompt.");
    }

    // 2. Add *flexible, future* parameters
    if (options.style) {
      userPrompt.push(
        `The desired brand style is: "${options.style}" (e.g., modern, classic, playful).`
      );
    }

    // 3. Add *flexible, future* parameters
    if (options.businessName) {
      userPrompt.push(`The business name is: "${options.businessName}".`);
    }

    // 4. Add *flexible, future* parameters
    if (options.tagline) {
      userPrompt.push(`The tagline is: "${options.tagline}".`);
    }

    if (
      options.keywords &&
      Array.isArray(options.keywords) &&
      options.keywords.length > 0
    ) {
      userPrompt.push(
        `The palettes should evoke these feelings: ${options.keywords.join(
          ", "
        )}.`
      );
    }

    // 3. Add final formatting instructions
    // We *consistently* ask for the 'suggestions' key
    // to keep our parsing logic simple.
    userPrompt.push(
      '\nReturn the list of palette objects in a JSON object, under a single key named "suggestions".'
    );
    userPrompt.push(
      'Example: { "suggestions": [ { "id": "calm-blue", "name": "Calm Blue", "colors": { "primary": "#0ea5e9", "secondary": "#0284c7", "accent": "#06b6d4" } }, ... ] }'
    );

    return {
      systemPrompt: systemPrompt,
      userPrompt: userPrompt.join("\n"),
    };
  }

  /**
   * --- ADD THIS NEW METHOD ---
   * Private helper to build the prompt for 'fontPairs'.
   * @param {object} options - The request options (e.g., { style: "modern" }).
   * @returns {{systemPrompt: string, userPrompt: string}}
   */
  _buildFontPairPrompt(options) {
    const systemPrompt = `You are a professional typographer and brand designer. You respond *only* with valid JSON.
      The font pairings should follow these guidelines:
      - Work well together (contrast + harmony)
      - Are web-safe or Google Fonts
      - Have good readability
      - Cover different styles (modern, classic, playful, elegant)
      Recommended Font Pairs [Not limited to these only]:
      - Modern Sans: Inter + Roboto
      - Classic Serif: Playfair Display + Lora
      - Tech Forward: Space Grotesk + JetBrains Mono
      - Elegant: Cormorant + Montserrat
      - Friendly: Poppins + Open Sans
      - Bold Statement: Bebas Neue + Raleway`;

    let userPrompt = [
      `Generate 6-10 curated font pairings.`,
      "Each pairing must include a 'primary' font (for headings) and a 'secondary' font (for body text).",
      "The fonts should be from Google Fonts or be web-safe.",
      "Each pairing object must also have a unique 'id' (string) and 'name' (string, e.g., 'Modern Sans').",
      "Provide a good mix of styles (modern, classic, elegant, tech, etc.), like 'Inter + Roboto' or 'Playfair Display + Lora'.",
    ];

    // 1. Add *flexible, future* parameters
    // Even though no params are required, we can still use them!
    if (options.style) {
      userPrompt.push(`Focus on pairings with a "${options.style}" style.`);
    }

    // 2. Add final formatting instructions
    userPrompt.push(
      '\nReturn the list of font pair objects in a JSON object, under a single key named "suggestions".'
    );
    userPrompt.push(
      'Example: { "suggestions": [ { "id": "1", "name": "Modern Sans", "primary": "Inter", "secondary": "Roboto" }, ... ] }'
    );

    return {
      systemPrompt: systemPrompt,
      userPrompt: userPrompt.join("\n"),
    };
  }

  /**
   * --- ADD THIS NEW METHOD ---
   * Private helper to build the prompt for 'products'.
   * @param {object} options - The request options (e.g., { niche: "tech" }).
   * @returns {{systemPrompt: string, userPrompt: string}}
   */
  _buildProductPrompt(options) {
    const systemPrompt = `You are a business consultant and industry expert. You respond *only* with valid JSON.
      The products should be relevant to the niche.
      Products should cover these areas:
      - Common products/services in the niche
      - Trending offerings
      - Complementary services
      - Upsell opportunities
      - Order by popularity or relevance`;

    let userPrompt = [
      `Generate a list of 8-15 relevant products or services.`,
      "The names should be concise (2-4 words) and relevant.",
      "Include a mix of common, trending, and complementary offerings.",
    ];

    // 1. Add *required* parameters
    if (options.niche) {
      userPrompt.push(`The business niche is: "${options.niche}".`);
    } else {
      throw new Error("'niche' is required to build the prompt.");
    }

    // 2. Add *flexible, future* parameters
    if (options.businessName) {
      userPrompt.push(`The business name is: "${options.businessName}".`);
    }
    if (options.style) {
      userPrompt.push(
        `The business style is: "${options.style}" (e.g., "B2B", "B2C", "SaaS", "E-commerce").`
      );
    }
    if (options.targetAudience) {
      userPrompt.push(`The target audience is: "${options.targetAudience}".`);
    }

    // 3. Add final formatting instructions
    userPrompt.push(
      '\nReturn the list as a simple array of strings in a JSON object, under a single key named "suggestions".'
    );
    userPrompt.push(
      'Example: { "suggestions": ["Product One", "Service Two", "Consulting Three", ...] }'
    );

    return {
      systemPrompt: systemPrompt,
      userPrompt: userPrompt.join("\n"),
    };
  }

  
  /**
   * --- ADD THIS NEW METHOD ---
   * Private helper to build the prompt for 'description'.
   * @param {object} options - The request options.
   * @returns {{systemPrompt: string, userPrompt: string}}
   */
  _buildDescriptionPrompt(options) {
    const systemPrompt =
      `You are a professional copywriter and brand strategist.
      You write clear, compelling, and concise text. You respond *only* with the requested text, no pleasantries or extra formatting.
      Your task is to enhance the brand description provided by the user.
      Brand Info provided:
      - Business Name
      - Niche
      - Description [Initial raw description provided by user]
      You may also have additional information if provided by user. In such cases, use the provided information to enhance the description.
      Guidelines:
      - Use the provided information to generate a compelling and engaging description.
      - Focus on the niche and target audience.
      - Use the provided tone and personality.
      - Should be catchy and professional.
      - Use the provided keywords and product offerings.
      - Use the provided visual elements and imagery. Use the visuals to create a unique and visually appealing description.
      - Include a mix of keywords, product offerings, and visual elements.`;

    let userPrompt = [
      `Write a compelling "About Us" or brand description (approx 50-100 words).`,
      `The description must be based professionally crafted and engaging. Business Info provided:`,
    ];

    // 1. Add *required* parameters
    userPrompt.push(`- Business Name: "${options.businessName}"`);
    userPrompt.push(`- Niche: "${options.niche}"`);
    userPrompt.push(`- Description: "${options.description}"`);

    // 2. Add *flexible, optional* parameters
    userPrompt.push("\nUse these optional details to guide the writing:");
    if (options.tagline) {
      userPrompt.push(`- Tagline: "${options.tagline}"`);
    }
    if (options.products && Array.isArray(options.products) && options.products.length > 0) {
      userPrompt.push(`- Products/Services: ${options.products.join(", ")}.`);
    }
    if (options.targetAudience) {
      userPrompt.push(`- Target Audience: ${options.targetAudience}`);
    }
    if (options.tone) {
      userPrompt.push(`- Tone: ${options.tone}`);
    }
    if (options.personality) {
      userPrompt.push(`- Brand Personality: ${options.personality}`);
    }
    if (options.emotions) {
      userPrompt.push(`- Emotions to Evoke: ${options.emotions}`);
    }
    if (options.history) {
      userPrompt.push(`- Company History/Origin: ${options.history}`);
    }

    // 3. Add final formatting instructions
    userPrompt.push(
      "\nRespond *only* with the final description text. Do not include any other text or JSON formatting."
    );

    return {
      systemPrompt: systemPrompt,
      userPrompt: userPrompt.join("\n"),
    };
  }

  /**
   * --- ADD THIS NEW METHOD ---
   * Private helper to build the prompt for 'logoPrompt'.
   * @param {object} options - The request options.
   * @returns {{systemPrompt: string, userPrompt: string}}
   */
  _buildLogoPrompt(options) {
    const systemPrompt = `You are an expert prompt engineer for AI image models. Your task is to create professional prompts to generate logos for brands. You respond *only* with the prompt text.
    Guidelines:
    - You'll be provided with brand info and other details
    - Use the provided info to understand the brand's style, pshycology and personality.
    - The logos must be professional and resonate with the brand values. They should be creative and visually appealing.
    - Logo must reflect the brand's target audience and niche.
    - You need to craft unique and creative ideas for logos`;

    // Use the exact template from the documentation for best results
    //
    let userPrompt = [
      `Create a professional logo for "${options.businessName}", a ${options.niche} business.`,
      `Style: ${options.style}.`,
      "Requirements:",
      "- Clean and modern design",
      "- Suitable for digital and print",
      "- Memorable and unique",
      "- Professional appearance",
      "- Transparent background"
    ];

    // 1. Add *flexible, future* parameters
    if (options.color) {
      userPrompt.push(`- Main color: ${options.color}`);
    }
    
    if (options.brandDescription) {
      userPrompt.push(`- Business description: ${options.brandDescription}`);
    }

    // 2. Add final formatting instructions
    userPrompt.push("\nRespond *only* with the prompt text. Do not add any other words or formatting.");

    return {
      systemPrompt: systemPrompt,
      userPrompt: userPrompt.join("\n")
    };
  }
}

// Export a singleton instance
module.exports = new AIProvider();