const llmService = require('./llmService');
const { parseJSONArray } = require('../../utils/jsonParser');
const { CONCEPT_COUNT, RETRY_CONFIG } = require('../../config/llmModels');
const logger = require('../../utils/logger');

/**
 * Concept Generator Service
 * Generates creative poster concepts
 */
class ConceptGenerator {
    /**
     * Generate N concepts for poster
     * @param {Object} profile - Business profile
     * @param {Object} templateMetadata - Extracted template metadata
     * @param {string} posterType - Poster type
     * @param {string} niche - Brand niche
     * @returns {Promise<Array>} Array of concepts
     */
    async generateConcepts(profile, templateMetadata, posterType, niche) {
        logger.info('Generating concepts', {
            profileId: profile._id,
            posterType,
            niche,
            count: CONCEPT_COUNT
        });

        const systemPrompt = this.buildSystemPrompt(posterType, niche);
        const userPrompt = this.buildUserPrompt(profile, templateMetadata, posterType);

        try {
            const response = await llmService.callWithRetry(
                'CONCEPT_GENERATION',
                systemPrompt,
                userPrompt,
                RETRY_CONFIG.conceptGeneration
            );

            const concepts = this.parseConcepts(response);

            logger.info('Concepts generated successfully', {
                profileId: profile._id,
                posterType,
                count: concepts.length
            });

            return concepts;
        } catch (error) {
            logger.error('Concept generation failed', {
                profileId: profile._id,
                posterType,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Build system prompt for concept generation
     * @param {string} posterType - Poster type
     * @param {string} niche - Brand niche
     * @returns {string} System prompt
     */
    buildSystemPrompt(posterType, niche) {
        let basePrompt = `You are a creative director and concept artist with expertise in poster design and brand storytelling.

Your task is to generate ${CONCEPT_COUNT} unique, creative poster concepts.`;

        // Add poster-type-specific guidelines
        if (posterType === 'awareness') {
            basePrompt += this.getAwarenessPosterTuning();

        } else if (posterType === 'cta') {
            basePrompt += `\n\nPOSTER TYPE: CALL-TO-ACTION
            Focus on product showcase, compelling offers, and driving action.
            Products should be hero elements with clear value proposition.`;

        } else if (posterType === 'wish') {
            basePrompt += `\n\nPOSTER TYPE: WISHING/GREETING
            Focus on festive greetings, warm emotions, and cultural celebration.
            Products (if included) should blend naturally with festive elements.`;
        }

        // Add niche-specific fine-tuning if applicable
        const nicheFinetuning = this.getNicheFinetuning(niche);
        if (nicheFinetuning) {
            basePrompt += `\n\n${nicheFinetuning}`;
        }

        basePrompt += `\n\nConcept Structure (for each concept):
{
  "concept_name": "Short catchy name",
  "mood": "Descriptive mood keywords",
  "core_idea": "The central creative idea",
  "visual_direction": "Detailed visual description",
  "product_presence": "How products appear (if applicable)",
  "key_presence_signal": "What the brand represents in this concept"
}

Generate ${CONCEPT_COUNT} concepts in valid JSON array format.
Respond with ONLY the JSON array, no markdown, no explanations.`;

        return basePrompt;
    }

    getAwarenessPosterTuning() {
        return `
        \n\nPOSTER TYPE: BRAND AWARENESS
        Focus on emotional storytelling, brand values, and lifestyle representation.
        Products (if included) should be symbolic, not promotional.
        In awareness posters, the product should:
        - Represent the brands spirit, not its catalogue.
        - Appear as part of the story, not the sales pitch.
        - Blend with the visual emotion, not stand out artificially.

        When Its Right to Use Products in Awareness Posters
        *Use products only when they visually serve the brands emotional narrative.*

        Scenarios Where It Works:
        1. When the product visually embodies the vibe.
            - E.g., a color-blocked VibraOn jacket on a chair surrounded by New Year sparkles.
            - Emotion > Object.

        2. When it enhances realism.
            - A cinematic scene with real people wearing VibraOn pieces naturally — no posing, no showcase.
            - The clothes exist in the story, not as the story.

        3. When it adds brand recognizability.
            - The product or its texture/color is iconic enough to become part of brand language.
            - E.g., Levis denim tone, Nike sneaker silhouette, or VibraOn red-blue color pop.

        When Its Wrong to Use Products
        Avoid products when they:
        - Interrupt the emotional flow (e.g., a floating shoe or T-shirt that breaks realism).
        - Look isolated or staged (e.g., white background product cutout).
        - Shift focus from mood to merchandise.
        - Look like an e-commerce listing instead of a cinematic frame.

        Awareness visuals must always prioritize feeling > detail.

        Copy Logic When Product Is Present
        *When a product appears in awareness design,
        the copywriting should emotionally frame the lifestyle, not the product.*

        | Example of Wrong Copy    | Example of Right Copy           |
        | ------------------------ | ------------------------------- |
        | “New Collection Out Now” | “The Season Starts With You”    |
        | “Shop Our Festive Drop”  | “Your Vibe. Your Celebration.”  |
        | “50% Off on Jackets”     | “Built to Shine. Made to Move.” |

        **The difference: One sells. The other expresses identity.**

        Example concepts for understanding and inspiration (don't copy):
        1. FASHION AWARENESS POSTER

        Concept: “Where Your Story Starts”

        Mood: Youthful · Cinematic · Urban · Expressive
        Core Idea: Fashion is not about clothing — it's about identity.
        Use the template background as a moody festive or urban glow, and blend it with subtle clothing elements (fabric folds, color-block shadows).

        No mannequin-style product display — only symbolic traces of apparel such as:
        - A jacket sleeve resting on a chair,
        - A scarf draped over soft light,
        - Or no product at all — just color & texture.

        Key Presence Signal:
        The brand is present in the moment where youth express themselves through energy, color, and vibe.

    2. JEWELLERY AWARENESS POSTER

        Concept: “Glow That Stays With You”

        Mood: Luxurious · Minimal · Shine-focused
        Core Idea: Jewellery isn’t shown as a product — it appears as light, reflection, or sparkle, symbolizing elegance.
        Template background is blended with:
        - Soft bokeh sparkles
        - Gold/rose-gold light trails
        - Subtle silhouette of an ear/neckline (optional)

        Or include jewellery indirectly:
        - A blurred close-up sparkle,
        - A faint glint in the corner,
        - A delicate chain barely resting at the frame’s edge.

        Key Presence Signal:
        The poster feels like luxury light — the jewellery is felt, not shown.

    3. FOOD & GOURMET AWARENESS POSTER


        Concept: “Moments Taste Better Together”

        Mood: Warm · Cozy · Sensory · Cinematic
        Core Idea: Food brings emotional warmth — show ambience, not dishes.
        Template background is blended with:
        - Golden lighting like a festive dinner table
        - Soft steam trails, cozy bokeh
        - Wooden textures, napkins, candle glow

        Optional symbolic product presence:
        - A blurred dessert plate,
        - A cup of coffee steaming in the corner,
        - A soft-focus pastry silhouette.

        Key Presence Signal:
        The warmth of festive gathering is the hero — the brand becomes the feeling of comfort.

    4. WATCH BRAND AWARENESS POSTER

        Concept: “Every Second Has a Mood”

        Mood: Premium · Modern · Timeless · Minimal
        Core Idea: Time is the story — the watch is optional.
        Use the template base to create a premium cinematic atmosphere:

        - Metallic shadows
        - Soft rim lights
        - Light passing across reflective surfaces

        Optional watch presence (symbolic):
        - A close-up of a crown or strap in extreme blur
        - A silhouette reflection on a glossy surface
        - Or no product at all — only time-lapse light streaks

        **Key Presence Signal:**
        The brand represents moments, precision, and presence — not just watches.

    5. ELECTRONICS BRAND AWARENESS POSTER

        Concept: “Energy That Moves With You”

        Mood: Futuristic · Clean · Dynamic · High-tech
        Core Idea: Show the energy flow of the product, not the product itself.
        Template background blended with:

        Electric blue or neon ambient glows
        - Soft tech-inspired lines
        - Futuristic gradient layers
        - Minimal geometric light effects

        Optional symbolic product cues:
        - A faint silhouette of earbuds or phone edge
        - A glowing contour in the corner
        - Or ambient soundwave-like ripples

        **Key Presence Signal:**
        The brand represents energy, connectivity, and modern movement — the lifestyle around tech, not the device itself.
        `
    }

    /**
     * Get niche-specific fine-tuning
     * @param {string} niche - Brand niche
     * @returns {string|null} Fine-tuning prompt
     */
    getNicheFinetuning(niche) {
        const NICHE_PROMPTS = {
            fashion: `FASHION-SPECIFIC GUIDELINES:
- Real fabrics, textures, authentic clothing styles
- Photography styles: Ramp, Street, Editorial, Studio, Heritage, Trendy, Festive
- Avoid clothing hallucinations and disorientation
- Elegant poses, heritage or trendy backgrounds
- Collections, close-ups
- Real human models must be used instead of mannequins
`,

            jewellery: `JEWELLERY-SPECIFIC GUIDELINES:
- Close-ups to macro shots showing detail
- Warm, moody tones with elegant expressions
- Product on premium fabrics or in elegant boxes
- Couple shots, mirror shots, close up of female model shot focusing on the jwellery
- Perfect alignment for collections`,

            electronics: `ELECTRONICS-SPECIFIC GUIDELINES:
- Perfect product alignment for collections
- Focus on single product shots with features
- Gradient backgrounds matching product tones
- Interactive elements, use-case scenarios
- Cool/professional/trendy models`,

            wearables: `WEARABLES-SPECIFIC GUIDELINES:
- Product in use context, active lifestyle
- Dynamic poses, modern aesthetic
- Clean design, modern technology aesthetic
- Real photography style`,

            food_gourmet: `FOOD & GOURMET-SPECIFIC GUIDELINES:
- Appetizing presentation, natural lighting
- Fresh ingredients, warm ambiance
- Product with food, product in use
- Dynamic movements, product being made
- Model eating/showcasing product`,

            sports: `SPORTS-SPECIFIC GUIDELINES:
- Dynamic movements, high energy
- Highly product focused
- Minimal layout, show energy
- Athletic models, action-oriented`,

            accessories: `ACCESSORIES-SPECIFIC GUIDELINES:
- Collections aligned properly
- Model wearing/holding accessory
- Elegant and attractive poses
- Close-up shots, premium aesthetic`
        };

        return NICHE_PROMPTS[niche] || null;
    }

    /**
     * Build user prompt for concept generation
     * @param {Object} profile - Business profile
     * @param {Object} templateMetadata - Template metadata
     * @param {string} posterType - Poster type
     * @returns {string} User prompt
     */
    buildUserPrompt(profile, templateMetadata, posterType) {
        return `Generate ${CONCEPT_COUNT} creative poster concepts for:

BRAND INFORMATION:
- Name: ${profile.name}
- Tagline: ${profile.tagline}
- Description: ${profile.description}
- Products: ${profile.products?.join(', ')}

TEMPLATE CONTEXT:
- Festival: ${templateMetadata.festival_name}
- Style: ${templateMetadata.poster_design_metadata.style_and_aesthetic.aesthetic_keywords.join(', ')}
- Color Palette: ${templateMetadata.poster_design_metadata.style_and_aesthetic.color_palette.dominant.join(', ')}

POSTER TYPE: ${posterType.toUpperCase()}

Generate ${CONCEPT_COUNT} unique, creative concepts that align with the brand and festival.`;
    }

    /**
     * Parse concepts from LLM response
     * @param {string} response - LLM response
     * @returns {Array} Parsed concepts
     */
    parseConcepts(response) {
        try {
            const concepts = parseJSONArray(response, 'concept_generation');

            if (concepts.length === 0) {
                throw new Error('No concepts generated');
            }

            return concepts;
        } catch (error) {
            logger.error('Failed to parse concepts', {
                error: error.message,
                response: response.substring(0, 200)
            });
            throw new Error('Failed to parse concept generation response');
        }
    }
}

module.exports = new ConceptGenerator();
