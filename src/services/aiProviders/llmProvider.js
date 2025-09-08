const AIProvider = require('./baseProvider');

/**
 * LLM Provider Abstract Class
 * Specialized abstract class for Large Language Model providers
 */
class LLMProvider extends AIProvider {
  constructor(config = {}) {
    super(config);
    if (this.constructor === LLMProvider) {
      throw new Error('LLMProvider is an abstract class and cannot be instantiated directly');
    }
  }

  /**
   * Generate a marketing prompt based on business profile and template
   * @param {Object} businessProfile - Business profile containing name, tagline, products, etc.
   * @param {Object} template - Template data with style and requirements
   * @returns {Promise<string>} Generated marketing prompt
   */
  async generatePrompt(businessProfile, template) {
    throw new Error('generatePrompt method must be implemented by LLM provider subclass');
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
      supportedLanguages: ['en']
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
    You are an expert text-to-image prompt engineer and creative marketing copywriter. 
    Your task is to generate a single, comprehensive prompt for an AI image generation model that will produce a *festive brand poster*.

    ## What You Must Do
    - Use the *reference poster* only as inspiration for style, mood, and composition. Do not copy it directly. Instead, creatively reinterpret it so the new poster resembles the festive spirit and design tone of the reference while remaining original.  
    - Seamlessly *blend the brand's identity* (name, tagline, description, and target style) into the poster. This does not mean pasting products; instead, integrate the brand essence through color palette, mood, visual storytelling, and style choices.  
    - Maintain the *sacredness, elegance, and cultural tone* of the festival shown in the reference, while ensuring the poster feels premium, cinematic, and campaign-ready.  
    - Explicitly define where *text elements* go:  
      - Brand name (top center, elegant and prominent).  
      - Short festive phrase or greeting (below brand name, emotionally resonant).  
      - Tagline (at the bottom, centered).  
      - Call-to-Action (bottom corner, bold).  
      - Ensure clean layout, no overlapping with main visuals, and typography matches the brand’s target style and festive mood.  

    ## Quality Requirements
    - The final image must be *highly detailed, cinematic, ultra-realistic, professional, rich in festive color, 8K resolution quality*.  
    - Lighting, colors, and composition must feel premium and campaign-worthy.  
    - Avoid generic poster clichés (like random fireworks or clipart-style objects) unless the reference uses them in a tasteful, cultural way.  

    ## Inputs You Have
    Business Name: ${businessProfile.name}  
    Tagline: ${businessProfile.tagline}  
    Description: ${businessProfile.description}  
    Products/Services: ${businessProfile.products?.join(", ") || "Not specified"}  
    Target Style: ${template.style || "Professional"}  

    Reference Poster Prompt (for inspiration only, not replication):  
    ${template.referencePrompt}  

    ## Output Format
    - Output only a *single, continuous text prompt* for the image model.  
    - Do not use headings, lists, or metadata.  
    - Do not include --ar, --zoom, --style, or --v commands.  
    - Do not generate markdown, JSON, or explanations—just the clean text prompt.  

    Remember: Your job is to create a *brand-aligned, festival-inspired, high-quality poster prompt* that is campaign-ready. It should respect the reference but elevate it with originality, brand identity, and cultural sacredness.
  `;

  }
}

module.exports = LLMProvider;