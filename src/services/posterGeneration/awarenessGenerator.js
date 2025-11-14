const BasePosterGenerator = require('./baseGenerator');
const conceptGenerator = require('../llm/conceptGenerator');
const embeddingService = require('../embedding/embeddingService');
const semanticMatcher = require('../embedding/semanticMatcher');
const PosterConcept = require('../../models/PosterConcept');
const llmService = require('../llm/llmService');
const { parseJSONObject } = require('../../utils/jsonParser');
const { providerFactory } = require('../aiProviders/providerFactory');
const logger = require('../../utils/logger');

/**
 * Awareness Poster Generator
 * Handles brand awareness poster generation
 */
class AwarenessPosterGenerator extends BasePosterGenerator {
    /**
     * Generate awareness poster
     * @param {Object} job - Generation job
     * @returns {Promise<Object>} Generation result
     */
    async generate(job) {
        logger.info('Starting awareness poster generation', {
            jobId: job._id
        });

        // Start prompt timing
        this.startPromptTiming();

        // Preprocessing
        const { niche, templateMetadata } = await this.preprocess(job);

        // Generate concepts
        const concepts = await conceptGenerator.generateConcepts(
            job.profileId,
            templateMetadata,
            'awareness',
            niche
        );

        // Embed concepts and brand DNA
        const { selectedConcept, rejectedConcepts, method } = await this.selectConcept(
            concepts,
            job.profileId
        );

        // Store concepts in database
        await this.storeConcepts(job._id, selectedConcept, rejectedConcepts, method, job.profileId);

        // Generate copy and visual description
        const { copy, visualDescription } = await this.generateCopyAndVisuals(
            job.profileId,
            templateMetadata,
            selectedConcept
        );

        // Build final prompt
        const finalPrompt = await this.buildFinalPrompt(
            job,
            niche,
            templateMetadata,
            selectedConcept,
            copy,
            visualDescription
        );

        // End prompt timing
        const promptGenerationTime = this.endPromptTiming();

        // Start image timing
        this.startImageTiming();

        // Generate poster
        const result = await this.generatePoster(job, finalPrompt, templateMetadata);

        // End image timing
        const imageGenerationTime = this.endImageTiming();

        // Add prompt data and timing to result
        result.prompt = finalPrompt;
        result.promptParameters = {
            llmProvider: job.aiProvider.llm,
            profileId: job.profileId._id,
            templateId: job.templateId._id,
            posterType: job.posterType,
            niche,
            selectedConcept: selectedConcept.concept,
            conceptScore: selectedConcept.score,
            selectionMethod: method,
            copy,
            visualDescription,
            promptGenerationTime
        };
        result.timing = {
            promptGenerationTime,
            imageGenerationTime,
            totalProcessingTime: promptGenerationTime + imageGenerationTime
        };

        return this.postprocess(job, result);
    }

    /**
     * Select best concept using semantic matching
     * @param {Array} concepts - Generated concepts
     * @param {Object} profile - Business profile
     * @returns {Promise<Object>} Selected and rejected concepts
     */
    async selectConcept(concepts, profile) {
        // Build brand DNA
        const brandDNA = embeddingService.buildBrandDNA(profile);

        // Generate embeddings
        const brandDNAEmbedding = await embeddingService.embed(brandDNA);

        const conceptTexts = concepts.map(c => JSON.stringify(c));
        const conceptEmbeddings = await embeddingService.embedBatch(conceptTexts);

        // Attach embeddings to concepts
        const conceptsWithEmbeddings = concepts.map((concept, index) => ({
            concept: concept,
            embedding: conceptEmbeddings[index]
        }));

        // Select best concept
        const result = semanticMatcher.selectBestConcept(
            conceptsWithEmbeddings,
            brandDNAEmbedding
        );

        return {
            selectedConcept: {
                concept: result.selected.concept,
                score: result.selected.score,
                embedding: result.selected.embedding
            },
            rejectedConcepts: result.rejected.map(r => ({
                concept: r.concept,
                score: r.score,
                embedding: r.embedding
            })),
            method: result.method
        };
    }

    /**
     * Store concepts in database
     * @param {ObjectId} jobId - Job ID
     * @param {Object} selectedConcept - Selected concept
     * @param {Array} rejectedConcepts - Rejected concepts
     * @param {string} method - Selection method
     * @param {Object} profile - Business profile
     */
    async storeConcepts(jobId, selectedConcept, rejectedConcepts, method, profile) {
        const brandDNA = embeddingService.buildBrandDNA(profile);

        await PosterConcept.create({
            jobId,
            posterType: 'awareness',
            selectedConcept,
            rejectedConcepts,
            metadata: {
                brandDNA,
                totalGenerated: rejectedConcepts.length + 1,
                selectionMethod: method
            }
        });

        logger.info('Concepts stored in database', {
            jobId,
            selectedScore: selectedConcept.score,
            rejectedCount: rejectedConcepts.length
        });
    }

    /**
     * Generate copy and visual description
     * @param {Object} profile - Business profile
     * @param {Object} templateMetadata - Template metadata
     * @param {Object} selectedConcept - Selected concept
     * @returns {Promise<Object>} Copy and visual description
     */
    async generateCopyAndVisuals(profile, templateMetadata, selectedConcept) {
        const systemPrompt = `You are a creative director specializing in brand awareness campaigns.

Generate copy and visual description for an awareness poster based on the selected concept.

The copy should be inspirational, story-driven, and value-focused.
The visual description should be detailed, cinematic, and emotionally resonant.

Template should be softly blended (weight 0.5-0.65) - natural and logical integration.

Respond in JSON format:
{
  "copy": {
    "headline": "...",
    "subheadline": "...",
    "tagline": "..."
  },
  "visual_description": "Detailed visual description..."
}`;

        const userPrompt = `Brand: ${profile.name}
Tagline: ${profile.tagline}
Festival: ${templateMetadata.festival_name}

Selected Concept:
${selectedConcept.concept}

Template Style: ${templateMetadata.poster_design_metadata.style_and_aesthetic.aesthetic_keywords.join(', ')}

Generate copy and visual description:`;

        const response = await llmService.call('VISUAL_DESCRIPTION', systemPrompt, userPrompt);
        return parseJSONObject(response, 'awareness_copy_and_visual_description');
    }

    /**
     * Build final prompt
     * @param {Object} job - Generation job
     * @param {string} niche - Brand niche
     * @param {Object} templateMetadata - Template metadata
     * @param {Object} selectedConcept - Selected concept
     * @param {Object} copy - Generated copy
     * @param {string} visualDescription - Visual description
     * @returns {Promise<string>} Final prompt
     */
    async buildFinalPrompt(job, niche, templateMetadata, selectedConcept, copy, visualDescription) {
        const systemPrompt = this.getFinalPromptSystemPrompt(niche);

        const userPrompt = `Generate a diffusion model prompt for an awareness poster:

BRAND: ${job.profileId.name}
FESTIVAL: ${templateMetadata.festival_name}

CONCEPT:
${selectedConcept.concept}

COPY:
- Headline: ${copy.headline}
- Subheadline: ${copy.subheadline}
- Tagline: ${copy.tagline}

VISUAL DIRECTION:
${visualDescription}

TEMPLATE BLENDING: Soft (weight 0.5-0.65) - natural integration

Generate the final prompt:`;

        return await llmService.call('FINAL_PROMPT_GENERATION', systemPrompt, userPrompt);
    }

    /**
     * Get system prompt for final prompt generation
     * @param {string} niche - Brand niche
     * @returns {string} System prompt
     */
    getFinalPromptSystemPrompt(niche) {
        let basePrompt = `You are an expert prompt engineer for diffusion models.
Generate a detailed, cinematic prompt for an awareness poster.
Focus on emotion, storytelling, and brand values.`;

        if (niche !== 'other') {
            basePrompt += `\n\nNICHE-SPECIFIC GUIDELINES for ${niche.toUpperCase()}:
${this.getNicheFinetuning(niche)}`;
        }

        return basePrompt;
    }

    /**
     * Get niche-specific fine-tuning
     * @param {string} niche - Brand niche
     * @returns {string} Fine-tuning guidelines
     */
    getNicheFinetuning(niche) {
        const NICHE_GUIDELINES = {
            fashion: '- Real fabrics, cinematic style\n- Lifestyle imagery\n- Authentic brand story',
            jewellery: '- Luxurious aesthetic\n- Emotional resonance\n- Premium storytelling',
            electronics: '- Modern, futuristic\n- Energy and connectivity\n- Lifestyle integration',
            wearables: '- Active lifestyle\n- Modern aesthetic\n- Real-world usage',
            food_gourmet: '- Warm, sensory\n- Comfort and gathering\n- Authentic moments',
            sports: '- Dynamic energy\n- Performance focus\n- Inspirational',
            accessories: '- Elegant lifestyle\n- Premium aesthetic\n- Aspirational'
        };

        return NICHE_GUIDELINES[niche] || '';
    }

    /**
     * Generate poster using diffusion provider
     * @param {Object} job - Generation job
     * @param {string} prompt - Final prompt
     * @param {Object} templateMetadata - Template metadata
     * @returns {Promise<Object>} Generation result
     */
    async generatePoster(job, prompt, templateMetadata) {
        const diffusionProvider = providerFactory.createDiffusionProvider(
            job.aiProvider.diffusion
        );

        const parameters = {
            size: `${job.templateId.aspectRatio.width}x${job.templateId.aspectRatio.height}`,
            quality: 'high',
            format: 'png',
            image_urls: {
                template: job.templateId.images.fullSize,
                logo: job.profileId.logo || null
            },
            template_weight: 0.6 // Soft blending
        };

        return await diffusionProvider.generateImage(prompt, parameters);
    }
}

module.exports = AwarenessPosterGenerator;
