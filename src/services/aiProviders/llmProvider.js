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
   * Generate a marketing prompt based on business profile, template, and poster type
   * @param {Object} businessProfile - Business profile containing name, tagline, products, etc.
   * @param {Object} template - Template data with style and requirements
   * @param {string} posterType - Type of poster: 'wish', 'cta', or 'awareness'
   * @returns {Promise<string>} Generated marketing prompt
   */
  async generatePrompt(businessProfile, template, posterType = 'wish') {
    throw new Error(
      "generatePrompt method must be implemented by LLM provider subclass"
    );
  }

  /**
   * Generate multiple prompt variations
   * @param {Object} businessProfile - Business profile data
   * @param {Object} template - Template data
   * @param {string} posterType - Type of poster
   * @param {number} count - Number of variations to generate
   * @returns {Promise<string[]>} Array of generated prompts
   */
  async generatePromptVariations(businessProfile, template, posterType = 'wish', count = 3) {
    const prompts = [];
    for (let i = 0; i < count; i++) {
      const prompt = await this.generatePrompt(businessProfile, template, posterType);
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
      supportedPosterTypes: ["wish", "cta", "awareness"],
    };
  }

  /**
   * Build system prompt for marketing content generation
   * @param {Object} businessProfile - Business profile data
   * @param {Object} template - Template requirements
   * @param {string} posterType - Type of poster: 'wish', 'cta', or 'awareness'
   * @returns {string} System prompt
   */
  buildSystemPrompt(businessProfile, template, posterType = 'wish') {
    // Base prompt that applies to all poster types
    const basePrompt = `
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
`;

    // Get poster-type-specific prompt
    let posterTypePrompt = '';
    switch (posterType) {
      case 'wish':
        posterTypePrompt = this.getWishPrompt();
        break;
      case 'cta':
        posterTypePrompt = this.getCtaPrompt();
        break;
      case 'awareness':
        posterTypePrompt = this.getAwarenessPrompt();
        break;
      default:
        posterTypePrompt = this.getWishPrompt();
    }

    // Combine base prompt with poster-type-specific prompt
    return `${basePrompt}\n\n${posterTypePrompt}\n\nExample Output Prompt:
Create a cinematic, photorealistic 4:5 poster captured at eye level with a 50mm lens, featuring a luxurious handwoven DesiWeaves shawl as the central hero, elegantly draped over a rustic wooden stand in perfect symmetry. The shawl's intricate texture subtly forms a divine bow and arrow motif in gleaming golden threads, symbolizing Dussehra's triumph of good (craft) over evil. The minimalist scene includes a warm-toned silk backdrop, a dark polished stone floor, and a softly blurred marigold flower at the base. A gentle spotlight-center glow highlights the shawl, casting a divine aura while maintaining a serene, earthy palette of rich brown (#584d3d), muted ochre (#c19a6b), and soft cream (#f2e4d5). The composition uses negative space, elegant drape lines, and a stable central focus to convey a mood that is triumphant, authentic, and culturally rich, celebrating heritage craftsmanship through cinematic simplicity.

Overlay the following text and logo without altering visuals, using natural overlay blending with anti-aliasing and contrast-respecting placement.

Headline (top center): "The Sacred Circle of Craft." — Georgia Regular, #584d3d, primary size, centered with 100px top margin.

Body copy (below headline): "This Navratri, celebrating the divine energy that guides the hands of our master artisans." — Arial Regular, #7c736b, secondary size, centered with 20px top margin.

Brand logo: Place the provided DesiWeaves logo at the bottom center, aligned and scaled proportionally with an 80px bottom margin.

Preserve all original visual compositions and proportions; apply micro-adjustments up to 20px only if necessary to prevent text or logo collision with visual elements. The result should harmoniously blend elegant typography with the cinematic imagery, conveying a serene yet powerful festive tribute to craft.

Use the provided poster template as base image for style and inspiration.`;
  }

  /**
   * Get wish-specific prompt guidelines
   * @returns {string} Wish poster prompt
   */
  getWishPrompt() {
    return `POSTER TYPE: WISH/GREETING POSTER

Specific Focus for Wish Posters:
1. Primary Goal: Create warm, heartfelt festive greetings that connect emotionally with the audience while subtly incorporating brand identity.

2. Tone & Messaging:
   - Warm, celebratory, and inclusive
   - Focus on festival wishes and blessings
   - Emotional connection over hard selling
   - Cultural authenticity and respect for traditions
   - Subtle brand presence (not promotional)

3. Visual Direction:
   - Festive elements should dominate (diyas, rangoli, flowers, traditional motifs)
   - Warm, inviting color palettes aligned with festival
   - Soft, ambient lighting creating a celebratory mood
   - Cultural symbols and traditional aesthetics
   - Brand products/services integrated naturally into festive scene

4. Copywriting Priority:
   - Headline: Festive greeting or blessing (e.g., "Wishing You a Joyous Diwali")
   - Subheadline: Warm message or cultural sentiment
   - Brand tagline: Subtle brand signature
   - Logo: Tastefully placed, not dominating
   - Avoid: Hard CTAs, promotional language, discount mentions

5. Emotional Impact:
   - Evoke feelings of joy, togetherness, tradition, and celebration
   - Create shareable content that people want to forward
   - Build brand affinity through cultural connection
   - Strengthen community bonds`;
  }

  /**
   * Get CTA-specific prompt guidelines
   * @returns {string} CTA poster prompt
   */
  getCtaPrompt() {
    return `POSTER TYPE: CALL-TO-ACTION (CTA) POSTER

Specific Focus for CTA Posters:
1. Primary Goal: Drive immediate action through compelling offers, urgency, and clear value proposition while maintaining festive appeal.

2. Tone & Messaging:
   - Action-oriented and persuasive
   - Clear value proposition and benefits
   - Sense of urgency (limited time, exclusive offers)
   - Direct and confident communication
   - Balance between promotional and festive

3. Visual Direction:
   - Product/service should be the hero element
   - Bold, attention-grabbing composition
   - Strategic use of contrast to highlight offers
   - Dynamic visual hierarchy guiding eye to CTA
   - Festive elements support but don't overshadow the offer
   - Clear visual path from product to CTA button

4. Copywriting Priority:
   - Headline: Strong offer or benefit statement (e.g., "Festive Sale: Up to 50% Off")
   - Subheadline: Supporting details or urgency message (e.g., "Limited Time Only")
   - CTA: Clear action button (e.g., "Shop Now", "Claim Offer", "Book Today")
   - Microcopy: Terms, validity, or additional incentives
   - Logo: Professional placement reinforcing brand trust

5. Conversion Elements:
   - Prominent, contrasting CTA button or text
   - Clear benefit statements
   - Urgency indicators (countdown, limited stock, exclusive)
   - Trust signals (guarantees, ratings, testimonials if applicable)
   - Easy-to-scan layout with clear visual hierarchy
   - Minimal friction - direct path to action`;
  }

  /**
   * Get awareness-specific prompt guidelines
   * @returns {string} Awareness poster prompt
   */
  getAwarenessPrompt() {
    return `POSTER TYPE: BRAND AWARENESS POSTER

Specific Focus for Awareness Posters:
1. Primary Goal: Build brand recognition, communicate brand values, and establish emotional connection through storytelling while leveraging festive context.

2. Tone & Messaging:
   - Inspirational and thought-provoking
   - Story-driven and value-focused
   - Educational or informative undertones
   - Authentic and relatable
   - Balance between brand story and festival relevance

3. Visual Direction:
   - Strong brand identity and visual language
   - Conceptual and creative storytelling through visuals
   - Memorable and distinctive composition
   - Brand colors and typography prominently featured
   - Lifestyle or aspirational imagery
   - Festival elements woven into brand narrative
   - Premium, polished aesthetic reflecting brand positioning

4. Copywriting Priority:
   - Headline: Brand message or value proposition (e.g., "Crafting Traditions, Weaving Dreams")
   - Subheadline: Brand story, mission, or unique differentiator
   - Brand tagline: Memorable brand signature line
   - Microcopy: Supporting brand narrative or values
   - Logo: Prominent, confident placement
   - Avoid: Direct sales language, pricing, urgent CTAs

5. Brand Building Elements:
   - Clear brand personality and voice
   - Unique visual identity that stands out
   - Emotional resonance and memorability
   - Educational value or insight
   - Shareable content that sparks conversation
   - Long-term brand recall over immediate conversion
   - Consistency with overall brand positioning
   - Festival context enhances brand story rather than dominates it`;
  }
}

module.exports = LLMProvider;
