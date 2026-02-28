const { providerFactory } = require('../aiProviders/providerFactory');
const logger = require('../../utils/logger');

/**
 * Embedding Service
 * Handles text embeddings using OpenAI
 */
class EmbeddingService {
    constructor() {
        this.model = 'text-embedding-3-small';
        this.encodingFormat = 'float';
    }

    /**
     * Generate embedding for text
     * @param {string} text - Text to embed
     * @returns {Promise<Array>} Embedding vector
     */
    async embed(text) {
        logger.info('Generating embedding', {
            textLength: text.length,
            model: this.model
        });

        try {
            const provider = providerFactory.createLLMProvider('openai');

            const response = await provider.makeAPICall('/embeddings', {
                model: this.model,
                input: text,
                encoding_format: this.encodingFormat
            });

            const embedding = response.data[0].embedding;

            logger.info('Embedding generated successfully', {
                dimensions: embedding.length
            });

            return embedding;
        } catch (error) {
            logger.error('Embedding generation failed', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Generate embeddings for multiple texts
     * @param {Array<string>} texts - Texts to embed
     * @returns {Promise<Array<Array>>} Array of embedding vectors
     */
    async embedBatch(texts) {
        logger.info('Generating batch embeddings', {
            count: texts.length,
            model: this.model
        });

        try {
            const provider = providerFactory.createLLMProvider('openai');

            const response = await provider.makeAPICall('/embeddings', {
                model: this.model,
                input: texts,
                encoding_format: this.encodingFormat
            });

            const embeddings = response.data.map(item => item.embedding);

            logger.info('Batch embeddings generated successfully', {
                count: embeddings.length
            });

            return embeddings;
        } catch (error) {
            logger.error('Batch embedding generation failed', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Build brand DNA text for embedding
     * @param {Object} profile - Business profile
     * @returns {string} Brand DNA text
     */
    buildBrandDNA(profile) {
        return `Name: ${profile.name}
Tagline: ${profile.tagline}
Description: ${profile.description}
Products: ${profile.products?.join(', ')}`;
    }
}

module.exports = new EmbeddingService();
