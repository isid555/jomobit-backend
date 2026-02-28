const logger = require('../../utils/logger');

/**
 * Semantic Matcher Service
 * Performs cosine similarity matching
 */
class SemanticMatcher {
    /**
     * Calculate cosine similarity between two vectors
     * @param {Array} vecA - First vector
     * @param {Array} vecB - Second vector
     * @returns {number} Similarity score (0-1)
     */
    cosineSimilarity(vecA, vecB) {
        if (vecA.length !== vecB.length) {
            throw new Error('Vectors must have same dimensions');
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);

        if (normA === 0 || normB === 0) {
            return 0;
        }

        return dotProduct / (normA * normB);
    }

    /**
     * Select best concept based on semantic similarity
     * @param {Array} concepts - Array of concepts with embeddings
     * @param {Array} brandDNAEmbedding - Brand DNA embedding
     * @returns {Object} Selected concept with scores
     */
    selectBestConcept(concepts, brandDNAEmbedding) {
        logger.info('Selecting best concept via semantic matching', {
            conceptCount: concepts.length
        });

        const conceptsWithScores = concepts.map(concept => {
            const score = this.cosineSimilarity(concept.embedding, brandDNAEmbedding);
            return {
                ...concept,
                score
            };
        });

        // Sort by score descending
        conceptsWithScores.sort((a, b) => b.score - a.score);

        const selectedConcept = conceptsWithScores[0];
        const rejectedConcepts = conceptsWithScores.slice(1);

        logger.info('Best concept selected', {
            selectedScore: selectedConcept.score,
            method: selectedConcept.score > 0 ? 'semantic_matching' : 'first_fallback'
        });

        return {
            selected: selectedConcept,
            rejected: rejectedConcepts,
            method: selectedConcept.score > 0 ? 'semantic_matching' : 'first_fallback'
        };
    }
}

module.exports = new SemanticMatcher();
