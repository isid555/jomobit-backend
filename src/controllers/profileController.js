const ProfileService = require("../services/profileService");
const logger = require("../utils/logger");

/**
 * Profile Controller
 * Handles business profile management endpoints
 */
class ProfileController {
  constructor() {
    this.profileService = new ProfileService();
    // Bind all methods to preserve 'this' context
    this.createProfile = this.createProfile.bind(this);
    this.getUserProfiles = this.getUserProfiles.bind(this);
    this.getProfileById = this.getProfileById.bind(this);
    this.updateProfile = this.updateProfile.bind(this);
    this.deactivateProfile = this.deactivateProfile.bind(this);
    this.activateProfile = this.activateProfile.bind(this);
    this.searchProfiles = this.searchProfiles.bind(this);
    this.getProfileGenerationSummary =
      this.getProfileGenerationSummary.bind(this);
  }

  /**
   * Create a new business profile
   * POST /api/profiles
   */
  async createProfile(req, res) {
    try {
      const userId = req.user.id; // From Auth0 JWT, need to get actual user ID
      const profileData = req.body;

      // Get user by Auth0 ID first
      const UserService = require("../services/userService");
      const userService = new UserService();
      const userResult = await userService.getUserByAuth0Id(userId);
      const actualUserId = userResult.user._id;

      const result = await this.profileService.createProfile(
        actualUserId,
        profileData
      );

      logger.info("Business profile created", {
        userId: actualUserId,
        profileId: result.profile._id,
        profileName: result.profile.name,
      });

      res.status(201).json({
        success: true,
        message: result.message,
        profile: result.profile,
        planInfo: result.planInfo,
      });
    } catch (error) {
      if (error.name === "PlanLimitExceededError") {
        return res.status(403).json({
          success: false,
          error: "Plan limit exceeded",
          message: error.message,
          details: {
            currentCount: error.currentCount,
            limit: error.limit,
            planName: error.planName,
          },
        });
      }

      if (error.name === "ProfileValidationError") {
        return res.status(400).json({
          success: false,
          error: "Validation error",
          message: error.message,
          field: error.field,
        });
      }

      if (error.name === "UserNotFoundError") {
        return res.status(404).json({
          success: false,
          error: "User not found",
          message: "User profile not found in database",
        });
      }

      logger.error("Error creating business profile:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: "Failed to create business profile",
      });
    }
  }

  /**
   * Get user's business profiles
   * GET /api/profiles
   */
  async getUserProfiles(req, res) {
    try {
      const userId = req.user.id;
      const {
        includeInactive = false,
        limit = 50,
        skip = 0,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      // Get user by Auth0 ID first
      const UserService = require("../services/userService");
      const userService = new UserService();
      const userResult = await userService.getUserByAuth0Id(userId);
      const actualUserId = userResult.user._id;

      const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

      const result = await this.profileService.getUserProfiles(actualUserId, {
        includeInactive: includeInactive === "true",
        limit: parseInt(limit),
        skip: parseInt(skip),
        sort,
      });

      res.json({
        success: true,
        profiles: result.profiles,
        planInfo: result.planInfo,
        pagination: result.pagination,
      });
    } catch (error) {
      if (error.name === "UserNotFoundError") {
        return res.status(404).json({
          success: false,
          error: "User not found",
          message: "User profile not found in database",
        });
      }

      logger.error("Error fetching user profiles:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: "Failed to fetch business profiles",
      });
    }
  }

  /**
   * Get business profile by ID
   * GET /api/profiles/:profileId
   */
  async getProfileById(req, res) {
    try {
      const userId = req.user.id;
      const { profileId } = req.params;

      // Get user by Auth0 ID first
      const UserService = require("../services/userService");
      const userService = new UserService();
      const userResult = await userService.getUserByAuth0Id(userId);
      const actualUserId = userResult.user._id;

      const result = await this.profileService.getProfileById(
        actualUserId,
        profileId
      );

      res.json({
        success: true,
        profile: result.profile,
        completeness: result.completeness,
      });
    } catch (error) {
      if (error.name === "ProfileNotFoundError") {
        return res.status(404).json({
          success: false,
          error: "Profile not found",
          message: "Business profile not found or access denied",
        });
      }

      if (error.name === "UserNotFoundError") {
        return res.status(404).json({
          success: false,
          error: "User not found",
          message: "User profile not found in database",
        });
      }

      logger.error("Error fetching profile by ID:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: "Failed to fetch business profile",
      });
    }
  }

  /**
   * Update business profile
   * PUT /api/profiles/:profileId
   */
  async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      const { profileId } = req.params;
      const updates = req.body;

      // Get user by Auth0 ID first
      const UserService = require("../services/userService");
      const userService = new UserService();
      const userResult = await userService.getUserByAuth0Id(userId);
      const actualUserId = userResult.user._id;

      const result = await this.profileService.updateProfile(
        actualUserId,
        profileId,
        updates
      );

      logger.info("Business profile updated", {
        userId: actualUserId,
        profileId,
        updatedFields: result.updatedFields,
      });

      res.json({
        success: true,
        message: result.message,
        profile: result.profile,
        updatedFields: result.updatedFields,
      });
    } catch (error) {
      if (error.name === "ProfileNotFoundError") {
        return res.status(404).json({
          success: false,
          error: "Profile not found",
          message: "Business profile not found or access denied",
        });
      }

      if (error.name === "ProfileValidationError") {
        return res.status(400).json({
          success: false,
          error: "Validation error",
          message: error.message,
          field: error.field,
        });
      }

      if (error.name === "UserNotFoundError") {
        return res.status(404).json({
          success: false,
          error: "User not found",
          message: "User profile not found in database",
        });
      }

      logger.error("Error updating business profile:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: "Failed to update business profile",
      });
    }
  }

  /**
   * Deactivate business profile
   * POST /api/profiles/:profileId/deactivate
   */
  async deactivateProfile(req, res) {
    try {
      const userId = req.user.id;
      const { profileId } = req.params;

      // Get user by Auth0 ID first
      const UserService = require("../services/userService");
      const userService = new UserService();
      const userResult = await userService.getUserByAuth0Id(userId);
      const actualUserId = userResult.user._id;

      const result = await this.profileService.deactivateProfile(
        actualUserId,
        profileId
      );

      logger.info("Business profile deactivated", {
        userId: actualUserId,
        profileId,
      });

      res.json({
        success: true,
        message: result.message,
        profile: result.profile,
      });
    } catch (error) {
      if (error.name === "ProfileNotFoundError") {
        return res.status(404).json({
          success: false,
          error: "Profile not found",
          message: "Business profile not found or access denied",
        });
      }

      if (error.name === "UserNotFoundError") {
        return res.status(404).json({
          success: false,
          error: "User not found",
          message: "User profile not found in database",
        });
      }

      logger.error("Error deactivating business profile:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: "Failed to deactivate business profile",
      });
    }
  }

  /**
   * Activate business profile
   * POST /api/profiles/:profileId/activate
   */
  async activateProfile(req, res) {
    try {
      const userId = req.user.id;
      const { profileId } = req.params;

      // Get user by Auth0 ID first
      const UserService = require("../services/userService");
      const userService = new UserService();
      const userResult = await userService.getUserByAuth0Id(userId);
      const actualUserId = userResult.user._id;

      const result = await this.profileService.activateProfile(
        actualUserId,
        profileId
      );

      logger.info("Business profile activated", {
        userId: actualUserId,
        profileId,
      });

      res.json({
        success: true,
        message: result.message,
        profile: result.profile,
      });
    } catch (error) {
      if (error.name === "ProfileNotFoundError") {
        return res.status(404).json({
          success: false,
          error: "Profile not found",
          message: "Business profile not found or access denied",
        });
      }

      if (error.name === "PlanLimitExceededError") {
        return res.status(403).json({
          success: false,
          error: "Plan limit exceeded",
          message: error.message,
          details: {
            currentCount: error.currentCount,
            limit: error.limit,
            planName: error.planName,
          },
        });
      }

      if (error.name === "UserNotFoundError") {
        return res.status(404).json({
          success: false,
          error: "User not found",
          message: "User profile not found in database",
        });
      }

      logger.error("Error activating business profile:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: "Failed to activate business profile",
      });
    }
  }

  /**
   * Search user's business profiles
   * GET /api/profiles/search
   */
  async searchProfiles(req, res) {
    try {
      const userId = req.user.id;
      const { q: searchText, limit = 20, skip = 0 } = req.query;

      if (!searchText || searchText.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: "Validation error",
          message: "Search text is required",
        });
      }

      // Get user by Auth0 ID first
      const UserService = require("../services/userService");
      const userService = new UserService();
      const userResult = await userService.getUserByAuth0Id(userId);
      const actualUserId = userResult.user._id;

      const result = await this.profileService.searchUserProfiles(
        actualUserId,
        searchText.trim(),
        {
          limit: parseInt(limit),
          skip: parseInt(skip),
        }
      );

      res.json({
        success: true,
        profiles: result.profiles,
        searchText: result.searchText,
        pagination: result.pagination,
      });
    } catch (error) {
      if (error.name === "UserNotFoundError") {
        return res.status(404).json({
          success: false,
          error: "User not found",
          message: "User profile not found in database",
        });
      }

      logger.error("Error searching user profiles:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: "Failed to search business profiles",
      });
    }
  }

  /**
   * Get profile generation summary
   * GET /api/profiles/:profileId/generation-summary
   */
  async getProfileGenerationSummary(req, res) {
    try {
      const userId = req.user.id;
      const { profileId } = req.params;

      // Get user by Auth0 ID first
      const UserService = require("../services/userService");
      const userService = new UserService();
      const userResult = await userService.getUserByAuth0Id(userId);
      const actualUserId = userResult.user._id;

      const result = await this.profileService.getProfileGenerationSummary(
        actualUserId,
        profileId
      );

      res.json({
        success: true,
        generationSummary: result.generationSummary,
        completeness: result.completeness,
        isReadyForGeneration: result.isReadyForGeneration,
      });
    } catch (error) {
      if (error.name === "ProfileNotFoundError") {
        return res.status(404).json({
          success: false,
          error: "Profile not found",
          message: "Business profile not found or access denied",
        });
      }

      if (error.name === "UserNotFoundError") {
        return res.status(404).json({
          success: false,
          error: "User not found",
          message: "User profile not found in database",
        });
      }

      logger.error("Error fetching profile generation summary:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: "Failed to fetch profile generation summary",
      });
    }
  }

  /**
   * Get imagekit auth params
   * GET /api/profiles/imagekit-auth
   */
  async getImageKitAuthParams(req, res) {
    try {
      const ImageKit = require("../utils/imageKit");
      const imageKit = new ImageKit();
      const authParams = await imageKit.getAuthParams();

      // Set headers to prevent caching of the params
      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, private"
      );

      return res.json({
        success: true,
        authenticationParams: authParams,
      });
    } catch (err) {
      logger.error("Error fetching imagekit auth params:", err);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: "Failed to fetch imagekit auth params",
      });
    }
  }
}

module.exports = new ProfileController();
