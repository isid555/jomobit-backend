const nicheDetector = require('../llm/nicheDetector');
const templateExtractor = require('../llm/templateExtractor');
const logger = require('../../utils/logger');

/**
 * Base Poster Generator
 * Abstract base class for all poster generators
 */
class BasePosterGenerator {
    constructor() {
        if (this.constructor === BasePosterGenerator) {
            throw new Error('BasePosterGenerator is abstract and cannot be instantiated');
        }

        // Initialize timing tracker
        this.timing = {
            startTime: null,
            promptStartTime: null,
            imageStartTime: null,
            promptGenerationTime: 0,
            imageGenerationTime: 0
        };
    }

    /**
     * Start timing for prompt generation
     */
    startPromptTiming() {
        this.timing.promptStartTime = Date.now();
    }

    /**
     * End timing for prompt generation
     * @returns {number} Time in milliseconds
     */
    endPromptTiming() {
        if (this.timing.promptStartTime) {
            this.timing.promptGenerationTime = Date.now() - this.timing.promptStartTime;
            return this.timing.promptGenerationTime;
        }
        return 0;
    }

    /**
     * Start timing for image generation
     */
    startImageTiming() {
        this.timing.imageStartTime = Date.now();
    }

    /**
     * End timing for image generation
     * @returns {number} Time in milliseconds
     */
    endImageTiming() {
        if (this.timing.imageStartTime) {
            this.timing.imageGenerationTime = Date.now() - this.timing.imageStartTime;
            return this.timing.imageGenerationTime;
        }
        return 0;
    }

    /**
     * Get timing summary
     * @returns {Object} Timing data
     */
    getTiming() {
        return {
            promptGenerationTime: this.timing.promptGenerationTime,
            imageGenerationTime: this.timing.imageGenerationTime,
            totalProcessingTime: this.timing.promptGenerationTime + this.timing.imageGenerationTime
        };
    }

    /**
     * Generate poster - must be implemented by subclasses
     * @param {Object} job - Generation job
     * @returns {Promise<Object>} Generation result
     */
    async generate(job) {
        throw new Error('generate() must be implemented by subclass');
    }

    /**
     * Common preprocessing steps
     * @param {Object} job - Generation job
     * @returns {Promise<Object>} Preprocessed data
     */
    async preprocess(job) {
        logger.info('Starting preprocessing', {
            jobId: job._id,
            posterType: job.posterType
        });

        // Step 1: Ensure niche exists
        const niche = await nicheDetector.ensureNiche(job.profileId);

        // Step 2: Extract template metadata
        const templateMetadata = await templateExtractor.extractMetadata(job.templateId);

        logger.info('Preprocessing completed', {
            jobId: job._id,
            niche,
            festival: templateMetadata.festival_name
        });

        return {
            niche,
            templateMetadata
        };
    }

    /**
     * Common postprocessing steps
     * @param {Object} job - Generation job
     * @param {Object} result - Generation result
     * @returns {Promise<Object>} Final result
     */
    async postprocess(job, result) {
        logger.info('Postprocessing completed', {
            jobId: job._id,
            hasImageUrl: !!result.imageUrl
        });

        return result;
    }

    enhanceSystemPrompt(basePrompt) {
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
3. It should follow a heirarchy of importance and should be aligned with the visual direction and tone of the poster.
4. Layout should be follow the real world desgining principles and rules that best fit for the brand category.

Guidelines for Prompting:
1. Prompt should describe the main subject, composition, mood, style, background description, motifs, elements, colors, lighting, atmosphere, volumetrics, layout for copywritings, call-to-actions and brand logo.
2. Prompt should not include --ar, --zoom, --style, or --v commands.
3. Prompt should not generate markdown, JSON, or explanations. Just the clean text prompt.

Must Have:
1. Festival integration (keeping the brand focused)
2. Clean layout, no overlapping with main visuals, and typography matches the brand's target style and festive mood.

Quality Requirements:
1. The final image must be highly detailed, cinematic, ultra-realistic, professional, rich in festive color, 8K resolution quality.
2. Lighting, colors, and composition must feel premium and campaign-worthy.

${basePrompt}

Required Output Structure:
[TITLE / CONCEPT NAME]
A short, descriptive title that reflects the theme of the poster.

Prompt Introduction
A 1–2 sentence description of the poster’s intention, theme, and creative direction.
(Example pattern: “Create a [theme] poster for [brand/event] with a [aesthetic] showcasing [focus].”)

LAYOUT & COMPOSITION
- Provide 5–10 bullet points describing:
- Poster orientation and ratio
- High-level aesthetic
- Top / main / bottom section breakdown
- Any specific layout divisions
- Placement of brand name, tagline, or headline
- Decorative layout elements
- Spatial logic and visual structure

PRODUCTS TO FEATURE (Optional)
List products:
Product Name: Very Short Description

Then add 2–4 bullets describing:
- Styling approach
- How the products integrate with theme
- How they’re arranged

PHOTOGRAPHY STYLE
5–10 bullets describing the visual photography feel, such as:
- Aesthetic tone (cinematic, vintage, urban, etc.)
- Depth of field, lighting mood
- Era or cultural reference
- Quality level and style logic
- Emotional or stylistic tone

VISUAL ELEMENTS
6–12 bullets describing the supporting visual components, such as:
- Graphic motifs
- Textures
- Scene elements
- Decorative accents
- Background textures
- Thematic references (urban, retro, festive, etc.)

COLOR PALETTE
5–10 bullets describing:
- Dominant colors
- Accent colors
- Thematic color styles
- Harmony or contrast logic
- Tone / mood of color scheme

TYPOGRAPHY
5–8 bullets describing the typographic personality, such as:
- Overall type vibe (bold, elegant, rebellious, vintage, etc.)
- Style direction (expressive, minimal, urban, etc.)
- Treatment logic (glow, texture, cinematic, retro, etc.)
- Emotional attitude
- Thematic type direction
(No hard font names — only style guidance.)

OVERALL MOOD
6–12 bullets describing the emotional + thematic mood, such as:
- Key feelings
- Aesthetic intention
- Cultural tone
- High-level visual impression
- Energy and atmosphere
- Brand relevance


Example Responses:
Poster 1: Urban Ritual
Prompt:
Create an urban, contemporary poster for NovaFlux Chatt Puja celebration with street art aesthetic showcasing fashion products.

LAYOUT & COMPOSITION:
- Vertical poster format (9:16 ratio)
- Urban street art aesthetic
- Top section (15%): "NOVAFLUX" brand name with graffiti-style typography + tagline "Fashion at the Speed of Now"
- Main section (55%): Fashion products styled in an urban, contemporary composition
- Bottom section (15%): "URBAN RITUAL - Celebrate the City"
- Decorative elements: graffiti, street art, urban textures, contemporary culture

PRODUCTS TO FEATURE:
1. Grey plaid V-neck dress with ruffled sleeves
2. Dark green velvet wrap dress
- Products styled in an urban, contemporary way
- Products arranged with street art elements

PHOTOGRAPHY STYLE:
- Urban fashion photography
- Street art aesthetic
- Contemporary and rebellious feel
- Products styled as if worn by urban fashion icons
- Modern, edgy aesthetic
- High-end urban quality

VISUAL ELEMENTS:
- Graffiti and street art elements (tags, splatters, urban art)
- Urban textures (concrete, brick, street surfaces)
- Contemporary culture references (urban lifestyle)
- Urban light effects and dramatic shadows
- Street art patterns and spray paint aesthetics
- Modern Indian urban aesthetic
- Urban celebration vibe with street energy

COLOR PALETTE:
- Dominant: Black, white, grey plaid, dark green velvet
- Accents: Urban colors (teal, orange, neon, electric blue)
- Street art aesthetic colors (vibrant, bold, contemporary)
- Contemporary urban color harmony
- High contrast for urban impact

TYPOGRAPHY:
- Graffiti-style bold fonts for "NOVAFLUX" (spray paint aesthetic)
- Street art aesthetic text treatment
- Modern, edgy, rebellious fonts throughout
- Urban typography style with attitude
- Contemporary font treatments

OVERALL MOOD:
- Contemporary and rebellious
- Urban street art aesthetic
- Modern city celebration
- Fashion meets street culture
- Edgy and modern with street energy
- Urban chic and trendy
- High-end contemporary quality
- Street icon vibe

Poster 2: Vintage Revival
Prompt:
Create a vintage, retro poster for NovaFlux Chatt Puja celebration with classic Hollywood glamour aesthetic showcasing fashion products.

LAYOUT & COMPOSITION:
- Vertical poster format (9:16 ratio)
- Vintage Hollywood glamour aesthetic
- Top section (15%): "NOVAFLUX" brand name in vintage typography + tagline "Fashion at the Speed of Now"
- Main section (55%): Fashion products styled in a vintage, classic composition
- Bottom section (15%): "VINTAGE REVIVAL - Timeless Glamour"
- Decorative elements: vintage patterns, Hollywood glamour, classic elegance

PRODUCTS TO FEATURE:
1. Grey plaid V-neck dress with ruffled sleeves
2. Dark green velvet wrap dress
- Products styled in a vintage, classic way
- Products arranged with Hollywood glamour aesthetic

PHOTOGRAPHY STYLE:
- Vintage fashion photography
- Classic Hollywood glamour aesthetic
- Golden age of Hollywood feel (1940s-1960s)
- Products styled as if worn by vintage fashion icons
- Timeless elegance and sophistication
- High-end vintage quality
- Classic film noir and glamour photography

VISUAL ELEMENTS:
- Vintage patterns (vignettes, decorative borders, classic motifs)
- Hollywood glamour elements (cigarette holders, vintage props)
- Classic elegance and sophistication
- Vintage light effects (soft focus, golden hour)
- Retro color grading (warm, golden tones, film grain)
- Classic Hollywood aesthetic (golden age cinematography)
- Vintage celebration vibe with timeless beauty

COLOR PALETTE:
- Dominant: Black, white, grey plaid, dark green velvet
- Accents: Golden tones, vintage warm colors (amber, bronze, honey)
- Classic Hollywood glamour colors (rich, warm, timeless)
- Timeless vintage color harmony

TYPOGRAPHY:
- Vintage Hollywood-style fonts for "NOVAFLUX" (classic movie title fonts)
- Classic elegant typography (Art Deco, vintage elegance)
- Retro font treatments with vintage charm
- Vintage glamour text style with Hollywood flair

OVERALL MOOD:
- Vintage elegance and timeless beauty
- Classic Hollywood glamour aesthetic
- Timeless sophistication and grace
- Fashion meets golden age of Hollywood
- Retro glamour and vintage chic
- Timeless and elegant with classic appeal
- High-end classic quality
- Golden age of cinema vibe
- Vintage icon aesthetic
`;
    }
}

module.exports = BasePosterGenerator;
