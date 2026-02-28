const { providerFactory } = require('../aiProviders/providerFactory');
const { LLM_MODELS } = require('../../config/llmModels');
const logger = require('../../utils/logger');

/**
 * LLM Service
 * Centralized service for all LLM operations
 */
class LLMService {
    /**
     * Make LLM call with specific task configuration
     * @param {string} taskType - Task type from LLM_MODELS
     * @param {string} systemPrompt - System prompt
     * @param {string} userPrompt - User prompt
     * @param {Object} options - Additional options (image, etc.)
     * @returns {Promise<string>} LLM response
     */
    async call(taskType, systemPrompt, userPrompt, options = {}) {
        const config = LLM_MODELS[taskType];

        if (!config) {
            throw new Error(`Unknown LLM task type: ${taskType}`);
        }

        logger.info('LLM call initiated', {
            taskType,
            provider: config.provider,
            model: config.model,
            temperature: config.temperature
        });

        try {
            const llmProvider = providerFactory.createLLMProvider(config.provider);

            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ];

            // Add image if provided (for vision tasks)
            if (options.image) {
                messages[1].content = [
                    { type: 'text', text: userPrompt },
                    { type: 'image_url', image_url: { url: options.image } }
                ];
            }

            const response = await llmProvider.makeAPICall('/chat/completions', {
                model: config.model,
                messages,
                temperature: config.temperature,
                max_tokens: config.maxTokens
            });

            const result = response.choices[0].message.content.trim();

            logger.info('LLM call completed', {
                taskType,
                responseLength: result.length
            });

            return result;
        } catch (error) {
            logger.error('LLM call failed', {
                taskType,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Make LLM call with retry logic
     * @param {string} taskType - Task type
     * @param {string} systemPrompt - System prompt
     * @param {string} userPrompt - User prompt
     * @param {number} maxRetries - Maximum retry attempts
     * @param {Object} options - Additional options
     * @returns {Promise<string>} LLM response
     */
    async callWithRetry(taskType, systemPrompt, userPrompt, maxRetries = 0, options = {}) {
        let lastError;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await this.call(taskType, systemPrompt, userPrompt, options);
            } catch (error) {
                lastError = error;
                logger.warn('LLM call attempt failed', {
                    taskType,
                    attempt: attempt + 1,
                    maxRetries: maxRetries + 1,
                    error: error.message
                });

                if (attempt < maxRetries) {
                    // Wait before retry (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
                }
            }
        }

        throw lastError;
    }
}

module.exports = new LLMService();
