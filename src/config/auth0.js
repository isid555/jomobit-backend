const { auth } = require('express-oauth2-jwt-bearer');

/**
 * Auth0 Configuration
 * Handles JWT validation and Auth0 integration settings
 */
class Auth0Config {
  constructor() {
    this.domain = process.env.AUTH0_DOMAIN;
    this.audience = process.env.AUTH0_AUDIENCE?.trim(); // Remove any whitespace/newlines
    this.clientId = process.env.AUTH0_CLIENT_ID;
    this.clientSecret = process.env.AUTH0_CLIENT_SECRET;
    
    this.validateConfig();
  }

  validateConfig() {
    const requiredVars = ['AUTH0_DOMAIN', 'AUTH0_AUDIENCE'];
    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required Auth0 environment variables: ${missing.join(', ')}`);
    }
  }

  /**
   * Create JWT validation middleware
   * @returns {Function} Express middleware for JWT validation
   */
  createJwtValidator() {
    return auth({
      issuerBaseURL: `https://${this.domain}`,
      audience: this.audience,
      tokenSigningAlg: 'RS256'
    });
  }

  /**
   * Get Auth0 configuration for webhooks and API calls
   * @returns {Object} Auth0 configuration object
   */
  getConfig() {
    return {
      domain: this.domain,
      audience: this.audience,
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      issuerBaseURL: `https://${this.domain}`,
      tokenSigningAlg: 'RS256'
    };
  }
}

module.exports = new Auth0Config();