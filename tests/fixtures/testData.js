const mongoose = require('mongoose');

// Test data factories for creating consistent test data
class TestDataFactory {
  static createUserData(overrides = {}) {
    return {
      auth0Id: `auth0|${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
      email: `test${Date.now()}@example.com`,
      status: 'active',
      metadata: {
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
      },
      createdAt: new Date(),
      lastLoginAt: new Date(),
      ...overrides
    };
  }

  static createBusinessProfileData(userId, overrides = {}) {
    return {
      userId: userId || new mongoose.Types.ObjectId(),
      name: 'Test Business',
      tagline: 'Your trusted partner',
      description: 'A test business for testing purposes',
      logo: 'https://example.com/logo.jpg',
      colorPalette: [
        { name: 'Primary', hex: '#007bff' },
        { name: 'Secondary', hex: '#6c757d' }
      ],
      typography: {
        primary: 'Arial',
        secondary: 'Helvetica'
      },
      products: ['Product 1', 'Product 2'],
      address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        country: 'Test Country',
        zipCode: '12345'
      },
      isActive: true,
      ...overrides
    };
  }

  static createCreditWalletData(userId, overrides = {}) {
    return {
      userId: userId || new mongoose.Types.ObjectId(),
      defaultCredits: 3,
      subscriptionCredits: 0,
      reservedCredits: 0,
      totalCredits: 3,
      lastUpdated: new Date(),
      subscriptionCreditExpiry: null,
      ...overrides
    };
  }

  static createCreditTransactionData(userId, overrides = {}) {
    return {
      userId: userId || new mongoose.Types.ObjectId(),
      type: 'grant',
      amount: 3,
      creditType: 'default',
      reference: {
        type: 'registration',
        id: 'test-ref-id'
      },
      balanceBefore: 0,
      balanceAfter: 3,
      createdAt: new Date(),
      metadata: {},
      ...overrides
    };
  }

  static createTemplateData(overrides = {}) {
    return {
      name: 'Test Template',
      description: 'A test template for testing',
      category: 'business',
      tags: ['professional', 'modern'],
      aspectRatio: '16:9',
      images: {
        thumbnail: 'https://example.com/thumb.jpg',
        preview: 'https://example.com/preview.jpg'
      },
      parameters: {
        textFields: ['title', 'subtitle'],
        colorFields: ['primary', 'secondary']
      },
      isActive: true,
      createdAt: new Date(),
      ...overrides
    };
  }

  static createGenerationJobData(userId, profileId, templateId, overrides = {}) {
    return {
      userId: userId || new mongoose.Types.ObjectId(),
      profileId: profileId || new mongoose.Types.ObjectId(),
      templateId: templateId || new mongoose.Types.ObjectId(),
      status: 'pending',
      creditsReserved: 1,
      aiProvider: {
        llm: 'openai',
        diffusion: 'openai'
      },
      prompt: {
        generated: 'Test prompt for poster generation',
        parameters: {}
      },
      result: {},
      externalJobId: `ext-job-${Date.now()}`,
      createdAt: new Date(),
      ...overrides
    };
  }

  static createSubscriptionData(userId, planId, overrides = {}) {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    
    return {
      userId: userId || new mongoose.Types.ObjectId(),
      planId: planId || new mongoose.Types.ObjectId(),
      razorpaySubscriptionId: `sub_${Date.now()}`,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: nextMonth,
      cancelAtPeriodEnd: false,
      billingHistory: [],
      createdAt: now,
      updatedAt: now,
      ...overrides
    };
  }

  static createPlanData(overrides = {}) {
    return {
      name: 'Test Plan',
      displayName: 'Test Plan',
      price: 25,
      currency: 'USD',
      interval: 'monthly',
      features: {
        credits: 50,
        profiles: 3,
        priority: false
      },
      razorpayPlanId: `plan_${Date.now()}`,
      isActive: true,
      createdAt: new Date(),
      ...overrides
    };
  }

  // Helper methods for creating multiple related records
  static async createUserWithWallet(User, CreditWallet, userOverrides = {}, walletOverrides = {}) {
    const userData = this.createUserData(userOverrides);
    const user = await User.create(userData);
    
    const walletData = this.createCreditWalletData(user._id, walletOverrides);
    const wallet = await CreditWallet.create(walletData);
    
    return { user, wallet };
  }

  static async createUserWithProfile(User, BusinessProfile, userOverrides = {}, profileOverrides = {}) {
    const userData = this.createUserData(userOverrides);
    const user = await User.create(userData);
    
    const profileData = this.createBusinessProfileData(user._id, profileOverrides);
    const profile = await BusinessProfile.create(profileData);
    
    return { user, profile };
  }

  static async createCompleteUserSetup(models, overrides = {}) {
    const { User, CreditWallet, BusinessProfile } = models;
    
    const userData = this.createUserData(overrides.user || {});
    const user = await User.create(userData);
    
    const walletData = this.createCreditWalletData(user._id, overrides.wallet || {});
    const wallet = await CreditWallet.create(walletData);
    
    const profileData = this.createBusinessProfileData(user._id, overrides.profile || {});
    const profile = await BusinessProfile.create(profileData);
    
    return { user, wallet, profile };
  }
}

// Mock data for external services
const mockWebhookPayloads = {
  auth0UserCreated: {
    user_id: 'auth0|test123',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://example.com/avatar.jpg',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },

  razorpayPaymentSuccess: {
    entity: 'event',
    account_id: 'acc_test123',
    event: 'payment.captured',
    contains: ['payment'],
    payload: {
      payment: {
        entity: {
          id: 'pay_test123',
          amount: 2500,
          currency: 'INR',
          status: 'captured',
          method: 'card',
          captured: true,
          created_at: Math.floor(Date.now() / 1000)
        }
      }
    }
  },

  ideogramWebhookSuccess: {
    job_id: 'test-job-123',
    status: 'completed',
    result: {
      image_url: 'https://example.com/generated-image.jpg',
      metadata: {
        prompt: 'Test prompt',
        model: 'ideogram-v1'
      }
    }
  },

  openaiWebhookSuccess: {
    job_id: 'test-job-456',
    status: 'succeeded',
    output: {
      data: [{
        url: 'https://example.com/dalle-image.jpg'
      }]
    }
  }
};

module.exports = {
  TestDataFactory,
  mockWebhookPayloads
};