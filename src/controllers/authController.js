const UserService = require('../services/userService');
const logger = require('../utils/logger');

/**
 * Authentication Controller
 * Handles user authentication endpoints
 */
class AuthController {
  constructor() {
    this.userService = new UserService();

    // Bind all methods to preserve 'this' context
    this.getCurrentUser = this.getCurrentUser.bind(this);
    this.updateLastLogin = this.updateLastLogin.bind(this);
    this.getUserPermissions = this.getUserPermissions.bind(this);
    this.getUserProfile = this.getUserProfile.bind(this);
    this.getUsers = this.getUsers.bind(this);
    this.suspendUser = this.suspendUser.bind(this);
    this.activateUser = this.activateUser.bind(this);
    this.getUserStats = this.getUserStats.bind(this);
    this.syncUserRegistration = this.syncUserRegistration.bind(this);
    this.syncUserLogin = this.syncUserLogin.bind(this);
    this.syncGuestJob = this.syncGuestJob.bind(this);
    this.syncProfileToJob = this.syncProfileToJob.bind(this);
  }


  /**
   * Create user from Auth0 registration
   * POST /api/auth/sync/register
   * Called by Auth0 Post-Registration Action
   */
  async syncUserRegistration(req, res) {
    try {
      // Validate API secret (not user JWT)
      const authHeader = req.headers.authorization;
      if (!authHeader || authHeader !== `Bearer ${process.env.AUTH0_ACTIONS_SECRET}`) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized - Invalid API secret'
        });
      }

      const { auth0User } = req.body;

      // Extract identity information for new fields
      const identities = auth0User.identities || [];
      const primaryIdentity = identities[0] || {};

      // Create user with identities
      const userData = {
        auth0Id: auth0User.user_id,
        email: auth0User.email?.toLowerCase(),
        emailVerified: auth0User.email_verified || false,
        status: auth0User.email_verified ? 'active' : 'pending',

        // New identity fields
        identities: identities.map(identity => ({
          provider: identity.provider,
          user_id: identity.user_id,
          connection: identity.connection,
          isSocial: identity.provider !== 'auth0'
        })),

        primaryIdentity: {
          provider: primaryIdentity.provider,
          connection: primaryIdentity.connection
        },

        metadata: {
          name: auth0User.name,
          given_name: auth0User.given_name,
          family_name: auth0User.family_name,
          nickname: auth0User.nickname,
          picture: auth0User.picture,
          // locale: auth0User.locale,
          updated_at: new Date()
        },
        // roles: auth0User['https://jomobit.com/roles'] || ['user'],
        // permissions: auth0User.permissions || [],
        lastSyncAt: new Date()
      };

      // Check for existing user by email first (prevent duplicates)
      let existingUser = await this.userService.getUserByEmail(auth0User.email);

      if (existingUser) {
        // Update existing user with new Auth0 identity
        // const updatedUser = await this.userService.addIdentityToUser(
        //   existingUser._id, 
        //   userData
        // );

        // logger.info('User identity linked to existing account', {
        //   userId: updatedUser._id,
        //   email: updatedUser.email,
        //   newProvider: primaryIdentity.provider
        // });

        // return res.json({
        //   success: true,
        //   message: 'Identity linked to existing user',
        //   user: updatedUser,
        //   action: 'linked'
        // });


        // return {
        //   success: true,
        //   user: user.toObject(),
        //   isNewUser,
        //   creditResult,
        //   message: isNewUser ? 'User created successfully' : 'User updated successfully'
        // };

        return res.status(201).json({
          success: true,
          message: 'User already exists - using existing account',
          user: existingUser.toObject(),
          action: 'existing'
        });

      }

      // Create new user
      const newUser = await this.userService.createOrUpdateFromAuth0(userData);

      logger.info('New user created from Auth0 registration', {
        userId: newUser._id,
        auth0Id: newUser.auth0Id,
        email: newUser.email,
        provider: primaryIdentity.provider
      });

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        user: newUser.user,
        action: 'created'
      });

    } catch (error) {
      logger.error('Error syncing user registration:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to sync user registration'
      });
    }
  }

  /**
   * Update user on login
   * POST /api/auth/sync/login  
   * Called by Auth0 Post-Login Action
   */
  async syncUserLogin(req, res) {
    try {
      // Validate API secret
      const authHeader = req.headers.authorization;
      if (!authHeader || authHeader !== `Bearer ${process.env.AUTH0_ACTIONS_SECRET}`) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized - Invalid API secret'
        });
      }

      const { auth0User } = req.body;

      const result = await this.userService.createOrUpdateFromAuth0(auth0User);

      res.json({
        success: true,
        message: 'User updated successfully',
        user: result.user
      });

    } catch (error) {
      if (error.name === 'UserNotFoundError') {
        // User doesn't exist - this shouldn't happen if registration works
        logger.warn('User not found during login sync', {
          auth0Id: req.body.auth0User?.user_id
        });

        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'User not found in database'
        });
      }

      logger.error('Error syncing user login:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to sync user login'
      });
    }
  }

  /**
   * Get current user profile
   * GET /api/auth/me
   */
  async getCurrentUser(req, res) {
    try {
      const { userId: id } = req.user;

      console.log("Middleware breached entered service");



      const result = await this.userService.getUserById(id);

      res.json({
        success: true,
        user: {
          id: result.user._id,
          auth0Id: result.user.auth0Id,
          email: result.user.email,
          status: result.user.status,
          emailVerified: result.user.emailVerified,
          metadata: result.user.metadata,
          roles: result.user.roles,
          permissions: result.user.permissions,
          createdAt: result.user.createdAt,
          lastLoginAt: result.user.lastLoginAt
        }
      });

    } catch (error) {
      if (error.name === 'UserNotFoundError') {
        logger.warn('User not found in database', {
          auth0Id: req.user.id,
          email: req.user.email
        });

        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'User profile not found in database'
        });
      }

      logger.error('Error fetching current user profile:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch user profile'
      });
    }
  }

  /**
   * Update user last login timestamp
   * POST /api/auth/login
   */
  async updateLastLogin(req, res) {
    try {
      const { userId: id } = req.user;

      console.log("Middleware breached entered service");



      const result = await this.userService.getUserById(id);

      logger.info('User login timestamp updated', {
        userId: result.user._id,
        auth0Id,
        email: result.user.email,
        lastLoginAt: result.user.lastLoginAt
      });

      res.json({
        success: true,
        message: 'Login timestamp updated successfully',
        lastLoginAt: result.user.lastLoginAt
      });

    } catch (error) {
      if (error.name === 'UserNotFoundError') {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'User profile not found in database'
        });
      }

      logger.error('Error updating login timestamp:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to update login timestamp'
      });
    }
  }

  /**
   * Get user permissions and roles
   * GET /api/auth/permissions
   */
  async getUserPermissions(req, res) {
    try {
      const { userId: id } = req.user;

      console.log("Middleware breached entered service");



      const result = await this.userService.getUserById(id);

      res.json({
        success: true,
        permissions: {
          roles: result.user.roles || [],
          permissions: result.user.permissions || [],
          isAdmin: result.user.roles?.includes('admin') || false
        }
      });

    } catch (error) {
      if (error.name === 'UserNotFoundError') {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'User profile not found in database'
        });
      }

      logger.error('Error fetching user permissions:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch user permissions'
      });
    }
  }

  /**
   * Get user with credit balance
   * GET /api/auth/profile
   */
  async getUserProfile(req, res) {
    try {

      const { userId: id } = req.user;

      console.log("Middleware breached entered service");

      // Get user with credits
      const result = await this.userService.getUserWithCredits(id);

      // Get business profile count
      const brandsResult = await this.userService.getUserBusinessProfileCount(id);

      // Get user's plan details
      const planDetails = await this.userService.getUserPlanDetails(id);

      res.json({
        success: true,
        profile: {
          user: {
            id: result.user._id,
            auth0Id: result.user.auth0Id,
            email: result.user.email,
            status: result.user.status,
            emailVerified: result.user.emailVerified,
            metadata: result.user.metadata,
            roles: result.user.roles,
            permissions: result.user.permissions,
            createdAt: result.user.createdAt,
            lastLoginAt: result.user.lastLoginAt
          },
          credits: result.credits,
          brands: {
            count: brandsResult.count
          },
          plan: {
            name: planDetails.plan,
            brands_limit: planDetails.brandsLimit,
            tier: planDetails.tier
          }
        }
      });

    } catch (error) {
      if (error.name === 'UserNotFoundError') {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'User profile not found in database'
        });
      }

      logger.error('Error fetching user profile with credits:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch user profile'
      });
    }
  }

  // Admin endpoints

  /**
   * Get all users (Admin only)
   * GET /api/auth/admin/users
   */
  async getUsers(req, res) {
    try {
      const {
        page = 1,
        limit = 50,
        status,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      let result;
      if (search) {
        result = await this.userService.searchUsers(search, {
          limit: parseInt(limit),
          skip,
          status
        });
      } else if (status) {
        result = await this.userService.getUsersByStatus(status, {
          limit: parseInt(limit),
          skip,
          sort
        });
      } else {
        // Get all users with pagination
        const User = require('../models/User');
        const users = await User.find({})
          .sort(sort)
          .limit(parseInt(limit))
          .skip(skip)
          .select('-__v')
          .exec();

        const total = await User.countDocuments({});

        result = {
          success: true,
          users: users.map(user => user.toObject()),
          pagination: {
            total,
            limit: parseInt(limit),
            skip,
            hasMore: skip + users.length < total
          }
        };
      }

      res.json({
        success: true,
        users: result.users,
        pagination: result.pagination || {
          page: parseInt(page),
          limit: parseInt(limit),
          total: result.users.length,
          pages: Math.ceil(result.users.length / parseInt(limit))
        }
      });

    } catch (error) {
      logger.error('Error fetching users for admin:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch users'
      });
    }
  }

  /**
   * Suspend a user (Admin only)
   * POST /api/auth/admin/users/:userId/suspend
   */
  async suspendUser(req, res) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;

      const result = await this.userService.suspendUser(userId, reason);

      logger.info('User suspended by admin', {
        suspendedUserId: userId,
        suspendedUserEmail: result.user.email,
        adminUserId: req.user.id,
        adminEmail: req.user.email,
        reason
      });

      res.json({
        success: true,
        message: 'User suspended successfully',
        user: {
          id: result.user._id,
          email: result.user.email,
          status: result.user.status
        }
      });

    } catch (error) {
      if (error.name === 'UserNotFoundError') {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'User not found in database'
        });
      }

      logger.error('Error suspending user:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to suspend user'
      });
    }
  }

  /**
   * Activate a user (Admin only)
   * POST /api/auth/admin/users/:userId/activate
   */
  async activateUser(req, res) {
    try {
      const { userId } = req.params;

      const result = await this.userService.activateUser(userId);

      logger.info('User activated by admin', {
        activatedUserId: userId,
        activatedUserEmail: result.user.email,
        adminUserId: req.user.id,
        adminEmail: req.user.email
      });

      res.json({
        success: true,
        message: 'User activated successfully',
        user: {
          id: result.user._id,
          email: result.user.email,
          status: result.user.status
        }
      });

    } catch (error) {
      if (error.name === 'UserNotFoundError') {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'User not found in database'
        });
      }

      logger.error('Error activating user:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to activate user'
      });
    }
  }

  /**
   * Get user statistics (Admin only)
   * GET /api/auth/admin/stats
   */
  async getUserStats(req, res) {
    try {
      const result = await this.userService.getUserStats();

      res.json({
        success: true,
        stats: result.stats
      });

    } catch (error) {
      logger.error('Error fetching user statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch user statistics'
      });
    }
  }

  /**
   * Sync guest user job to authenticated user
   * POST /api/auth/sync-guest-job
   * Transfers job ownership from guest user to actual user after signup
   * @access Private (requires authentication)
   */
  async syncGuestJob(req, res) {
    try {
      const { guestUserId } = req.body;
      const actualUserId = req.user.userId; // From JWT token

      logger.info('Starting guest job sync', {
        guestUserId,
        actualUserId,
        operation: 'syncGuestJob'
      });

      // Validate guestUserId
      if (!guestUserId) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Guest user ID is required'
        });
      }

      // Validate ObjectId format
      const mongoose = require('mongoose');
      if (!mongoose.Types.ObjectId.isValid(guestUserId)) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Invalid guest user ID format'
        });
      }

      // Find guest user
      const User = require('../models/User');
      const guestUser = await User.findById(guestUserId);

      if (!guestUser) {
        logger.warn('Guest user not found', { guestUserId });
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Guest user not found'
        });
      }

      // Verify it's actually a guest user
      if (!guestUser.isGuest) {
        logger.warn('User is not a guest user', {
          guestUserId,
          isGuest: guestUser.isGuest
        });
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Provided user ID is not a guest user'
        });
      }

      // Check if guest user is already suspended
      if (guestUser.status === 'suspended') {
        logger.warn('Guest user already suspended', { guestUserId });
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Guest user has already been synced'
        });
      }

      // Find all jobs belonging to guest user
      const GenerationJob = require('../models/GenerationJob');
      const jobs = await GenerationJob.find({ userId: guestUserId });

      if (jobs.length === 0) {
        logger.warn('No jobs found for guest user', { guestUserId });
        // Still suspend the guest user even if no jobs
      }

      // Transfer job ownership
      const updateResult = await GenerationJob.updateMany(
        { userId: guestUserId },
        { $set: { userId: actualUserId } }
      );

      logger.info('Jobs transferred successfully', {
        guestUserId,
        actualUserId,
        jobsTransferred: updateResult.modifiedCount
      });

      // Transfer reservation transactions from guest user to actual user
      const CreditTransaction = require('../models/CreditTransaction');
      const CreditWallet = require('../models/CreditWallet');

      // Find all reservation transactions for the guest user's jobs
      const jobIds = jobs.map(job => job._id.toString());
      const reservationTransactions = await CreditTransaction.find({
        userId: guestUserId,
        type: 'reserve',
        'reference.type': 'generation',
        'reference.id': { $in: jobIds }
      });

      logger.info('Found reservation transactions to transfer', {
        guestUserId,
        actualUserId,
        transactionCount: reservationTransactions.length,
        jobIds
      });

      // Transfer each reservation transaction
      let totalReservedCredits = 0;
      for (const transaction of reservationTransactions) {
        // Update transaction to point to actual user
        transaction.userId = actualUserId;
        await transaction.save();

        totalReservedCredits += transaction.amount;

        logger.info('Reservation transaction transferred', {
          transactionId: transaction._id,
          jobId: transaction.reference.id,
          amount: transaction.amount,
          fromUser: guestUserId,
          toUser: actualUserId
        });
      }

      // Update actual user's wallet to reflect reserved credits
      if (totalReservedCredits > 0) {
        const actualUserWallet = await CreditWallet.findOne({ userId: actualUserId });

        if (actualUserWallet) {
          actualUserWallet.reservedCredits += totalReservedCredits;
          actualUserWallet.lastUpdated = new Date();
          await actualUserWallet.save();

          logger.info('Actual user wallet updated with reserved credits', {
            actualUserId,
            reservedCreditsAdded: totalReservedCredits,
            newReservedCredits: actualUserWallet.reservedCredits,
            totalCredits: actualUserWallet.totalCredits
          });
        } else {
          logger.warn('Actual user wallet not found', { actualUserId });
        }
      }

      // Soft delete guest user (set status to suspended)
      guestUser.status = 'suspended';
      await guestUser.save();

      logger.info('Guest user suspended successfully', {
        guestUserId,
        actualUserId
      });

      // Return success with job details
      const jobDetails = jobs.map(job => ({
        jobId: job._id,
        status: job.status,
        templateId: job.templateId,
        createdAt: job.createdAt
      }));

      res.json({
        success: true,
        message: 'Guest job synced successfully',
        data: {
          jobsTransferred: updateResult.modifiedCount,
          jobs: jobDetails,
          guestUserId,
          actualUserId
        }
      });

    } catch (error) {
      logger.error('Error syncing guest job:', {
        error: error.message,
        stack: error.stack,
        guestUserId: req.body.guestUserId,
        actualUserId: req.user?.userId
      });

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to sync guest job'
      });
    }
  }

  /**
   * Sync profile to job (for trial users after creating first profile)
   * POST /api/auth/sync-profile-to-job
   * @access Private (requires authentication)
   */
  async syncProfileToJob(req, res) {
    try {
      const { jobId, profileId } = req.body;
      const userId = req.user.userId;

      logger.info('Starting profile sync to job', {
        jobId,
        profileId,
        userId,
        operation: 'syncProfileToJob'
      });

      // Validate inputs
      if (!jobId || !profileId) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Job ID and Profile ID are required'
        });
      }

      // Validate ObjectId formats
      const mongoose = require('mongoose');
      if (!mongoose.Types.ObjectId.isValid(jobId) || !mongoose.Types.ObjectId.isValid(profileId)) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Invalid ID format'
        });
      }

      // Find job and verify ownership
      const GenerationJob = require('../models/GenerationJob');
      const job = await GenerationJob.findById(jobId);

      if (!job) {
        logger.warn('Job not found', { jobId });
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Job not found'
        });
      }

      if (job.userId.toString() !== userId) {
        logger.warn('User does not own this job', { jobId, userId, jobUserId: job.userId });
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'You do not have permission to modify this job'
        });
      }

      // Find profile and verify ownership
      const BusinessProfile = require('../models/BusinessProfile');
      const profile = await BusinessProfile.findById(profileId);

      if (!profile) {
        logger.warn('Profile not found', { profileId });
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Profile not found'
        });
      }

      if (profile.userId.toString() !== userId) {
        logger.warn('User does not own this profile', { profileId, userId, profileUserId: profile.userId });
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'You do not have permission to use this profile'
        });
      }

      // Update job with new profile
      job.profileId = profileId;
      await job.save();

      logger.info('Profile synced to job successfully', {
        jobId,
        profileId,
        userId
      });

      res.json({
        success: true,
        message: 'Profile synced to job successfully',
        data: {
          jobId: job._id,
          profileId: job.profileId,
          status: job.status
        }
      });

    } catch (error) {
      logger.error('Error syncing profile to job:', {
        error: error.message,
        stack: error.stack,
        jobId: req.body.jobId,
        profileId: req.body.profileId,
        userId: req.user?.userId
      });

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to sync profile to job'
      });
    }
  }
}

// Export an instance with methods bound to the correct context
module.exports = new AuthController();