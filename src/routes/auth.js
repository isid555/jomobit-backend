const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const User = require('../models/User');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Get current user profile
 * GET /api/auth/me
 * Requires: Valid JWT token
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    // Find user in database
    const user = await User.findByAuth0Id(req.user.id);
    
    if (!user) {
      logger.warn('User not found in database', {
        auth0Id: req.user.id,
        email: req.user.email
      });
      
      return res.status(404).json({
        error: 'User not found',
        message: 'User profile not found in database'
      });
    }

    // Return user profile
    res.json({
      id: user._id,
      auth0Id: user.auth0Id,
      email: user.email,
      status: user.status,
      emailVerified: user.emailVerified,
      metadata: user.metadata,
      roles: user.roles,
      permissions: user.permissions,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt
    });

  } catch (error) {
    logger.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Update user last login timestamp
 * POST /api/auth/login
 * Requires: Valid JWT token
 */
router.post('/login', authenticate, async (req, res) => {
  try {
    const user = await User.findByAuth0Id(req.user.id);
    
    if (!user) {
      logger.warn('User not found for login update', {
        auth0Id: req.user.id,
        email: req.user.email
      });
      
      return res.status(404).json({
        error: 'User not found',
        message: 'User profile not found in database'
      });
    }

    // Update last login timestamp
    await user.updateLastLogin();

    logger.info('User login timestamp updated', {
      userId: user._id,
      auth0Id: user.auth0Id,
      email: user.email,
      lastLoginAt: user.lastLoginAt
    });

    res.json({
      message: 'Login timestamp updated successfully',
      lastLoginAt: user.lastLoginAt
    });

  } catch (error) {
    logger.error('Error updating login timestamp:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get user permissions and roles
 * GET /api/auth/permissions
 * Requires: Valid JWT token
 */
router.get('/permissions', authenticate, async (req, res) => {
  try {
    const user = await User.findByAuth0Id(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User profile not found in database'
      });
    }

    res.json({
      roles: user.roles,
      permissions: user.permissions,
      isAdmin: user.isAdmin()
    });

  } catch (error) {
    logger.error('Error fetching user permissions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Admin endpoint to get all users
 * GET /api/auth/admin/users
 * Requires: Admin role
 */
router.get('/admin/users', authenticate, requireAdmin(), async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      status, 
      sortBy = 'createdAt', 
      sortOrder = 'desc' 
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // Build query
    const query = {};
    if (status) {
      query.status = status;
    }

    // Get users with pagination
    const users = await User.find(query)
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip)
      .select('-__v')
      .exec();

    // Get total count
    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    logger.error('Error fetching users for admin:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Admin endpoint to suspend a user
 * POST /api/auth/admin/users/:userId/suspend
 * Requires: Admin role
 */
router.post('/admin/users/:userId/suspend', authenticate, requireAdmin(), async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User not found in database'
      });
    }

    await user.suspend();

    logger.info('User suspended by admin', {
      suspendedUserId: user._id,
      suspendedUserEmail: user.email,
      adminUserId: req.user.id,
      adminEmail: req.user.email
    });

    res.json({
      message: 'User suspended successfully',
      user: {
        id: user._id,
        email: user.email,
        status: user.status
      }
    });

  } catch (error) {
    logger.error('Error suspending user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Admin endpoint to activate a user
 * POST /api/auth/admin/users/:userId/activate
 * Requires: Admin role
 */
router.post('/admin/users/:userId/activate', authenticate, requireAdmin(), async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User not found in database'
      });
    }

    await user.activate();

    logger.info('User activated by admin', {
      activatedUserId: user._id,
      activatedUserEmail: user.email,
      adminUserId: req.user.id,
      adminEmail: req.user.email
    });

    res.json({
      message: 'User activated successfully',
      user: {
        id: user._id,
        email: user.email,
        status: user.status
      }
    });

  } catch (error) {
    logger.error('Error activating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;