const UserService = require('../services/userService');
const logger = require('../utils/logger');

/**
 * Authentication Controller
 * Handles user authentication endpoints
 */
class AuthController {
  constructor() {
    this.userService = new UserService();
  }

  /**
   * Get current user profile
   * GET /api/auth/me
   */
  async getCurrentUser(req, res) {
    try {
      const { id: auth0Id } = req.user;

      const result = await this.userService.getUserByAuth0Id(auth0Id);

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
      const { id: auth0Id } = req.user;

      const result = await this.userService.updateLastLogin(auth0Id);

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
      const { id: auth0Id } = req.user;

      const result = await this.userService.getUserByAuth0Id(auth0Id);

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
      const { id: auth0Id } = req.user;

      // Get user by Auth0 ID first
      const userResult = await this.userService.getUserByAuth0Id(auth0Id);
      
      // Get user with credits
      const result = await this.userService.getUserWithCredits(userResult.user._id);

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
          credits: result.credits
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
}

module.exports = new AuthController();