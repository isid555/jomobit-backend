const { TestDataFactory } = require('../fixtures/testData');
const mongoose = require('mongoose');

describe('Test Setup Verification', () => {
  it('should have MongoDB connection available', () => {
    expect(global.__MONGO_URI__).toBeDefined();
    expect(mongoose.connection.readyState).toBe(1); // Connected
  });

  it('should create test data using factory', () => {
    const userData = TestDataFactory.createUserData();
    
    expect(userData).toHaveProperty('auth0Id');
    expect(userData).toHaveProperty('email');
    expect(userData).toHaveProperty('status');
    expect(userData.status).toBe('active');
    expect(userData.email).toMatch(/@example\.com$/);
  });

  it('should create business profile data', () => {
    const userId = new mongoose.Types.ObjectId();
    const profileData = TestDataFactory.createBusinessProfileData(userId);
    
    expect(profileData).toHaveProperty('userId');
    expect(profileData).toHaveProperty('name');
    expect(profileData).toHaveProperty('tagline');
    expect(profileData).toHaveProperty('colorPalette');
    expect(profileData.userId).toEqual(userId);
    expect(Array.isArray(profileData.colorPalette)).toBe(true);
  });

  it('should create credit wallet data', () => {
    const userId = new mongoose.Types.ObjectId();
    const walletData = TestDataFactory.createCreditWalletData(userId);
    
    expect(walletData).toHaveProperty('userId');
    expect(walletData).toHaveProperty('defaultCredits');
    expect(walletData).toHaveProperty('subscriptionCredits');
    expect(walletData).toHaveProperty('reservedCredits');
    expect(walletData.userId).toEqual(userId);
    expect(walletData.defaultCredits).toBe(3);
  });

  it('should have test environment variables set', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.MONGODB_URI).toBeDefined();
    expect(process.env.AUTH0_DOMAIN).toBeDefined();
    expect(process.env.AUTH0_AUDIENCE).toBeDefined();
  });
});