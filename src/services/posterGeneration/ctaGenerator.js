const BasePosterGenerator = require('./baseGenerator');
const conceptGenerator = require('../llm/conceptGenerator');
const embeddingService = require('../embedding/embeddingService');
const semanticMatcher = require('../embedding/semanticMatcher');
const PosterConcept = require('../../models/PosterConcept');
const llmService = require('../llm/llmService');
const { parseJSONObject } = require('../../utils/jsonParser');
const { providerFactory } = require('../aiProviders/providerFactory');
const { RETRY_CONFIG } = require('../../config/llmModels');
const ImageKitService = require('../aiProviders/ImageKitService');
const logger = require('../../utils/logger');

/**
 * CTA Poster Generator
 * Handles call-to-action poster generation with multi-stage image generation
 */
class CTAPosterGenerator extends BasePosterGenerator {
    constructor() {
        super();
        this.imageKit = new ImageKitService();
    }

    /**
     * Generate CTA poster
     * @param {Object} job - Generation job
     * @returns {Promise<Object>} Generation result
     */
    async generate(job) {
        logger.info('Starting CTA poster generation', {
            jobId: job._id
        });

        // Start prompt timing (includes concept generation, subject splitting, copy)
        this.startPromptTiming();

        // Preprocessing
        const { niche, templateMetadata } = await this.preprocess(job);

        // Generate concepts
        const concepts = await conceptGenerator.generateConcepts(
            job.profileId,
            templateMetadata,
            'cta',
            niche
        );

        // Embed concepts and brand DNA
        const { selectedConcept, rejectedConcepts, method } = await this.selectConcept(
            concepts,
            job.profileId
        );

        // Store concepts in database
        await this.storeConcepts(job._id, selectedConcept, rejectedConcepts, method, job.profileId);

        // Split subjects and generate prompts for model & product
        const { subjects, useTemplate } = await this.splitSubjects(
            selectedConcept,
            templateMetadata
        );

        // Generate copy
        const copy = await this.generateCopy(
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
            null, // intermediateImages not yet generated
            useTemplate
        );

        // End prompt timing
        const promptGenerationTime = this.endPromptTiming();

        // Start image timing (includes model, product, and final poster)
        this.startImageTiming();

        // Generate model and product images (multi-stage)
        const intermediateImages = await this.generateIntermediateImages(
            job,
            subjects,
            niche
        );

        // Generate final poster
        const result = await this.generatePoster(
            job,
            finalPrompt,
            intermediateImages,
            useTemplate ? templateMetadata : null
        );

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
            subjects,
            useTemplate,
            copy,
            intermediateImages: {
                model: intermediateImages.model?.type,
                product: intermediateImages.product?.type
            },
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
            posterType: 'cta',
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
     * Split concept into subjects (model + product) and generate prompts
     * @param {Object} selectedConcept - Selected concept
     * @param {Object} templateMetadata - Template metadata
     * @returns {Promise<Object>} Subjects with prompts and template usage flag
     */
    async splitSubjects(selectedConcept, templateMetadata) {
        logger.info('Splitting subjects from concept');

        const systemPrompt = `You are an expert at analyzing creative concepts and breaking them down into actionable components.

Analyze the concept and determine:
1. What subjects need to be generated separately (model, product, or both)
2. Generate structured prompts for each subject
3. Determine if template should be used

For MODEL prompts:
- Describe look, expression, style, age, gender, hair style
- Match tone and mood of concept and festival
- Keep description creative but not overly detailed
- Allow room for diffusion model creativity

For PRODUCT prompts:
- Describe product inspired by real-world products
- Proper alignment and logical placement
- Real photography style
- Avoid random placements

Respond in JSON format:
{
  "subjects": {
    "model": {
      "needed": true/false,
      "prompt": "..." or null,
      "description": "..." or null
    },
    "product": {
      "needed": true/false,
      "prompt": "..." or null,
      "description": "..." or null
    }
  },
  "useTemplate": true/false,
  "reasoning": "Brief explanation of decisions"
}`;

        const userPrompt = `Concept:
${selectedConcept.concept}

Festival: ${templateMetadata.festival_name}
Template Style: ${templateMetadata.poster_design_metadata.style_and_aesthetic.aesthetic_keywords.join(', ')}

Analyze and split into subjects:`;

        const response = await llmService.call('SUBJECT_SPLITTING', systemPrompt, userPrompt);
        const parsed = parseJSONObject(response, 'cta_subject_splitting');

        logger.info('Subjects split successfully', {
            modelNeeded: parsed.subjects.model.needed,
            productNeeded: parsed.subjects.product.needed,
            useTemplate: parsed.useTemplate
        });

        return parsed;
    }

    /**
     * Generate intermediate images (model and/or product)
     * @param {Object} job - Generation job
     * @param {Object} subjects - Subjects with prompts
     * @param {string} niche - Brand niche
     * @returns {Promise<Object>} Generated images or descriptions
     */
    async generateIntermediateImages(job, subjects, niche) {
        const results = {
            model: null,
            product: null
        };

        // Generate model image if needed
        if (subjects.model.needed && subjects.model.prompt) {
            results.model = await this.generateModelImage(
                job,
                subjects.model.prompt,
                subjects.model.description,
                niche
            );
        }

        // Generate product image if needed
        if (subjects.product.needed && subjects.product.prompt) {
            results.product = await this.generateProductImage(
                job,
                subjects.product.prompt,
                subjects.product.description,
                niche
            );
        }

        return results;
    }

    /**
     * Generate model image with retry and fallback
     * @param {Object} job - Generation job
     * @param {string} prompt - Model prompt
     * @param {string} description - Model description (fallback)
     * @param {string} niche - Brand niche
     * @returns {Promise<Object>} Image URL or description
     */
    async generateModelImage(job, prompt, description, niche) {
        logger.info('Generating model image', { jobId: job._id });

        const diffusionProvider = providerFactory.createDiffusionProvider(
            job.aiProvider.diffusion
        );

        // Add niche-specific enhancements to prompt
        const enhancedPrompt = this.enhancePromptWithNiche(prompt, niche, 'model');

        const parameters = {
            size: '1024x1024',
            quality: 'high',
            format: 'png'
        };

        // Try to generate with retry
        for (let attempt = 0; attempt <= RETRY_CONFIG.imageGeneration; attempt++) {
            try {
                const result = await diffusionProvider.generateImage(enhancedPrompt, parameters);

                // Upload to ImageKit under assets/model/
                const fileName = `model_${job._id}_${Date.now()}.png`;
                const imageKitResult = await this.imageKit.uploadImage(
                    result.imageUrl,
                    fileName,
                    'assets/model'
                );

                logger.info('Model image generated successfully', {
                    jobId: job._id,
                    imageUrl: imageKitResult.url
                });

                return {
                    type: 'image',
                    url: imageKitResult.url,
                    thumbnailUrl: imageKitResult.thumbnailUrl
                };
            } catch (error) {
                logger.warn('Model image generation attempt failed', {
                    jobId: job._id,
                    attempt: attempt + 1,
                    error: error.message
                });

                if (attempt >= RETRY_CONFIG.imageGeneration) {
                    logger.info('Falling back to model description', { jobId: job._id });
                    return {
                        type: 'description',
                        description: description
                    };
                }
            }
        }
    }

    /**
     * Generate product image with retry and fallback
     * @param {Object} job - Generation job
     * @param {string} prompt - Product prompt
     * @param {string} description - Product description (fallback)
     * @param {string} niche - Brand niche
     * @returns {Promise<Object>} Image URL or description
     */
    async generateProductImage(job, prompt, description, niche) {
        logger.info('Generating product image', { jobId: job._id });

        const diffusionProvider = providerFactory.createDiffusionProvider(
            job.aiProvider.diffusion
        );

        // Add niche-specific enhancements to prompt
        const enhancedPrompt = this.enhancePromptWithNiche(prompt, niche, 'product');

        const parameters = {
            size: '1024x1024',
            quality: 'high',
            format: 'png'
        };

        // Try to generate with retry
        for (let attempt = 0; attempt <= RETRY_CONFIG.imageGeneration; attempt++) {
            try {
                const result = await diffusionProvider.generateImage(enhancedPrompt, parameters);

                // Upload to ImageKit under assets/product/
                const fileName = `product_${job._id}_${Date.now()}.png`;
                const imageKitResult = await this.imageKit.uploadImage(
                    result.imageUrl,
                    fileName,
                    'assets/product'
                );

                logger.info('Product image generated successfully', {
                    jobId: job._id,
                    imageUrl: imageKitResult.url
                });

                return {
                    type: 'image',
                    url: imageKitResult.url,
                    thumbnailUrl: imageKitResult.thumbnailUrl
                };
            } catch (error) {
                logger.warn('Product image generation attempt failed', {
                    jobId: job._id,
                    attempt: attempt + 1,
                    error: error.message
                });

                if (attempt >= RETRY_CONFIG.imageGeneration) {
                    logger.info('Falling back to product description', { jobId: job._id });
                    return {
                        type: 'description',
                        description: description
                    };
                }
            }
        }
    }

    /**
     * Enhance prompt with niche-specific guidelines
     * @param {string} prompt - Base prompt
     * @param {string} niche - Brand niche
     * @param {string} subjectType - 'model' or 'product'
     * @returns {string} Enhanced prompt
     */
    enhancePromptWithNiche(prompt, niche, subjectType) {
        const NICHE_ENHANCEMENTS = {
            fashion: {
                model: 'Real photography style, professional fashion model, elegant pose, studio lighting',
                product: 'Real fabric textures, authentic clothing style, professional product photography'
            },
            jewellery: {
                model: 'Elegant expression, warm lighting, close-up shot, premium aesthetic',
                product: 'Macro shot, intricate details, premium materials, elegant placement'
            },
            electronics: {
                model: 'Cool and professional look, modern aesthetic, tech-savvy vibe',
                product: 'Clean product shot, gradient background, feature highlights, modern design'
            },
            wearables: {
                model: 'Active lifestyle, dynamic pose, modern aesthetic',
                product: 'Product in use context, clean design, modern technology aesthetic'
            },
            food_gourmet: {
                model: 'Natural expression, enjoying food, warm ambiance',
                product: 'Appetizing presentation, natural lighting, fresh ingredients'
            },
            sports: {
                model: 'Athletic build, dynamic movement, energetic expression',
                product: 'Dynamic product shot, action-oriented, performance-focused'
            },
            accessories: {
                model: 'Stylish and confident, accessory showcase, elegant pose',
                product: 'Premium materials, detailed craftsmanship, elegant presentation'
            }
        };

        const enhancement = NICHE_ENHANCEMENTS[niche]?.[subjectType];

        if (enhancement) {
            return `${prompt}\n\nStyle: ${enhancement}`;
        }

        return prompt;
    }

    /**
     * Generate copy for CTA poster
     * @param {Object} profile - Business profile
     * @param {Object} templateMetadata - Template metadata
     * @param {Object} selectedConcept - Selected concept
     * @returns {Promise<Object>} Copy object
     */
    async generateCopy(profile, templateMetadata, selectedConcept) {
        const systemPrompt = `You are a conversion copywriter specializing in CTA posters.

Generate emotional, human-feel copy that focuses on brand tone and personality.

Copy should be:
- Action-oriented and persuasive
- Clear value proposition
- Sense of urgency
- Emotional and relatable

Respond in JSON format:
{
  "headline": "Strong offer or benefit statement",
  "subheadline": "Supporting details or urgency message",
  "cta": "Clear action button text",
  "microcopy": "Additional details or incentives (optional)"
}`;

        const userPrompt = `Brand: ${profile.name}
Tagline: ${profile.tagline}
Festival: ${templateMetadata.festival_name}

Concept:
${selectedConcept.concept}

Generate CTA copy:`;

        const response = await llmService.call('COPY_GENERATION', systemPrompt, userPrompt);
        return parseJSONObject(response, 'cta_copy_generation');
    }

    /**
     * Build final prompt for poster composition
     * @param {Object} job - Generation job
     * @param {string} niche - Brand niche
     * @param {Object} templateMetadata - Template metadata
     * @param {Object} selectedConcept - Selected concept
     * @param {Object} copy - Generated copy
     * @param {Object} intermediateImages - Model and product images/descriptions
     * @param {boolean} useTemplate - Whether to use template
     * @returns {Promise<string>} Final prompt
     */
    async buildFinalPrompt(job, niche, templateMetadata, selectedConcept, copy, intermediateImages, useTemplate) {
        const systemPrompt = this.getFinalPromptSystemPrompt(niche);

        // Build content based on what we have
        let modelContent = '';
        let productContent = '';

        if (intermediateImages.model) {
            if (intermediateImages.model.type === 'image') {
                modelContent = `MODEL IMAGE PROVIDED: Use the provided model image in the composition.`;
            } else {
                modelContent = `MODEL DESCRIPTION: ${intermediateImages.model.description}`;
            }
        }

        if (intermediateImages.product) {
            if (intermediateImages.product.type === 'image') {
                productContent = `PRODUCT IMAGE PROVIDED: Use the provided product image in the composition.`;
            } else {
                productContent = `PRODUCT DESCRIPTION: ${intermediateImages.product.description}`;
            }
        }

        const userPrompt = `Generate a diffusion model prompt for a CTA poster:

BRAND: ${job.profileId.name}
FESTIVAL: ${templateMetadata.festival_name}

CONCEPT:
${selectedConcept.concept}

COPY:
- Headline: ${copy.headline}
- Subheadline: ${copy.subheadline}
- CTA: ${copy.cta}
${copy.microcopy ? `- Microcopy: ${copy.microcopy}` : ''}

${modelContent}

${productContent}

${useTemplate ? `TEMPLATE: Use template with minimal influence (optional color/symbol/motif)` : 'TEMPLATE: Not used'}

INSTRUCTIONS:
- Blend model and product images (if provided) with matching scene/background
- Create cohesive composition with proper alignment
- Integrate copywriting with clear hierarchy
- Maintain festive essence while keeping product focused
- Ensure emotional and human feel

Generate the final prompt:`;

        return await llmService.call('FINAL_PROMPT_GENERATION', systemPrompt, userPrompt);
    }

    /**
     * Get system prompt for final prompt generation
     * @param {string} niche - Brand niche
     * @returns {string} System prompt
     */
    getFinalPromptSystemPrompt(niche) {
        return `You are an expert prompt engineer for diffusion models specializing in CTA posters.

Generate a detailed prompt that:
- Composes model and product images into cohesive scene
- Creates compelling, action-oriented visual
- Maintains product focus with festive essence
- Ensures proper alignment and placement
- Integrates copywriting effectively

${niche !== 'other' ? `\n\nNICHE-SPECIFIC GUIDELINES for ${niche} will be applied.` : ''}`;
    }

    /**
     * Generate final poster using diffusion provider
     * @param {Object} job - Generation job
     * @param {string} prompt - Final prompt
     * @param {Object} intermediateImages - Model and product images
     * @param {Object|null} templateMetadata - Template metadata (if used)
     * @returns {Promise<Object>} Generation result
     */
    async generatePoster(job, prompt, intermediateImages, templateMetadata) {
        const diffusionProvider = providerFactory.createDiffusionProvider(
            job.aiProvider.diffusion
        );

        const imageUrls = {
            logo: job.profileId.logo || null
        };

        // Add model image if available
        if (intermediateImages.model?.type === 'image') {
            imageUrls.model = intermediateImages.model.url;
        }

        // Add product image if available
        if (intermediateImages.product?.type === 'image') {
            imageUrls.product = intermediateImages.product.url;
        }

        // Add template if used
        if (templateMetadata) {
            imageUrls.template = job.templateId.images.fullSize;
        }

        const parameters = {
            size: `${job.templateId.aspectRatio.width}x${job.templateId.aspectRatio.height}`,
            quality: 'high',
            format: 'png',
            image_urls: imageUrls
        };

        logger.info('Generating final CTA poster', {
            jobId: job._id,
            hasModelImage: !!imageUrls.model,
            hasProductImage: !!imageUrls.product,
            hasTemplate: !!imageUrls.template
        });

        return await diffusionProvider.generateImage(prompt, parameters);
    }
}

module.exports = CTAPosterGenerator;
