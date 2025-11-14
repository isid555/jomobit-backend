const BasePosterGenerator = require("./baseGenerator");
const llmService = require("../llm/llmService");
const { parseJSONObject } = require("../../utils/jsonParser");
const { providerFactory } = require("../aiProviders/providerFactory");
const logger = require("../../utils/logger");

/**
 * Wishing Poster Generator
 * Handles wishing/greeting poster generation
 */
class WishingPosterGenerator extends BasePosterGenerator {
  /**
   * Generate wishing poster
   * @param {Object} job - Generation job
   * @returns {Promise<Object>} Generation result
   */
  async generate(job) {
    logger.info("Starting wishing poster generation", {
      jobId: job._id,
    });

    // Start prompt timing
    this.startPromptTiming();

    // Preprocessing
    const { niche, templateMetadata } = await this.preprocess(job);

    // Decide Type A or Type B
    const decision = await this.decideType(
      job.profileId,
      templateMetadata
    );

    let finalPrompt;
    let promptParameters;

    if (decision.type === "TYPE_A") {
      const typeAResult = await this.generateTypeA(
        job,
        niche,
        templateMetadata,
        decision.products
      );
      finalPrompt = typeAResult.prompt;
      promptParameters = typeAResult.parameters;
    } else {
      const typeBResult = await this.generateTypeB(job, niche, templateMetadata);
      finalPrompt = typeBResult.prompt;
      promptParameters = typeBResult.parameters;
    }

    // End prompt timing
    const promptGenerationTime = this.endPromptTiming();

    // Start image timing
    this.startImageTiming();

    // Generate poster using diffusion
    const result = await this.generatePoster(job, finalPrompt);

    // End image timing
    const imageGenerationTime = this.endImageTiming();

    // Add prompt data and timing to result
    result.prompt = finalPrompt;
    result.promptParameters = {
      ...promptParameters,
      posterSubType: decision.type,
      selectedProducts: decision.products,
      promptGenerationTime
    };
    result.timing = {
      promptGenerationTime,
      imageGenerationTime,
      totalProcessingTime: promptGenerationTime + imageGenerationTime
    };

    return this.postprocess(job, result);
  }

  /**
   * Decide between Type A (with products) or Type B (no products)
   * @param {Object} profile - Business profile
   * @param {Object} templateMetadata - Template metadata
   * @returns {Promise<Object>} Decision object with type and selected products
   */
  async decideType(profile, templateMetadata) {
    const systemPrompt = `You are a professional design strategist with expertise in designing wishing posters.
    Analyze the template and decide if brand products should be included in the wishing poster.
    Consider:
    - Template layout and space availability
    - Template style (product-friendly or abstract)
    - Composition guidelines
    - Creative flexibility
    - Brand products
    - Analyze the template content carefully and decide if products should be included.
    - If products are included then return a list containing the brand products that can be used in the poster. If no products can be used in the poster then return an empty list.
    - The poster should contain either a single product or combo or collection of products. Either of type and this should be randomly decided not template influence.
    - Strictly Avoid mannequins

    Meaning of single, combo, collection:
    - Single: a single product is included in the poster
    - Combo: two matching products is included in the poster
    - Collection: a collection of products to be included in the poster
    ex for fashion brands- collection of shirts, collection of jeans, single shirt/jeans, shirt & jeans together [combo], etc
    for watches brands- collection of watches, single watch, same watch model but two different colors etc. Similar applies to shoes, sunglasses, electronics, etc.
    for object selling brands- collection of objects, single object, etc

    Example: for collections posters (if products are fashion):
    products: [
    'Shirts', 'T-shirts', 'Polo shirts', 'Hoodies', 'Sweatshirts', 'Tank tops'
    ]
    or
    products: [
    'Jeans', 'Trousers', 'Cargo pants', 'Joggers', 'Shorts'
    ]

    for combo posters (if products are fashion):
    products: [
    'Shirt', 'Jeans'
    ]
    or (if products are wearables):
    products: [
    'Watch', 'Sunglasses'
    ]
    or
    products: [
    'Shirt', 'Watch'
    ]

    for single product posters (if products are fashion):
    products: [
    'Shirt'
    ]
    or (if products are wearables):
    products: [
    'Watch'
    ]
    or  (if products are wearables):
    products: [
    'Sunglasses'
    ]

    Respond with either TYPE_A (include products) or TYPE_B (no products) as type
    Required output schema:
    {
      "type": "TYPE_A" or "TYPE_B",
      "products": [
        "product1",
        "product2",
        "product3"
      ]
    }`;

    const userPrompt = `Template Analysis:
    Composition Guidelines: ${templateMetadata.poster_design_metadata.composition_guidelines}
    Style: ${templateMetadata.poster_design_metadata.style_and_aesthetic.aesthetic_keywords.join(
      ", "
    )}
    Fixed Elements: ${templateMetadata.poster_design_metadata.creative_flexibility.fixed.join(
      ", "
    )}
    Brand Products: ${profile.products?.join(", ")}

    Should products be included? If yes, which products?`;

    const response = await llmService.call(
      "TYPE_DECISION",
      systemPrompt,
      userPrompt
    );

    // Parse JSON response
    const decision = parseJSONObject(response, 'wishing_type_decision');

    logger.info('Type decision made', {
      type: decision.type,
      selectedProducts: decision.products,
      productCount: decision.products?.length || 0
    });

    return {
      type: decision.type,
      products: decision.products || []
    };
  }

  /**
   * Generate Type A poster (with products)
   * @param {Object} job - Generation job
   * @param {string} niche - Brand niche
   * @param {Object} templateMetadata - Template metadata
   * @param {Array} selectedProducts - Selected products from decideType
   * @returns {Promise<Object>} Prompt and parameters
   */
  async generateTypeA(job, niche, templateMetadata, selectedProducts) {
    logger.info("Generating Type A wishing poster", {
      jobId: job._id,
      selectedProducts,
      productCount: selectedProducts.length
    });

    // Select and describe products
    const productDescription = await this.generateProductDescription(
      job.profileId,
      templateMetadata,
      selectedProducts
    );

    // Generate copy
    const copy = await this.generateCopy(
      job.profileId,
      templateMetadata,
      "TYPE_A"
    );

    // Build final prompt
    const finalPrompt = await this.buildFinalPrompt(
      job,
      niche,
      templateMetadata,
      copy,
      productDescription,
      'TYPE_A'
    );

    return {
      prompt: finalPrompt,
      parameters: {
        llmProvider: job.aiProvider.llm,
        profileId: job.profileId._id,
        templateId: job.templateId._id,
        posterType: job.posterType,
        niche,
        type: 'TYPE_A',
        hasProducts: true,
        selectedProducts,
        copy,
        productDescription
      }
    };
  }

  /**
   * Generate Type B poster (no products)
   * @param {Object} job - Generation job
   * @param {string} niche - Brand niche
   * @param {Object} templateMetadata - Template metadata
   * @returns {Promise<Object>} Prompt and parameters
   */
  async generateTypeB(job, niche, templateMetadata) {
    logger.info("Generating Type B wishing poster", { jobId: job._id });

    // Generate copy
    const copy = await this.generateCopy(
      job.profileId,
      templateMetadata,
      "TYPE_B"
    );

    // Build final prompt
    const finalPrompt = await this.buildFinalPrompt(
      job,
      niche,
      templateMetadata,
      copy,
      null,
      'TYPE_B'
    );

    return {
      prompt: finalPrompt,
      parameters: {
        llmProvider: job.aiProvider.llm,
        profileId: job.profileId._id,
        templateId: job.templateId._id,
        posterType: job.posterType,
        niche,
        type: 'TYPE_B',
        hasProducts: false,
        copy
      }
    };
  }

  /**
   * Generate product description
   * @param {Object} profile - Business profile
   * @param {Object} templateMetadata - Template metadata
   * @param {Array} selectedProducts - Selected products from decideType
   * @returns {Promise<string>} Product description
   */
  async generateProductDescription(profile, templateMetadata, selectedProducts) {
    const systemPrompt = `You are a product stylist and visual merchandiser. You also expertize in prompt engineering for diffusion models.
    Given the list of brand product/products you need to generate description of the products. The product must be relevant to the brand personality and niche. If product description is provided then it must be used in the final description.

    Guidelines for image generation:
    - Focus on high quality and realistic images
    - Use real world products and product photography
    - Avoid hallucinated and abstract
    - It could be a single product, a combo, or a collection.
    ex (for fashion brand, similar analogys apply to other niches): if single product for a fashion brand like shirt then generate rich description of the shirt, its color, fabric, style, etc.
    if combo of a fashion brand like shirt and jeans then generate rich description of both the shirt and jeans, its color, fabric, style, etc.
    for collections, no need to generate detailed description of each product but must specify the color, style, fabric, etc and how they should be aligned together to place everything in the collection for a fashion campaign poster.
    - If the brand is a service/agency based brand then describe visuals or objects that symbolizes the brand tailored to the services they sell.
    - For fashion brands, describe visuals of real fabrics, textures, brands product style clothes, real clothes.
    - For object selling brands [jewellery, watches, sunglasses, etc], describe visuals of real objects.
    - No mannequins, use real human models if required wearing/holding the product.

    Consider:
    - Product selection (single, combo, or collection)
    - Alignment and placement logic
    - Visual hierarchy
    - Template & Brand color palette to match the product mood, style and color to properly match with the scene, festive and brand essence.
    - Product photography style

    Be specific about arrangement, lighting, and presentation.`;

    const userPrompt = `Brand: ${profile.name}
    Festival: ${templateMetadata.festival_name}
    Selected Products: ${selectedProducts.join(", ")}
    Brand tagline: ${profile.tagline}
    Business Logo: ${profile.logo ? "Logo is provided" : "Not provided"}
    Brand description: ${profile.description}
    Brand color palette: ${profile.colorPalette}
    Template Color Palette: ${JSON.stringify(templateMetadata.poster_design_metadata.style_and_aesthetic.color_palette)}
    Target Style: ${JSON.stringify(templateMetadata.poster_design_metadata.style_and_aesthetic, null)}

    Generate description of the SELECTED products:`;

    return await llmService.call(
      "PRODUCT_DESCRIPTION",
      systemPrompt,
      userPrompt
    );
  }

  /**
   * Generate copy (headline + quote)
   * @param {Object} profile - Business profile
   * @param {Object} templateMetadata - Template metadata
   * @param {string} type - 'TYPE_A' or 'TYPE_B'
   * @returns {Promise<Object>} Copy object
   */
  async generateCopy(profile, templateMetadata, type) {
    const systemPrompt = `You are a creative copywriter specializing in festive greetings.
    Generate elegant, emotional copy for a wishing poster depending upon the festival and brand:
    - Headline: Festive greeting that wishes the audience on the occasion of festive [2-4 words max]
    - Quote: 1-2 liner that grabs reader's attention and triggers emotions, should be concise, meaningfull and catchy.
    The copy should be written in human writing style with natural tone and emotions catching the festive sacredness and reader's heart.
    Style should match template typography: ${templateMetadata.poster_design_metadata.typography.copy_styles}
    Respond in JSON format:
    {
      "headline": "...",
      "quote": "..."
    }`;

    const userPrompt = `Brand: ${profile.name}
    Tagline: ${profile.tagline}
    Festival: ${templateMetadata.festival_name}
    Type: ${type}
    Generate festive copy:`;

    const response = await llmService.call(
      "COPY_GENERATION",
      systemPrompt,
      userPrompt
    );
    return parseJSONObject(response, "wishing_copy_generation");
  }

  /**
   * Build final prompt for diffusion
   * @param {Object} job - Generation job
   * @param {string} niche - Brand niche
   * @param {Object} templateMetadata - Template metadata
   * @param {Object} copy - Generated copy
   * @param {string|null} productDescription - Product description (if Type A)
   * @returns {Promise<string>} Final prompt
   */
  async buildFinalPrompt(
    job,
    niche,
    templateMetadata,
    copy,
    productDescription,
    posterType
  ) {
    const systemPrompt = this.getFinalPromptSystemPrompt(niche, posterType);

    const userPrompt = `Generate a diffusion model prompt for a wishing poster:
    BRAND: ${job.profileId.name}
    FESTIVAL: ${templateMetadata.festival_name}
    TEMPLATE STYLE: ${templateMetadata.poster_design_metadata.style_and_aesthetic.aesthetic_keywords.join(
      ", "
    )}

    COPY:
    - Headline: ${copy.headline}
    - Quote: ${copy.quote}

    ${productDescription
        ? `PRODUCTS:\n${productDescription}`
        : "NO PRODUCTS - Template hard blending"
      }

    TEMPLATE METADATA:
    ${JSON.stringify(templateMetadata, null, 2)}

    Generate the final prompt:`;

    return await llmService.call(
      "FINAL_PROMPT_GENERATION",
      systemPrompt,
      userPrompt
    );
  }

  /**
   * Get system prompt for final prompt generation
   * @param {string} niche - Brand niche
   * @returns {string} System prompt
   */
  getFinalPromptSystemPrompt(niche, posterType) {
    let basePrompt = `
      ${posterType === 'TYPE_A' ? `
        - Key visuals include brand product, template influenced visuals and festive elements, appropriate bg matching the scene and mood.
        - Product/products should be properly aligned and perfectly placed. Avoid random placements & flying products. Everything should be aligned and logically placed.
        - Product images will be used in the final generation where the diffusion model will be provided with the product images to use in the poster.
        - You'll be provided the decription of the product to make you aware of the context of the products that will be used int he poster so you can generate the visuals matching with the product and decide the alignment.
        - You don't need to re-describe the product, just the alignment and usage.
        - Avoid hallucinations, abstract and unrealistic visuals.
        - The template visuals and brand products should be logically blended that makes sense and look appealing.
        - Focus on brand products in the context of the festival and festival theme.
      ` : `
        - The template should be entirely used for the wishing poster. Entire reference template will be used as the poster.
        - The template may/may not contain any text. Your prompt should blend the provided copy in the template tailored to the festive tone and template visuals.
        - If the template already has text in it then instruct to replace the text with the provided copy in the same typography style of the template text with proper alignment and layout.
      `
    }

    Copy Guidelines:
    - The main greeting headline and quote must look elegant, clearly readable and decorative depending on the festive mood. Use invitation card inspired typography style for the greeting with lines, patterns to make the headline more appealing. The quote must be elegantly written to evoke the emotions of the festival. The copy must be of appropriate size so clearly readable.
    - Mention the style of the copy. Don't hard mention the font, color, size of the texts instead provide real world inspired style so the diffusion gets room for creative blending of the text and poster. ex: for a street style, genz poster instead of describing font, color and size we can mention 'Graffiti-style bold fonts, spray paint aesthetic, Street art aesthetic text treatment, Modern, edgy, rebellious fonts throughout, Urban typography style with attitude, Contemporary font treatments'
    `;
    basePrompt = this.enhanceSystemPrompt(basePrompt);

    if (niche !== "other" && posterType == "TYPE_A") {
      basePrompt += `\n\nNICHE-SPECIFIC GUIDELINES for ${niche.toUpperCase()}:
${this.getNicheFinetuning(niche)}`;
    }

    return basePrompt;
  }

  /**
   * Get niche-specific fine-tuning
   * @param {string} niche - Brand niche
   * @returns {string} Fine-tuning guidelines
   */
  getNicheFinetuning(niche) {
    const NICHE_GUIDELINES = {
      fashion:
        "- Real fabrics, textures, authentic clothing\n- Elegant poses, heritage or trendy backgrounds\n- Avoid hallucinations",
      jewellery:
        "- Close-ups to macro shots\n- Warm, moody tones\n- Elegant expressions",
      electronics:
        "- Clean product shots\n- Gradient backgrounds\n- Modern aesthetic",
      wearables: "- Product in use context\n- Modern aesthetic\n- Clean design",
      food_gourmet:
        "- Appetizing presentation\n- Natural lighting\n- Warm ambiance",
      sports: "- Dynamic movements\n- High energy\n- Minimal layout",
      accessories: "- Elegant poses\n- Close-up shots\n- Premium aesthetic",
    };

    return NICHE_GUIDELINES[niche] || "";
  }

  /**
   * Generate poster using diffusion provider
   * @param {Object} job - Generation job
   * @param {string} prompt - Final prompt
   * @returns {Promise<Object>} Generation result
   */
  async generatePoster(job, prompt) {
    const diffusionProvider = providerFactory.createDiffusionProvider(
      job.aiProvider.diffusion
    );

    const parameters = {
      size: `${job.templateId.aspectRatio.width}x${job.templateId.aspectRatio.height}`,
      quality: "high",
      format: "png",
      image_urls: {
        template: job.templateId.images.fullSize,
        logo: job.profileId.logo || null,
      },
    };
    return await diffusionProvider.generateImage(prompt, parameters);
  }
}

module.exports = WishingPosterGenerator;
