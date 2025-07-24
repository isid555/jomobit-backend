const { InsufficientScopeError } = require('express-oauth2-jwt-bearer');
const auth0Config = require('../config/auth0');
const logger = require('../utils/logger');

/**
 * JWT validation middleware using Auth0
 * Validates JWT tokens and extracts user information
 */
const validateAccessToken = auth0Config.createJwtValidator();

/**
 * Permission-based access control middleware
 * Checks if user has required permissions from JWT claims
 * @param {string|string[]} requiredPermissions - Required permission(s)
 * @returns {Function} Express middleware
 */
const checkRequiredPermissions = (requiredPermissions) => {
  return (req, res, next) => {
    try {
      const permissions = req.auth?.permissions || [];
      const requiredPerms = Array.isArray(requiredPermissions) 
        ? requiredPermissions 
        : [requiredPermissions];

      // Check if user has all required permissions
      const hasAllPermissions = requiredPerms.every(permission => 
        permissions.includes(permission)
      );

      if (!hasAllPermissions) {
        logger.warn('Insufficient permissions', {
          userId: req.auth?.sub,
          requiredPermissions: requiredPerms,
          userPermissions: permissions,
          endpoint: req.path,
          method: req.method
        });

        throw new InsufficientScopeError();
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Role-based access control middleware
 * Checks if user has required role from JWT claims
 * @param {string|string[]} requiredRoles - Required role(s)
 * @returns {Function} Express middleware
 */
const checkRequiredRoles = (requiredRoles) => {
  return (req, res, next) => {
    try {
      const userRoles = req.auth?.['https://jomobit.com/roles'] || [];
      const requiredRolesList = Array.isArray(requiredRoles) 
        ? requiredRoles 
        : [requiredRoles];

      // Check if user has at least one of the required roles
      const hasRequiredRole = requiredRolesList.some(role => 
        userRoles.includes(role)
      );

      if (!hasRequiredRole) {
        logger.warn('Insufficient role permissions', {
          userId: req.auth?.sub,
          requiredRoles: requiredRolesList,
          userRoles: userRoles,
          endpoint: req.path,
          method: req.method
        });

        return res.status(403).json({
          error: 'Forbidden',
          message: 'Insufficient role permissions'
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Admin access control middleware
 * Checks if user has admin role
 * @returns {Function} Express middleware
 */
const requireAdmin = () => {
  return checkRequiredRoles(['admin']);
};

/**
 * Optional authentication middleware
 * Validates JWT if present but doesn't require it
 * @returns {Function} Express middleware
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token provided, continue without authentication
    return next();
  }

  // Token provided, validate it
  validateAccessToken(req, res, next);
};

/**
 * Extract user information from JWT
 * Adds user info to request object for easier access
 * @returns {Function} Express middleware
 */
const extractUserInfo = (req, res, next) => {
  try {
    if (req.auth) {
      req.user = {
        id: req.auth.sub,
        email: req.auth['https://jomobit.com/email'] || req.auth.email,
        name: req.auth['https://jomobit.com/name'] || req.auth.name,
        picture: req.auth['https://jomobit.com/picture'] || req.auth.picture,
        roles: req.auth['https://jomobit.com/roles'] || [],
        permissions: req.auth.permissions || [],
        emailVerified: req.auth.email_verified || false
      };

      logger.debug('User authenticated', {
        userId: req.user.id,
        email: req.user.email,
        roles: req.user.roles,
        endpoint: req.path
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to ensure user email is verified
 * @returns {Function} Express middleware
 */
const requireEmailVerified = (req, res, next) => {
  if (!req.user?.emailVerified) {
    logger.warn('Unverified email access attempt', {
      userId: req.user?.id,
      email: req.user?.email,
      endpoint: req.path
    });

    return res.status(403).json({
      error: 'Email verification required',
      message: 'Please verify your email address to access this resource'
    });
  }

  next();
};

/**
 * Combined authentication middleware
 * Validates JWT and extracts user information
 */
const authenticate = [validateAccessToken, extractUserInfo];

/**
 * Combined authentication with email verification
 */
const authenticateWithEmailVerification = [
  validateAccessToken, 
  extractUserInfo, 
  requireEmailVerified
];

module.exports = {
  validateAccessToken,
  checkRequiredPermissions,
  checkRequiredRoles,
  requireAdmin,
  optionalAuth,
  extractUserInfo,
  requireEmailVerified,
  authenticate,
  authenticateWithEmailVerification
};