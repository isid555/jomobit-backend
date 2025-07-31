# Chapter 5: API Endpoints

## Table of Contents
- [API Overview](#api-overview)
- [Authentication Endpoints](#authentication-endpoints)
- [Business Profile Endpoints](#business-profile-endpoints)
- [Template Endpoints](#template-endpoints)
- [Poster Generation Endpoints](#poster-generation-endpoints)
- [Subscription Endpoints](#subscription-endpoints)
- [Admin Endpoints](#admin-endpoints)
- [Webhook Endpoints](#webhook-endpoints)
- [Error Handling](#error-handling)

## API Overview

The Jomobit API is a RESTful API that provides comprehensive functionality for AI-powered poster generation. All endpoints follow REST conventions and return JSON responses.

### Base URL
```
Production: https://api.jomobit.com
Development: http://localhost:3000
```

### API Versioning
All endpoints are prefixed with `/api` and currently use version 1.0.

### Content Type
All requests and responses use `application/json` content type.

### Rate Limiting
Different endpoint groups have different rate limits:
- **General API**: 100 requests per 15 minutes
- **Authentication**: 20 requests per 15 minutes  
- **Generation**: 50 requests per hour
- **Admin**: 50 requests per 15 minutes
- **Webhooks**: 200 requests per 5 minutes

### Common Response Format

**Success Response:**
```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Operation completed successfully"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": { /* additional error details */ }
  }
}
```

**Paginated Response:**
```json
{
  "success": true,
  "data": [ /* array of items */ ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## Authentication Endpoints

All authentication endpoints require a valid JWT token from Auth0.

### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "auth0Id": "auth0|507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "status": "active",
    "emailVerified": true,
    "metadata": {
      "name": "John Doe",
      "given_name": "John",
      "family_name": "Doe",
      "picture": "https://example.com/avatar.jpg"
    },
    "roles": ["user"],
    "permissions": ["read:own_profile", "write:own_profile"],
    "createdAt": "2024-01-15T10:30:00.000Z",
    "lastLoginAt": "2024-01-20T14:22:00.000Z"
  }
}
```

### Update Last Login
```http
POST /api/auth/login
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Login timestamp updated successfully",
  "data": {
    "lastLoginAt": "2024-01-20T14:22:00.000Z"
  }
}
```

### Get User Permissions
```http
GET /api/auth/permissions
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "permissions": [
      "read:own_profile",
      "write:own_profile",
      "read:own_business_profiles",
      "write:own_business_profiles",
      "create:generation_jobs"
    ],
    "roles": ["user"]
  }
}
```

### Get User Profile with Credits
```http
GET /api/auth/profile
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "email": "user@example.com",
      "status": "active",
      "metadata": {
        "name": "John Doe",
        "picture": "https://example.com/avatar.jpg"
      }
    },
    "creditWallet": {
      "defaultCredits": 3,
      "subscriptionCredits": 47,
      "reservedCredits": 2,
      "totalCredits": 50,
      "availableCredits": 48,
      "subscriptionCreditExpiry": "2024-02-01T00:00:00.000Z"
    },
    "subscription": {
      "status": "active",
      "planName": "Plus",
      "currentPeriodEnd": "2024-02-15T00:00:00.000Z",
      "cancelAtPeriodEnd": false
    }
  }
}
```

### Admin: Get All Users
```http
GET /api/auth/admin/users?page=1&limit=20&status=active&search=john
Authorization: Bearer <admin_jwt_token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `status` (optional): Filter by user status (`pending`, `active`, `suspended`)
- `search` (optional): Search by email or name

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "email": "user@example.com",
      "status": "active",
      "metadata": {
        "name": "John Doe"
      },
      "createdAt": "2024-01-15T10:30:00.000Z",
      "lastLoginAt": "2024-01-20T14:22:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Admin: Suspend User
```http
POST /api/auth/admin/users/{userId}/suspend
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json

{
  "reason": "Terms of service violation"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User suspended successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "status": "suspended"
  }
}
```

### Admin: Get User Statistics
```http
GET /api/auth/admin/stats
Authorization: Bearer <admin_jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalUsers": 1250,
    "activeUsers": 1180,
    "pendingUsers": 45,
    "suspendedUsers": 25,
    "newUsersThisMonth": 89,
    "userGrowthRate": 12.5
  }
}
```

## Business Profile Endpoints

### Create Business Profile
```http
POST /api/profiles
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "Acme Corporation",
  "tagline": "Innovation at its finest",
  "description": "We create innovative solutions for modern businesses",
  "logo": "https://ik.imagekit.io/jomobit/logos/acme-logo.png",
  "colorPalette": [
    {
      "name": "Primary Blue",
      "hex": "#1E40AF"
    },
    {
      "name": "Secondary Orange",
      "hex": "#F97316"
    }
  ],
  "typography": {
    "primary": "Inter",
    "secondary": "Roboto"
  },
  "products": ["Software Solutions", "Consulting", "Training"],
  "address": {
    "street": "123 Business Ave",
    "city": "San Francisco",
    "state": "CA",
    "country": "USA",
    "zipCode": "94105"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Business profile created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "userId": "507f1f77bcf86cd799439011",
    "name": "Acme Corporation",
    "tagline": "Innovation at its finest",
    "description": "We create innovative solutions for modern businesses",
    "logo": "https://ik.imagekit.io/jomobit/logos/acme-logo.png",
    "colorPalette": [
      {
        "name": "Primary Blue",
        "hex": "#1E40AF"
      }
    ],
    "isActive": true,
    "createdAt": "2024-01-20T15:30:00.000Z"
  }
}
```

### Get User's Business Profiles
```http
GET /api/profiles?page=1&limit=10&active=true
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `active` (optional): Filter by active status (default: true)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "name": "Acme Corporation",
      "tagline": "Innovation at its finest",
      "description": "We create innovative solutions...",
      "logo": "https://ik.imagekit.io/jomobit/logos/acme-logo.png",
      "isActive": true,
      "createdAt": "2024-01-20T15:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 3,
    "pages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

### Search Business Profiles
```http
GET /api/profiles/search?q=acme&page=1&limit=10
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `q` (required): Search query
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

### Get Business Profile by ID
```http
GET /api/profiles/{profileId}
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "userId": "507f1f77bcf86cd799439011",
    "name": "Acme Corporation",
    "tagline": "Innovation at its finest",
    "description": "We create innovative solutions for modern businesses",
    "logo": "https://ik.imagekit.io/jomobit/logos/acme-logo.png",
    "colorPalette": [
      {
        "name": "Primary Blue",
        "hex": "#1E40AF"
      }
    ],
    "typography": {
      "primary": "Inter",
      "secondary": "Roboto"
    },
    "products": ["Software Solutions", "Consulting"],
    "address": {
      "street": "123 Business Ave",
      "city": "San Francisco",
      "state": "CA",
      "country": "USA",
      "zipCode": "94105"
    },
    "isActive": true,
    "createdAt": "2024-01-20T15:30:00.000Z"
  }
}
```

### Update Business Profile
```http
PUT /api/profiles/{profileId}
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "tagline": "Updated tagline",
  "products": ["New Product", "Updated Service"],
  "colorPalette": [
    {
      "name": "New Primary",
      "hex": "#2563EB"
    }
  ]
}
```

### Deactivate Business Profile
```http
POST /api/profiles/{profileId}/deactivate
Authorization: Bearer <jwt_token>
```

### Get Profile Generation Summary
```http
GET /api/profiles/{profileId}/generation-summary
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "profileId": "507f1f77bcf86cd799439012",
    "totalGenerations": 45,
    "successfulGenerations": 42,
    "failedGenerations": 3,
    "creditsUsed": 45,
    "lastGeneration": "2024-01-20T14:30:00.000Z",
    "averageGenerationTime": 12.5
  }
}
```

## Template Endpoints

### Get Templates (Public)
```http
GET /api/templates?page=1&limit=20&category=social&type=post&tags=business,modern&difficulty=beginner&aspectRatio=1:1&featured=true&search=business
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `category` (optional): Filter by category
- `type` (optional): Filter by type (`social`, `print`, `web`, `story`, `post`, `banner`)
- `tags` (optional): Comma-separated list of tags
- `difficulty` (optional): Filter by difficulty (`beginner`, `intermediate`, `advanced`)
- `aspectRatio` (optional): Filter by aspect ratio (e.g., `1:1`, `16:9`)
- `featured` (optional): Filter featured templates (boolean)
- `search` (optional): Text search in name, description, tags

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "name": "Modern Business Card",
      "description": "Clean and professional business card template",
      "category": "business",
      "tags": ["business", "professional", "modern"],
      "images": {
        "thumbnail": "https://ik.imagekit.io/jomobit/templates/thumb_123.jpg",
        "preview": "https://ik.imagekit.io/jomobit/templates/preview_123.jpg",
        "fullSize": "https://ik.imagekit.io/jomobit/templates/full_123.jpg"
      },
      "aspectRatio": {
        "width": 1080,
        "height": 1080,
        "ratio": "1:1"
      },
      "type": "social",
      "difficulty": "beginner",
      "metrics": {
        "usageCount": 1250,
        "rating": 4.7
      },
      "isFeatured": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Search Templates
```http
GET /api/templates/search?q=business&page=1&limit=20
```

### Get Template Filter Options
```http
GET /api/templates/filters
```

**Response:**
```json
{
  "success": true,
  "data": {
    "categories": ["business", "social", "marketing", "events"],
    "types": ["social", "print", "web", "story", "post", "banner"],
    "difficulties": ["beginner", "intermediate", "advanced"],
    "aspectRatios": ["1:1", "16:9", "4:3", "9:16"],
    "tags": ["business", "modern", "professional", "creative", "minimal"]
  }
}
```

### Get Featured Templates
```http
GET /api/templates/featured?limit=10
```

### Get Popular Templates
```http
GET /api/templates/popular?limit=10
```

### Get Recent Templates
```http
GET /api/templates/recent?limit=10
```

### Get Template by ID
```http
GET /api/templates/{templateId}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "name": "Modern Business Card",
    "description": "Clean and professional business card template",
    "category": "business",
    "tags": ["business", "professional", "modern"],
    "images": {
      "thumbnail": "https://ik.imagekit.io/jomobit/templates/thumb_123.jpg",
      "preview": "https://ik.imagekit.io/jomobit/templates/preview_123.jpg",
      "fullSize": "https://ik.imagekit.io/jomobit/templates/full_123.jpg"
    },
    "aspectRatio": {
      "width": 1080,
      "height": 1080,
      "ratio": "1:1"
    },
    "type": "social",
    "difficulty": "beginner",
    "metadata": {
      "colorSchemes": [
        {
          "name": "Professional Blue",
          "colors": ["#1E40AF", "#3B82F6", "#60A5FA"]
        }
      ],
      "typography": [
        {
          "name": "Heading",
          "fontFamily": "Inter",
          "weight": "bold"
        }
      ],
      "layout": {
        "textAreas": [
          {
            "type": "title",
            "position": { "x": 50, "y": 100, "width": 300, "height": 60 },
            "maxLength": 50
          }
        ]
      },
      "aiParameters": {
        "promptTemplate": "Create a {type} poster for {businessName}...",
        "styleKeywords": ["professional", "modern", "clean"],
        "excludeKeywords": ["cluttered", "outdated"]
      }
    },
    "metrics": {
      "usageCount": 1250,
      "rating": 4.7,
      "ratingCount": 89,
      "lastUsed": "2024-01-20T12:00:00.000Z"
    },
    "status": "active",
    "isPublic": true,
    "isFeatured": true,
    "createdAt": "2024-01-10T10:00:00.000Z"
  }
}
```

## Poster Generation Endpoints

### Generate Poster
```http
POST /api/posters/generate
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "profileId": "507f1f77bcf86cd799439012",
  "templateId": "507f1f77bcf86cd799439013",
  "aiProvider": {
    "llm": "openai",
    "diffusion": "ideogram"
  },
  "customPrompt": "Create a modern business poster with blue theme",
  "priority": "normal"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Generation job created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439014",
    "userId": "507f1f77bcf86cd799439011",
    "profileId": "507f1f77bcf86cd799439012",
    "templateId": "507f1f77bcf86cd799439013",
    "status": "pending",
    "creditsReserved": 1,
    "aiProvider": {
      "llm": "openai",
      "diffusion": "ideogram"
    },
    "priority": "normal",
    "createdAt": "2024-01-20T16:00:00.000Z",
    "estimatedCompletionTime": "2024-01-20T16:02:00.000Z"
  }
}
```

### Get Generation History
```http
GET /api/posters/history?page=1&limit=20&status=completed&profileId=507f1f77bcf86cd799439012&startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `status` (optional): Filter by status (`pending`, `processing`, `completed`, `failed`, `cancelled`)
- `profileId` (optional): Filter by business profile
- `startDate` (optional): Filter by creation date (ISO 8601)
- `endDate` (optional): Filter by creation date (ISO 8601)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439014",
      "status": "completed",
      "creditsReserved": 1,
      "aiProvider": {
        "llm": "openai",
        "diffusion": "ideogram"
      },
      "result": {
        "imageUrl": "https://ik.imagekit.io/jomobit/generated/poster_123.jpg",
        "thumbnailUrl": "https://ik.imagekit.io/jomobit/generated/thumb_123.jpg"
      },
      "timing": {
        "totalProcessingTime": 12500
      },
      "profileId": {
        "_id": "507f1f77bcf86cd799439012",
        "name": "Acme Corporation"
      },
      "templateId": {
        "_id": "507f1f77bcf86cd799439013",
        "name": "Modern Business Card",
        "images": {
          "thumbnail": "https://ik.imagekit.io/jomobit/templates/thumb_123.jpg"
        }
      },
      "createdAt": "2024-01-20T16:00:00.000Z",
      "completedAt": "2024-01-20T16:00:12.500Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Get User Generation Statistics
```http
GET /api/posters/stats?startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalJobs": 45,
    "completedJobs": 42,
    "failedJobs": 2,
    "pendingJobs": 1,
    "processingJobs": 0,
    "totalCreditsUsed": 45,
    "successRate": 93,
    "avgProcessingTime": 11200
  }
}
```

### Get Generation Job
```http
GET /api/posters/{jobId}
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439014",
    "userId": "507f1f77bcf86cd799439011",
    "profileId": {
      "_id": "507f1f77bcf86cd799439012",
      "name": "Acme Corporation",
      "tagline": "Innovation at its finest"
    },
    "templateId": {
      "_id": "507f1f77bcf86cd799439013",
      "name": "Modern Business Card",
      "images": {
        "thumbnail": "https://ik.imagekit.io/jomobit/templates/thumb_123.jpg"
      },
      "aspectRatio": {
        "width": 1080,
        "height": 1080,
        "ratio": "1:1"
      }
    },
    "status": "completed",
    "creditsReserved": 1,
    "aiProvider": {
      "llm": "openai",
      "diffusion": "ideogram"
    },
    "prompt": {
      "generated": "Create a modern business poster for Acme Corporation...",
      "parameters": {
        "businessName": "Acme Corporation",
        "tagline": "Innovation at its finest",
        "style": "modern",
        "colors": ["#1E40AF", "#F97316"]
      },
      "generatedAt": "2024-01-20T16:00:01.000Z"
    },
    "result": {
      "imageUrl": "https://ik.imagekit.io/jomobit/generated/poster_123.jpg",
      "imagekitFileId": "file_123",
      "thumbnailUrl": "https://ik.imagekit.io/jomobit/generated/thumb_123.jpg",
      "metadata": {
        "width": 1080,
        "height": 1080,
        "format": "JPEG",
        "size": 245760
      }
    },
    "timing": {
      "promptGenerationTime": 1200,
      "imageGenerationTime": 11300,
      "totalProcessingTime": 12500
    },
    "retryCount": 0,
    "priority": "normal",
    "createdAt": "2024-01-20T16:00:00.000Z",
    "startedAt": "2024-01-20T16:00:01.000Z",
    "completedAt": "2024-01-20T16:00:12.500Z"
  }
}
```

### Cancel Generation Job
```http
POST /api/posters/{jobId}/cancel
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "reason": "User cancelled"
}
```

### Retry Generation Job
```http
POST /api/posters/{jobId}/retry
Authorization: Bearer <jwt_token>
```

### Get Poster Sharing Options
```http
GET /api/posters/{jobId}/share
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "shareUrl": "https://share.jomobit.com/poster/abc123",
    "downloadUrl": "https://api.jomobit.com/api/posters/507f1f77bcf86cd799439014/download",
    "socialSharing": {
      "facebook": "https://facebook.com/sharer/sharer.php?u=...",
      "twitter": "https://twitter.com/intent/tweet?url=...",
      "linkedin": "https://linkedin.com/sharing/share-offsite/?url=..."
    },
    "embedCode": "<iframe src=\"https://share.jomobit.com/embed/abc123\" width=\"540\" height=\"540\"></iframe>"
  }
}
```

### Download Poster
```http
GET /api/posters/{jobId}/download?format=jpg&size=original
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `format` (optional): Image format (`jpg`, `png`, `webp`) (default: `jpg`)
- `size` (optional): Image size (`thumbnail`, `medium`, `original`) (default: `original`)

**Response:** Binary image data with appropriate headers

## Subscription Endpoints

### Get Current Subscription
```http
GET /api/subscriptions/current
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439015",
    "userId": "507f1f77bcf86cd799439011",
    "planId": {
      "_id": "507f1f77bcf86cd799439016",
      "name": "Plus",
      "planId": "plus",
      "pricing": {
        "amount": 2500,
        "currency": "INR",
        "interval": "monthly"
      },
      "features": {
        "credits": {
          "monthly": 50,
          "rollover": false
        },
        "businessProfiles": {
          "limit": 3
        }
      }
    },
    "status": "active",
    "currentPeriodStart": "2024-01-15T00:00:00.000Z",
    "currentPeriodEnd": "2024-02-15T00:00:00.000Z",
    "cancelAtPeriodEnd": false,
    "billing": {
      "currency": "INR",
      "amount": 2500,
      "interval": "monthly"
    },
    "isInTrial": false,
    "isActive": true,
    "daysUntilRenewal": 25
  }
}
```

### Get Subscription History
```http
GET /api/subscriptions/history?page=1&limit=10
Authorization: Bearer <jwt_token>
```

### Upgrade Subscription
```http
POST /api/subscriptions/upgrade
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "planId": "507f1f77bcf86cd799439017",
  "paymentMethodId": "pm_1234567890"
}
```

### Cancel Subscription
```http
POST /api/subscriptions/cancel
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "immediately": false,
  "reason": "No longer needed",
  "feedback": "Great service, but switching to different solution"
}
```

### Get Billing History
```http
GET /api/subscriptions/billing?page=1&limit=20
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "razorpayPaymentId": "pay_1234567890",
      "amount": 2500,
      "currency": "INR",
      "status": "paid",
      "paymentMethod": "card",
      "paidAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "pages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

### Get Available Plans
```http
GET /api/subscriptions/plans?includeFree=true
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439016",
      "name": "Free",
      "planId": "free",
      "description": "Perfect for trying out Jomobit",
      "pricing": {
        "amount": 0,
        "currency": "INR",
        "interval": "monthly"
      },
      "features": {
        "credits": {
          "monthly": 3,
          "rollover": false
        },
        "businessProfiles": {
          "limit": 1
        },
        "templates": {
          "access": "basic"
        },
        "aiProviders": {
          "llm": ["openai"],
          "diffusion": ["openai"]
        }
      },
      "tier": "free",
      "isFeatured": false,
      "monthlyPrice": 0,
      "yearlyPrice": 0
    },
    {
      "_id": "507f1f77bcf86cd799439017",
      "name": "Plus",
      "planId": "plus",
      "description": "Great for small businesses and entrepreneurs",
      "pricing": {
        "amount": 2500,
        "currency": "INR",
        "interval": "monthly"
      },
      "features": {
        "credits": {
          "monthly": 50,
          "rollover": false
        },
        "businessProfiles": {
          "limit": 3
        },
        "templates": {
          "access": "premium"
        },
        "aiProviders": {
          "llm": ["openai", "gemini"],
          "diffusion": ["openai", "ideogram"]
        },
        "additional": {
          "prioritySupport": true,
          "analytics": true
        }
      },
      "tier": "basic",
      "isFeatured": true,
      "monthlyPrice": 2500,
      "yearlyPrice": 30000
    }
  ]
}
```

### Get Plan by ID
```http
GET /api/subscriptions/plans/{planId}
```

## Admin Endpoints

All admin endpoints require admin role authentication.

### Get Dashboard Data
```http
GET /api/admin/dashboard
Authorization: Bearer <admin_jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "users": {
      "total": 1250,
      "active": 1180,
      "newThisMonth": 89,
      "growthRate": 12.5
    },
    "revenue": {
      "thisMonth": 125000,
      "lastMonth": 110000,
      "growthRate": 13.6,
      "mrr": 125000
    },
    "generations": {
      "total": 15420,
      "thisMonth": 2340,
      "successRate": 94.2,
      "avgProcessingTime": 11.2
    },
    "templates": {
      "total": 150,
      "active": 142,
      "featured": 25,
      "mostPopular": {
        "name": "Modern Business Card",
        "usageCount": 1250
      }
    }
  }
}
```

### Get User Metrics
```http
GET /api/admin/metrics/users?period=30d&groupBy=day
Authorization: Bearer <admin_jwt_token>
```

### Get Revenue Metrics
```http
GET /api/admin/metrics/revenue?period=12m&groupBy=month
Authorization: Bearer <admin_jwt_token>
```

### Export Data
```http
GET /api/admin/export/users?format=csv&startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <admin_jwt_token>
```

**Query Parameters:**
- `format`: Export format (`csv`, `json`, `xlsx`)
- `startDate`: Start date for data export
- `endDate`: End date for data export

## Webhook Endpoints

Webhook endpoints don't require authentication but validate signatures.

### Auth0 Webhook
```http
POST /api/webhooks/auth0
Content-Type: application/json
X-Auth0-Signature: sha256=<signature>

{
  "event": "user.created",
  "data": {
    "user_id": "auth0|507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "email_verified": true,
    "name": "John Doe"
  }
}
```

### Razorpay Webhook
```http
POST /api/webhooks/razorpay
Content-Type: application/json
X-Razorpay-Signature: <signature>

{
  "event": "payment.captured",
  "payload": {
    "payment": {
      "entity": {
        "id": "pay_1234567890",
        "amount": 2500,
        "currency": "INR",
        "status": "captured"
      }
    }
  }
}
```

### AI Generation Webhook
```http
POST /api/webhooks/ai/generation
Content-Type: application/json

{
  "jobId": "507f1f77bcf86cd799439014",
  "status": "completed",
  "result": {
    "imageUrl": "https://generated-image-url.com/image.jpg",
    "metadata": {
      "width": 1080,
      "height": 1080,
      "format": "JPEG"
    }
  }
}
```

## Error Handling

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Unprocessable Entity
- `429` - Too Many Requests
- `500` - Internal Server Error

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      },
      {
        "field": "name",
        "message": "Name is required"
      }
    ]
  }
}
```

### Common Error Codes

- `AUTH_REQUIRED` - Authentication required
- `INVALID_TOKEN` - Invalid or expired JWT token
- `INSUFFICIENT_PERMISSIONS` - User lacks required permissions
- `VALIDATION_ERROR` - Request validation failed
- `RESOURCE_NOT_FOUND` - Requested resource not found
- `PLAN_LIMIT_EXCEEDED` - User has exceeded plan limits
- `INSUFFICIENT_CREDITS` - Not enough credits for operation
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `GENERATION_FAILED` - AI generation failed
- `WEBHOOK_SIGNATURE_INVALID` - Invalid webhook signature

### Rate Limiting Headers

When rate limits are approached or exceeded:

```http
X-Rate-Limit-Limit: 100
X-Rate-Limit-Remaining: 5
X-Rate-Limit-Reset: 1642680000
Retry-After: 900
```

---

**Next Chapter**: [AI Integration](./06-ai-integration.md) - Learn about AI providers, generation workflow, and prompt engineering strategies.