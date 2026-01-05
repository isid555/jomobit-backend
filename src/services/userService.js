const mongoose = require('mongoose');
const User = require('../models/User');
const { CreditService } = require('./creditService');
const logger = require('../utils/logger');
const Plan = require('../models/Plan');

/**
 * Custom error classes for user operations
 */
class UserNotFoundError extends Error {
  constructor(identifier) {
    super(`User not found: ${identifier}`);
    this.name = 'UserNotFoundError';
    this.code = 'USER_NOT_FOUND';
    this.identifier = identifier;
  }
}

class UserAlreadyExistsError extends Error {
  constructor(identifier) {
    super(`User already exists: ${identifier}`);
    this.name = 'UserAlreadyExistsError';
    this.code = 'USER_ALREADY_EXISTS';
    this.identifier = identifier;
  }
}

class UserOperationError extends Error {
  constructor(message, operation, userId) {
    super(message);
    this.name = 'UserOperationError';
    this.code = 'USER_OPERATION_ERROR';
    this.operation = operation;
    this.userId = userId;
  }
}

/**
 * User Management Service
 * Handles user lifecycle management and Auth0 integration
 */

class UserService {
  constructor(options = {}) {
    this.creditService = options.creditService || new CreditService();
  }

  /**
   * Create or update user from Auth0 webhook data
   * @param {Object} auth0User - Auth0 user data from webhook
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Operation result with user and credit info
   */
  async createOrUpdateFromAuth0(auth0User, options = {}) {
    const { grantDefaultCredits = true } = options;

    try {
      logger.info('Processing Auth0 user data', {
        auth0Id: auth0User.auth0Id,
        email: auth0User.email,
        operation: 'createOrUpdateFromAuth0'
      });

      // Create or update user using model method
      const user = await User.createOrUpdateFromAuth0(auth0User);
      const isNewUser = user.createdAt.getTime() === user.updatedAt.getTime();

      let creditResult = null;

      // Grant default credits for new users
      if (isNewUser && grantDefaultCredits) {
        try {
          creditResult = await this.creditService.grantDefaultCredits(
            user._id,
            this.creditService.DEFAULT_CREDITS,
            {
              source: 'user_registration',
              auth0Id: auth0User.user_id,
              email: auth0User.email
            }
          );

          logger.info('Default credits granted to new user', {
            userId: user._id,
            auth0Id: auth0User.user_id,
            credits: this.creditService.DEFAULT_CREDITS
          });
        } catch (creditError) {
          // Log credit error but don't fail user creation
          logger.error('Failed to grant default credits to new user', {
            userId: user._id,
            auth0Id: auth0User.user_id,
            error: creditError.message
          });
        }
      }

      return {
        success: true,
        user: user.toObject(),
        isNewUser,
        creditResult,
        message: isNewUser ? 'User created successfully' : 'User updated successfully'
      };

    } catch (error) {
      logger.error('Error processing Auth0 user data', {
        auth0Id: auth0User.user_id,
        email: auth0User.email,
        error: error.message,
        stack: error.stack
      });
      throw new UserOperationError(
        `Failed to process Auth0 user data: ${error.message}`,
        'createOrUpdateFromAuth0',
        auth0User.user_id
      );
    }
  }


  /**
 * Add new identity to existing user (for account linking)
 * @param {string|ObjectId} userId - User ID
 * @param {Object} newUserData - New identity data from Auth0
 * @returns {Promise<Object>} Updated user
 */
  async addIdentityToUser(userId, newUserData) {
    try {
      logger.info('Adding identity to existing user', {
        userId,
        newAuth0Id: newUserData.auth0Id,
        newProvider: newUserData.primaryIdentity?.provider
      });

      // Update user with new identity information
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          $set: {
            auth0Id: newUserData.auth0Id, // Update to latest Auth0 ID
            metadata: { ...newUserData.metadata },
            lastSyncAt: new Date(),
            emailVerified: newUserData.emailVerified || true,
            status: 'active' // Activate user when linking social account
          },
          $addToSet: {
            identities: { $each: newUserData.identities || [] }
          }
        },
        {
          new: true,
          runValidators: true
        }
      );

      if (!updatedUser) {
        throw new UserNotFoundError(userId);
      }

      logger.info('Identity added to existing user successfully', {
        userId: updatedUser._id,
        auth0Id: updatedUser.auth0Id,
        totalIdentities: updatedUser.identities?.length || 0
      });

      return updatedUser.toObject();

    } catch (error) {
      if (error instanceof UserNotFoundError) {
        throw error;
      }

      logger.error('Error adding identity to user', {
        userId,
        newAuth0Id: newUserData.auth0Id,
        error: error.message
      });

      throw new UserOperationError(
        `Failed to add identity to user: ${error.message}`,
        'addIdentityToUser',
        userId
      );
    }
  }

  /**
   * Handle user status update from Auth0 webhooks
   * @param {string} auth0Id - Auth0 user ID
   * @param {string} newStatus - New user status
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Operation result
   */
  async updateUserStatus(auth0Id, newStatus, metadata = {}) {
    try {
      logger.info('Updating user status', {
        auth0Id,
        newStatus,
        operation: 'updateUserStatus'
      });

      const user = await User.findByAuth0Id(auth0Id);
      if (!user) {
        throw new UserNotFoundError(auth0Id);
      }

      const oldStatus = user.status;
      user.status = newStatus;
      user.lastSyncAt = new Date();

      // Update metadata if provided
      if (metadata.emailVerified !== undefined) {
        user.emailVerified = metadata.emailVerified;
      }

      if (metadata.lastLogin) {
        user.lastLoginAt = new Date(metadata.lastLogin);
      }

      await user.save();

      logger.info('User status updated successfully', {
        userId: user._id,
        auth0Id,
        oldStatus,
        newStatus
      });

      return {
        success: true,
        user: user.toObject(),
        statusChanged: oldStatus !== newStatus,
        oldStatus,
        newStatus,
        message: `User status updated from ${oldStatus} to ${newStatus}`
      };

    } catch (error) {
      if (error instanceof UserNotFoundError) {
        throw error;
      }

      logger.error('Error updating user status', {
        auth0Id,
        newStatus,
        error: error.message,
        stack: error.stack
      });
      throw new UserOperationError(
        `Failed to update user status: ${error.message}`,
        'updateUserStatus',
        auth0Id
      );
    }
  }

  /**
   * Get user by Auth0 ID
   * @param {string} auth0Id - Auth0 user ID
   * @returns {Promise<Object>} User data
   */
  async getUserByAuth0Id(auth0Id) {
    try {
      const user = await User.findByAuth0Id(auth0Id);
      if (!user) {
        throw new UserNotFoundError(auth0Id);
      }

      return {
        success: true,
        user: user.toObject()
      };

    } catch (error) {
      if (error instanceof UserNotFoundError) {
        throw error;
      }

      logger.error('Error getting user by Auth0 ID', {
        auth0Id,
        error: error.message
      });
      throw new UserOperationError(
        `Failed to get user: ${error.message}`,
        'getUserByAuth0Id',
        auth0Id
      );
    }
  }

  /**
   * Get user by email
   * @param {string} email - User email
   * @returns {Promise<Object>} User data
   */
  async getUserByEmail(email) {
    // try {
    const user = await User.findByEmail(email);
    return user;
    // if (!user) {
    //   throw new UserNotFoundError(email);
    // }

    // return {
    //   success: true,
    //   user: user.toObject()
    // };

    // } catch (error) {
    // if (error instanceof UserNotFoundError) {
    //   throw error;
    // }

    // logger.error('Error getting user by email', {
    //   email,
    //   error: error.message
    // });
    // throw new UserOperationError(
    //   `Failed to get user: ${error.message}`,
    //   'getUserByEmail',
    //   email
    // );
    // }
  }

  /**
   * Get user by ID
   * @param {string|ObjectId} userId - User ID
   * @returns {Promise<Object>} User data
   */
  async getUserById(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new UserNotFoundError(userId);
      }

      return {
        success: true,
        user: user.toObject()
      };

    } catch (error) {
      if (error instanceof UserNotFoundError) {
        throw error;
      }

      logger.error('Error getting user by ID', {
        userId,
        error: error.message
      });
      throw new UserOperationError(
        `Failed to get user: ${error.message}`,
        'getUserById',
        userId
      );
    }
  }

  /**
   * Update user last login timestamp
   * @param {string} auth0Id - Auth0 user ID
   * @returns {Promise<Object>} Operation result
   */
  async updateLastLogin(auth0Id) {
    try {
      const user = await User.findByAuth0Id(auth0Id);
      if (!user) {
        throw new UserNotFoundError(auth0Id);
      }

      await user.updateLastLogin();

      logger.info('User last login updated', {
        userId: user._id,
        auth0Id,
        lastLoginAt: user.lastLoginAt
      });

      return {
        success: true,
        user: user.toObject(),
        message: 'Last login timestamp updated'
      };

    } catch (error) {
      if (error instanceof UserNotFoundError) {
        throw error;
      }

      logger.error('Error updating last login', {
        auth0Id,
        error: error.message
      });
      throw new UserOperationError(
        `Failed to update last login: ${error.message}`,
        'updateLastLogin',
        auth0Id
      );
    }
  }

  /**
   * Suspend user account
   * @param {string|ObjectId} userId - User ID
   * @param {string} reason - Suspension reason
   * @returns {Promise<Object>} Operation result
   */
  async suspendUser(userId, reason = null) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new UserNotFoundError(userId);
      }

      const oldStatus = user.status;
      await user.suspend();

      logger.info('User suspended', {
        userId,
        oldStatus,
        reason
      });

      return {
        success: true,
        user: user.toObject(),
        oldStatus,
        reason,
        message: 'User account suspended'
      };

    } catch (error) {
      if (error instanceof UserNotFoundError) {
        throw error;
      }

      logger.error('Error suspending user', {
        userId,
        error: error.message
      });
      throw new UserOperationError(
        `Failed to suspend user: ${error.message}`,
        'suspendUser',
        userId
      );
    }
  }

  /**
   * Activate user account
   * @param {string|ObjectId} userId - User ID
   * @returns {Promise<Object>} Operation result
   */
  async activateUser(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new UserNotFoundError(userId);
      }

      const oldStatus = user.status;
      await user.activate();

      logger.info('User activated', {
        userId,
        oldStatus
      });

      return {
        success: true,
        user: user.toObject(),
        oldStatus,
        message: 'User account activated'
      };

    } catch (error) {
      if (error instanceof UserNotFoundError) {
        throw error;
      }

      logger.error('Error activating user', {
        userId,
        error: error.message
      });
      throw new UserOperationError(
        `Failed to activate user: ${error.message}`,
        'activateUser',
        userId
      );
    }
  }

  /**
   * Get users by status with pagination
   * @param {string} status - User status to filter by
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Users and pagination info
   */
  async getUsersByStatus(status, options = {}) {
    try {
      const {
        limit = 50,
        skip = 0,
        sort = { createdAt: -1 }
      } = options;

      const users = await User.getUsersByStatus(status, { limit, skip, sort });
      const totalCount = await User.countDocuments({ status });

      return {
        success: true,
        users: users.map(user => user.toObject()),
        pagination: {
          total: totalCount,
          limit,
          skip,
          hasMore: skip + users.length < totalCount
        }
      };

    } catch (error) {
      logger.error('Error getting users by status', {
        status,
        options,
        error: error.message
      });
      throw new UserOperationError(
        `Failed to get users by status: ${error.message}`,
        'getUsersByStatus',
        null
      );
    }
  }

  /**
   * Get user statistics
   * @returns {Promise<Object>} User statistics
   */
  async getUserStats() {
    try {
      const totalUsers = await User.countDocuments({});
      const activeUsers = await User.getActiveUsersCount();
      const pendingUsers = await User.countDocuments({ status: 'pending' });
      const suspendedUsers = await User.countDocuments({ status: 'suspended' });

      // Get recent registrations (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentRegistrations = await User.countDocuments({
        createdAt: { $gte: thirtyDaysAgo }
      });

      // Get users with recent activity (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentlyActive = await User.countDocuments({
        lastLoginAt: { $gte: sevenDaysAgo }
      });

      return {
        success: true,
        stats: {
          total: totalUsers,
          active: activeUsers,
          pending: pendingUsers,
          suspended: suspendedUsers,
          recentRegistrations,
          recentlyActive,
          statusBreakdown: {
            active: activeUsers,
            pending: pendingUsers,
            suspended: suspendedUsers
          }
        }
      };

    } catch (error) {
      logger.error('Error getting user statistics', {
        error: error.message
      });
      throw new UserOperationError(
        `Failed to get user statistics: ${error.message}`,
        'getUserStats',
        null
      );
    }
  }

  /**
   * Search users by email or name
   * @param {string} searchTerm - Search term
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async searchUsers(searchTerm, options = {}) {
    try {
      const {
        limit = 20,
        skip = 0,
        status = null
      } = options;

      const query = {
        $or: [
          { email: { $regex: searchTerm, $options: 'i' } },
          { 'metadata.name': { $regex: searchTerm, $options: 'i' } },
          { 'metadata.given_name': { $regex: searchTerm, $options: 'i' } },
          { 'metadata.family_name': { $regex: searchTerm, $options: 'i' } }
        ]
      };

      if (status) {
        query.status = status;
      }

      const users = await User.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .exec();

      const totalCount = await User.countDocuments(query);

      return {
        success: true,
        users: users.map(user => user.toObject()),
        searchTerm,
        pagination: {
          total: totalCount,
          limit,
          skip,
          hasMore: skip + users.length < totalCount
        }
      };

    } catch (error) {
      logger.error('Error searching users', {
        searchTerm,
        options,
        error: error.message
      });
      throw new UserOperationError(
        `Failed to search users: ${error.message}`,
        'searchUsers',
        null
      );
    }
  }

  /**
   * Get user with credit balance
   * @param {string|ObjectId} userId - User ID
   * @returns {Promise<Object>} User data with credit information
   */
  async getUserWithCredits(userId) {
    try {
      const userResult = await this.getUserById(userId);
      const creditBalance = await this.creditService.getCreditBalance(userId);

      return {
        success: true,
        user: userResult.user,
        credits: creditBalance
      };

    } catch (error) {
      if (error instanceof UserNotFoundError) {
        throw error;
      }

      logger.error('Error getting user with credits', {
        userId,
        error: error.message
      });
      throw new UserOperationError(
        `Failed to get user with credits: ${error.message}`,
        'getUserWithCredits',
        userId
      );
    }
  }

  /**
   * Create a guest user for trial generation
   * @returns {Promise<Object>} Created guest user
   */
  async createGuestUser() {
    try {
      const randomString = (length) => {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };

      // Generate fake auth0Id for guest users
      const guestAuth0Id = `guest|${Date.now()}_${randomString(16)}`;
      const guestIdentifier = `guest_${Date.now()}_${randomString(8)}`;
      const expiresAt = null // new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 hours

      // Generate unique placeholder email for guest users
      // Format: guest_<timestamp>_<random>@internal.jomobit.com
      const guestEmail = `guest_${Date.now()}_${randomString(8)}@internal.jomobit.com`;

      const guestUser = new User({
        auth0Id: guestAuth0Id,
        email: guestEmail, // Add unique email for guest users
        guestIdentifier,
        isGuest: true,
        status: 'active',
        emailVerified: false,
        metadata: {
          name: `Guest User ${randomString(4)}`
        },
        roles: ['user'],
        expiresAt
      });

      await guestUser.save();

      // Grant 1 credit to guest user
      await this.creditService.grantDefaultCredits(
        guestUser._id,
        1,
        {
          source: 'guest_trial',
          guestIdentifier
        }
      );

      logger.info('Guest user created successfully', {
        userId: guestUser._id,
        guestIdentifier,
        guestEmail,
        auth0Id: guestAuth0Id,
        expiresAt
      });

      return {
        success: true,
        user: guestUser.toObject(),
        message: 'Guest user created successfully'
      };

    } catch (error) {
      logger.error('Error creating guest user', {
        error: error.message,
        stack: error.stack
      });
      throw new UserOperationError(
        `Failed to create guest user: ${error.message}`,
        'createGuestUser',
        null
      );
    }
  }

  /**
   * Get business profile count for a user
   * @param {string|ObjectId} userId - User ID
   * @returns {Promise<Object>} Business profile count
   */
  async getUserBusinessProfileCount(userId) {
    try {
      const BusinessProfile = require('../models/BusinessProfile');
      const count = await BusinessProfile.countDocuments({
        userId: userId,
        isDeleted: { $ne: true }
      });

      logger.info('Retrieved business profile count', {
        userId,
        count
      });

      return {
        success: true,
        count
      };

    } catch (error) {
      logger.error('Error getting business profile count', {
        userId,
        error: error.message
      });
      throw new UserOperationError(
        `Failed to get business profile count: ${error.message}`,
        'getUserBusinessProfileCount',
        userId
      );
    }
  }

  /**
   * Get user's plan details (subscription and limits)
   * @param {string|ObjectId} userId - User ID
   * @returns {Promise<Object>} Plan details with limits and tier
   */
  async getUserPlanDetails(userId) {
    try {
      const Subscription = require('../models/Subscription');

      // Get user's active subscription with populated plan
      const subscription = await Subscription.getUserActiveSubscription(userId);

      // Default to free plan if no active subscription
      if (!subscription || !subscription.planId) {
        logger.info('No active subscription found, returning free plan defaults', {
          userId
        });


        const FreePlan = await Plan.findOne({ tier: "free", status: "active" });




        return {
          success: true,
          plan: FreePlan.name,
          tier: FreePlan.tier,
          brandsLimit: FreePlan.features?.businessProfiles?.limit || 1
        };

      }

      const plan = subscription.planId;

      logger.info('Retrieved user plan details', {
        userId,
        planName: plan.name,
        tier: plan.tier,
        brandsLimit: plan.features?.businessProfiles?.limit
      });

      return {
        success: true,
        plan: plan.name,
        tier: plan.tier,
        brandsLimit: plan.features?.businessProfiles?.limit || 1
      };

    } catch (error) {
      logger.error('Error getting user plan details', {
        userId,
        error: error.message
      });

      // Return free plan defaults on error
      return {
        success: true,
        plan: 'Free',
        tier: 'free',
        brandsLimit: 1
      };
    }
  }
}

// Export error classes for use in other modules
UserService.UserNotFoundError = UserNotFoundError;
UserService.UserAlreadyExistsError = UserAlreadyExistsError;
UserService.UserOperationError = UserOperationError;

module.exports = UserService;