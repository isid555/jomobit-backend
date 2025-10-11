const AIProvider = require("./baseProvider");

/**
 * LLM Provider Abstract Class
 * Specialized abstract class for Large Language Model providers
 */
class LLMProvider extends AIProvider {
  constructor(config = {}) {
    super(config);
    if (this.constructor === LLMProvider) {
      throw new Error(
        "LLMProvider is an abstract class and cannot be instantiated directly"
      );
    }
  }

  /**
   * Generate a marketing prompt based on business profile and template
   * @param {Object} businessProfile - Business profile containing name, tagline, products, etc.
   * @param {Object} template - Template data with style and requirements
   * @returns {Promise<string>} Generated marketing prompt
   */
  async generatePrompt(businessProfile, template) {
    throw new Error(
      "generatePrompt method must be implemented by LLM provider subclass"
    );
  }

  /**
   * Generate multiple prompt variations
   * @param {Object} businessProfile - Business profile data
   * @param {Object} template - Template data
   * @param {number} count - Number of variations to generate
   * @returns {Promise<string[]>} Array of generated prompts
   */
  async generatePromptVariations(businessProfile, template, count = 3) {
    const prompts = [];
    for (let i = 0; i < count; i++) {
      const prompt = await this.generatePrompt(businessProfile, template);
      prompts.push(prompt);
    }
    return prompts;
  }

  /**
   * Get provider capabilities - LLM providers support prompt generation
   * @returns {Object} Provider capabilities
   */
  getCapabilities() {
    return {
      ...super.getCapabilities(),
      supportsPromptGeneration: true,
      supportsPromptVariations: true,
      maxPromptLength: 4000,
      supportedLanguages: ["en"],
    };
  }

  /**
   * Build system prompt for marketing content generation
   * @param {Object} businessProfile - Business profile data
   * @param {Object} template - Template requirements
   * @returns {string} System prompt
   */
  buildSystemPrompt(businessProfile, template) {
    return `
    You're senior AI engineer, Designer and Creative Writer with 30+ years of experience. You're expert in prompt engineering, diffusion models, marketing, designing and branding.
Goal: Generate a high quality enriched brand campaign festive poster using diffusion models. Brand's essence must be integrated into the poster through the festival.
Your task: Generate a single, comprehensive prompt for the diffusion model that follows the given guidelines.

Guidelines for Poster Design:
1. Brand identity and essence should be focused. Portray the brand's essence and message through the poster while maintaining the festival's cultural tone and integrity.
2. The poster needs to have a concept/message that resonates with the brand and the festival. The concept should be creative, emotional and captivating.
3. The visuals should have composition (visuals arranged in proper symmetry) and feel cinematic and premium. The visual direction should be creative and engaging.
4. The poster will be inspired from the user given template. The template will be used as a base for the poster and your concept will be added on top of the template. Specify to use the given template as a base.

Guidelines for Layout & Copywriting:
1. The poster will have copywritings, call-to-actions and brand logo (if logo is not provided then it won't be included).It must have clean layout, no overlapping with main visuals, and typography matches the brand's target style and festive mood.
2. There are 6 types of copywritings:
    - headline: Primary message (usually max 4-8 words)
    - subheadline: Supporting text (usually max 10-20 words)
    - brand_tagline: Brand's signature phrase (usually max 5 words)
    - logo: Brand mark/logo placement
    - cta: Action text like "Shop Now", "Learn More" (usually max 3-4 words)
    - microcopy: Additional details, terms, or supporting text (usually max 8-15 words)
  You can select at max 4 copywritings from the list that best fit the brand's target, visuals, audience and festive mood.
3. The copywritings should be creative, emotional and captivating. It should follow a heirarchy of importance and should be aligned with the visual direction and tone of the poster.
4. Layout should be follow the real world desgining principles and rules that best fit for the brand category.


Guidelines for Prompting:
1. Prompt should describe the main subject, composition, mood, style, background description, motifs, elements, colors, lighting, atmosphere, volumetrics, layout for copywritings, call-to-actions and brand logo.
2. Prompt should not include --ar, --zoom, --style, or --v commands.
3. Prompt should not generate markdown, JSON, or explanations. Just the clean text prompt.
4. Prompt can have atmost 2000 characters.

Must Have:
1. Brand products (if provided) or services
2. Festival integration (keeping the brand focused)
3. Copywritings and call-to-actions (proper layout and typography)
4. Clean layout, no overlapping with main visuals, and typography matches the brand's target style and festive mood.

Quality Requirements:
1. The final image must be highly detailed, cinematic, ultra-realistic, professional, rich in festive color, 8K resolution quality.
2. Lighting, colors, and composition must feel premium and campaign-worthy.

Inputs You Have:
Business Name: ${businessProfile.name}
Business Logo: ${businessProfile.logo ? "Logo is provided" : "Not provided"}
Tagline: ${businessProfile.tagline}
Description: ${businessProfile.description}
Products/Services: ${businessProfile.products?.join(", ") || "Not specified"}
Target Style: ${template.style || "Professional"}
Festival: ${template.name}
Tags: ${template.tags?.join(", ") || "Not specified"}

Example Output Prompt:
Create a cinematic, photorealistic 4:5 poster captured at eye level with a 50mm lens, featuring a luxurious handwoven DesiWeaves shawl as the central hero, elegantly draped over a rustic wooden stand in perfect symmetry. The shawl’s intricate texture subtly forms a divine bow and arrow motif in gleaming golden threads, symbolizing Dussehra’s triumph of good (craft) over evil. The minimalist scene includes a warm-toned silk backdrop, a dark polished stone floor, and a softly blurred marigold flower at the base. A gentle spotlight-center glow highlights the shawl, casting a divine aura while maintaining a serene, earthy palette of rich brown (#584d3d), muted ochre (#c19a6b), and soft cream (#f2e4d5). The composition uses negative space, elegant drape lines, and a stable central focus to convey a mood that is triumphant, authentic, and culturally rich, celebrating heritage craftsmanship through cinematic simplicity.

Overlay the following text and logo without altering visuals, using natural overlay blending with anti-aliasing and contrast-respecting placement.

Headline (top center): “The Sacred Circle of Craft.” — Georgia Regular, #584d3d, primary size, centered with 100px top margin.

Body copy (below headline): “This Navratri, celebrating the divine energy that guides the hands of our master artisans.” — Arial Regular, #7c736b, secondary size, centered with 20px top margin.

Brand logo: Place the provided DesiWeaves logo at the bottom center, aligned and scaled proportionally with an 80px bottom margin.

Preserve all original visual compositions and proportions; apply micro-adjustments up to 20px only if necessary to prevent text or logo collision with visual elements. The result should harmoniously blend elegant typography with the cinematic imagery, conveying a serene yet powerful festive tribute to craft.

Use the provided poster template as base image for style and inspiration.
  `;
  }
}

module.exports = LLMProvider;
