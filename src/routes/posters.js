const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const posterController = require('../controllers/posterController');

const router = express.Router();

// Poster generation endpoints
router.post('/generate', authenticate, posterController.generatePoster);
router.get('/history', authenticate, posterController.getGenerationHistory);
router.get('/stats', authenticate, posterController.getUserGenerationStats);
router.get('/:jobId', authenticate, posterController.getGenerationJob);
router.post('/:jobId/cancel', authenticate, posterController.cancelGenerationJob);
router.post('/:jobId/retry', authenticate, posterController.retryGenerationJob);
router.get('/:jobId/share', authenticate, posterController.getPosterSharingOptions);
router.get('/:jobId/download', authenticate, posterController.downloadPoster);

// Admin poster endpoints
router.get('/admin', authenticate, requireAdmin(), posterController.getAdminGenerationJobs);
router.get('/admin/stats', authenticate, requireAdmin(), posterController.getAdminGenerationStats);

module.exports = router;