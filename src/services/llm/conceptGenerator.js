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
            basePrompt += `\n\nPOSTER TYPE: BRAND AWARENESS
Focus on emotional storytelling, brand values, and lifestyle representation.
Products (if included) should be symbolic, not promotional.`;
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

    /**
     * Get niche-specific fine-tuning
     * @param {string} niche - Brand niche
     * @returns {string|null} Fine-tuning prompt
     */
    getNicheFinetuning(niche) {
        const NICHE_PROMPTS = {
            fashion: `FASHION-SPECIFIC GUIDELINES:
- Real fabrics, textures, authentic clothing styles
- Photography styles: Ramp, Street, Editorial, Studio
- Avoid clothing hallucinations and disorientation
- Elegant poses, heritage or trendy backgrounds
- Collections, close-ups, or mane queen shots`,

            jewellery: `JEWELLERY-SPECIFIC GUIDELINES:
- Close-ups to macro shots showing detail
- Warm, moody tones with elegant expressions
- Product on premium fabrics or in elegant boxes
- Couple shots, mirror shots, mane queen shots
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
