const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const posterController = require('../controllers/posterController');

const router = express.Router();

// Poster generation endpoints
router.post('/generate', authenticate, posterController.generatePoster.bind(posterController));
router.get('/history', authenticate, posterController.getGenerationHistory.bind(posterController));
router.get('/stats', authenticate, posterController.getUserGenerationStats.bind(posterController));
router.get('/:jobId', authenticate, posterController.getGenerationJob.bind(posterController));
router.get('/:jobId/metadata', authenticate, posterController.getPosterMetadata.bind(posterController));
router.post('/:jobId/cancel', authenticate, posterController.cancelGenerationJob.bind(posterController));
router.post('/:jobId/retry', authenticate, posterController.retryGenerationJob.bind(posterController));
router.get('/:jobId/share', authenticate, posterController.getPosterSharingOptions.bind(posterController));
router.get('/:jobId/download', authenticate, posterController.downloadPoster.bind(posterController));

// Admin poster endpoints
router.get('/admin', authenticate, requireAdmin(), posterController.getAdminGenerationJobs.bind(posterController));
router.get('/admin/stats', authenticate, requireAdmin(), posterController.getAdminGenerationStats.bind(posterController));

module.exports = router;