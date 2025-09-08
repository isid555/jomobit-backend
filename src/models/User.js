const mongoose = require('mongoose');

/**
 * User Schema
 * Stores user information synchronized from Auth0
 */
const userSchema = new mongoose.Schema({
  // Auth0 user ID (primary identifier)
  auth0Id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // User email (unique identifier)
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },

  identities: [{
    provider: String,        // 'auth0', 'google-oauth2', 'facebook', etc.
    user_id: String,        // Provider-specific user ID  
    connection: String,     // Auth0 connection name
    isSocial: Boolean      // true for social logins
  }],

  // Track which identity was used for creation
  primaryIdentity: {
    provider: String,
    connection: String
  },
  
  // User status
  status: {
    type: String,
    enum: ['pending', 'active', 'suspended'],
    default: 'pending',
    index: true
  },
  
  // Email verification status
  emailVerified: {
    type: Boolean,
    default: false
  },
  
  // User metadata from Auth0
  metadata: {
    name: String,
    given_name: String,
    family_name: String,
    nickname: String,
    picture: String,
    locale: String,
    updated_at: Date
  },
  
  // User roles (from Auth0 custom claims)
  roles: [{
    type: String,
    enum: ['user', 'admin', 'moderator']
  }],
  
  // User permissions (from Auth0)
  permissions: [String],
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  lastLoginAt: {
    type: Date,
    index: true
  },
  
  // Auth0 webhook tracking
  lastSyncAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      // Remove sensitive fields from JSON output
      delete ret.__v;
      return ret;
    }
  }
});

// Additional indexes for performance (basic indexes are defined in schema)
userSchema.index({ createdAt: -1 });
userSchema.index({ lastLoginAt: -1 });

// Pre-save middleware to update timestamps
userSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

// Static methods
userSchema.statics = {
  /**
   * Find user by Auth0 ID
   * @param {string} auth0Id - Auth0 user ID
   * @returns {Promise<User|null>} User document or null
   */
  async findByAuth0Id(auth0Id) {
    return this.findOne({ auth0Id }).exec();
  },

  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Promise<User|null>} User document or null
   */
  async findByEmail(email) {
    return this.findOne({ email: email.toLowerCase() }).exec();
  },

  /**
   * Create or update user from Auth0 data
   * @param {Object} auth0User - Auth0 user data
   * @returns {Promise<User>} User document
   */
  async createOrUpdateFromAuth0(auth0User) {
    const userData = {
      auth0Id: auth0User.auth0Id,
      email: auth0User.email?.toLowerCase(),
      emailVerified: auth0User.email_verified || false,
      status: auth0User.email_verified ? 'active' : 'pending',
      metadata: {
        name: auth0User.name,
        given_name: auth0User.given_name,
        family_name: auth0User.family_name,
        nickname: auth0User.nickname,
        picture: auth0User.picture,
        locale: auth0User.locale,
        updated_at: auth0User.updated_at ? new Date(auth0User.updated_at) : new Date()
      },
      roles: auth0User['https://jomobit.com/roles'] || ['user'],
      permissions: auth0User.permissions || [],
      lastSyncAt: new Date()
    };

    // Update last login if login event
    if (auth0User.last_login) {
      userData.lastLoginAt = new Date(auth0User.last_login);
    }

    return this.findOneAndUpdate(
      { auth0Id: auth0User.user_id },
      userData,
      { 
        upsert: true, 
        new: true, 
        runValidators: true 
      }
    ).exec();
  },

  /**
   * Get active users count
   * @returns {Promise<number>} Count of active users
   */
  async getActiveUsersCount() {
    return this.countDocuments({ status: 'active' }).exec();
  },

  /**
   * Get users by status
   * @param {string} status - User status
   * @param {Object} options - Query options
   * @returns {Promise<User[]>} Array of users
   */
  async getUsersByStatus(status, options = {}) {
    const { limit = 50, skip = 0, sort = { createdAt: -1 } } = options;
    
    return this.find({ status })
      .sort(sort)
      .limit(limit)
      .skip(skip)
      .exec();
  }
};

// Instance methods
userSchema.methods = {
  /**
   * Check if user has specific role
   * @param {string} role - Role to check
   * @returns {boolean} True if user has role
   */
  hasRole(role) {
    return this.roles.includes(role);
  },

  /**
   * Check if user has specific permission
   * @param {string} permission - Permission to check
   * @returns {boolean} True if user has permission
   */
  hasPermission(permission) {
    return this.permissions.includes(permission);
  },

  /**
   * Check if user is admin
   * @returns {boolean} True if user is admin
   */
  isAdmin() {
    return this.hasRole('admin');
  },

  /**
   * Update last login timestamp
   * @returns {Promise<User>} Updated user document
   */
  async updateLastLogin() {
    this.lastLoginAt = new Date();
    return this.save();
  },

  /**
   * Suspend user account
   * @returns {Promise<User>} Updated user document
   */
  async suspend() {
    this.status = 'suspended';
    return this.save();
  },

  /**
   * Activate user account
   * @returns {Promise<User>} Updated user document
   */
  async activate() {
    this.status = 'active';
    return this.save();
  }
};

const User = mongoose.model('User', userSchema);

module.exports = User;