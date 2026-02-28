const WishingPosterGenerator = require('./wishingGenerator');
const AwarenessPosterGenerator = require('./awarenessGenerator');
const CTAPosterGenerator = require('./ctaGenerator');
const logger = require('../../utils/logger');

/**
 * Poster Generation Factory
 * Routes to appropriate generator based on poster type
 */
class PosterGenerationService {
    constructor() {
        this.generators = {
            wish: new WishingPosterGenerator(),
            awareness: new AwarenessPosterGenerator(),
            cta: new CTAPosterGenerator()
        };
    }

    /**
     * Generate poster based on type
     * @param {Object} job - Generation job
     * @returns {Promise<Object>} Generation result
     */
    async generatePoster(job) {
        const generator = this.generators[job.posterType];

        if (!generator) {
            throw new Error(`Unknown poster type: ${job.posterType}`);
        }

        logger.info('Routing to poster generator', {
            jobId: job._id,
            posterType: job.posterType
        });

        return await generator.generate(job);
    }
}

module.exports = new PosterGenerationService();
