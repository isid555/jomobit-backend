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
      description: 'AI-powered poster generation platform API with Auth0 integration, credit management, and subscription handling',
      contact: {
        name: 'Jomobit API Support',
        email: 'support@jomobit.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
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
          description: 'Auth0 JWT token'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message'
            },
            code: {
              type: 'string',
              description: 'Error code'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Error timestamp'
            },
            correlationId: {
              type: 'string',
              description: 'Request correlation ID'
            }
          },
          required: ['error']
        },
        ValidationError: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Validation error message'
            },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: {
                    type: 'string',
                    description: 'Field name with validation error'
                  },
                  message: {
                    type: 'string',
                    description: 'Validation error message'
                  },
                  value: {
                    description: 'Invalid value provided'
                  }
                }
              }
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'User ID'
            },
            auth0Id: {
              type: 'string',
              description: 'Auth0 user ID'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            status: {
              type: 'string',
              enum: ['pending', 'active', 'suspended'],
              description: 'User account status'
            },
            metadata: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'User display name'
                },
                picture: {
                  type: 'string',
                  format: 'uri',
                  description: 'User profile picture URL'
                }
              }
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation timestamp'
            }
          }
        },
        BusinessProfile: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Profile ID'
            },
            userId: {
              type: 'string',
              description: 'Owner user ID'
            },
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              description: 'Business name'
            },
            tagline: {
              type: 'string',
              minLength: 1,
              maxLength: 200,
              description: 'Business tagline'
            },
            description: {
              type: 'string',
              minLength: 1,
              maxLength: 1000,
              description: 'Business description'
            },
            logo: {
              type: 'string',
              format: 'uri',
              description: 'Business logo URL'
            },
            colorPalette: {
              type: 'array',
              maxItems: 10,
              items: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                    description: 'Color name'
                  },
                  hex: {
                    type: 'string',
                    pattern: '^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$',
                    description: 'Hex color code'
                  }
                }
              }
            },
            products: {
              type: 'array',
              maxItems: 20,
              items: {
                type: 'string',
                maxLength: 100
              },
              description: 'List of products/services'
            },
            address: {
              type: 'object',
              properties: {
                street: { type: 'string', maxLength: 200 },
                city: { type: 'string', maxLength: 100 },
                state: { type: 'string', maxLength: 100 },
                country: { type: 'string', maxLength: 100 },
                zipCode: { type: 'string', maxLength: 20 }
              }
            },
            isActive: {
              type: 'boolean',
              description: 'Profile active status'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          },
          required: ['name', 'tagline', 'description']
        },
        Template: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Template ID'
            },
            name: {
              type: 'string',
              description: 'Template name'
            },
            description: {
              type: 'string',
              description: 'Template description'
            },
            category: {
              type: 'string',
              description: 'Template category'
            },
            type: {
              type: 'string',
              enum: ['social', 'print', 'web', 'story', 'post', 'banner'],
              description: 'Template type'
            },
            difficulty: {
              type: 'string',
              enum: ['beginner', 'intermediate', 'advanced'],
              description: 'Template difficulty level'
            },
            aspectRatio: {
              type: 'string',
              pattern: '^\\d+:\\d+$',
              description: 'Template aspect ratio (e.g., 16:9)'
            },
            tags: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Template tags for filtering'
            },
            images: {
              type: 'array',
              items: {
                type: 'string',
                format: 'uri'
              },
              description: 'Template preview images'
            },
            isActive: {
              type: 'boolean',
              description: 'Template availability status'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        GenerationJob: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Generation job ID'
            },
            userId: {
              type: 'string',
              description: 'User ID'
            },
            profileId: {
              type: 'string',
              description: 'Business profile ID'
            },
            templateId: {
              type: 'string',
              description: 'Template ID'
            },
            status: {
              type: 'string',
              enum: ['pending', 'processing', 'completed', 'failed'],
              description: 'Generation status'
            },
            creditsReserved: {
              type: 'number',
              description: 'Credits reserved for this generation'
            },
            aiProvider: {
              type: 'object',
              properties: {
                llm: {
                  type: 'string',
                  description: 'LLM provider used'
                },
                diffusion: {
                  type: 'string',
                  description: 'Diffusion model provider used'
                }
              }
            },
            result: {
              type: 'object',
              properties: {
                imageUrl: {
                  type: 'string',
                  format: 'uri',
                  description: 'Generated poster image URL'
                },
                metadata: {
                  type: 'object',
                  description: 'Generation metadata'
                }
              }
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            completedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        CreditWallet: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'User ID'
            },
            defaultCredits: {
              type: 'number',
              description: 'Default credits (never expire)'
            },
            subscriptionCredits: {
              type: 'number',
              description: 'Subscription credits (expire monthly)'
            },
            reservedCredits: {
              type: 'number',
              description: 'Currently reserved credits'
            },
            totalCredits: {
              type: 'number',
              description: 'Total available credits'
            },
            subscriptionCreditExpiry: {
              type: 'string',
              format: 'date-time',
              description: 'Subscription credits expiry date'
            }
          }
        },
        Subscription: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Subscription ID'
            },
            userId: {
              type: 'string',
              description: 'User ID'
            },
            planId: {
              type: 'string',
              description: 'Subscription plan ID'
            },
            status: {
              type: 'string',
              enum: ['active', 'cancelled', 'expired'],
              description: 'Subscription status'
            },
            currentPeriodStart: {
              type: 'string',
              format: 'date-time',
              description: 'Current billing period start'
            },
            currentPeriodEnd: {
              type: 'string',
              format: 'date-time',
              description: 'Current billing period end'
            },
            cancelAtPeriodEnd: {
              type: 'boolean',
              description: 'Whether subscription will cancel at period end'
            }
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
        }
      },
      responses: {
        BadRequest: {
          description: 'Bad request - validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ValidationError'
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
              }
            }
          }
        },
        TooManyRequests: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
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
          description: 'MongoDB ObjectId',
          required: true,
          schema: {
            type: 'string',
            pattern: '^[0-9a-fA-F]{24}$'
          }
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
        name: 'Authentication',
        description: 'User authentication and authorization endpoints'
      },
      {
        name: 'Profiles',
        description: 'Business profile management endpoints'
      },
      {
        name: 'Templates',
        description: 'Template browsing and management endpoints'
      },
      {
        name: 'Posters',
        description: 'Poster generation and history endpoints'
      },
      {
        name: 'Subscriptions',
        description: 'Subscription and payment management endpoints'
      },
      {
        name: 'Admin',
        description: 'Administrative endpoints (admin access required)'
      },
      {
        name: 'Webhooks',
        description: 'Third-party service webhook endpoints'
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

// Swagger UI options
const swaggerUiOptions = {
  explorer: true,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    docExpansion: 'none',
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2
  },
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin: 20px 0 }
    .swagger-ui .scheme-container { margin: 20px 0 }
  `,
  customSiteTitle: 'Jomobit API Documentation',
  customfavIcon: '/favicon.ico'
};

/**
 * Setup Swagger documentation middleware
 */
const setupSwagger = (app) => {
  // Serve swagger spec as JSON
  app.get('/api-docs/swagger.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Serve swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

  // Redirect /docs to /api-docs for convenience
  app.get('/docs', (req, res) => {
    res.redirect('/api-docs');
  });

  console.log('📚 Swagger documentation available at /api-docs');
};

module.exports = {
  swaggerSpec,
  swaggerUiOptions,
  setupSwagger
};