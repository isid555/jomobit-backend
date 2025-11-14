/**
 * LLM Model Configuration
 * Centralized configuration for different LLM tasks
 */

const LLM_MODELS = {
    // Vision tasks - Requires vision-capable models
    TEMPLATE_METADATA_EXTRACTION: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        temperature: 0.3,
        maxTokens: 2000,
        description: 'Extract structured metadata from template images'
    },

    // Creative tasks - High quality models
    CONCEPT_GENERATION: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        temperature: 0.8,
        maxTokens: 1500,
        description: 'Generate creative poster concepts'
    },

    VISUAL_DESCRIPTION: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 1200,
        description: 'Generate detailed visual descriptions'
    },

    FINAL_PROMPT_GENERATION: {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 2000,
        description: 'Build final diffusion model prompt'
    },

    SUBJECT_SPLITTING: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        temperature: 0.5,
        maxTokens: 1000,
        description: 'Split concept into model and product subjects'
    },

    // Simple tasks - Cost-optimized models
    NICHE_DETECTION: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        temperature: 0.2,
        maxTokens: 50,
        description: 'Detect brand niche category'
    },

    COPY_GENERATION: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 500,
        description: 'Generate poster copywriting'
    },

    PRODUCT_DESCRIPTION: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        temperature: 0.6,
        maxTokens: 800,
        description: 'Generate product descriptions'
    },

    TYPE_DECISION: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        temperature: 0.3,
        maxTokens: 100,
        description: 'Decide wishing poster type (A or B)'
    }
};

// Supported niches for fine-tuning
const SUPPORTED_NICHES = [
    'fashion',
    'accessories',
    'electronics',
    'wearables',
    'food_gourmet',
    'sports',
    'jewellery'
];

// Number of concepts to generate
const CONCEPT_COUNT = 5;

// Retry configurations
const RETRY_CONFIG = {
    nicheDetection: 1,      // Retry once
    conceptGeneration: 2,   // Retry twice
    imageGeneration: 1      // Retry once (for CTA model/product)
};

module.exports = {
    LLM_MODELS,
    SUPPORTED_NICHES,
    CONCEPT_COUNT,
    RETRY_CONFIG
};
