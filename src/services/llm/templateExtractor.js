const llmService = require('./llmService');
const { parseJSONObject } = require('../../utils/jsonParser');
const logger = require('../../utils/logger');

/**
 * Template Metadata Extractor
 * Extracts structured metadata from template images
 */
class TemplateExtractor {
  /**
   * Extract metadata from template
   * @param {Object} template - Template object with image URL
   * @returns {Promise<Object>} Extracted metadata
   */
  async extractMetadata(template) {
    logger.info('Extracting template metadata', {
      templateId: template._id,
      templateName: template.name
    });

    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(template);

    try {
      const response = await llmService.call(
        'TEMPLATE_METADATA_EXTRACTION',
        systemPrompt,
        userPrompt,
        { image: template.images.fullSize }
      );

      const metadata = parseJSONObject(response, 'template_metadata_extraction');

      logger.info('Template metadata extracted successfully', {
        templateId: template._id
      });

      return metadata;
    } catch (error) {
      logger.error('Template metadata extraction failed', {
        templateId: template._id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Build system prompt for metadata extraction
   * @returns {string} System prompt
   */
  buildSystemPrompt() {
    return `You are an expert design analyst specializing in poster and template analysis.

Your task is to analyze a template image and extract structured metadata in JSON format.

The metadata should follow this exact schema:
{
  "festival_name": "string",
  "poster_design_metadata": {
    "core_elements": {
      "must_have": ["array", "of", "strings"],
      "optional_variations": ["array", "of", "strings"]
    },
    "composition_guidelines": {
      "layout": "string",
      "text_area": {
        "primary_text": "string",
        "safe_zones": "string"
      },
      "balance": "string",
      "depth": "string"
    },
    "style_and_aesthetic": {
      "lighting": {
        "type": "string",
        "contrast": "string",
        "mood": "string"
      },
      "color_palette": {
        "dominant": ["array", "of", "colors"],
        "accents": ["array", "of", "colors"],
        "tone": "string"
      },
      "textures": ["array", "of", "strings"],
      "aesthetic_keywords": ["array", "of", "strings"]
    },
    "creative_flexibility": {
      "fixed": ["array", "of", "strings"],
      "flexible": ["array", "of", "strings"],
      "suggested_alternatives": {
        "lighting": ["array", "of", "strings"],
        "background": ["array", "of", "strings"],
        "props": ["array", "of", "strings"]
      }
    },
    "typography": {
      "copy": {},
      "copy_styles": "string",
      "layout": "string"
    }
  }
}

Rules:
1. Respond with ONLY valid JSON, no markdown, no explanations
2. Be specific and detailed in descriptions
3. Extract actual text from the template in the "copy" object
4. Describe colors using hex codes or color names
5. Be thorough but concise`;
  }

  /**
   * Build user prompt for metadata extraction
   * @param {Object} template - Template object
   * @returns {string} User prompt
   */
  buildUserPrompt(template) {
    return `Analyze this template image and extract metadata:

Template Name: ${template.name}
Template Type: ${template.type || 'Not specified'}
Festival/Event: ${template.tags?.join(', ') || 'Not specified'}

Extract all visual elements, composition guidelines, color palette, typography, and creative flexibility options.`;
  }
}

module.exports = new TemplateExtractor();
