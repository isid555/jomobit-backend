const llmService = require('./llmService');
const { SUPPORTED_NICHES, RETRY_CONFIG } = require('../../config/llmModels');
const logger = require('../../utils/logger');

/**
 * Niche Detector Service
 * Detects brand niche using LLM
 */
class NicheDetector {
    /**
     * Detect niche for a business profile
     * @param {Object} profile - Business profile
     * @returns {Promise<string>} Detected niche
     */
    async detectNiche(profile) {
        logger.info('Detecting niche for profile', {
            profileId: profile._id,
            profileName: profile.name
        });

        const systemPrompt = this.buildSystemPrompt();
        const userPrompt = this.buildUserPrompt(profile);

        try {
            const response = await llmService.callWithRetry(
                'NICHE_DETECTION',
                systemPrompt,
                userPrompt,
                RETRY_CONFIG.nicheDetection
            );

            const detectedNiche = response.toLowerCase().trim();

            // Validate detected niche
            if (SUPPORTED_NICHES.includes(detectedNiche)) {
                logger.info('Niche detected successfully', {
                    profileId: profile._id,
                    niche: detectedNiche
                });
                return detectedNiche;
            } else {
                logger.warn('Detected niche not in supported list', {
                    profileId: profile._id,
                    detectedNiche,
                    fallback: 'other'
                });
                return 'other';
            }
        } catch (error) {
            logger.error('Niche detection failed', {
                profileId: profile._id,
                error: error.message
            });
            return 'other'; // Fallback
        }
    }

    /**
     * Build system prompt for niche detection
     * @returns {string} System prompt
     */
    buildSystemPrompt() {
        return `You are a business category classification expert.

Your task is to analyze business information and determine the most appropriate niche category.

Available categories:
${SUPPORTED_NICHES.map(n => `- ${n}`).join('\n')}
- other (if none of the above match)

Rules:
1. Respond with ONLY the category name in lowercase
2. No explanations, no additional text
3. Choose the most specific category that fits
4. If uncertain between multiple categories, choose the most dominant one
5. Use "other" only if truly none of the categories fit

Examples:
- Clothing brand → fashion
- Watch brand → accessories
- Smartphone brand → electronics
- Fitness tracker → wearables
- Restaurant → food_gourmet
- Gym equipment → sports
- Diamond rings → jewellery`;
    }

    /**
     * Build user prompt for niche detection
     * @param {Object} profile - Business profile
     * @returns {string} User prompt
     */
    buildUserPrompt(profile) {
        return `Analyze this business and determine its niche:

Business Name: ${profile.name}
Tagline: ${profile.tagline || 'Not provided'}
Description: ${profile.description || 'Not provided'}
Products/Services: ${profile.products?.join(', ') || 'Not provided'}

What is the niche category?`;
    }

    /**
     * Ensure profile has niche (detect if missing)
     * @param {Object} profile - Business profile
     * @returns {Promise<string>} Niche (existing or detected)
     */
    async ensureNiche(profile) {
        // If niche already exists, return it
        if (profile.niche && profile.niche.trim() !== '') {
            logger.info('Profile already has niche', {
                profileId: profile._id,
                niche: profile.niche
            });
            return profile.niche;
        }

        // Detect niche
        const detectedNiche = await this.detectNiche(profile);

        // Update profile
        profile.niche = detectedNiche;
        await profile.save();

        logger.info('Profile niche updated', {
            profileId: profile._id,
            niche: detectedNiche
        });

        return detectedNiche;
    }
}

module.exports = new NicheDetector();
