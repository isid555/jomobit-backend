const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

/**
 * Swagger configuration for API documentation
 */
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Jomobit Backend API',
      version: '1.0.0',
      description: `
        # Jomobit Backend API Documentation
        
        Welcome to the Jomobit API! This is a comprehensive AI-powered poster generation platform that enables users to create professional posters using business profiles and customizable templates.
        
        ## Key Features
        - **AI-Powered Generation**: Create posters using advanced AI models (OpenAI, Gemini, Ideogram)
        - **Business Profiles**: Manage multiple business profiles with branding information
        - **Template Library**: Access hundreds of professional templates
        - **Credit System**: Flexible credit-based usage with subscription plans
        - **Admin Dashboard**: Comprehensive administrative tools and analytics
        
        ## Authentication
        This API uses Auth0 JWT tokens for authentication. To get started:
        1. Register or login through Auth0 to obtain a JWT token
        2. Include the token in the Authorization header: \`Bearer <your-jwt-token>\`
        3. Admin endpoints require additional admin permissions
        
        ## Rate Limiting
        - Standard endpoints: 100 requests per minute per user
        - Generation endpoints: 10 requests per minute per user
        - Admin endpoints: 200 requests per minute per admin
        
        ## Error Handling
        All errors follow a consistent format with appropriate HTTP status codes and detailed error messages.
        
        ## Support
        For API support, please contact our team or check the documentation.
      `,
      contact: {
        name: 'Jomobit API Support',
        email: 'support@jomobit.com',
        url: 'https://jomobit.com/support'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      },
      termsOfService: 'https://jomobit.com/terms'
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'http://localhost:3000/api',
        description: 'Development server'
      },
      {
        url: 'https://api.jomobit.com/api',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: `
            Auth0 JWT Bearer Token Authentication
            
            To authenticate with the API:
            1. Register or login through Auth0 to obtain a JWT token
            2. Include the token in the Authorization header: 'Bearer <your-jwt-token>'
            3. The token will be validated on each request
            
            Token format: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
            
            Note: Tokens expire after 24 hours and need to be refreshed.
            Admin endpoints require additional admin permissions in the token.
          `
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Human-readable error message',
              example: 'Resource not found'
            },
            code: {
              type: 'string',
              description: 'Machine-readable error code',
              example: 'NOT_FOUND'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Error timestamp in ISO 8601 format',
              example: '2024-01-15T10:30:00Z'
            },
            correlationId: {
              type: 'string',
              description: 'Unique request correlation ID for debugging',
              example: 'req-123456789'
            }
          },
          required: ['error'],
          example: {
            error: 'Resource not found',
            code: 'NOT_FOUND',
            timestamp: '2024-01-15T10:30:00Z',
            correlationId: 'req-123456789'
          }
        },
        ValidationError: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'General validation error message',
              example: 'Validation failed'
            },
            details: {
              type: 'array',
              description: 'Detailed validation errors for each field',
              items: {
                type: 'object',
                properties: {
                  field: {
                    type: 'string',
                    description: 'Field name that failed validation',
                    example: 'email'
                  },
                  message: {
                    type: 'string',
                    description: 'Specific validation error message',
                    example: 'Email format is invalid'
                  },
                  value: {
                    description: 'The invalid value that was provided',
                    example: 'invalid-email'
                  }
                },
                required: ['field', 'message']
              }
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Error timestamp',
              example: '2024-01-15T10:30:00Z'
            },
            correlationId: {
              type: 'string',
              description: 'Request correlation ID',
              example: 'req-123456789'
            }
          },
          required: ['error', 'details'],
          example: {
            error: 'Validation failed',
            details: [
              {
                field: 'email',
                message: 'Email format is invalid',
                value: 'invalid-email'
              },
              {
                field: 'name',
                message: 'Name is required',
                value: null
              }
            ],
            timestamp: '2024-01-15T10:30:00Z',
            correlationId: 'req-123456789'
          }
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              pattern: '^[0-9a-fA-F]{24}$',
              description: 'Unique user identifier',
              example: '507f1f77bcf86cd799439011'
            },
            auth0Id: {
              type: 'string',
              description: 'Auth0 user identifier',
              example: 'auth0|507f1f77bcf86cd799439011'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
              example: 'user@example.com'
            },
            status: {
              type: 'string',
              enum: ['pending', 'active', 'suspended'],
              description: 'Current account status',
              example: 'active'
            },
            metadata: {
              type: 'object',
              description: 'Additional user information from Auth0',
              properties: {
                name: {
                  type: 'string',
                  description: 'User display name',
                  example: 'John Doe'
                },
                picture: {
                  type: 'string',
                  format: 'uri',
                  description: 'User profile picture URL',
                  example: 'https://example.com/avatar.jpg'
                },
                locale: {
                  type: 'string',
                  description: 'User locale preference',
                  example: 'en-US'
                }
              }
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation timestamp',
              example: '2024-01-15T10:30:00Z'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
              example: '2024-01-15T10:30:00Z'
            }
          },
          required: ['id', 'auth0Id', 'email', 'status'],
          example: {
            id: '507f1f77bcf86cd799439011',
            auth0Id: 'auth0|507f1f77bcf86cd799439011',
            email: 'user@example.com',
            status: 'active',
            metadata: {
              name: 'John Doe',
              picture: 'https://example.com/avatar.jpg',
              locale: 'en-US'
            },
            createdAt: '2024-01-15T10:30:00Z',
            updatedAt: '2024-01-15T10:30:00Z'
          }
        },
        BusinessProfile: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              pattern: '^[0-9a-fA-F]{24}$',
              description: 'Unique profile identifier',
              example: '507f1f77bcf86cd799439011'
            },
            userId: {
              type: 'string',
              pattern: '^[0-9a-fA-F]{24}$',
              description: 'Owner user ID',
              example: '507f1f77bcf86cd799439012'
            },
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              description: 'Business name',
              example: 'Acme Corporation'
            },
            tagline: {
              type: 'string',
              minLength: 1,
              maxLength: 200,
              description: 'Business tagline or slogan',
              example: 'Innovation at its finest'
            },
            description: {
              type: 'string',
              minLength: 1,
              maxLength: 1000,
              description: 'Detailed business description',
              example: 'We are a leading technology company specializing in innovative solutions for modern businesses.'
            },
            logo: {
              type: 'string',
              format: 'uri',
              description: 'Business logo URL',
              example: 'https://example.com/logo.png'
            },
            colorPalette: {
              type: 'array',
              maxItems: 10,
              description: 'Brand color palette',
              items: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                    description: 'Color name or identifier',
                    example: 'Primary Blue'
                  },
                  hex: {
                    type: 'string',
                    pattern: '^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$',
                    description: 'Hex color code',
                    example: '#3B82F6'
                  }
                },
                required: ['name', 'hex']
              },
              example: [
                { name: 'Primary Blue', hex: '#3B82F6' },
                { name: 'Secondary Green', hex: '#10B981' }
              ]
            },
            products: {
              type: 'array',
              maxItems: 20,
              items: {
                type: 'string',
                maxLength: 100
              },
              description: 'List of products or services offered',
              example: ['Web Development', 'Mobile Apps', 'Cloud Solutions']
            },
            address: {
              type: 'object',
              description: 'Business address information',
              properties: {
                street: {
                  type: 'string',
                  maxLength: 200,
                  description: 'Street address',
                  example: '123 Tech Street'
                },
                city: {
                  type: 'string',
                  maxLength: 100,
                  description: 'City name',
                  example: 'San Francisco'
                },
                state: {
                  type: 'string',
                  maxLength: 100,
                  description: 'State or province',
                  example: 'California'
                },
                country: {
                  type: 'string',
                  maxLength: 100,
                  description: 'Country name',
                  example: 'United States'
                },
                zipCode: {
                  type: 'string',
                  maxLength: 20,
                  description: 'Postal/ZIP code',
                  example: '94105'
                }
              }
            },
            isActive: {
              type: 'boolean',
              description: 'Whether the profile is active and can be used for generation',
              example: true
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Profile creation timestamp',
              example: '2024-01-15T10:30:00Z'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
              example: '2024-01-15T10:30:00Z'
            }
          },
          required: ['name', 'tagline', 'description'],
          example: {
            id: '507f1f77bcf86cd799439011',
            userId: '507f1f77bcf86cd799439012',
            name: 'Acme Corporation',
            tagline: 'Innovation at its finest',
            description: 'We are a leading technology company specializing in innovative solutions for modern businesses.',
            logo: 'https://example.com/logo.png',
            colorPalette: [
              { name: 'Primary Blue', hex: '#3B82F6' },
              { name: 'Secondary Green', hex: '#10B981' }
            ],
            products: ['Web Development', 'Mobile Apps', 'Cloud Solutions'],
            address: {
              street: '123 Tech Street',
              city: 'San Francisco',
              state: 'California',
              country: 'United States',
              zipCode: '94105'
            },
            isActive: true,
            createdAt: '2024-01-15T10:30:00Z',
            updatedAt: '2024-01-15T10:30:00Z'
          }
        },
        Template: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              pattern: '^[0-9a-fA-F]{24}$',
              description: 'Unique template identifier',
              example: '507f1f77bcf86cd799439011'
            },
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              description: 'Template display name',
              example: 'Modern Business Card'
            },
            description: {
              type: 'string',
              maxLength: 500,
              description: 'Detailed template description',
              example: 'A sleek, modern business card template perfect for professionals'
            },
            category: {
              type: 'string',
              description: 'Template category for organization',
              example: 'business'
            },
            type: {
              type: 'string',
              enum: ['social', 'print', 'web', 'story', 'post', 'banner'],
              description: 'Template type classification',
              example: 'print'
            },
            difficulty: {
              type: 'string',
              enum: ['beginner', 'intermediate', 'advanced'],
              description: 'Complexity level for customization',
              example: 'beginner'
            },
            tags: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Searchable tags for filtering and discovery',
              example: ['business', 'professional', 'modern', 'minimal']
            },
            images: {
              type: 'object',
              description: 'Template preview images in different sizes',
              properties: {
                thumbnail: {
                  type: 'string',
                  format: 'uri',
                  description: 'Thumbnail image URL',
                  example: 'https://cdn.jomobit.com/templates/thumbnails/507f1f77bcf86cd799439011.jpg'
                },
                preview: {
                  type: 'string',
                  format: 'uri',
                  description: 'Preview image URL',
                  example: 'https://cdn.jomobit.com/templates/previews/507f1f77bcf86cd799439011.jpg'
                },
                fullSize: {
                  type: 'string',
                  format: 'uri',
                  description: 'Full size image URL',
                  example: 'https://cdn.jomobit.com/templates/full/507f1f77bcf86cd799439011.jpg'
                }
              },
              required: ['thumbnail', 'preview', 'fullSize']
            },
            aspectRatio: {
              type: 'object',
              description: 'Template dimensions and aspect ratio information',
              properties: {
                width: {
                  type: 'number',
                  minimum: 1,
                  description: 'Template width in pixels',
                  example: 1080
                },
                height: {
                  type: 'number',
                  minimum: 1,
                  description: 'Template height in pixels',
                  example: 1080
                },
                ratio: {
                  type: 'string',
                  pattern: '^\\d+:\\d+$',
                  description: 'Aspect ratio as width:height',
                  example: '1:1'
                }
              },
              required: ['width', 'height', 'ratio']
            },
            metrics: {
              type: 'object',
              description: 'Template usage and performance metrics',
              properties: {
                usageCount: {
                  type: 'number',
                  minimum: 0,
                  description: 'Number of times template has been used',
                  example: 1250
                },
                rating: {
                  type: 'number',
                  minimum: 0,
                  maximum: 5,
                  description: 'Average user rating (0-5)',
                  example: 4.2
                },
                ratingCount: {
                  type: 'number',
                  minimum: 0,
                  description: 'Number of ratings received',
                  example: 89
                },
                lastUsed: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Last usage timestamp',
                  example: '2024-01-15T10:30:00Z'
                }
              }
            },
            status: {
              type: 'string',
              enum: ['draft', 'active', 'inactive', 'archived'],
              description: 'Template availability status',
              example: 'active'
            },
            isPublic: {
              type: 'boolean',
              description: 'Whether template is publicly available',
              example: true
            },
            isFeatured: {
              type: 'boolean',
              description: 'Whether template is featured in recommendations',
              example: false
            },
            createdBy: {
              type: 'string',
              pattern: '^[0-9a-fA-F]{24}$',
              description: 'ID of the user who created the template',
              example: '507f1f77bcf86cd799439012'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Template creation timestamp',
              example: '2024-01-15T10:30:00Z'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
              example: '2024-01-15T10:30:00Z'
            }
          },
          required: ['id', 'name', 'type', 'status'],
          example: {
            id: '507f1f77bcf86cd799439011',
            name: 'Modern Business Card',
            description: 'A sleek, modern business card template perfect for professionals',
            category: 'business',
            type: 'print',
            difficulty: 'beginner',
            tags: ['business', 'professional', 'modern', 'minimal'],
            images: {
              thumbnail: 'https://cdn.jomobit.com/templates/thumbnails/507f1f77bcf86cd799439011.jpg',
              preview: 'https://cdn.jomobit.com/templates/previews/507f1f77bcf86cd799439011.jpg',
              fullSize: 'https://cdn.jomobit.com/templates/full/507f1f77bcf86cd799439011.jpg'
            },
            aspectRatio: {
              width: 1080,
              height: 1080,
              ratio: '1:1'
            },
            metrics: {
              usageCount: 1250,
              rating: 4.2,
              ratingCount: 89,
              lastUsed: '2024-01-15T10:30:00Z'
            },
            status: 'active',
            isPublic: true,
            isFeatured: false,
            createdBy: '507f1f77bcf86cd799439012',
            createdAt: '2024-01-15T10:30:00Z',
            updatedAt: '2024-01-15T10:30:00Z'
          }
        },
        GenerationJob: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              pattern: '^[0-9a-fA-F]{24}$',
              description: 'Unique generation job identifier',
              example: '507f1f77bcf86cd799439011'
            },
            userId: {
              type: 'string',
              pattern: '^[0-9a-fA-F]{24}$',
              description: 'ID of the user who requested the generation',
              example: '507f1f77bcf86cd799439012'
            },
            profileId: {
              type: 'string',
              pattern: '^[0-9a-fA-F]{24}$',
              description: 'Business profile used for generation',
              example: '507f1f77bcf86cd799439013'
            },
            templateId: {
              type: 'string',
              pattern: '^[0-9a-fA-F]{24}$',
              description: 'Template used for generation',
              example: '507f1f77bcf86cd799439014'
            },
            status: {
              type: 'string',
              enum: ['pending', 'processing', 'completed', 'failed'],
              description: 'Current generation status',
              example: 'completed'
            },
            creditsReserved: {
              type: 'number',
              description: 'Number of credits reserved for this generation',
              example: 1
            },
            creditsUsed: {
              type: 'number',
              description: 'Number of credits actually consumed',
              example: 1
            },
            aiProvider: {
              type: 'object',
              description: 'AI providers used for generation',
              properties: {
                llm: {
                  type: 'string',
                  enum: ['openai', 'gemini'],
                  description: 'Language model provider used',
                  example: 'openai'
                },
                diffusion: {
                  type: 'string',
                  enum: ['openai', 'ideogram'],
                  description: 'Image generation provider used',
                  example: 'ideogram'
                }
              }
            },
            customizations: {
              type: 'object',
              description: 'Applied customizations',
              properties: {
                colors: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['#3B82F6', '#10B981']
                },
                text: {
                  type: 'string',
                  example: 'Special Offer - 50% Off!'
                },
                style: {
                  type: 'string',
                  example: 'modern'
                }
              }
            },
            result: {
              type: 'object',
              description: 'Generation result (available when status is completed)',
              properties: {
                imageUrl: {
                  type: 'string',
                  format: 'uri',
                  description: 'URL of the generated poster image',
                  example: 'https://cdn.jomobit.com/posters/507f1f77bcf86cd799439011.png'
                },
                thumbnailUrl: {
                  type: 'string',
                  format: 'uri',
                  description: 'URL of the thumbnail image',
                  example: 'https://cdn.jomobit.com/thumbnails/507f1f77bcf86cd799439011.jpg'
                },
                metadata: {
                  $ref: '#/components/schemas/PosterMetadata'
                }
              }
            },
            error: {
              type: 'object',
              description: 'Error details (available when status is failed)',
              properties: {
                code: {
                  type: 'string',
                  example: 'AI_PROVIDER_ERROR'
                },
                message: {
                  type: 'string',
                  example: 'AI provider temporarily unavailable'
                },
                retryable: {
                  type: 'boolean',
                  example: true
                }
              }
            },
            processingTime: {
              type: 'number',
              description: 'Processing time in seconds',
              example: 42.5
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Job creation timestamp',
              example: '2024-01-15T10:30:00Z'
            },
            startedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Processing start timestamp',
              example: '2024-01-15T10:30:15Z'
            },
            completedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Job completion timestamp',
              example: '2024-01-15T10:30:57Z'
            }
          },
          required: ['id', 'userId', 'profileId', 'templateId', 'status', 'creditsReserved'],
          example: {
            id: '507f1f77bcf86cd799439011',
            userId: '507f1f77bcf86cd799439012',
            profileId: '507f1f77bcf86cd799439013',
            templateId: '507f1f77bcf86cd799439014',
            status: 'completed',
            creditsReserved: 1,
            creditsUsed: 1,
            aiProvider: {
              llm: 'openai',
              diffusion: 'ideogram'
            },
            customizations: {
              colors: ['#3B82F6', '#10B981'],
              text: 'Special Offer - 50% Off!',
              style: 'modern'
            },
            result: {
              imageUrl: 'https://cdn.jomobit.com/posters/507f1f77bcf86cd799439011.png',
              thumbnailUrl: 'https://cdn.jomobit.com/thumbnails/507f1f77bcf86cd799439011.jpg'
            },
            processingTime: 42.5,
            createdAt: '2024-01-15T10:30:00Z',
            startedAt: '2024-01-15T10:30:15Z',
            completedAt: '2024-01-15T10:30:57Z'
          }
        },
        PosterGenerationRequest: {
          type: 'object',
          properties: {
            profileId: {
              type: 'string',
              pattern: '^[0-9a-fA-F]{24}$',
              description: 'Business profile ID to use for generation',
              example: '507f1f77bcf86cd799439013'
            },
            templateId: {
              type: 'string',
              pattern: '^[0-9a-fA-F]{24}$',
              description: 'Template ID to use for generation',
              example: '507f1f77bcf86cd799439014'
            },
            aiProvider: {
              type: 'object',
              description: 'AI providers to use for generation',
              properties: {
                llm: {
                  type: 'string',
                  enum: ['openai', 'gemini'],
                  description: 'Language model provider',
                  example: 'openai'
                },
                diffusion: {
                  type: 'string',
                  enum: ['openai', 'ideogram'],
                  description: 'Image generation provider',
                  example: 'ideogram'
                }
              },
              default: { llm: 'openai', diffusion: 'openai' }
            },
            priority: {
              type: 'string',
              enum: ['low', 'normal', 'high'],
              description: 'Generation priority level',
              example: 'normal',
              default: 'normal'
            },
            creditsRequired: {
              type: 'number',
              minimum: 1,
              maximum: 10,
              description: 'Number of credits to reserve for generation',
              example: 1,
              default: 1
            }
          },
          required: ['profileId', 'templateId'],
          example: {
            profileId: '507f1f77bcf86cd799439013',
            templateId: '507f1f77bcf86cd799439014',
            aiProvider: {
              llm: 'openai',
              diffusion: 'ideogram'
            },
            priority: 'normal',
            creditsRequired: 1
          }
        },
        // Admin Schema Definitions
        AdminDashboard: {
          type: 'object',
          properties: {
            metrics: {
              type: 'object',
              properties: {
                totalUsers: {
                  type: 'integer',
                  description: 'Total number of registered users',
                  example: 12450
                },
                activeUsers: {
                  type: 'integer',
                  description: 'Number of active users in the last 30 days',
                  example: 8920
                },
                totalRevenue: {
                  type: 'number',
                  description: 'Total revenue in USD',
                  example: 45678.90
                },
                monthlyRevenue: {
                  type: 'number',
                  description: 'Current month revenue in USD',
                  example: 12345.67
                },
                totalGenerations: {
                  type: 'integer',
                  description: 'Total number of poster generations',
                  example: 89456
                },
                activeSubscriptions: {
                  type: 'integer',
                  description: 'Number of active paid subscriptions',
                  example: 2340
                }
              }
            },
            recentActivity: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    enum: ['user_registration', 'subscription_created', 'generation_completed', 'payment_received'],
                    example: 'user_registration'
                  },
                  description: {
                    type: 'string',
                    example: 'New user registered: john@example.com'
                  },
                  timestamp: {
                    type: 'string',
                    format: 'date-time',
                    example: '2024-01-15T10:30:00Z'
                  },
                  metadata: {
                    type: 'object',
                    additionalProperties: true
                  }
                }
              }
            },
            systemHealth: {
              type: 'object',
              properties: {
                overall: {
                  type: 'string',
                  enum: ['healthy', 'degraded', 'unhealthy'],
                  example: 'healthy'
                },
                services: {
                  type: 'object',
                  properties: {
                    database: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'], example: 'healthy' },
                    redis: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'], example: 'healthy' },
                    aiProviders: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'], example: 'healthy' }
                  }
                }
              }
            }
          }
        },
        UserMetrics: {
          type: 'object',
          properties: {
            totalUsers: {
              type: 'integer',
              example: 12450
            },
            newUsers: {
              type: 'integer',
              description: 'New users in the specified period',
              example: 234
            },
            activeUsers: {
              type: 'integer',
              description: 'Active users in the specified period',
              example: 8920
            },
            usersByStatus: {
              type: 'object',
              properties: {
                active: { type: 'integer', example: 11200 },
                suspended: { type: 'integer', example: 45 },
                pending: { type: 'integer', example: 1205 }
              }
            },
            registrationTrend: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string', format: 'date', example: '2024-01-15' },
                  count: { type: 'integer', example: 23 }
                }
              }
            }
          }
        },
        RevenueMetrics: {
          type: 'object',
          properties: {
            totalRevenue: {
              type: 'number',
              example: 45678.90
            },
            periodRevenue: {
              type: 'number',
              description: 'Revenue for the specified period',
              example: 12345.67
            },
            revenueByPlan: {
              type: 'object',
              properties: {
                free: { type: 'number', example: 0 },
                plus: { type: 'number', example: 8750.25 },
                pro: { type: 'number', example: 3595.42 }
              }
            },
            revenueTrend: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string', format: 'date', example: '2024-01-15' },
                  amount: { type: 'number', example: 456.78 }
                }
              }
            },
            averageRevenuePerUser: {
              type: 'number',
              example: 18.45
            }
          }
        },
        AdminUserDetails: {
          allOf: [
            { $ref: '#/components/schemas/User' },
            {
              type: 'object',
              properties: {
                lastLogin: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Last login timestamp',
                  example: '2024-01-15T10:30:00Z'
                },
                totalGenerations: {
                  type: 'integer',
                  description: 'Total number of generations by this user',
                  example: 45
                },
                totalSpent: {
                  type: 'number',
                  description: 'Total amount spent by user in USD',
                  example: 125.50
                },
                suspensionHistory: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      suspendedAt: { type: 'string', format: 'date-time' },
                      suspendedBy: { type: 'string' },
                      reason: { type: 'string' },
                      reactivatedAt: { type: 'string', format: 'date-time' },
                      reactivatedBy: { type: 'string' }
                    }
                  }
                },
                adminNotes: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      note: { type: 'string' },
                      createdBy: { type: 'string' },
                      createdAt: { type: 'string', format: 'date-time' }
                    }
                  }
                }
              }
            }
          ]
        },
        UserSubscriptionDetails: {
          type: 'object',
          properties: {
            currentPlan: {
              type: 'string',
              example: 'plus'
            },
            status: {
              type: 'string',
              enum: ['active', 'cancelled', 'expired', 'past_due'],
              example: 'active'
            },
            startDate: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T00:00:00Z'
            },
            nextBillingDate: {
              type: 'string',
              format: 'date-time',
              example: '2024-02-01T00:00:00Z'
            },
            creditsRemaining: {
              type: 'integer',
              example: 35
            },
            profilesUsed: {
              type: 'integer',
              example: 2
            }
          }
        },
        UserActivitySummary: {
          type: 'object',
          properties: {
            lastActivity: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-15T10:30:00Z'
            },
            generationsThisMonth: {
              type: 'integer',
              example: 12
            },
            favoriteTemplates: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  templateId: { type: 'string' },
                  templateName: { type: 'string' },
                  usageCount: { type: 'integer' }
                }
              }
            },
            recentGenerations: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/GenerationJob'
              }
            }
          }
        },
        AdminPlanDetails: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'plus'
            },
            name: {
              type: 'string',
              example: 'Plus Plan'
            },
            pricing: {
              type: 'object',
              properties: {
                monthly: { type: 'number', example: 25.00 },
                yearly: { type: 'number', example: 250.00 }
              }
            },
            features: {
              type: 'object',
              properties: {
                credits: { type: 'integer', example: 50 },
                profiles: { type: 'integer', example: 3 },
                priority: { type: 'boolean', example: false },
                support: { type: 'string', example: 'email' }
              }
            },
            statistics: {
              type: 'object',
              properties: {
                activeSubscriptions: { type: 'integer', example: 1250 },
                monthlyRevenue: { type: 'number', example: 31250.00 },
                conversionRate: { type: 'number', example: 0.15 },
                churnRate: { type: 'number', example: 0.05 }
              }
            },
            isActive: {
              type: 'boolean',
              example: true
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T00:00:00Z'
            }
          }
        },
        CreatePlanRequest: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              description: 'Plan display name',
              example: 'Premium Plan'
            },
            planId: {
              type: 'string',
              pattern: '^[a-z0-9-]+$',
              description: 'Unique plan identifier',
              example: 'premium'
            },
            pricing: {
              type: 'object',
              properties: {
                monthly: { type: 'number', minimum: 0, example: 49.00 },
                yearly: { type: 'number', minimum: 0, example: 490.00 }
              },
              required: ['monthly']
            },
            features: {
              type: 'object',
              properties: {
                credits: { type: 'integer', minimum: 0, example: 100 },
                profiles: { type: 'integer', minimum: 1, example: 5 },
                priority: { type: 'boolean', example: true },
                support: { type: 'string', enum: ['none', 'email', 'priority'], example: 'priority' }
              },
              required: ['credits', 'profiles']
            },
            tier: {
              type: 'integer',
              minimum: 0,
              description: 'Plan tier for ordering (higher = more premium)',
              example: 3
            },
            description: {
              type: 'string',
              maxLength: 500,
              description: 'Plan description',
              example: 'Perfect for growing businesses with advanced needs'
            }
          },
          required: ['name', 'planId', 'pricing', 'features', 'tier']
        },
        UpdatePlanRequest: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              example: 'Premium Plan Updated'
            },
            pricing: {
              type: 'object',
              properties: {
                monthly: { type: 'number', minimum: 0, example: 55.00 },
                yearly: { type: 'number', minimum: 0, example: 550.00 }
              }
            },
            features: {
              type: 'object',
              properties: {
                credits: { type: 'integer', minimum: 0, example: 120 },
                profiles: { type: 'integer', minimum: 1, example: 6 },
                priority: { type: 'boolean', example: true },
                support: { type: 'string', enum: ['none', 'email', 'priority'], example: 'priority' }
              }
            },
            description: {
              type: 'string',
              maxLength: 500,
              example: 'Updated plan description'
            },
            isActive: {
              type: 'boolean',
              example: true
            }
          }
        },
        AdminTemplateDetails: {
          allOf: [
            { $ref: '#/components/schemas/Template' },
            {
              type: 'object',
              properties: {
                adminMetrics: {
                  type: 'object',
                  properties: {
                    totalRevenue: {
                      type: 'number',
                      description: 'Total revenue generated by this template',
                      example: 1250.75
                    },
                    conversionRate: {
                      type: 'number',
                      description: 'Template view to usage conversion rate',
                      example: 0.15
                    },
                    averageRating: {
                      type: 'number',
                      minimum: 0,
                      maximum: 5,
                      example: 4.2
                    },
                    reportCount: {
                      type: 'integer',
                      description: 'Number of reports/complaints about this template',
                      example: 2
                    }
                  }
                },
                moderationStatus: {
                  type: 'string',
                  enum: ['approved', 'pending', 'rejected', 'flagged'],
                  example: 'approved'
                },
                lastModerated: {
                  type: 'string',
                  format: 'date-time',
                  example: '2024-01-15T10:30:00Z'
                },
                moderatedBy: {
                  type: 'string',
                  description: 'Admin user ID who last moderated this template',
                  example: '507f1f77bcf86cd799439012'
                }
              }
            }
          ]
        },
        BatchTemplateUpload: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              example: 'Modern Business Card'
            },
            description: {
              type: 'string',
              maxLength: 500,
              example: 'A sleek, modern business card template'
            },
            category: {
              type: 'string',
              example: 'business'
            },
            type: {
              type: 'string',
              enum: ['social', 'print', 'web', 'story', 'post', 'banner'],
              example: 'print'
            },
            difficulty: {
              type: 'string',
              enum: ['beginner', 'intermediate', 'advanced'],
              example: 'beginner'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              example: ['business', 'professional', 'modern']
            },
            images: {
              type: 'object',
              properties: {
                thumbnail: { type: 'string', format: 'uri' },
                preview: { type: 'string', format: 'uri' },
                fullSize: { type: 'string', format: 'uri' }
              },
              required: ['thumbnail', 'preview', 'fullSize']
            },
            aspectRatio: {
              type: 'object',
              properties: {
                width: { type: 'number', minimum: 1 },
                height: { type: 'number', minimum: 1 },
                ratio: { type: 'string', pattern: '^\\d+:\\d+$' }
              },
              required: ['width', 'height', 'ratio']
            }
          },
          required: ['name', 'type', 'images', 'aspectRatio']
        },
        BatchUploadResults: {
          type: 'object',
          properties: {
            total: {
              type: 'integer',
              description: 'Total number of templates processed',
              example: 10
            },
            successful: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  index: { type: 'integer', example: 0 },
                  templateId: { type: 'string', example: '507f1f77bcf86cd799439011' },
                  name: { type: 'string', example: 'Modern Business Card' }
                }
              }
            },
            failed: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  index: { type: 'integer', example: 5 },
                  name: { type: 'string', example: 'Invalid Template' },
                  error: { type: 'string', example: 'Missing required field: images' }
                }
              }
            }
          }
        },
        AdminPaymentTransaction: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            userId: {
              type: 'string',
              example: '507f1f77bcf86cd799439012'
            },
            userEmail: {
              type: 'string',
              format: 'email',
              example: 'user@example.com'
            },
            planId: {
              type: 'string',
              example: 'plus'
            },
            amount: {
              type: 'number',
              description: 'Transaction amount in USD',
              example: 25.00
            },
            currency: {
              type: 'string',
              example: 'USD'
            },
            status: {
              type: 'string',
              enum: ['pending', 'completed', 'failed', 'refunded'],
              example: 'completed'
            },
            paymentMethod: {
              type: 'string',
              example: 'card'
            },
            razorpayPaymentId: {
              type: 'string',
              example: 'pay_1234567890'
            },
            paidAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-15T10:30:00Z'
            },
            refundedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: null
            },
            failureReason: {
              type: 'string',
              nullable: true,
              example: null
            }
          }
        },
        PaymentAnalytics: {
          type: 'object',
          properties: {
            totalRevenue: {
              type: 'number',
              example: 45678.90
            },
            totalTransactions: {
              type: 'integer',
              example: 2450
            },
            successRate: {
              type: 'number',
              description: 'Payment success rate as percentage',
              example: 0.95
            },
            averageTransactionValue: {
              type: 'number',
              example: 18.64
            },
            revenueByPlan: {
              type: 'object',
              additionalProperties: {
                type: 'number'
              },
              example: {
                'plus': 31250.00,
                'pro': 14428.90
              }
            },
            paymentMethodBreakdown: {
              type: 'object',
              properties: {
                card: { type: 'number', example: 0.85 },
                netbanking: { type: 'number', example: 0.10 },
                upi: { type: 'number', example: 0.05 }
              }
            },
            monthlyTrend: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  month: { type: 'string', example: '2024-01' },
                  revenue: { type: 'number', example: 12345.67 },
                  transactions: { type: 'integer', example: 456 }
                }
              }
            }
          }
        },
        FailedPaymentDetails: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            userId: {
              type: 'string',
              example: '507f1f77bcf86cd799439012'
            },
            userEmail: {
              type: 'string',
              format: 'email',
              example: 'user@example.com'
            },
            planId: {
              type: 'string',
              example: 'plus'
            },
            amount: {
              type: 'number',
              example: 25.00
            },
            failureReason: {
              type: 'string',
              example: 'Insufficient funds'
            },
            razorpayErrorCode: {
              type: 'string',
              example: 'BAD_REQUEST_ERROR'
            },
            attemptedAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-15T10:30:00Z'
            },
            retryCount: {
              type: 'integer',
              example: 2
            },
            nextRetryAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2024-01-16T10:30:00Z'
            }
          }
        },
        SystemHealthCheck: {
          type: 'object',
          properties: {
            overall: {
              type: 'string',
              enum: ['healthy', 'degraded', 'unhealthy'],
              example: 'healthy'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-15T10:30:00Z'
            },
            services: {
              type: 'object',
              properties: {
                database: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'], example: 'healthy' },
                    responseTime: { type: 'number', example: 15.5 },
                    lastChecked: { type: 'string', format: 'date-time' }
                  }
                },
                redis: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'], example: 'healthy' },
                    responseTime: { type: 'number', example: 2.1 },
                    lastChecked: { type: 'string', format: 'date-time' }
                  }
                },
                aiProviders: {
                  type: 'object',
                  properties: {
                    openai: {
                      type: 'object',
                      properties: {
                        status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'], example: 'healthy' },
                        responseTime: { type: 'number', example: 1250.0 },
                        lastChecked: { type: 'string', format: 'date-time' }
                      }
                    },
                    gemini: {
                      type: 'object',
                      properties: {
                        status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'], example: 'healthy' },
                        responseTime: { type: 'number', example: 890.5 },
                        lastChecked: { type: 'string', format: 'date-time' }
                      }
                    },
                    ideogram: {
                      type: 'object',
                      properties: {
                        status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'], example: 'healthy' },
                        responseTime: { type: 'number', example: 2100.0 },
                        lastChecked: { type: 'string', format: 'date-time' }
                      }
                    }
                  }
                },
                externalServices: {
                  type: 'object',
                  properties: {
                    auth0: {
                      type: 'object',
                      properties: {
                        status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'], example: 'healthy' },
                        responseTime: { type: 'number', example: 145.2 },
                        lastChecked: { type: 'string', format: 'date-time' }
                      }
                    },
                    razorpay: {
                      type: 'object',
                      properties: {
                        status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'], example: 'healthy' },
                        responseTime: { type: 'number', example: 234.8 },
                        lastChecked: { type: 'string', format: 'date-time' }
                      }
                    },
                    imagekit: {
                      type: 'object',
                      properties: {
                        status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'], example: 'healthy' },
                        responseTime: { type: 'number', example: 89.3 },
                        lastChecked: { type: 'string', format: 'date-time' }
                      }
                    }
                  }
                }
              }
            },
            systemMetrics: {
              type: 'object',
              properties: {
                uptime: { type: 'number', description: 'System uptime in seconds', example: 86400 },
                memoryUsage: { type: 'number', description: 'Memory usage percentage', example: 0.65 },
                cpuUsage: { type: 'number', description: 'CPU usage percentage', example: 0.23 }
              }
            }
          }
        },
        SystemConfiguration: {
          type: 'object',
          properties: {
            environment: {
              type: 'string',
              enum: ['development', 'staging', 'production'],
              example: 'production'
            },
            features: {
              type: 'object',
              properties: {
                auth0: { type: 'boolean', example: true },
                razorpay: { type: 'boolean', example: true },
                imagekit: { type: 'boolean', example: true },
                redis: { type: 'boolean', example: true },
                slack: { type: 'boolean', example: true }
              }
            },
            limits: {
              type: 'object',
              properties: {
                defaultCredits: { type: 'integer', example: 3 },
                maxFileSize: { type: 'string', example: '10MB' },
                maxRequestSize: { type: 'string', example: '50MB' },
                rateLimits: {
                  type: 'object',
                  properties: {
                    general: { type: 'string', example: '100/hour' },
                    generation: { type: 'string', example: '10/hour' },
                    upload: { type: 'string', example: '5/hour' }
                  }
                }
              }
            },
            aiProviders: {
              type: 'object',
              properties: {
                llm: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['openai', 'gemini']
                },
                diffusion: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['openai', 'ideogram']
                }
              }
            },
            plans: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                properties: {
                  credits: { type: 'integer' },
                  profiles: { type: 'integer' },
                  price: { type: 'number' }
                }
              },
              example: {
                'free': { credits: 3, profiles: 1 },
                'plus': { credits: 50, profiles: 3, price: 25 },
                'pro': { credits: 120, profiles: 8, price: 59 }
              }
            }
          }
        },
        PaginationInfo: {
          type: 'object',
          properties: {
            currentPage: {
              type: 'integer',
              example: 1
            },
            totalPages: {
              type: 'integer',
              example: 25
            },
            pageSize: {
              type: 'integer',
              example: 20
            },
            hasNextPage: {
              type: 'boolean',
              example: true
            },
            hasPreviousPage: {
              type: 'boolean',
              example: false
            }
          }
        },

        // Subscription and Plan Schemas
        Plan: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              pattern: '^[0-9a-fA-F]{24}$',
              description: 'Unique plan identifier',
              example: '507f1f77bcf86cd799439011'
            },
            name: {
              type: 'string',
              description: 'Plan display name',
              example: 'Pro Plan'
            },
            planId: {
              type: 'string',
              description: 'Plan identifier for internal use',
              example: 'pro'
            },
            description: {
              type: 'string',
              description: 'Detailed plan description',
              example: 'Perfect for growing businesses and agencies'
            },
            pricing: {
              type: 'object',
              properties: {
                amount: {
                  type: 'number',
                  description: 'Plan price in smallest currency unit (paise for INR)',
                  example: 5900
                },
                currency: {
                  type: 'string',
                  description: 'Currency code',
                  example: 'INR'
                },
                interval: {
                  type: 'string',
                  enum: ['monthly', 'yearly'],
                  description: 'Billing interval',
                  example: 'monthly'
                },
                intervalCount: {
                  type: 'number',
                  description: 'Number of intervals between charges',
                  example: 1
                }
              },
              required: ['amount', 'currency', 'interval']
            },
            features: {
              type: 'object',
              properties: {
                credits: {
                  type: 'object',
                  properties: {
                    monthly: {
                      type: 'number',
                      description: 'Monthly credit allocation',
                      example: 120
                    },
                    rollover: {
                      type: 'boolean',
                      description: 'Whether unused credits roll over',
                      example: true
                    }
                  }
                },
                businessProfiles: {
                  type: 'object',
                  properties: {
                    limit: {
                      type: 'number',
                      description: 'Maximum number of business profiles',
                      example: 8
                    }
                  }
                },
                templates: {
                  type: 'object',
                  properties: {
                    access: {
                      type: 'string',
                      enum: ['basic', 'premium', 'all'],
                      description: 'Template access level',
                      example: 'all'
                    },
                    customTemplates: {
                      type: 'boolean',
                      description: 'Whether custom templates are allowed',
                      example: true
                    }
                  }
                },
                aiProviders: {
                  type: 'object',
                  properties: {
                    llm: {
                      type: 'array',
                      items: {
                        type: 'string',
                        enum: ['openai', 'gemini']
                      },
                      description: 'Available LLM providers',
                      example: ['openai', 'gemini']
                    },
                    diffusion: {
                      type: 'array',
                      items: {
                        type: 'string',
                        enum: ['openai', 'ideogram']
                      },
                      description: 'Available image generation providers',
                      example: ['openai', 'ideogram']
                    }
                  }
                },
                additional: {
                  type: 'object',
                  properties: {
                    prioritySupport: {
                      type: 'boolean',
                      description: 'Priority customer support',
                      example: true
                    },
                    analytics: {
                      type: 'boolean',
                      description: 'Advanced analytics access',
                      example: true
                    },
                    apiAccess: {
                      type: 'boolean',
                      description: 'API access for integrations',
                      example: true
                    },
                    whiteLabel: {
                      type: 'boolean',
                      description: 'White-label branding options',
                      example: true
                    },
                    bulkGeneration: {
                      type: 'boolean',
                      description: 'Bulk poster generation capability',
                      example: true
                    }
                  }
                }
              }
            },
            tier: {
              type: 'string',
              enum: ['free', 'basic', 'premium', 'enterprise'],
              description: 'Plan tier level',
              example: 'premium'
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'deprecated'],
              description: 'Plan availability status',
              example: 'active'
            },
            isFeatured: {
              type: 'boolean',
              description: 'Whether plan is featured in recommendations',
              example: true
            },
            trial: {
              type: 'object',
              properties: {
                enabled: {
                  type: 'boolean',
                  description: 'Whether trial is available',
                  example: false
                },
                duration: {
                  type: 'number',
                  description: 'Trial duration in days',
                  example: 0
                }
              }
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Plan creation timestamp',
              example: '2024-01-15T10:30:00Z'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
              example: '2024-01-15T10:30:00Z'
            }
          },
          required: ['id', 'name', 'planId', 'pricing', 'features', 'tier', 'status'],
          example: {
            id: '507f1f77bcf86cd799439011',
            name: 'Pro Plan',
            planId: 'pro',
            description: 'Perfect for growing businesses and agencies',
            pricing: {
              amount: 5900,
              currency: 'INR',
              interval: 'monthly',
              intervalCount: 1
            },
            features: {
              credits: {
                monthly: 120,
                rollover: true
              },
              businessProfiles: {
                limit: 8
              },
              templates: {
                access: 'all',
                customTemplates: true
              },
              aiProviders: {
                llm: ['openai', 'gemini'],
                diffusion: ['openai', 'ideogram']
              },
              additional: {
                prioritySupport: true,
                analytics: true,
                apiAccess: true,
                whiteLabel: true,
                bulkGeneration: true
              }
            },
            tier: 'premium',
            status: 'active',
            isFeatured: true,
            trial: {
              enabled: false,
              duration: 0
            },
            createdAt: '2024-01-15T10:30:00Z',
            updatedAt: '2024-01-15T10:30:00Z'
          }
        },
        Subscription: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              pattern: '^[0-9a-fA-F]{24}$',
              description: 'Unique subscription identifier',
              example: '507f1f77bcf86cd799439011'
            },
            userId: {
              type: 'string',
              pattern: '^[0-9a-fA-F]{24}$',
              description: 'User ID who owns the subscription',
              example: '507f1f77bcf86cd799439012'
            },
            planId: {
              oneOf: [
                {
                  type: 'string',
                  pattern: '^[0-9a-fA-F]{24}$'
                },
                {
                  $ref: '#/components/schemas/Plan'
                }
              ],
              description: 'Plan ID or populated plan object',
              example: '507f1f77bcf86cd799439013'
            },
            razorpaySubscriptionId: {
              type: 'string',
              description: 'Razorpay subscription identifier',
              example: 'sub_1234567890abcdef'
            },
            status: {
              type: 'string',
              enum: ['active', 'cancelled', 'expired', 'paused', 'pending'],
              description: 'Current subscription status',
              example: 'active'
            },
            currentPeriodStart: {
              type: 'string',
              format: 'date-time',
              description: 'Current billing period start date',
              example: '2024-01-15T10:30:00Z'
            },
            currentPeriodEnd: {
              type: 'string',
              format: 'date-time',
              description: 'Current billing period end date',
              example: '2024-02-15T10:30:00Z'
            },
            cancelAtPeriodEnd: {
              type: 'boolean',
              description: 'Whether subscription will cancel at period end',
              example: false
            },
            cancelledAt: {
              type: 'string',
              format: 'date-time',
              description: 'Cancellation timestamp (if cancelled)',
              example: null
            },
            cancellationReason: {
              type: 'string',
              description: 'Reason for cancellation',
              example: null
            },
            trialStart: {
              type: 'string',
              format: 'date-time',
              description: 'Trial period start date',
              example: null
            },
            trialEnd: {
              type: 'string',
              format: 'date-time',
              description: 'Trial period end date',
              example: null
            },
            billing: {
              type: 'object',
              properties: {
                currency: {
                  type: 'string',
                  description: 'Billing currency',
                  example: 'INR'
                },
                amount: {
                  type: 'number',
                  description: 'Billing amount in smallest currency unit',
                  example: 5900
                },
                interval: {
                  type: 'string',
                  enum: ['monthly', 'yearly'],
                  description: 'Billing interval',
                  example: 'monthly'
                },
                intervalCount: {
                  type: 'number',
                  description: 'Number of intervals between charges',
                  example: 1
                }
              },
              required: ['currency', 'amount', 'interval']
            },
            discount: {
              type: 'object',
              properties: {
                couponCode: {
                  type: 'string',
                  description: 'Applied coupon code',
                  example: 'SAVE20'
                },
                discountPercent: {
                  type: 'number',
                  description: 'Discount percentage',
                  example: 20
                },
                discountAmount: {
                  type: 'number',
                  description: 'Fixed discount amount',
                  example: 1000
                },
                validUntil: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Discount validity end date',
                  example: '2024-12-31T23:59:59Z'
                }
              }
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Subscription creation timestamp',
              example: '2024-01-15T10:30:00Z'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
              example: '2024-01-15T10:30:00Z'
            }
          },
          required: ['id', 'userId', 'planId', 'razorpaySubscriptionId', 'status', 'currentPeriodStart', 'currentPeriodEnd', 'billing'],
          example: {
            id: '507f1f77bcf86cd799439011',
            userId: '507f1f77bcf86cd799439012',
            planId: '507f1f77bcf86cd799439013',
            razorpaySubscriptionId: 'sub_1234567890abcdef',
            status: 'active',
            currentPeriodStart: '2024-01-15T10:30:00Z',
            currentPeriodEnd: '2024-02-15T10:30:00Z',
            cancelAtPeriodEnd: false,
            cancelledAt: null,
            cancellationReason: null,
            trialStart: null,
            trialEnd: null,
            billing: {
              currency: 'INR',
              amount: 5900,
              interval: 'monthly',
              intervalCount: 1
            },
            discount: null,
            createdAt: '2024-01-15T10:30:00Z',
            updatedAt: '2024-01-15T10:30:00Z'
          }
        },
        SubscriptionUpgradeRequest: {
          type: 'object',
          properties: {
            newPlanId: {
              type: 'string',
              pattern: '^[0-9a-fA-F]{24}$',
              description: 'ID of the plan to upgrade to',
              example: '507f1f77bcf86cd799439013'
            },
            immediate: {
              type: 'boolean',
              description: 'Whether to apply the upgrade immediately',
              example: true,
              default: true
            },
            reason: {
              type: 'string',
              description: 'Reason for the upgrade',
              example: 'user_upgrade',
              default: 'user_upgrade'
            }
          },
          required: ['newPlanId'],
          example: {
            newPlanId: '507f1f77bcf86cd799439013',
            immediate: true,
            reason: 'user_upgrade'
          }
        },
        SubscriptionCancelRequest: {
          type: 'object',
          properties: {
            immediately: {
              type: 'boolean',
              description: 'Whether to cancel immediately or at period end',
              example: false,
              default: false
            },
            reason: {
              type: 'string',
              description: 'Reason for cancellation',
              example: 'user_cancellation',
              default: 'user_cancellation'
            }
          },
          example: {
            immediately: false,
            reason: 'user_cancellation'
          }
        },
        BillingHistoryItem: {
          type: 'object',
          properties: {
            razorpayPaymentId: {
              type: 'string',
              description: 'Razorpay payment identifier',
              example: 'pay_1234567890abcdef'
            },
            amount: {
              type: 'number',
              description: 'Payment amount in smallest currency unit',
              example: 5900
            },
            currency: {
              type: 'string',
              description: 'Payment currency',
              example: 'INR'
            },
            status: {
              type: 'string',
              enum: ['paid', 'failed', 'pending', 'refunded'],
              description: 'Payment status',
              example: 'paid'
            },
            paymentMethod: {
              type: 'string',
              description: 'Payment method used',
              example: 'card'
            },
            paidAt: {
              type: 'string',
              format: 'date-time',
              description: 'Payment completion timestamp',
              example: '2024-01-15T10:30:00Z'
            },
            failureReason: {
              type: 'string',
              description: 'Failure reason (if payment failed)',
              example: null
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Record creation timestamp',
              example: '2024-01-15T10:30:00Z'
            }
          },
          required: ['razorpayPaymentId', 'amount', 'currency', 'status', 'paidAt'],
          example: {
            razorpayPaymentId: 'pay_1234567890abcdef',
            amount: 5900,
            currency: 'INR',
            status: 'paid',
            paymentMethod: 'card',
            paidAt: '2024-01-15T10:30:00Z',
            failureReason: null,
            createdAt: '2024-01-15T10:30:00Z'
          }
        },
        SubscriptionAnalytics: {
          type: 'object',
          properties: {
            overview: {
              type: 'object',
              properties: {
                totalSubscriptions: {
                  type: 'number',
                  description: 'Total number of subscriptions',
                  example: 1250
                },
                activeSubscriptions: {
                  type: 'number',
                  description: 'Number of active subscriptions',
                  example: 980
                },
                monthlyRecurringRevenue: {
                  type: 'number',
                  description: 'Monthly recurring revenue in smallest currency unit',
                  example: 5782000
                },
                averageRevenuePerUser: {
                  type: 'number',
                  description: 'Average revenue per user',
                  example: 5900
                },
                churnRate: {
                  type: 'number',
                  description: 'Monthly churn rate as percentage',
                  example: 2.5
                }
              }
            },
            byPlan: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  planId: {
                    type: 'string',
                    description: 'Plan identifier',
                    example: 'pro'
                  },
                  planName: {
                    type: 'string',
                    description: 'Plan display name',
                    example: 'Pro Plan'
                  },
                  subscriptionCount: {
                    type: 'number',
                    description: 'Number of subscriptions for this plan',
                    example: 450
                  },
                  revenue: {
                    type: 'number',
                    description: 'Total revenue from this plan',
                    example: 2655000
                  }
                }
              },
              description: 'Subscription analytics by plan'
            },
            trends: {
              type: 'object',
              properties: {
                newSubscriptions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      date: {
                        type: 'string',
                        format: 'date',
                        description: 'Date',
                        example: '2024-01-15'
                      },
                      count: {
                        type: 'number',
                        description: 'Number of new subscriptions',
                        example: 25
                      }
                    }
                  },
                  description: 'New subscriptions trend data'
                },
                cancellations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      date: {
                        type: 'string',
                        format: 'date',
                        description: 'Date',
                        example: '2024-01-15'
                      },
                      count: {
                        type: 'number',
                        description: 'Number of cancellations',
                        example: 3
                      }
                    }
                  },
                  description: 'Cancellation trend data'
                }
              }
            }
          },
          example: {
            overview: {
              totalSubscriptions: 1250,
              activeSubscriptions: 980,
              monthlyRecurringRevenue: 5782000,
              averageRevenuePerUser: 5900,
              churnRate: 2.5
            },
            byPlan: [
              {
                planId: 'pro',
                planName: 'Pro Plan',
                subscriptionCount: 450,
                revenue: 2655000
              },
              {
                planId: 'plus',
                planName: 'Plus Plan',
                subscriptionCount: 530,
                revenue: 1325000
              }
            ],
            trends: {
              newSubscriptions: [
                { date: '2024-01-15', count: 25 },
                { date: '2024-01-16', count: 32 }
              ],
              cancellations: [
                { date: '2024-01-15', count: 3 },
                { date: '2024-01-16', count: 2 }
              ]
            }
          }
        },
        PosterGenerationResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Whether the request was successful',
              example: true
            },
            message: {
              type: 'string',
              description: 'Human-readable response message',
              example: 'Poster generation job created successfully'
            },
            job: {
              $ref: '#/components/schemas/GenerationJob',
              description: 'Created generation job details'
            },
            creditReservation: {
              type: 'object',
              description: 'Credit reservation details',
              properties: {
                creditsReserved: {
                  type: 'number',
                  description: 'Number of credits reserved',
                  example: 1
                },
                remainingCredits: {
                  type: 'number',
                  description: 'Credits remaining after reservation',
                  example: 49
                }
              }
            }
          },
          required: ['success', 'message', 'job'],
          example: {
            success: true,
            message: 'Poster generation job created successfully',
            job: {
              id: '507f1f77bcf86cd799439011',
              status: 'pending',
              profileId: '507f1f77bcf86cd799439013',
              templateId: '507f1f77bcf86cd799439014',
              creditsReserved: 1,
              createdAt: '2024-01-15T10:30:00Z'
            },
            creditReservation: {
              creditsReserved: 1,
              remainingCredits: 49
            }
          }
        },
        PosterHistoryResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Whether the request was successful',
              example: true
            },
            history: {
              type: 'array',
              description: 'List of generation jobs',
              items: {
                $ref: '#/components/schemas/GenerationJob'
              }
            },
            pagination: {
              type: 'object',
              description: 'Pagination information',
              properties: {
                currentPage: {
                  type: 'number',
                  description: 'Current page number',
                  example: 1
                },
                totalPages: {
                  type: 'number',
                  description: 'Total number of pages',
                  example: 5
                },
                totalItems: {
                  type: 'number',
                  description: 'Total number of items',
                  example: 87
                },
                itemsPerPage: {
                  type: 'number',
                  description: 'Items per page',
                  example: 20
                }
              }
            },
            filters: {
              type: 'object',
              description: 'Applied filters',
              properties: {
                profileId: {
                  type: 'string',
                  description: 'Filtered by profile ID',
                  example: '507f1f77bcf86cd799439013'
                },
                status: {
                  type: 'string',
                  description: 'Filtered by status',
                  example: 'completed'
                }
              }
            }
          },
          required: ['success', 'history', 'pagination']
        },
        PosterMetadata: {
          type: 'object',
          properties: {
            job: {
              type: 'object',
              description: 'Job information',
              properties: {
                id: {
                  type: 'string',
                  description: 'Job ID',
                  example: '507f1f77bcf86cd799439011'
                },
                status: {
                  type: 'string',
                  description: 'Current status',
                  example: 'completed'
                },
                priority: {
                  type: 'string',
                  description: 'Generation priority',
                  example: 'normal'
                },
                creditsReserved: {
                  type: 'number',
                  description: 'Credits reserved',
                  example: 1
                },
                retryCount: {
                  type: 'number',
                  description: 'Number of retries',
                  example: 0
                }
              }
            },
            businessProfile: {
              type: 'object',
              description: 'Business profile information',
              properties: {
                id: {
                  type: 'string',
                  description: 'Profile ID',
                  example: '507f1f77bcf86cd799439013'
                },
                name: {
                  type: 'string',
                  description: 'Business name',
                  example: 'Acme Corporation'
                },
                tagline: {
                  type: 'string',
                  description: 'Business tagline',
                  example: 'Innovation at its finest'
                },
                colorPalette: {
                  type: 'array',
                  description: 'Brand colors used',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', example: 'Primary Blue' },
                      hex: { type: 'string', example: '#3B82F6' }
                    }
                  }
                }
              }
            },
            template: {
              type: 'object',
              description: 'Template information',
              properties: {
                id: {
                  type: 'string',
                  description: 'Template ID',
                  example: '507f1f77bcf86cd799439014'
                },
                name: {
                  type: 'string',
                  description: 'Template name',
                  example: 'Modern Business Card'
                },
                aspectRatio: {
                  type: 'string',
                  description: 'Template aspect ratio',
                  example: '3.5:2'
                },
                type: {
                  type: 'string',
                  description: 'Template type',
                  example: 'print'
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Template tags',
                  example: ['business', 'professional']
                }
              }
            },
            aiProvider: {
              type: 'object',
              description: 'AI providers used',
              properties: {
                llm: {
                  type: 'string',
                  description: 'Language model provider',
                  example: 'openai'
                },
                diffusion: {
                  type: 'string',
                  description: 'Image generation provider',
                  example: 'ideogram'
                }
              }
            },
            generation: {
              type: 'object',
              description: 'Generation details',
              properties: {
                prompt: {
                  type: 'string',
                  description: 'Generated prompt used',
                  example: 'Create a modern business card for Acme Corporation...'
                },
                promptParameters: {
                  type: 'object',
                  description: 'Parameters used for prompt generation'
                },
                promptGeneratedAt: {
                  type: 'string',
                  format: 'date-time',
                  description: 'When prompt was generated',
                  example: '2024-01-15T10:30:05Z'
                }
              }
            },
            timing: {
              type: 'object',
              description: 'Processing timing information',
              properties: {
                createdAt: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Job creation time',
                  example: '2024-01-15T10:30:00Z'
                },
                startedAt: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Processing start time',
                  example: '2024-01-15T10:30:15Z'
                },
                completedAt: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Processing completion time',
                  example: '2024-01-15T10:30:57Z'
                },
                totalDuration: {
                  type: 'number',
                  description: 'Total processing duration in seconds',
                  example: 42.5
                },
                promptGenerationTime: {
                  type: 'number',
                  description: 'Prompt generation time in seconds',
                  example: 3.2
                },
                imageGenerationTime: {
                  type: 'number',
                  description: 'Image generation time in seconds',
                  example: 39.3
                }
              }
            },
            result: {
              type: 'object',
              description: 'Generation result (if completed)',
              properties: {
                imageUrl: {
                  type: 'string',
                  format: 'uri',
                  description: 'Generated poster URL',
                  example: 'https://cdn.jomobit.com/posters/507f1f77bcf86cd799439011.png'
                },
                thumbnailUrl: {
                  type: 'string',
                  format: 'uri',
                  description: 'Thumbnail URL',
                  example: 'https://cdn.jomobit.com/thumbnails/507f1f77bcf86cd799439011.jpg'
                },
                imagekitFileId: {
                  type: 'string',
                  description: 'ImageKit file ID',
                  example: 'file_507f1f77bcf86cd799439011'
                },
                metadata: {
                  type: 'object',
                  description: 'Additional result metadata'
                }
              }
            },
            error: {
              type: 'object',
              description: 'Error details (if failed)',
              properties: {
                message: {
                  type: 'string',
                  description: 'Error message',
                  example: 'AI provider temporarily unavailable'
                },
                code: {
                  type: 'string',
                  description: 'Error code',
                  example: 'AI_PROVIDER_ERROR'
                },
                provider: {
                  type: 'string',
                  description: 'Provider that caused the error',
                  example: 'ideogram'
                },
                occurredAt: {
                  type: 'string',
                  format: 'date-time',
                  description: 'When error occurred',
                  example: '2024-01-15T10:30:45Z'
                }
              }
            }
          }
        },
        PosterSharingOptions: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Whether the request was successful',
              example: true
            },
            jobId: {
              type: 'string',
              description: 'Generation job ID',
              example: '507f1f77bcf86cd799439011'
            },
            posterUrl: {
              type: 'string',
              format: 'uri',
              description: 'Direct poster URL',
              example: 'https://cdn.jomobit.com/posters/507f1f77bcf86cd799439011.png'
            },
            businessProfile: {
              type: 'object',
              description: 'Business profile information',
              properties: {
                id: { type: 'string', example: '507f1f77bcf86cd799439013' },
                name: { type: 'string', example: 'Acme Corporation' }
              }
            },
            template: {
              type: 'object',
              description: 'Template information',
              properties: {
                id: { type: 'string', example: '507f1f77bcf86cd799439014' },
                name: { type: 'string', example: 'Modern Business Card' },
                aspectRatio: { type: 'string', example: '3.5:2' }
              }
            },
            sharingOptions: {
              type: 'object',
              description: 'Platform-specific sharing options',
              properties: {
                instagram: {
                  type: 'object',
                  properties: {
                    platform: { type: 'string', example: 'Instagram' },
                    type: { type: 'string', example: 'download' },
                    url: { type: 'string', format: 'uri' },
                    downloadUrl: { type: 'string', format: 'uri' },
                    instructions: { type: 'string' },
                    recommendedText: { type: 'string' },
                    aspectRatio: {
                      type: 'object',
                      properties: {
                        width: { type: 'number', example: 1080 },
                        height: { type: 'number', example: 1080 }
                      }
                    }
                  }
                },
                whatsapp: {
                  type: 'object',
                  properties: {
                    platform: { type: 'string', example: 'WhatsApp' },
                    type: { type: 'string', example: 'share_url' },
                    url: { type: 'string', format: 'uri' },
                    text: { type: 'string' },
                    imageUrl: { type: 'string', format: 'uri' },
                    instructions: { type: 'string' }
                  }
                },
                facebook: {
                  type: 'object',
                  properties: {
                    platform: { type: 'string', example: 'Facebook' },
                    type: { type: 'string', example: 'share_url' },
                    url: { type: 'string', format: 'uri' },
                    text: { type: 'string' },
                    imageUrl: { type: 'string', format: 'uri' },
                    instructions: { type: 'string' }
                  }
                },
                twitter: {
                  type: 'object',
                  properties: {
                    platform: { type: 'string', example: 'Twitter' },
                    type: { type: 'string', example: 'share_url' },
                    url: { type: 'string', format: 'uri' },
                    text: { type: 'string' },
                    imageUrl: { type: 'string', format: 'uri' },
                    instructions: { type: 'string' }
                  }
                },
                linkedin: {
                  type: 'object',
                  properties: {
                    platform: { type: 'string', example: 'LinkedIn' },
                    type: { type: 'string', example: 'share_url' },
                    url: { type: 'string', format: 'uri' },
                    text: { type: 'string' },
                    imageUrl: { type: 'string', format: 'uri' },
                    instructions: { type: 'string' }
                  }
                },
                direct: {
                  type: 'object',
                  properties: {
                    platform: { type: 'string', example: 'Direct Link' },
                    type: { type: 'string', example: 'direct' },
                    url: { type: 'string', format: 'uri' },
                    downloadUrl: { type: 'string', format: 'uri' },
                    thumbnailUrl: { type: 'string', format: 'uri' },
                    instructions: { type: 'string' }
                  }
                }
              }
            },
            supportedPlatforms: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of supported sharing platforms',
              example: ['instagram', 'whatsapp', 'facebook', 'twitter', 'linkedin', 'direct']
            }
          },
          required: ['success', 'jobId', 'posterUrl', 'sharingOptions']
        },
        PosterDownloadResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Whether the request was successful',
              example: true
            },
            downloadUrl: {
              type: 'string',
              format: 'uri',
              description: 'Direct download URL with quality transformations',
              example: 'https://cdn.jomobit.com/posters/507f1f77bcf86cd799439011.png?tr=q-90'
            },
            filename: {
              type: 'string',
              description: 'Suggested filename for download',
              example: 'jomobit_Acme_Corporation_2024-01-15_39011.png'
            },
            quality: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Image quality level',
              example: 'high'
            },
            format: {
              type: 'string',
              enum: ['png', 'jpg', 'jpeg', 'webp'],
              description: 'Image format',
              example: 'png'
            },
            fileSize: {
              type: 'string',
              description: 'Estimated file size',
              example: '2.3MB'
            },
            metadata: {
              type: 'object',
              description: 'Additional download metadata',
              properties: {
                businessProfile: { type: 'string', example: 'Acme Corporation' },
                templateName: { type: 'string', example: 'Modern Business Card' },
                createdAt: { type: 'string', format: 'date-time' },
                aspectRatio: {
                  type: 'object',
                  properties: {
                    width: { type: 'number', example: 1080 },
                    height: { type: 'number', example: 1080 }
                  }
                }
              }
            },
            message: {
              type: 'string',
              description: 'Success message',
              example: 'Download URL generated successfully'
            }
          },
          required: ['success', 'downloadUrl', 'filename', 'quality', 'format']
        },
        PosterStats: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Whether the request was successful',
              example: true
            },
            stats: {
              type: 'object',
              description: 'Generation statistics',
              properties: {
                totalGenerations: {
                  type: 'number',
                  description: 'Total number of generations',
                  example: 87
                },
                completedGenerations: {
                  type: 'number',
                  description: 'Number of completed generations',
                  example: 82
                },
                failedGenerations: {
                  type: 'number',
                  description: 'Number of failed generations',
                  example: 3
                },
                pendingGenerations: {
                  type: 'number',
                  description: 'Number of pending generations',
                  example: 2
                },
                totalCreditsUsed: {
                  type: 'number',
                  description: 'Total credits consumed',
                  example: 82
                },
                averageProcessingTime: {
                  type: 'number',
                  description: 'Average processing time in seconds',
                  example: 45.2
                },
                mostUsedTemplate: {
                  type: 'object',
                  description: 'Most frequently used template',
                  properties: {
                    id: { type: 'string', example: '507f1f77bcf86cd799439014' },
                    name: { type: 'string', example: 'Modern Business Card' },
                    usageCount: { type: 'number', example: 15 }
                  }
                },
                mostUsedProfile: {
                  type: 'object',
                  description: 'Most frequently used business profile',
                  properties: {
                    id: { type: 'string', example: '507f1f77bcf86cd799439013' },
                    name: { type: 'string', example: 'Acme Corporation' },
                    usageCount: { type: 'number', example: 25 }
                  }
                },
                generationsByStatus: {
                  type: 'object',
                  description: 'Breakdown by status',
                  properties: {
                    completed: { type: 'number', example: 82 },
                    failed: { type: 'number', example: 3 },
                    pending: { type: 'number', example: 2 },
                    processing: { type: 'number', example: 0 }
                  }
                },
                generationsByProvider: {
                  type: 'object',
                  description: 'Breakdown by AI provider',
                  properties: {
                    openai: { type: 'number', example: 45 },
                    ideogram: { type: 'number', example: 37 },
                    gemini: { type: 'number', example: 5 }
                  }
                }
              }
            },
            filters: {
              type: 'object',
              description: 'Applied filters for the statistics',
              properties: {
                startDate: { type: 'string', format: 'date-time' },
                endDate: { type: 'string', format: 'date-time' },
                profileId: { type: 'string' }
              }
            }
          },
          required: ['success', 'stats']
        },
        CreditWallet: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              pattern: '^[0-9a-fA-F]{24}$',
              description: 'User ID who owns this wallet',
              example: '507f1f77bcf86cd799439011'
            },
            defaultCredits: {
              type: 'number',
              minimum: 0,
              description: 'Default credits that never expire (usually from registration or promotions)',
              example: 3
            },
            subscriptionCredits: {
              type: 'number',
              minimum: 0,
              description: 'Credits from active subscription (expire monthly)',
              example: 47
            },
            reservedCredits: {
              type: 'number',
              minimum: 0,
              description: 'Credits currently reserved for pending generations',
              example: 2
            },
            totalCredits: {
              type: 'number',
              minimum: 0,
              description: 'Total available credits (defaultCredits + subscriptionCredits)',
              example: 50
            },
            subscriptionCreditExpiry: {
              type: 'string',
              format: 'date-time',
              description: 'When subscription credits will expire',
              example: '2024-02-15T00:00:00Z'
            },
            lastUpdated: {
              type: 'string',
              format: 'date-time',
              description: 'Last wallet update timestamp',
              example: '2024-01-15T10:30:00Z'
            }
          },
          required: ['userId', 'defaultCredits', 'subscriptionCredits', 'reservedCredits', 'totalCredits'],
          example: {
            userId: '507f1f77bcf86cd799439011',
            defaultCredits: 3,
            subscriptionCredits: 47,
            reservedCredits: 2,
            totalCredits: 50,
            subscriptionCreditExpiry: '2024-02-15T00:00:00Z',
            lastUpdated: '2024-01-15T10:30:00Z'
          }
        },
        Subscription: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              pattern: '^[0-9a-fA-F]{24}$',
              description: 'Unique subscription identifier',
              example: '507f1f77bcf86cd799439011'
            },
            userId: {
              type: 'string',
              pattern: '^[0-9a-fA-F]{24}$',
              description: 'ID of the subscribed user',
              example: '507f1f77bcf86cd799439012'
            },
            planId: {
              type: 'string',
              description: 'Plan identifier (e.g., free, plus, pro)',
              example: 'pro'
            },
            razorpaySubscriptionId: {
              type: 'string',
              description: 'Razorpay subscription ID for payment tracking',
              example: 'sub_1234567890'
            },
            status: {
              type: 'string',
              enum: ['active', 'cancelled', 'expired', 'past_due'],
              description: 'Current subscription status',
              example: 'active'
            },
            currentPeriodStart: {
              type: 'string',
              format: 'date-time',
              description: 'Start of current billing period',
              example: '2024-01-15T00:00:00Z'
            },
            currentPeriodEnd: {
              type: 'string',
              format: 'date-time',
              description: 'End of current billing period',
              example: '2024-02-15T00:00:00Z'
            },
            cancelAtPeriodEnd: {
              type: 'boolean',
              description: 'Whether subscription will cancel at the end of current period',
              example: false
            },
            cancelledAt: {
              type: 'string',
              format: 'date-time',
              description: 'When subscription was cancelled (if applicable)',
              example: null
            },
            trialStart: {
              type: 'string',
              format: 'date-time',
              description: 'Trial period start (if applicable)',
              example: null
            },
            trialEnd: {
              type: 'string',
              format: 'date-time',
              description: 'Trial period end (if applicable)',
              example: null
            },
            plan: {
              $ref: '#/components/schemas/Plan',
              description: 'Associated plan details'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Subscription creation timestamp',
              example: '2024-01-15T10:30:00Z'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
              example: '2024-01-15T10:30:00Z'
            }
          },
          required: ['id', 'userId', 'planId', 'status', 'currentPeriodStart', 'currentPeriodEnd'],
          example: {
            id: '507f1f77bcf86cd799439011',
            userId: '507f1f77bcf86cd799439012',
            planId: 'pro',
            razorpaySubscriptionId: 'sub_1234567890',
            status: 'active',
            currentPeriodStart: '2024-01-15T00:00:00Z',
            currentPeriodEnd: '2024-02-15T00:00:00Z',
            cancelAtPeriodEnd: false,
            cancelledAt: null,
            trialStart: null,
            trialEnd: null,
            createdAt: '2024-01-15T10:30:00Z',
            updatedAt: '2024-01-15T10:30:00Z'
          }
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {},
              description: 'Response data array'
            },
            pagination: {
              type: 'object',
              properties: {
                page: {
                  type: 'number',
                  description: 'Current page number'
                },
                limit: {
                  type: 'number',
                  description: 'Items per page'
                },
                total: {
                  type: 'number',
                  description: 'Total number of items'
                },
                pages: {
                  type: 'number',
                  description: 'Total number of pages'
                },
                hasNext: {
                  type: 'boolean',
                  description: 'Whether there are more pages'
                },
                hasPrev: {
                  type: 'boolean',
                  description: 'Whether there are previous pages'
                }
              }
            }
          }
        },
        // Poster Generation Schemas
        PosterGenerationRequest: {
          type: 'object',
          required: ['profileId', 'templateId'],
          properties: {
            profileId: {
              type: 'string',
              pattern: '^[0-9a-fA-F]{24}$',
              description: 'Business profile ID',
              example: '507f1f77bcf86cd799439011'
            },
            templateId: {
              type: 'string',
              pattern: '^[0-9a-fA-F]{24}$',
              description: 'Template ID to use for generation',
              example: '507f1f77bcf86cd799439012'
            },
            customizations: {
              type: 'object',
              description: 'Optional customizations for the poster',
              properties: {
                colors: {
                  type: 'array',
                  items: {
                    type: 'string',
                    pattern: '^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$'
                  },
                  maxItems: 5,
                  description: 'Custom color palette',
                  example: ['#FF5733', '#33FF57', '#3357FF']
                },
                text: {
                  type: 'string',
                  maxLength: 500,
                  description: 'Custom text content',
                  example: 'Special offer - 50% off!'
                },
                style: {
                  type: 'string',
                  enum: ['modern', 'classic', 'bold', 'minimal'],
                  description: 'Style preference',
                  example: 'modern'
                }
              }
            },
            aiProviders: {
              type: 'object',
              description: 'Preferred AI providers (optional)',
              properties: {
                llm: {
                  type: 'string',
                  enum: ['openai', 'gemini'],
                  description: 'LLM provider preference',
                  example: 'openai'
                },
                diffusion: {
                  type: 'string',
                  enum: ['openai', 'ideogram'],
                  description: 'Image generation provider preference',
                  example: 'ideogram'
                }
              }
            }
          },
          example: {
            profileId: '507f1f77bcf86cd799439011',
            templateId: '507f1f77bcf86cd799439012',
            customizations: {
              colors: ['#FF5733', '#33FF57'],
              text: 'New Product Launch!',
              style: 'modern'
            }
          }
        },
        PosterGenerationResponse: {
          type: 'object',
          properties: {
            jobId: {
              type: 'string',
              pattern: '^[0-9a-fA-F]{24}$',
              description: 'Generation job ID',
              example: '507f1f77bcf86cd799439013'
            },
            status: {
              type: 'string',
              enum: ['pending', 'processing', 'completed', 'failed'],
              description: 'Current generation status',
              example: 'pending'
            },
            estimatedTime: {
              type: 'number',
              description: 'Estimated completion time in seconds',
              example: 45
            },
            creditsReserved: {
              type: 'number',
              description: 'Credits reserved for this generation',
              example: 1
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Job creation timestamp',
              example: '2024-01-15T10:30:00Z'
            }
          },
          example: {
            jobId: '507f1f77bcf86cd799439013',
            status: 'pending',
            estimatedTime: 45,
            creditsReserved: 1,
            createdAt: '2024-01-15T10:30:00Z'
          }
        },
        PosterMetadata: {
          type: 'object',
          properties: {
            dimensions: {
              type: 'object',
              properties: {
                width: { type: 'number', example: 1080 },
                height: { type: 'number', example: 1080 }
              }
            },
            format: {
              type: 'string',
              enum: ['png', 'jpg', 'webp'],
              example: 'png'
            },
            fileSize: {
              type: 'number',
              description: 'File size in bytes',
              example: 2048576
            },
            colorProfile: {
              type: 'string',
              example: 'sRGB'
            },
            generationParams: {
              type: 'object',
              description: 'Parameters used for generation'
            }
          }
        },
        // Template Schemas
        TemplateFilter: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Filter by template category',
              example: 'social-media'
            },
            type: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['social', 'print', 'web', 'story', 'post', 'banner']
              },
              description: 'Filter by template types',
              example: ['social', 'post']
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by tags',
              example: ['business', 'modern']
            },
            difficulty: {
              type: 'string',
              enum: ['beginner', 'intermediate', 'advanced'],
              description: 'Filter by difficulty level',
              example: 'beginner'
            },
            aspectRatio: {
              type: 'string',
              pattern: '^\\d+:\\d+$',
              description: 'Filter by aspect ratio',
              example: '1:1'
            },
            search: {
              type: 'string',
              maxLength: 100,
              description: 'Search query',
              example: 'business card'
            }
          }
        },
        TemplateCreateRequest: {
          type: 'object',
          required: ['name', 'category', 'type'],
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              description: 'Template name',
              example: 'Modern Business Card'
            },
            description: {
              type: 'string',
              maxLength: 500,
              description: 'Template description',
              example: 'A sleek, modern business card template'
            },
            category: {
              type: 'string',
              description: 'Template category',
              example: 'business'
            },
            type: {
              type: 'string',
              enum: ['social', 'print', 'web', 'story', 'post', 'banner'],
              description: 'Template type',
              example: 'print'
            },
            difficulty: {
              type: 'string',
              enum: ['beginner', 'intermediate', 'advanced'],
              description: 'Template difficulty level',
              example: 'beginner'
            },
            aspectRatio: {
              type: 'string',
              pattern: '^\\d+:\\d+$',
              description: 'Template aspect ratio',
              example: '3.5:2'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              maxItems: 10,
              description: 'Template tags',
              example: ['business', 'professional', 'modern']
            },
            images: {
              type: 'array',
              items: {
                type: 'string',
                format: 'uri'
              },
              description: 'Template preview images',
              example: ['https://example.com/preview1.jpg']
            }
          }
        },
        // Subscription Schemas
        SubscriptionUpgradeRequest: {
          type: 'object',
          required: ['planId'],
          properties: {
            planId: {
              type: 'string',
              description: 'Target plan ID',
              example: 'pro'
            },
            paymentMethodId: {
              type: 'string',
              description: 'Razorpay payment method ID (if required)',
              example: 'pm_1234567890'
            },
            billingCycle: {
              type: 'string',
              enum: ['monthly', 'yearly'],
              description: 'Billing cycle preference',
              example: 'monthly'
            }
          },
          example: {
            planId: 'pro',
            billingCycle: 'monthly'
          }
        },
        Plan: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              pattern: '^[0-9a-fA-F]{24}$',
              description: 'Plan ID',
              example: '507f1f77bcf86cd799439011'
            },
            name: {
              type: 'string',
              description: 'Plan name',
              example: 'Pro'
            },
            planId: {
              type: 'string',
              description: 'Plan identifier',
              example: 'pro'
            },
            description: {
              type: 'string',
              description: 'Plan description',
              example: 'Perfect for growing businesses and agencies'
            },
            pricing: {
              type: 'object',
              properties: {
                amount: {
                  type: 'number',
                  description: 'Price in smallest currency unit',
                  example: 5900
                },
                currency: {
                  type: 'string',
                  description: 'Currency code',
                  example: 'INR'
                },
                interval: {
                  type: 'string',
                  enum: ['monthly', 'yearly'],
                  description: 'Billing interval',
                  example: 'monthly'
                }
              }
            },
            features: {
              type: 'object',
              properties: {
                credits: {
                  type: 'object',
                  properties: {
                    monthly: {
                      type: 'number',
                      description: 'Monthly credit allocation',
                      example: 120
                    },
                    rollover: {
                      type: 'boolean',
                      description: 'Whether credits roll over',
                      example: true
                    }
                  }
                },
                businessProfiles: {
                  type: 'object',
                  properties: {
                    limit: {
                      type: 'number',
                      description: 'Maximum business profiles',
                      example: 8
                    }
                  }
                },
                templates: {
                  type: 'object',
                  properties: {
                    access: {
                      type: 'string',
                      enum: ['basic', 'premium', 'all'],
                      description: 'Template access level',
                      example: 'all'
                    },
                    customTemplates: {
                      type: 'boolean',
                      description: 'Custom template support',
                      example: true
                    }
                  }
                },
                additional: {
                  type: 'object',
                  properties: {
                    prioritySupport: { type: 'boolean', example: true },
                    analytics: { type: 'boolean', example: true },
                    apiAccess: { type: 'boolean', example: true },
                    whiteLabel: { type: 'boolean', example: true },
                    bulkGeneration: { type: 'boolean', example: true }
                  }
                }
              }
            },
            tier: {
              type: 'string',
              enum: ['free', 'basic', 'premium', 'enterprise'],
              description: 'Plan tier',
              example: 'premium'
            },
            isFeatured: {
              type: 'boolean',
              description: 'Whether plan is featured',
              example: true
            }
          },
          required: ['id', 'name', 'planId', 'pricing', 'features', 'tier'],
          example: {
            id: '507f1f77bcf86cd799439011',
            name: 'Pro',
            planId: 'pro',
            description: 'Perfect for growing businesses and agencies',
            pricing: {
              amount: 5900,
              currency: 'INR',
              interval: 'monthly'
            },
            features: {
              credits: {
                monthly: 120,
                rollover: true
              },
              businessProfiles: {
                limit: 8
              },
              templates: {
                access: 'all',
                customTemplates: true
              },
              additional: {
                prioritySupport: true,
                analytics: true,
                apiAccess: true,
                whiteLabel: true,
                bulkGeneration: true
              }
            },
            tier: 'premium',
            isFeatured: true
          }
        },
        // Admin Schemas
        AdminDashboardResponse: {
          type: 'object',
          properties: {
            metrics: {
              type: 'object',
              properties: {
                totalUsers: {
                  type: 'number',
                  description: 'Total registered users',
                  example: 1250
                },
                activeSubscriptions: {
                  type: 'number',
                  description: 'Active subscription count',
                  example: 340
                },
                monthlyRevenue: {
                  type: 'number',
                  description: 'Monthly revenue in smallest currency unit',
                  example: 2500000
                },
                totalGenerations: {
                  type: 'number',
                  description: 'Total poster generations',
                  example: 15680
                }
              }
            },
            recentActivity: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    enum: ['user_registration', 'subscription_created', 'poster_generated', 'payment_received'],
                    example: 'poster_generated'
                  },
                  description: {
                    type: 'string',
                    example: 'User generated a poster using Modern Business template'
                  },
                  timestamp: {
                    type: 'string',
                    format: 'date-time',
                    example: '2024-01-15T10:30:00Z'
                  },
                  userId: {
                    type: 'string',
                    pattern: '^[0-9a-fA-F]{24}$',
                    example: '507f1f77bcf86cd799439011'
                  }
                }
              }
            },
            systemHealth: {
              type: 'object',
              properties: {
                status: {
                  type: 'string',
                  enum: ['healthy', 'warning', 'critical'],
                  example: 'healthy'
                },
                services: {
                  type: 'object',
                  properties: {
                    database: { type: 'string', enum: ['up', 'down'], example: 'up' },
                    redis: { type: 'string', enum: ['up', 'down'], example: 'up' },
                    aiProviders: { type: 'string', enum: ['up', 'down'], example: 'up' }
                  }
                }
              }
            }
          }
        },
        UserSuspensionRequest: {
          type: 'object',
          required: ['reason'],
          properties: {
            reason: {
              type: 'string',
              minLength: 10,
              maxLength: 500,
              description: 'Reason for suspension',
              example: 'Violation of terms of service - inappropriate content generation'
            },
            duration: {
              type: 'number',
              minimum: 1,
              description: 'Suspension duration in days (optional, permanent if not specified)',
              example: 30
            },
            notifyUser: {
              type: 'boolean',
              description: 'Whether to send notification email to user',
              example: true
            }
          }
        },
        // Credit and Transaction Schemas
        CreditTransactionResponse: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              pattern: '^[0-9a-fA-F]{24}$',
              description: 'Transaction ID',
              example: '507f1f77bcf86cd799439011'
            },
            type: {
              type: 'string',
              enum: ['grant', 'reserve', 'deduct', 'release', 'expire'],
              description: 'Transaction type',
              example: 'deduct'
            },
            amount: {
              type: 'number',
              description: 'Credit amount (positive for additions, negative for deductions)',
              example: -1
            },
            creditType: {
              type: 'string',
              enum: ['default', 'subscription', 'mixed'],
              description: 'Type of credits affected',
              example: 'subscription'
            },
            reference: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['registration', 'subscription', 'generation', 'expiry', 'admin', 'refund'],
                  example: 'generation'
                },
                id: {
                  type: 'string',
                  description: 'Reference ID (job ID, subscription ID, etc.)',
                  example: '507f1f77bcf86cd799439012'
                },
                description: {
                  type: 'string',
                  example: 'Poster generation for Modern Business template'
                }
              }
            },
            balanceAfter: {
              type: 'object',
              properties: {
                defaultCredits: { type: 'number', example: 3 },
                subscriptionCredits: { type: 'number', example: 49 },
                reservedCredits: { type: 'number', example: 0 },
                totalCredits: { type: 'number', example: 52 }
              }
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-15T10:30:00Z'
            }
          }
        },
        // Webhook Schemas
        WebhookEvent: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Webhook event ID',
              example: 'evt_1234567890'
            },
            type: {
              type: 'string',
              enum: ['payment.captured', 'payment.failed', 'subscription.created', 'subscription.cancelled'],
              description: 'Event type',
              example: 'payment.captured'
            },
            data: {
              type: 'object',
              description: 'Event payload data'
            },
            created_at: {
              type: 'number',
              description: 'Event creation timestamp (Unix timestamp)',
              example: 1705312200
            }
          }
        },
        // Statistics and Analytics Schemas
        UserStats: {
          type: 'object',
          properties: {
            totalGenerations: {
              type: 'number',
              description: 'Total poster generations by user',
              example: 45
            },
            successfulGenerations: {
              type: 'number',
              description: 'Successful generations count',
              example: 42
            },
            failedGenerations: {
              type: 'number',
              description: 'Failed generations count',
              example: 3
            },
            creditsUsed: {
              type: 'number',
              description: 'Total credits consumed',
              example: 42
            },
            favoriteTemplates: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  templateId: { type: 'string', example: '507f1f77bcf86cd799439011' },
                  templateName: { type: 'string', example: 'Modern Business Card' },
                  usageCount: { type: 'number', example: 8 }
                }
              }
            },
            generationsByMonth: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  month: { type: 'string', example: '2024-01' },
                  count: { type: 'number', example: 12 }
                }
              }
            }
          }
        },
        // Batch Operation Schemas
        BatchUploadRequest: {
          type: 'object',
          properties: {
            templates: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/TemplateCreateRequest'
              },
              maxItems: 50,
              description: 'Array of templates to upload (max 50)'
            }
          },
          required: ['templates']
        },
        BatchUploadResponse: {
          type: 'object',
          properties: {
            successful: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  index: { type: 'number', example: 0 },
                  templateId: { type: 'string', example: '507f1f77bcf86cd799439011' },
                  name: { type: 'string', example: 'Modern Business Card' }
                }
              }
            },
            failed: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  index: { type: 'number', example: 1 },
                  error: { type: 'string', example: 'Template name already exists' },
                  name: { type: 'string', example: 'Duplicate Template' }
                }
              }
            },
            summary: {
              type: 'object',
              properties: {
                total: { type: 'number', example: 10 },
                successful: { type: 'number', example: 8 },
                failed: { type: 'number', example: 2 }
              }
            }
          }
        },
        // System Health Schema
        HealthCheckResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['healthy', 'degraded', 'unhealthy'],
              description: 'Overall system health status',
              example: 'healthy'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Health check timestamp',
              example: '2024-01-15T10:30:00Z'
            },
            services: {
              type: 'object',
              properties: {
                database: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['up', 'down'], example: 'up' },
                    responseTime: { type: 'number', example: 12.5 },
                    lastChecked: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00Z' }
                  }
                },
                redis: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['up', 'down'], example: 'up' },
                    responseTime: { type: 'number', example: 3.2 },
                    lastChecked: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00Z' }
                  }
                },
                aiProviders: {
                  type: 'object',
                  properties: {
                    openai: {
                      type: 'object',
                      properties: {
                        status: { type: 'string', enum: ['up', 'down'], example: 'up' },
                        responseTime: { type: 'number', example: 850.3 },
                        lastChecked: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00Z' }
                      }
                    },
                    ideogram: {
                      type: 'object',
                      properties: {
                        status: { type: 'string', enum: ['up', 'down'], example: 'up' },
                        responseTime: { type: 'number', example: 1200.7 },
                        lastChecked: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00Z' }
                      }
                    }
                  }
                }
              }
            },
            version: {
              type: 'string',
              description: 'API version',
              example: '1.0.0'
            },
            uptime: {
              type: 'number',
              description: 'System uptime in seconds',
              example: 86400
            }
          }
        },
        // Template Management Schemas
        TemplateListResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Request success status',
              example: true
            },
            templates: {
              type: 'array',
              description: 'List of templates',
              items: {
                $ref: '#/components/schemas/Template'
              }
            },
            pagination: {
              $ref: '#/components/schemas/Pagination'
            },
            filters: {
              type: 'object',
              description: 'Applied filters',
              properties: {
                category: { type: 'string', example: 'business' },
                type: { type: 'string', example: 'print' },
                tags: { type: 'array', items: { type: 'string' }, example: ['professional'] },
                difficulty: { type: 'string', example: 'beginner' },
                aspectRatio: { type: 'string', example: '1:1' },
                isFeatured: { type: 'boolean', example: true },
                search: { type: 'string', example: 'business card' }
              }
            }
          },
          required: ['success', 'templates', 'pagination']
        },
        TemplateSearchResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Request success status',
              example: true
            },
            templates: {
              type: 'array',
              description: 'Search results',
              items: {
                $ref: '#/components/schemas/Template'
              }
            },
            pagination: {
              $ref: '#/components/schemas/Pagination'
            },
            searchTerm: {
              type: 'string',
              description: 'Original search term',
              example: 'modern business'
            },
            filters: {
              type: 'object',
              description: 'Applied filters',
              properties: {
                category: { type: 'string', example: 'business' },
                type: { type: 'string', example: 'print' },
                tags: { type: 'array', items: { type: 'string' }, example: ['professional'] },
                difficulty: { type: 'string', example: 'beginner' },
                aspectRatio: { type: 'string', example: '1:1' }
              }
            }
          },
          required: ['success', 'templates', 'pagination', 'searchTerm']
        },
        TemplateFilterOptionsResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Request success status',
              example: true
            },
            filters: {
              type: 'object',
              description: 'Available filter options',
              properties: {
                categories: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Available categories',
                  example: ['business', 'social', 'marketing', 'event']
                },
                types: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Available template types',
                  example: ['social', 'print', 'web', 'story', 'post', 'banner']
                },
                difficulties: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Available difficulty levels',
                  example: ['beginner', 'intermediate', 'advanced']
                },
                aspectRatios: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Available aspect ratios',
                  example: ['1:1', '16:9', '4:3', '3:2']
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Available tags',
                  example: ['business', 'professional', 'modern', 'minimal', 'colorful']
                }
              },
              required: ['categories', 'types', 'difficulties', 'aspectRatios', 'tags']
            }
          },
          required: ['success', 'filters']
        },
        TemplateCollectionResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Request success status',
              example: true
            },
            templates: {
              type: 'array',
              description: 'Collection of templates',
              items: {
                $ref: '#/components/schemas/Template'
              }
            }
          },
          required: ['success', 'templates']
        },
        TemplateDetailResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Request success status',
              example: true
            },
            template: {
              $ref: '#/components/schemas/Template'
            }
          },
          required: ['success', 'template']
        },
        TemplateCreateRequest: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              description: 'Template name',
              example: 'Modern Business Card'
            },
            description: {
              type: 'string',
              maxLength: 500,
              description: 'Template description',
              example: 'A sleek, modern business card template perfect for professionals'
            },
            category: {
              type: 'string',
              description: 'Template category',
              example: 'business'
            },
            type: {
              type: 'string',
              enum: ['social', 'print', 'web', 'story', 'post', 'banner'],
              description: 'Template type',
              example: 'print'
            },
            difficulty: {
              type: 'string',
              enum: ['beginner', 'intermediate', 'advanced'],
              description: 'Template difficulty level',
              example: 'beginner'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              maxItems: 20,
              description: 'Template tags',
              example: ['business', 'professional', 'modern']
            },
            images: {
              type: 'object',
              description: 'Template images',
              properties: {
                thumbnail: {
                  type: 'string',
                  format: 'uri',
                  description: 'Thumbnail image URL',
                  example: 'https://cdn.jomobit.com/templates/thumbnails/new-template.jpg'
                },
                preview: {
                  type: 'string',
                  format: 'uri',
                  description: 'Preview image URL',
                  example: 'https://cdn.jomobit.com/templates/previews/new-template.jpg'
                },
                fullSize: {
                  type: 'string',
                  format: 'uri',
                  description: 'Full size image URL',
                  example: 'https://cdn.jomobit.com/templates/full/new-template.jpg'
                }
              },
              required: ['thumbnail', 'preview', 'fullSize']
            },
            aspectRatio: {
              type: 'object',
              description: 'Template dimensions',
              properties: {
                width: {
                  type: 'number',
                  minimum: 1,
                  description: 'Template width',
                  example: 1080
                },
                height: {
                  type: 'number',
                  minimum: 1,
                  description: 'Template height',
                  example: 1080
                }
              },
              required: ['width', 'height']
            },
            metadata: {
              type: 'object',
              description: 'Template metadata for AI generation',
              properties: {
                colorSchemes: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', example: 'Modern Blue' },
                      colors: { type: 'array', items: { type: 'string' }, example: ['#3B82F6', '#1E40AF'] }
                    }
                  }
                },
                typography: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', example: 'Heading' },
                      fontFamily: { type: 'string', example: 'Inter' },
                      weight: { type: 'string', example: 'bold' },
                      size: { type: 'string', example: '24px' }
                    }
                  }
                }
              }
            },
            isFeatured: {
              type: 'boolean',
              description: 'Whether template should be featured',
              example: false
            },
            status: {
              type: 'string',
              enum: ['draft', 'active', 'inactive'],
              description: 'Template status',
              example: 'active'
            }
          },
          required: ['name', 'category', 'type', 'images', 'aspectRatio']
        },
        TemplateCreateResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Request success status',
              example: true
            },
            message: {
              type: 'string',
              description: 'Success message',
              example: 'Template created successfully'
            },
            template: {
              $ref: '#/components/schemas/Template'
            }
          },
          required: ['success', 'message', 'template']
        },
        TemplateUpdateRequest: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              description: 'Template name',
              example: 'Updated Modern Business Card'
            },
            description: {
              type: 'string',
              maxLength: 500,
              description: 'Template description',
              example: 'An updated sleek, modern business card template'
            },
            category: {
              type: 'string',
              description: 'Template category',
              example: 'business'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              maxItems: 20,
              description: 'Template tags',
              example: ['business', 'professional', 'updated']
            },
            difficulty: {
              type: 'string',
              enum: ['beginner', 'intermediate', 'advanced'],
              description: 'Template difficulty level',
              example: 'intermediate'
            },
            isFeatured: {
              type: 'boolean',
              description: 'Whether template should be featured',
              example: true
            },
            status: {
              type: 'string',
              enum: ['draft', 'active', 'inactive', 'archived'],
              description: 'Template status',
              example: 'active'
            }
          }
        },
        TemplateUpdateResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Request success status',
              example: true
            },
            message: {
              type: 'string',
              description: 'Success message',
              example: 'Template updated successfully'
            },
            template: {
              $ref: '#/components/schemas/Template'
            }
          },
          required: ['success', 'message', 'template']
        },
        TemplateDeleteResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Request success status',
              example: true
            },
            message: {
              type: 'string',
              description: 'Success message',
              example: 'Template deleted successfully'
            }
          },
          required: ['success', 'message']
        },
        TemplateToggleFeaturedResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Request success status',
              example: true
            },
            message: {
              type: 'string',
              description: 'Success message',
              example: 'Template featured status updated successfully'
            },
            template: {
              $ref: '#/components/schemas/Template'
            },
            oldFeaturedStatus: {
              type: 'boolean',
              description: 'Previous featured status',
              example: false
            },
            newFeaturedStatus: {
              type: 'boolean',
              description: 'New featured status',
              example: true
            }
          },
          required: ['success', 'message', 'template', 'oldFeaturedStatus', 'newFeaturedStatus']
        },
        TemplateArchiveResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Request success status',
              example: true
            },
            message: {
              type: 'string',
              description: 'Success message',
              example: 'Template archived successfully'
            },
            template: {
              $ref: '#/components/schemas/Template'
            },
            oldStatus: {
              type: 'string',
              description: 'Previous template status',
              example: 'active'
            },
            newStatus: {
              type: 'string',
              description: 'New template status',
              example: 'archived'
            }
          },
          required: ['success', 'message', 'template', 'oldStatus', 'newStatus']
        },
        TemplateActivateResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Request success status',
              example: true
            },
            message: {
              type: 'string',
              description: 'Success message',
              example: 'Template activated successfully'
            },
            template: {
              $ref: '#/components/schemas/Template'
            },
            oldStatus: {
              type: 'string',
              description: 'Previous template status',
              example: 'archived'
            },
            newStatus: {
              type: 'string',
              description: 'New template status',
              example: 'active'
            }
          },
          required: ['success', 'message', 'template', 'oldStatus', 'newStatus']
        },
        TemplateBatchUploadRequest: {
          type: 'object',
          properties: {
            templates: {
              type: 'array',
              description: 'Array of templates to upload',
              minItems: 1,
              maxItems: 50,
              items: {
                $ref: '#/components/schemas/TemplateCreateRequest'
              }
            }
          },
          required: ['templates']
        },
        TemplateBatchUploadResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Request success status',
              example: true
            },
            message: {
              type: 'string',
              description: 'Success message',
              example: 'Batch upload completed with 8 successful and 2 failed templates'
            },
            results: {
              type: 'object',
              description: 'Batch upload results',
              properties: {
                total: {
                  type: 'number',
                  description: 'Total templates processed',
                  example: 10
                },
                successful: {
                  type: 'array',
                  description: 'Successfully created templates',
                  items: {
                    type: 'object',
                    properties: {
                      index: { type: 'number', example: 0 },
                      template: { $ref: '#/components/schemas/Template' }
                    }
                  }
                },
                failed: {
                  type: 'array',
                  description: 'Failed template creations',
                  items: {
                    type: 'object',
                    properties: {
                      index: { type: 'number', example: 5 },
                      error: { type: 'string', example: 'Template name is required' },
                      templateData: { type: 'object', description: 'Original template data that failed' }
                    }
                  }
                }
              },
              required: ['total', 'successful', 'failed']
            }
          },
          required: ['success', 'message', 'results']
        },
        TemplateStatsResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Request success status',
              example: true
            },
            stats: {
              type: 'object',
              description: 'Template statistics',
              properties: {
                total: {
                  type: 'number',
                  description: 'Total number of templates',
                  example: 1250
                },
                active: {
                  type: 'number',
                  description: 'Number of active templates',
                  example: 1100
                },
                featured: {
                  type: 'number',
                  description: 'Number of featured templates',
                  example: 50
                },
                totalUsage: {
                  type: 'number',
                  description: 'Total usage count across all templates',
                  example: 125000
                },
                byStatus: {
                  type: 'array',
                  description: 'Statistics by template status',
                  items: {
                    type: 'object',
                    properties: {
                      _id: { type: 'string', example: 'active' },
                      count: { type: 'number', example: 1100 },
                      totalUsage: { type: 'number', example: 120000 },
                      avgRating: { type: 'number', example: 4.2 }
                    }
                  }
                },
                byCategory: {
                  type: 'array',
                  description: 'Statistics by template category',
                  items: {
                    type: 'object',
                    properties: {
                      category: { type: 'string', example: 'business' },
                      count: { type: 'number', example: 350 },
                      usage: { type: 'number', example: 45000 }
                    }
                  }
                },
                byType: {
                  type: 'array',
                  description: 'Statistics by template type',
                  items: {
                    type: 'object',
                    properties: {
                      type: { type: 'string', example: 'social' },
                      count: { type: 'number', example: 400 },
                      usage: { type: 'number', example: 60000 }
                    }
                  }
                },
                topPerforming: {
                  type: 'array',
                  description: 'Top performing templates by usage',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', example: '507f1f77bcf86cd799439011' },
                      name: { type: 'string', example: 'Modern Business Card' },
                      usageCount: { type: 'number', example: 5000 },
                      rating: { type: 'number', example: 4.8 }
                    }
                  }
                }
              },
              required: ['total', 'active', 'featured', 'totalUsage', 'byStatus']
            }
          },
          required: ['success', 'stats']
        },
        AdminTemplateListResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Request success status',
              example: true
            },
            templates: {
              type: 'array',
              description: 'List of templates with admin information',
              items: {
                allOf: [
                  { $ref: '#/components/schemas/Template' },
                  {
                    type: 'object',
                    properties: {
                      adminInfo: {
                        type: 'object',
                        description: 'Additional admin-only information',
                        properties: {
                          createdByUser: {
                            type: 'object',
                            properties: {
                              id: { type: 'string', example: '507f1f77bcf86cd799439012' },
                              email: { type: 'string', example: 'admin@jomobit.com' },
                              name: { type: 'string', example: 'Admin User' }
                            }
                          },
                          lastModified: {
                            type: 'string',
                            format: 'date-time',
                            example: '2024-01-15T10:30:00Z'
                          },
                          internalNotes: {
                            type: 'string',
                            example: 'High-performing template, consider featuring'
                          }
                        }
                      }
                    }
                  }
                ]
              }
            },
            pagination: {
              $ref: '#/components/schemas/Pagination'
            },
            filters: {
              type: 'object',
              description: 'Applied filters',
              properties: {
                category: { type: 'string', example: 'business' },
                type: { type: 'string', example: 'print' },
                tags: { type: 'array', items: { type: 'string' }, example: ['professional'] },
                difficulty: { type: 'string', example: 'beginner' },
                aspectRatio: { type: 'string', example: '1:1' },
                isFeatured: { type: 'boolean', example: true },
                search: { type: 'string', example: 'business card' },
                status: { type: 'string', example: 'active' }
              }
            }
          },
          required: ['success', 'templates', 'pagination']
        },
        Pagination: {
          type: 'object',
          properties: {
            page: {
              type: 'number',
              description: 'Current page number',
              example: 1
            },
            limit: {
              type: 'number',
              description: 'Items per page',
              example: 20
            },
            total: {
              type: 'number',
              description: 'Total number of items',
              example: 150
            },
            pages: {
              type: 'number',
              description: 'Total number of pages',
              example: 8
            },
            hasNext: {
              type: 'boolean',
              description: 'Whether there is a next page',
              example: true
            },
            hasPrev: {
              type: 'boolean',
              description: 'Whether there is a previous page',
              example: false
            }
          },
          required: ['page', 'limit', 'total', 'pages', 'hasNext', 'hasPrev']
        }
      },
      responses: {
        BadRequest: {
          description: 'Bad request - validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ValidationError'
              },
              example: {
                error: 'Validation failed',
                details: [
                  {
                    field: 'profileId',
                    message: 'Profile ID is required',
                    value: null
                  },
                  {
                    field: 'templateId',
                    message: 'Invalid template ID format',
                    value: 'invalid-id'
                  }
                ]
              }
            }
          }
        },
        Unauthorized: {
          description: 'Unauthorized - invalid or missing token',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'Authentication required',
                code: 'UNAUTHORIZED',
                timestamp: '2024-01-15T10:30:00Z',
                correlationId: 'req-123456'
              }
            }
          }
        },
        Forbidden: {
          description: 'Forbidden - insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'Insufficient permissions to access this resource',
                code: 'FORBIDDEN',
                timestamp: '2024-01-15T10:30:00Z',
                correlationId: 'req-123456'
              }
            }
          }
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'Resource not found',
                code: 'NOT_FOUND',
                timestamp: '2024-01-15T10:30:00Z',
                correlationId: 'req-123456'
              }
            }
          }
        },
        PaymentRequired: {
          description: 'Insufficient credits or subscription required',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/Error' },
                  {
                    type: 'object',
                    properties: {
                      requiredCredits: {
                        type: 'number',
                        description: 'Credits required for this operation',
                        example: 1
                      },
                      availableCredits: {
                        type: 'number',
                        description: 'User\'s available credits',
                        example: 0
                      },
                      upgradeOptions: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Plan' },
                        description: 'Available upgrade options'
                      }
                    }
                  }
                ]
              },
              example: {
                error: 'Insufficient credits to complete this operation',
                code: 'PAYMENT_REQUIRED',
                requiredCredits: 1,
                availableCredits: 0,
                upgradeOptions: [
                  {
                    id: '507f1f77bcf86cd799439011',
                    name: 'Plus',
                    planId: 'plus',
                    pricing: {
                      amount: 2500,
                      currency: 'INR',
                      interval: 'monthly'
                    }
                  }
                ],
                timestamp: '2024-01-15T10:30:00Z',
                correlationId: 'req-123456'
              }
            }
          }
        },
        PlanLimitExceeded: {
          description: 'Plan limit exceeded',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/Error' },
                  {
                    type: 'object',
                    properties: {
                      limitType: {
                        type: 'string',
                        enum: ['business_profiles', 'monthly_generations', 'template_access'],
                        description: 'Type of limit exceeded',
                        example: 'business_profiles'
                      },
                      currentLimit: {
                        type: 'number',
                        description: 'Current plan limit',
                        example: 1
                      },
                      currentUsage: {
                        type: 'number',
                        description: 'Current usage count',
                        example: 1
                      },
                      upgradeRequired: {
                        type: 'boolean',
                        description: 'Whether upgrade is required',
                        example: true
                      }
                    }
                  }
                ]
              },
              example: {
                error: 'Business profile limit exceeded for current plan',
                code: 'PLAN_LIMIT_EXCEEDED',
                limitType: 'business_profiles',
                currentLimit: 1,
                currentUsage: 1,
                upgradeRequired: true,
                timestamp: '2024-01-15T10:30:00Z',
                correlationId: 'req-123456'
              }
            }
          }
        },
        TooManyRequests: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/Error' },
                  {
                    type: 'object',
                    properties: {
                      retryAfter: {
                        type: 'number',
                        description: 'Seconds to wait before retrying',
                        example: 60
                      },
                      limit: {
                        type: 'number',
                        description: 'Rate limit threshold',
                        example: 10
                      },
                      remaining: {
                        type: 'number',
                        description: 'Remaining requests in current window',
                        example: 0
                      },
                      resetTime: {
                        type: 'string',
                        format: 'date-time',
                        description: 'When the rate limit resets',
                        example: '2024-01-15T11:00:00Z'
                      }
                    }
                  }
                ]
              },
              example: {
                error: 'Rate limit exceeded',
                code: 'TOO_MANY_REQUESTS',
                retryAfter: 60,
                limit: 10,
                remaining: 0,
                resetTime: '2024-01-15T11:00:00Z',
                timestamp: '2024-01-15T10:30:00Z',
                correlationId: 'req-123456'
              }
            }
          }
        },
        ServiceUnavailable: {
          description: 'Service temporarily unavailable',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/Error' },
                  {
                    type: 'object',
                    properties: {
                      service: {
                        type: 'string',
                        description: 'Affected service',
                        example: 'ai-generation'
                      },
                      estimatedRecovery: {
                        type: 'string',
                        format: 'date-time',
                        description: 'Estimated recovery time',
                        example: '2024-01-15T11:00:00Z'
                      }
                    }
                  }
                ]
              },
              example: {
                error: 'AI generation service is temporarily unavailable',
                code: 'SERVICE_UNAVAILABLE',
                service: 'ai-generation',
                estimatedRecovery: '2024-01-15T11:00:00Z',
                timestamp: '2024-01-15T10:30:00Z',
                correlationId: 'req-123456'
              }
            }
          }
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'An unexpected error occurred',
                code: 'INTERNAL_SERVER_ERROR',
                timestamp: '2024-01-15T10:30:00Z',
                correlationId: 'req-123456'
              }
            }
          }
        },
        JobNotFound: {
          description: 'Generation job not found or access denied',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: 'Job not found',
                message: 'Generation job not found or access denied'
              }
            }
          }
        },
        JobNotCompleted: {
          description: 'Generation job is not completed yet',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: 'Job not completed',
                message: 'Poster generation is not completed yet'
              }
            }
          }
        },
        JobCannotBeCancelled: {
          description: 'Generation job cannot be cancelled in current state',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/Error' },
                  {
                    type: 'object',
                    properties: {
                      currentStatus: {
                        type: 'string',
                        description: 'Current job status',
                        example: 'completed'
                      },
                      allowedStatuses: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Statuses that allow cancellation',
                        example: ['pending', 'processing']
                      }
                    }
                  }
                ]
              },
              example: {
                success: false,
                error: 'CANNOT_CANCEL_JOB',
                message: 'Cannot cancel job in current status',
                details: {
                  currentStatus: 'completed',
                  allowedStatuses: ['pending', 'processing']
                }
              }
            }
          }
        },
        GenerationError: {
          description: 'Error during poster generation process',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/Error' },
                  {
                    type: 'object',
                    properties: {
                      provider: {
                        type: 'string',
                        description: 'AI provider that caused the error',
                        example: 'ideogram'
                      },
                      retryable: {
                        type: 'boolean',
                        description: 'Whether the operation can be retried',
                        example: true
                      },
                      estimatedRetryTime: {
                        type: 'number',
                        description: 'Estimated time before retry in seconds',
                        example: 300
                      }
                    }
                  }
                ]
              },
              example: {
                success: false,
                error: 'AI_PROVIDER_ERROR',
                message: 'AI provider temporarily unavailable',
                details: {
                  provider: 'ideogram',
                  retryable: true,
                  estimatedRetryTime: 300
                }
              }
            }
          }
        },
        SubscriptionNotFound: {
          description: 'No active subscription found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: 'No active subscription found',
                message: 'User does not have an active subscription'
              }
            }
          }
        },
        PlanNotFound: {
          description: 'Subscription plan not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: 'Plan not found',
                message: 'Subscription plan not found'
              }
            }
          }
        },
        SubscriptionError: {
          description: 'Subscription operation error',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/Error' },
                  {
                    type: 'object',
                    properties: {
                      code: {
                        type: 'string',
                        description: 'Specific error code',
                        example: 'CANNOT_UPGRADE_TO_SAME_PLAN'
                      },
                      details: {
                        type: 'object',
                        description: 'Additional error details',
                        example: {
                          currentPlan: 'pro',
                          requestedPlan: 'pro'
                        }
                      }
                    }
                  }
                ]
              },
              example: {
                success: false,
                error: 'CANNOT_UPGRADE_TO_SAME_PLAN',
                message: 'Cannot upgrade to the same plan',
                details: {
                  currentPlan: 'pro',
                  requestedPlan: 'pro'
                }
              }
            }
          }
        },
        PaymentError: {
          description: 'Payment processing error',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/Error' },
                  {
                    type: 'object',
                    properties: {
                      paymentId: {
                        type: 'string',
                        description: 'Payment identifier',
                        example: 'pay_1234567890abcdef'
                      },
                      failureReason: {
                        type: 'string',
                        description: 'Reason for payment failure',
                        example: 'insufficient_funds'
                      },
                      retryable: {
                        type: 'boolean',
                        description: 'Whether payment can be retried',
                        example: true
                      }
                    }
                  }
                ]
              },
              example: {
                success: false,
                error: 'PAYMENT_FAILED',
                message: 'Payment processing failed',
                details: {
                  paymentId: 'pay_1234567890abcdef',
                  failureReason: 'insufficient_funds',
                  retryable: true
                }
              }
            }
          }
        }
      },
      parameters: {
        PageParam: {
          name: 'page',
          in: 'query',
          description: 'Page number for pagination',
          required: false,
          schema: {
            type: 'integer',
            minimum: 1,
            default: 1
          }
        },
        LimitParam: {
          name: 'limit',
          in: 'query',
          description: 'Number of items per page',
          required: false,
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 20
          }
        },
        ObjectIdParam: {
          name: 'id',
          in: 'path',
          description: 'MongoDB ObjectId (24-character hexadecimal string)',
          required: true,
          schema: {
            type: 'string',
            pattern: '^[0-9a-fA-F]{24}$'
          },
          example: '507f1f77bcf86cd799439011'
        },
        UserIdParam: {
          name: 'userId',
          in: 'path',
          description: 'User ID',
          required: true,
          schema: {
            type: 'string',
            pattern: '^[0-9a-fA-F]{24}$'
          },
          example: '507f1f77bcf86cd799439011'
        },
        JobIdParam: {
          name: 'jobId',
          in: 'path',
          description: 'Generation job ID',
          required: true,
          schema: {
            type: 'string',
            pattern: '^[0-9a-fA-F]{24}$'
          },
          example: '507f1f77bcf86cd799439011'
        },
        TemplateIdParam: {
          name: 'templateId',
          in: 'path',
          description: 'Template ID',
          required: true,
          schema: {
            type: 'string',
            pattern: '^[0-9a-fA-F]{24}$'
          },
          example: '507f1f77bcf86cd799439011'
        },
        PlanIdParam: {
          name: 'planId',
          in: 'path',
          description: 'Plan ID or plan identifier',
          required: true,
          schema: {
            type: 'string'
          },
          example: 'pro'
        },
        SearchParam: {
          name: 'search',
          in: 'query',
          description: 'Search query string',
          required: false,
          schema: {
            type: 'string',
            maxLength: 100
          },
          example: 'business card'
        },
        CategoryParam: {
          name: 'category',
          in: 'query',
          description: 'Filter by category',
          required: false,
          schema: {
            type: 'string'
          },
          example: 'business'
        },
        TypeParam: {
          name: 'type',
          in: 'query',
          description: 'Filter by template type (can be specified multiple times)',
          required: false,
          schema: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['social', 'print', 'web', 'story', 'post', 'banner']
            }
          },
          style: 'form',
          explode: true,
          example: ['social', 'post']
        },
        StatusParam: {
          name: 'status',
          in: 'query',
          description: 'Filter by status',
          required: false,
          schema: {
            type: 'string',
            enum: ['pending', 'processing', 'completed', 'failed']
          },
          example: 'completed'
        },
        StartDateParam: {
          name: 'startDate',
          in: 'query',
          description: 'Filter results from this date (ISO 8601 format)',
          required: false,
          schema: {
            type: 'string',
            format: 'date-time'
          },
          example: '2024-01-01T00:00:00Z'
        },
        EndDateParam: {
          name: 'endDate',
          in: 'query',
          description: 'Filter results until this date (ISO 8601 format)',
          required: false,
          schema: {
            type: 'string',
            format: 'date-time'
          },
          example: '2024-01-31T23:59:59Z'
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: '🔐 Authentication',
        description: `
          **User Authentication & Authorization**
          
          Manage user authentication using Auth0 JWT tokens. These endpoints handle user registration, login, token validation, and user profile management.
          
          **Key Features:**
          - Auth0 integration for secure authentication
          - JWT token-based authorization
          - User profile synchronization
          - Session management
          
          **Getting Started:**
          1. Register or login through Auth0
          2. Obtain JWT token from response
          3. Use token in Authorization header for protected endpoints
        `,
        externalDocs: {
          description: 'Auth0 Documentation',
          url: 'https://auth0.com/docs'
        }
      },
      {
        name: '👤 User Profiles',
        description: `
          **Business Profile Management**
          
          Create and manage business profiles that contain branding information, company details, and customization preferences for poster generation.
          
          **Key Features:**
          - Multiple business profiles per user
          - Brand color palette management
          - Logo and asset management
          - Address and contact information
          - Profile activation/deactivation
          
          **Usage Tips:**
          - Create detailed profiles for better AI generation results
          - Use consistent branding across profiles
          - Keep profiles active for generation access
        `,
        externalDocs: {
          description: 'Profile Management Guide',
          url: 'https://jomobit.com/docs/profiles'
        }
      },
      {
        name: '🎨 Templates',
        description: `
          **Template Library & Management**
          
          Browse, search, and manage the extensive template library. Templates serve as the foundation for AI-powered poster generation.
          
          **Key Features:**
          - Hundreds of professional templates
          - Advanced filtering and search
          - Category-based organization
          - Template ratings and usage statistics
          - Admin template management
          
          **Template Categories:**
          - Business & Professional
          - Social Media Posts
          - Marketing Materials
          - Event Promotions
          - And many more...
        `,
        externalDocs: {
          description: 'Template Gallery',
          url: 'https://jomobit.com/templates'
        }
      },
      {
        name: '🖼️ Poster Generation',
        description: `
          **AI-Powered Poster Creation**
          
          Generate professional posters using AI technology. Combine business profiles with templates to create customized marketing materials.
          
          **Key Features:**
          - Multiple AI providers (OpenAI, Gemini, Ideogram)
          - Real-time generation status tracking
          - Credit-based usage system
          - Generation history and management
          - High-quality output formats
          
          **Generation Process:**
          1. Select business profile
          2. Choose template
          3. Customize options (optional)
          4. Submit generation request
          5. Monitor progress and download result
        `,
        externalDocs: {
          description: 'Generation Guide',
          url: 'https://jomobit.com/docs/generation'
        }
      },
      {
        name: '💳 Subscriptions & Billing',
        description: `
          **Payment & Subscription Management**
          
          Manage user subscriptions, billing, and credit systems. Handle plan upgrades, payment processing, and usage tracking.
          
          **Key Features:**
          - Flexible subscription plans
          - Credit-based usage system
          - Razorpay payment integration
          - Billing history and invoices
          - Plan upgrade/downgrade
          - Usage analytics
          
          **Available Plans:**
          - Free tier with limited credits
          - Pro plans with increased limits
          - Enterprise solutions
          - Custom pricing options
        `,
        externalDocs: {
          description: 'Pricing Information',
          url: 'https://jomobit.com/pricing'
        }
      },
      {
        name: '⚙️ Admin Dashboard',
        description: `
          **Administrative Functions**
          
          Comprehensive admin tools for platform management, user oversight, and system analytics. Requires admin permissions.
          
          **Key Features:**
          - User management and moderation
          - System analytics and reporting
          - Template management and approval
          - Payment monitoring and reconciliation
          - Platform configuration
          - Data export and reporting
          
          **Admin Capabilities:**
          - View platform-wide statistics
          - Manage user accounts and permissions
          - Monitor system health and performance
          - Handle customer support requests
          
          **⚠️ Note:** All admin endpoints require special admin permissions in JWT token.
        `,
        externalDocs: {
          description: 'Admin Guide',
          url: 'https://jomobit.com/docs/admin'
        }
      },
      {
        name: '🔗 Webhooks & Integrations',
        description: `
          **Third-Party Service Integration**
          
          Handle webhooks and integrations with external services like Auth0, Razorpay, and other third-party platforms.
          
          **Supported Integrations:**
          - Auth0 user lifecycle events
          - Razorpay payment notifications
          - System health monitoring
          - Custom webhook endpoints
          
          **Webhook Security:**
          - Signature verification
          - IP allowlisting
          - Rate limiting protection
          - Comprehensive logging
          
          **Event Types:**
          - User registration/updates
          - Payment success/failure
          - Subscription changes
          - System alerts
        `,
        externalDocs: {
          description: 'Webhook Documentation',
          url: 'https://jomobit.com/docs/webhooks'
        }
      },
      {
        name: '🔧 System & Utilities',
        description: `
          **System Health & Utility Endpoints**
          
          Monitor system health, check API status, and access utility functions for debugging and maintenance.
          
          **Available Utilities:**
          - Health check endpoint
          - API status monitoring
          - Performance metrics
          - Debug information
          - System configuration
          
          **Monitoring Features:**
          - Real-time health status
          - Performance metrics
          - Error rate tracking
          - Uptime monitoring
        `
      }
    ]
  },
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js',
    './src/models/*.js'
  ]
};

// Generate swagger specification
const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Enhanced Swagger UI options for optimal developer experience
const swaggerUiOptions = {
  explorer: true,
  swaggerOptions: {
    // Authentication and persistence
    persistAuthorization: true,
    preauthorizeBasic: false,

    // Display and interaction options
    displayRequestDuration: true,
    displayOperationId: true,
    showMutatedRequest: true,
    showExtensions: true,
    showCommonExtensions: true,

    // Filtering and search
    filter: true,
    tagsSorter: 'alpha',
    operationsSorter: 'alpha',

    // Expansion and layout
    docExpansion: 'list', // Show operations but not details
    defaultModelsExpandDepth: 3,
    defaultModelExpandDepth: 3,
    defaultModelRendering: 'example',

    // Navigation and linking
    deepLinking: true,
    displayRequestDuration: true,
    maxDisplayedTags: 20,

    // Try it out functionality
    tryItOutEnabled: true,
    supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],

    // Request/Response handling
    requestInterceptor: function (request) {
      // Add correlation ID for debugging
      const correlationId = 'swagger-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      request.headers['X-Correlation-ID'] = correlationId;

      // Log request for debugging
      console.log('🔄 API Request:', {
        method: request.method,
        url: request.url,
        correlationId: correlationId,
        hasAuth: !!request.headers.Authorization
      });

      return request;
    },

    responseInterceptor: function (response) {
      // Enhanced response logging
      const correlationId = response.headers['x-correlation-id'] || 'unknown';
      console.log('✅ API Response:', {
        status: response.status,
        url: response.url,
        correlationId: correlationId,
        duration: response.duration || 'unknown'
      });

      // Handle authentication errors with helpful messages
      if (response.status === 401) {
        console.warn('🔐 Authentication required. Please authorize with a valid JWT token.');
      } else if (response.status === 403) {
        console.warn('🚫 Access forbidden. Check if you have the required permissions.');
      } else if (response.status === 429) {
        console.warn('⏱️ Rate limit exceeded. Please wait before making more requests.');
      }

      return response;
    },

    // Custom validation
    validatorUrl: null, // Disable online validator for security

    // OAuth configuration (if needed in future)
    oauth2RedirectUrl: process.env.SWAGGER_OAUTH_REDIRECT_URL || undefined,

    // Plugin configuration
    plugins: [
      // Custom plugin for enhanced functionality
      function () {
        return {
          statePlugins: {
            spec: {
              wrapSelectors: {
                allowTryItOutFor: () => () => true
              }
            }
          }
        };
      }
    ]
  },

  customSiteTitle: 'Jomobit API Documentation - Interactive Testing Interface',
  customfavIcon: '/favicon.ico',

  // Enhanced custom CSS for better UX
  customCss: `
    /* Hide Swagger UI branding */
    .swagger-ui .topbar { display: none; }
    
    /* Enhanced header styling */
    .swagger-ui .info { 
      margin: 30px 0; 
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .swagger-ui .info .title { 
      color: white; 
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 10px;
    }
    .swagger-ui .info .description { 
      color: rgba(255, 255, 255, 0.9);
      font-size: 1.1rem;
      line-height: 1.6;
    }
    
    /* Authentication section styling */
    .swagger-ui .scheme-container { 
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      padding: 25px; 
      border-radius: 12px; 
      margin: 25px 0;
      border: none;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .swagger-ui .auth-wrapper { 
      background: rgba(255, 255, 255, 0.95);
      padding: 20px; 
      border-radius: 8px;
      margin-top: 15px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    /* Button styling */
    .swagger-ui .btn.authorize { 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      padding: 12px 24px;
      font-weight: 600;
      border-radius: 6px;
      transition: all 0.3s ease;
    }
    .swagger-ui .btn.authorize:hover { 
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }
    
    /* Operation styling */
    .swagger-ui .opblock { 
      border-radius: 8px;
      margin-bottom: 15px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
    }
    .swagger-ui .opblock.opblock-get { border-left: 4px solid #10b981; }
    .swagger-ui .opblock.opblock-post { border-left: 4px solid #3b82f6; }
    .swagger-ui .opblock.opblock-put { border-left: 4px solid #f59e0b; }
    .swagger-ui .opblock.opblock-delete { border-left: 4px solid #ef4444; }
    .swagger-ui .opblock.opblock-patch { border-left: 4px solid #8b5cf6; }
    
    /* Tag sections */
    .swagger-ui .opblock-tag {
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      border-radius: 8px;
      margin-bottom: 20px;
      padding: 15px;
      border: 1px solid #cbd5e1;
    }
    
    /* Response styling */
    .swagger-ui .responses-inner {
      border-radius: 6px;
      background: #f8fafc;
      padding: 15px;
    }
    
    /* Model styling */
    .swagger-ui .model-box {
      background: #f1f5f9;
      border-radius: 6px;
      padding: 15px;
      margin: 10px 0;
    }
    
    /* Try it out section */
    .swagger-ui .try-out {
      background: #ecfdf5;
      border-radius: 6px;
      padding: 15px;
      margin: 10px 0;
      border: 1px solid #d1fae5;
    }
    
    /* Parameter tables */
    .swagger-ui .parameters-col_description {
      font-size: 14px;
      line-height: 1.5;
    }
    
    /* Custom success/error indicators */
    .swagger-ui .response.highlighted {
      animation: highlight 2s ease-in-out;
    }
    
    @keyframes highlight {
      0% { background-color: #fef3c7; }
      100% { background-color: transparent; }
    }
    
    /* Loading states */
    .swagger-ui .loading-container {
      text-align: center;
      padding: 40px;
    }
    
    /* Custom scrollbar */
    .swagger-ui ::-webkit-scrollbar {
      width: 8px;
    }
    .swagger-ui ::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 4px;
    }
    .swagger-ui ::-webkit-scrollbar-thumb {
      background: #c1c1c1;
      border-radius: 4px;
    }
    .swagger-ui ::-webkit-scrollbar-thumb:hover {
      background: #a8a8a8;
    }
  `,

  // Custom JavaScript for enhanced functionality
  customJs: `
    // Enhanced authentication helper
    window.swaggerAuthHelper = {
      // Store token in localStorage for persistence
      setToken: function(token) {
        localStorage.setItem('swagger_jwt_token', token);
        console.log('🔐 JWT token stored successfully');
      },
      
      // Retrieve stored token
      getToken: function() {
        return localStorage.getItem('swagger_jwt_token');
      },
      
      // Clear stored token
      clearToken: function() {
        localStorage.removeItem('swagger_jwt_token');
        console.log('🔓 JWT token cleared');
      },
      
      // Auto-apply stored token on page load
      autoApplyToken: function() {
        const token = this.getToken();
        if (token) {
          // Auto-authorize with stored token
          setTimeout(() => {
            const ui = window.ui;
            if (ui) {
              ui.authActions.authorize({
                bearerAuth: {
                  name: 'bearerAuth',
                  schema: { type: 'http', scheme: 'bearer' },
                  value: token
                }
              });
              console.log('🔄 Auto-applied stored JWT token');
            }
          }, 1000);
        }
      }
    };
    
    // Apply token on page load
    document.addEventListener('DOMContentLoaded', function() {
      window.swaggerAuthHelper.autoApplyToken();
    });
    
    // Custom request/response logging
    window.swaggerLogger = {
      logRequest: function(request) {
        console.group('📤 Outgoing Request');
        console.log('Method:', request.method);
        console.log('URL:', request.url);
        console.log('Headers:', request.headers);
        if (request.body) console.log('Body:', request.body);
        console.groupEnd();
      },
      
      logResponse: function(response) {
        console.group('📥 Incoming Response');
        console.log('Status:', response.status);
        console.log('Headers:', response.headers);
        console.log('Data:', response.data);
        console.groupEnd();
      }
    };
  `
};

/**
 * Enhanced Swagger documentation setup with comprehensive testing capabilities
 */
const setupSwagger = (app) => {
  // Enhanced CSP middleware for Swagger UI functionality
  const setCspForSwagger = (req, res, next) => {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; " +
      "style-src 'self' 'unsafe-inline' fonts.googleapis.com; " +
      "img-src 'self' data: https: blob:; " +
      "font-src 'self' data: fonts.gstatic.com; " +
      "connect-src 'self' https:; " +
      "media-src 'self' blob:; " +
      "object-src 'none'; " +
      "base-uri 'self'"
    );

    // Add CORS headers for API testing
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Correlation-ID');

    next();
  };

  // Apply enhanced CSP middleware to swagger routes
  app.use('/api-docs*', setCspForSwagger);

  // Serve specific endpoints BEFORE the main Swagger UI middleware

  // Serve swagger specification as JSON with enhanced metadata
  app.get('/api-docs/swagger.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Add runtime information to spec
    const enhancedSpec = {
      ...swaggerSpec,
      info: {
        ...swaggerSpec.info,
        'x-generated-at': new Date().toISOString(),
        'x-environment': process.env.NODE_ENV || 'development',
        'x-version': process.env.npm_package_version || '1.0.0'
      }
    };

    res.send(enhancedSpec);
  });

  // API testing utilities endpoint
  app.get('/api-docs/test-utils', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Jomobit API Testing Utilities</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; line-height: 1.6; }
          .container { max-width: 800px; margin: 0 auto; }
          .section { background: #f8fafc; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #3b82f6; }
          .code { background: #1f2937; color: #f9fafb; padding: 15px; border-radius: 6px; font-family: 'Monaco', 'Consolas', monospace; overflow-x: auto; }
          .button { background: #3b82f6; color: white; padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; margin: 5px; }
          .button:hover { background: #2563eb; }
          .warning { background: #fef3c7; border-left-color: #f59e0b; }
          .success { background: #ecfdf5; border-left-color: #10b981; }
          .error { background: #fef2f2; border-left-color: #ef4444; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🧪 Jomobit API Testing Utilities</h1>
          
          <div class="section">
            <h2>🔐 Authentication Setup</h2>
            <p>To test authenticated endpoints, you need a valid JWT token from Auth0:</p>
            <div class="code">
# Get token from Auth0 (replace with your credentials)
curl -X POST https://your-auth0-domain/oauth/token \\
  -H "Content-Type: application/json" \\
  -d '{
    "client_id": "your-client-id",
    "client_secret": "your-client-secret",
    "audience": "your-api-audience",
    "grant_type": "client_credentials"
  }'</div>
            <button class="button" onclick="copyToClipboard(this.nextElementSibling.textContent)">Copy Auth Command</button>
            <textarea id="authCommand" style="display:none;">curl -X POST https://your-auth0-domain/oauth/token -H "Content-Type: application/json" -d '{"client_id": "your-client-id", "client_secret": "your-client-secret", "audience": "your-api-audience", "grant_type": "client_credentials"}'</textarea>
          </div>

          <div class="section success">
            <h2>✅ Quick Test Commands</h2>
            <p>Test basic API functionality:</p>
            <div class="code">
# Health check (no auth required)
curl ${req.protocol}://${req.get('host')}/health

# Get user profile (requires auth)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
     ${req.protocol}://${req.get('host')}/api/profiles

# List templates (requires auth)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
     ${req.protocol}://${req.get('host')}/api/templates</div>
          </div>

          <div class="section warning">
            <h2>⚠️ Common Issues & Solutions</h2>
            <ul>
              <li><strong>401 Unauthorized:</strong> Check if your JWT token is valid and not expired</li>
              <li><strong>403 Forbidden:</strong> Verify you have the required permissions for admin endpoints</li>
              <li><strong>429 Too Many Requests:</strong> You've hit the rate limit, wait before retrying</li>
              <li><strong>500 Internal Server Error:</strong> Check server logs for detailed error information</li>
            </ul>
          </div>

          <div class="section">
            <h2>🔧 Testing Tools</h2>
            <button class="button" onclick="testHealthEndpoint()">Test Health Endpoint</button>
            <button class="button" onclick="validateJWTToken()">Validate JWT Token</button>
            <button class="button" onclick="clearStoredAuth()">Clear Stored Auth</button>
            <div id="testResults" style="margin-top: 20px;"></div>
          </div>

          <div class="section">
            <h2>📊 API Endpoints Overview</h2>
            <ul>
              <li><strong>Authentication:</strong> /api/auth/* - User authentication and token management</li>
              <li><strong>Profiles:</strong> /api/profiles/* - Business profile management</li>
              <li><strong>Templates:</strong> /api/templates/* - Template browsing and management</li>
              <li><strong>Posters:</strong> /api/posters/* - Poster generation and history</li>
              <li><strong>Subscriptions:</strong> /api/subscriptions/* - Payment and subscription management</li>
              <li><strong>Admin:</strong> /api/admin/* - Administrative functions (admin only)</li>
              <li><strong>Webhooks:</strong> /api/webhooks/* - Third-party integrations</li>
            </ul>
          </div>

          <div class="section">
            <h2>🚀 Getting Started</h2>
            <ol>
              <li>Go to <a href="/api-docs" target="_blank">Swagger UI</a></li>
              <li>Click "Authorize" button</li>
              <li>Enter your JWT token in format: <code>Bearer your-token-here</code></li>
              <li>Start testing endpoints!</li>
            </ol>
          </div>
        </div>

        <script>
          function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
              alert('Copied to clipboard!');
            });
          }

          async function testHealthEndpoint() {
            const results = document.getElementById('testResults');
            results.innerHTML = '<p>Testing health endpoint...</p>';
            
            try {
              const response = await fetch('/health');
              const data = await response.json();
              results.innerHTML = \`
                <div class="section success">
                  <h3>✅ Health Check Successful</h3>
                  <div class="code">\${JSON.stringify(data, null, 2)}</div>
                </div>
              \`;
            } catch (error) {
              results.innerHTML = \`
                <div class="section error">
                  <h3>❌ Health Check Failed</h3>
                  <p>Error: \${error.message}</p>
                </div>
              \`;
            }
          }

          function validateJWTToken() {
            const token = localStorage.getItem('swagger_jwt_token');
            const results = document.getElementById('testResults');
            
            if (!token) {
              results.innerHTML = \`
                <div class="section warning">
                  <h3>⚠️ No Token Found</h3>
                  <p>No JWT token found in storage. Please authorize in Swagger UI first.</p>
                </div>
              \`;
              return;
            }

            try {
              const payload = JSON.parse(atob(token.split('.')[1]));
              const isExpired = payload.exp * 1000 < Date.now();
              
              results.innerHTML = \`
                <div class="section \${isExpired ? 'error' : 'success'}">
                  <h3>\${isExpired ? '❌' : '✅'} Token \${isExpired ? 'Expired' : 'Valid'}</h3>
                  <div class="code">\${JSON.stringify(payload, null, 2)}</div>
                  <p><strong>Expires:</strong> \${new Date(payload.exp * 1000).toLocaleString()}</p>
                </div>
              \`;
            } catch (error) {
              results.innerHTML = \`
                <div class="section error">
                  <h3>❌ Invalid Token Format</h3>
                  <p>The stored token is not a valid JWT format.</p>
                </div>
              \`;
            }
          }

          function clearStoredAuth() {
            localStorage.removeItem('swagger_jwt_token');
            document.getElementById('testResults').innerHTML = \`
              <div class="section success">
                <h3>✅ Authentication Cleared</h3>
                <p>Stored JWT token has been removed. You'll need to re-authorize in Swagger UI.</p>
              </div>
            \`;
          }
        </script>
      </body>
      </html>
    `);
  });

  // Serve troubleshooting guide
  app.get('/api-docs/troubleshooting', (req, res) => {
    const fs = require('fs');
    const path = require('path');

    try {
      const troubleshootingPath = path.join(__dirname, '..', '..', 'docs', 'swagger-troubleshooting.md');
      const content = fs.readFileSync(troubleshootingPath, 'utf8');

      // Simple markdown to HTML conversion for basic formatting
      const htmlContent = content
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/```[\s\S]*?```/g, '<pre><code>$&</code></pre>')
        .replace(/^- (.*$)/gim, '<li>$1</li>')
        .replace(/\n\n/g, '</p><p>')
        .split('\n')
        .map(line => line.trim() ? `<p>${line}</p>` : '')
        .join('');

      res.setHeader('Content-Type', 'text/html');
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Jomobit API Troubleshooting Guide</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              max-width: 900px; 
              margin: 0 auto; 
              padding: 20px; 
              line-height: 1.6; 
              color: #333;
              background: #f8fafc;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            h1 { 
              color: #1f2937; 
              border-bottom: 3px solid #3b82f6; 
              padding-bottom: 10px;
              font-size: 2.5rem;
            }
            h2 { 
              color: #374151; 
              margin-top: 2rem;
              font-size: 1.8rem;
            }
            h3 { 
              color: #4b5563; 
              margin-top: 1.5rem;
              font-size: 1.3rem;
            }
            code { 
              background: #f3f4f6; 
              padding: 3px 6px; 
              border-radius: 4px; 
              font-family: 'Monaco', 'Consolas', monospace;
              font-size: 0.9em;
            }
            pre { 
              background: #1f2937; 
              color: #f9fafb;
              padding: 20px; 
              border-radius: 8px; 
              overflow-x: auto;
              margin: 1rem 0;
            }
            pre code {
              background: none;
              color: inherit;
              padding: 0;
            }
            ul, ol { 
              margin: 1rem 0; 
              padding-left: 2rem;
            }
            li { 
              margin: 0.5rem 0; 
            }
            .back-link { 
              margin-bottom: 30px; 
              padding: 15px;
              background: #eff6ff;
              border-radius: 8px;
              border-left: 4px solid #3b82f6;
            }
            .back-link a { 
              color: #3b82f6; 
              text-decoration: none; 
              font-weight: 600;
            }
            .back-link a:hover {
              text-decoration: underline;
            }
            .section {
              margin: 2rem 0;
              padding: 1.5rem;
              background: #f8fafc;
              border-radius: 8px;
              border-left: 4px solid #10b981;
            }
            .warning {
              border-left-color: #f59e0b;
              background: #fffbeb;
            }
            .error {
              border-left-color: #ef4444;
              background: #fef2f2;
            }
            .info {
              border-left-color: #3b82f6;
              background: #eff6ff;
            }
            strong {
              color: #1f2937;
              font-weight: 600;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 1rem 0;
            }
            th, td {
              padding: 12px;
              text-align: left;
              border-bottom: 1px solid #e5e7eb;
            }
            th {
              background: #f9fafb;
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="back-link">
              <a href="/api-docs">← Back to API Documentation</a> | 
              <a href="/api-docs/test-utils">Testing Utilities</a> | 
              <a href="/api-docs/status">API Status</a>
            </div>
            ${htmlContent}
          </div>
        </body>
        </html>
      `);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to load troubleshooting guide',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // API status and health endpoint for testing
  app.get('/api-docs/status', (req, res) => {
    const status = {
      service: 'Jomobit API',
      status: 'operational',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      endpoints: {
        documentation: `${req.protocol}://${req.get('host')}/api-docs`,
        specification: `${req.protocol}://${req.get('host')}/api-docs/swagger.json`,
        testUtils: `${req.protocol}://${req.get('host')}/api-docs/test-utils`,
        health: `${req.protocol}://${req.get('host')}/health`
      },
      authentication: {
        type: 'JWT Bearer Token',
        provider: 'Auth0',
        required: true,
        adminEndpoints: 'Require admin permissions'
      },
      rateLimits: {
        standard: '100 requests/minute',
        generation: '10 requests/minute',
        admin: '200 requests/minute'
      }
    };

    res.json(status);
  });

  // Main Swagger UI endpoint with enhanced setup (must be LAST)
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

  // Convenient redirects
  app.get('/docs', (req, res) => res.redirect('/api-docs'));
  app.get('/swagger', (req, res) => res.redirect('/api-docs'));
  app.get('/api-documentation', (req, res) => res.redirect('/api-docs'));

  // Log successful setup with enhanced information
  console.log('📚 Enhanced Swagger documentation setup complete:');
  console.log('   📖 Main documentation: /api-docs');
  console.log('   🧪 Testing utilities: /api-docs/test-utils');
  console.log('   📊 API status: /api-docs/status');
  console.log('   📄 OpenAPI spec: /api-docs/swagger.json');
  console.log('   🔗 Convenient redirects: /docs, /swagger');
};

module.exports = {
  swaggerSpec,
  swaggerUiOptions,
  setupSwagger
};