const TemplateService = require("../services/templateService");
const UserService = require("../services/userService");
const ProfileService = require("../services/profileService");
const { GenerationService } = require("../services/generationService");
const Template = require("../models/Template");
const GenerationJob = require("../models/GenerationJob");
const logger = require("../utils/logger");
const BusinessProfile = require('../models/BusinessProfile');
const mongoose = require('mongoose');

/**
 * Trial Controller
 * Handles trial/guest mode endpoints without authentication
 */
class TrialController {
    constructor() {
        this.templateService = new TemplateService();
        this.userService = new UserService();
        this.profileService = new ProfileService();
        this.generationService = new GenerationService();

        // Allowed profile IDs for guest users (MongoDB ObjectIds)
        this.ALLOWED_PROFILE_IDS = [
            '69554734e71d37bfec0aef42', // GUEST_USER_FASHION
            '69554791e71d37bfec0aef44', // GUEST_USER_JEWELLERY
            '695547dfe71d37bfec0aef46', // GUEST_USER_BEAUTY
            '695549fde71d37bfec0aef49', // GUEST_USER_ELECTRONICS
            '69554cb5e71d37bfec0aef4b', // GUEST_USER_FOOD
            '69554d05e71d37bfec0aef4d'  // GUEST_USER_SPORTS
        ];

        // Bind methods to preserve 'this' context
        this.getTrialTemplates = this.getTrialTemplates.bind(this);
        this.generatePosters = this.generatePosters.bind(this);
        this.getJobStatus = this.getJobStatus.bind(this);
    }

    /**
     * Get featured templates for trial users
     * GET /api/trial/templates
     * No authentication required
     */
    async getTrialTemplates(req, res) {
        try {
            const { limit } = req.query;

            logger.info("Fetching trial templates", {
                requestedLimit: limit,
                operation: "getTrialTemplates",
            });

            const result = await this.templateService.getTrialTemplates(
                limit ? parseInt(limit) : undefined
            );

            logger.info("Trial templates fetched successfully", {
                count: result.count,
                operation: "getTrialTemplates",
            });

            res.json({
                success: true,
                templates: result.templates,
                count: result.count,
            });
        } catch (error) {
            logger.error("Error fetching trial templates:", error);
            res.status(500).json({
                success: false,
                error: "Internal server error",
                message: "Failed to fetch trial templates",
            });
        }
    }

    /**
     * Generate posters for guest users
     * POST /api/trial/generate
     * No authentication required
     * Supports retry with existing guestUserId
     */
    async generatePosters(req, res) {
        try {
            const { templateId, profileId, guestUserId } = req.body;

            logger.info("Guest poster generation request", {
                templateId,
                profileId,
                guestUserId: guestUserId || 'new',
                operation: "generatePosters",
            });

            // Validate required fields
            if (!templateId || !profileId) {
                return res.status(400).json({
                    success: false,
                    error: "Validation error",
                    message: "templateId and profileId are required",
                });
            }

            // Validate profile ID is in allowed list
            if (!this.ALLOWED_PROFILE_IDS.includes(profileId)) {
                return res.status(400).json({
                    success: false,
                    error: "Validation error",
                    message: `Invalid profileId. Must be one of the predefined guest profiles.`,
                });
            }

            // Validate template exists and is featured
            const template = await Template.findOne({
                _id: templateId,
                isFeatured: true,
                status: 'active',
                isPublic: true
            });

            if (!template) {
                return res.status(404).json({
                    success: false,
                    error: "Not found",
                    message: "Template not found or not available for trial",
                });
            }

            // Validate profile exists
            const profile = await BusinessProfile.findById(profileId);

            if (!profile || !profile.isActive) {
                return res.status(404).json({
                    success: false,
                    error: "Not found",
                    message: "Profile not found or inactive",
                });
            }

            let userId;
            let isRetry = false;

            // Check if retry with existing guest user
            if (guestUserId && mongoose.Types.ObjectId.isValid(guestUserId)) {
                const User = require('../models/User');
                const existingGuest = await User.findById(guestUserId);

                if (existingGuest && existingGuest.isGuest && existingGuest.status !== 'suspended') {
                    // Reuse existing guest user
                    userId = existingGuest._id;
                    isRetry = true;

                    logger.info("Reusing existing guest user for retry", {
                        guestUserId: userId,
                        templateId,
                        profileId,
                        guestIdentifier: existingGuest.guestIdentifier,
                    });
                } else {
                    // Guest user not found, invalid, or suspended - create new one
                    logger.warn("Guest user not found, invalid, or suspended - creating new one", {
                        providedGuestUserId: guestUserId,
                        exists: !!existingGuest,
                        isGuest: existingGuest?.isGuest,
                        status: existingGuest?.status,
                    });

                    const guestUserResult = await this.userService.createGuestUser();
                    userId = guestUserResult.user._id;
                }
            } else {
                // Create new guest user
                const guestUserResult = await this.userService.createGuestUser();
                const guestUser = guestUserResult.user;
                userId = guestUser._id;

                logger.info("New guest user created", {
                    userId: guestUser._id,
                    guestIdentifier: guestUser.guestIdentifier,
                });
            }

            // Prepare generation context with hardcoded params
            const generationContext = {
                posterType: 'wish',
                diffusionModel: 'midjourney',
                diffusionProvider: 'legnext',
                posterSpecs: {
                    aspectRatio: '1:1',
                    quality: 1
                }
            };

            // Create generation job using the provided profileId
            const jobResult = await this.generationService.createGenerationJob({
                userId: userId,
                profileId: profileId,
                templateId: template._id,
                priority: 'normal',
                creditsRequired: 1,
                generationContext
            }, true); // Pass isGuest = true

            logger.info("Guest generation job created successfully", {
                userId: userId,
                jobId: jobResult.job.id,
                templateId,
                profileId,
                isRetry,
            });

            res.json({
                success: true,
                userId: userId,
                jobId: jobResult.job.id,
                message: "Generation started successfully",
            });

        } catch (error) {
            logger.error("Error generating posters for guest:", {
                error: error.message,
                stack: error.stack,
            });

            // Handle specific error types
            if (error.code === 'INSUFFICIENT_CREDITS') {
                return res.status(400).json({
                    success: false,
                    error: "Insufficient credits",
                    message: error.message,
                });
            }

            res.status(500).json({
                success: false,
                error: "Internal server error",
                message: "Failed to start poster generation",
            });
        }
    }

    /**
     * Get job status for trial users (unauthenticated)
     * GET /api/trial/jobs/:jobId
     * No authentication required
     */
    async getJobStatus(req, res) {
        try {
            const { jobId } = req.params;

            logger.info("Fetching trial job status", {
                jobId,
                operation: "getJobStatus",
            });

            // Validate jobId format
            if (!mongoose.Types.ObjectId.isValid(jobId)) {
                return res.status(400).json({
                    success: false,
                    error: "Validation error",
                    message: "Invalid job ID format",
                });
            }

            // Find job with limited fields (security - don't expose sensitive data)
            const job = await GenerationJob.findById(jobId)
                .select('status progress result.metadata.baseImages result.imageUrl error templateId profileId createdAt updatedAt')
                .lean();

            if (!job) {
                return res.status(404).json({
                    success: false,
                    error: "Not found",
                    message: "Job not found",
                });
            }

            // Prepare response with limited data
            const response = {
                success: true,
                job: {
                    _id: job._id,
                    status: job.status,
                    progress: job.progress || 0,
                    templateId: job.templateId,
                    profileId: job.profileId,
                    createdAt: job.createdAt,
                    updatedAt: job.updatedAt,
                },
            };

            // Add result data based on status
            if (job.status === 'pending' && job.result?.metadata?.baseImages) {
                response.job.result = {
                    metadata: {
                        baseImages: job.result.metadata.baseImages,
                    },
                };
                logger.info("Job in pending state, returning base images", {
                    jobId,
                    baseImagesCount: job.result.metadata.baseImages.length,
                });
            }

            if (job.status === 'completed' && job.result?.imageUrl) {
                response.job.result = {
                    imageUrl: job.result.imageUrl,
                };
                logger.info("Job completed, returning final image", {
                    jobId,
                });
            }

            if (job.status === 'failed') {
                // Return user-friendly error message (don't expose technical details)
                response.job.error = 'Generation failed. Please try again.';
                logger.info("Job failed, returning user-friendly error", {
                    jobId,
                    originalError: job.error?.message,
                });
            }

            logger.info("Trial job status fetched successfully", {
                jobId,
                status: job.status,
                operation: "getJobStatus",
            });

            res.json(response);

        } catch (error) {
            logger.error("Error fetching trial job status:", {
                error: error.message,
                stack: error.stack,
                jobId: req.params.jobId,
            });

            res.status(500).json({
                success: false,
                error: "Internal server error",
                message: "Failed to fetch job status",
            });
        }
    }
}

module.exports = new TrialController();
