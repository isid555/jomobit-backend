const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const authController = require('../controllers/authController');

const router = express.Router();

// User endpoints
router.get('/me', authenticate, authController.getCurrentUser);
router.post('/login', authenticate, authController.updateLastLogin);
router.get('/permissions', authenticate, authController.getUserPermissions);
router.get('/profile', authenticate, authController.getUserProfile);

// Admin endpoints
router.get('/admin/users', authenticate, requireAdmin(), authController.getUsers);
router.post('/admin/users/:userId/suspend', authenticate, requireAdmin(), authController.suspendUser);
router.post('/admin/users/:userId/activate', authenticate, requireAdmin(), authController.activateUser);
router.get('/admin/stats', authenticate, requireAdmin(), authController.getUserStats);

module.exports = router;