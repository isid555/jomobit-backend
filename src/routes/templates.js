const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const templateController = require('../controllers/templateController');

const router = express.Router();

// Public template endpoints
router.get('/', templateController.getTemplates);
router.get('/search', templateController.searchTemplates);
router.get('/filters', templateController.getFilterOptions);
router.get('/featured', templateController.getFeaturedTemplates);
router.get('/popular', templateController.getPopularTemplates);
router.get('/recent', templateController.getRecentTemplates);
router.get('/:templateId', templateController.getTemplateById);

// Admin template endpoints
router.post('/admin', authenticate, requireAdmin(), templateController.createTemplate);
router.get('/admin', authenticate, requireAdmin(), templateController.getAdminTemplates);
router.get('/admin/stats', authenticate, requireAdmin(), templateController.getTemplateStats);
router.put('/admin/:templateId', authenticate, requireAdmin(), templateController.updateTemplate);
router.delete('/admin/:templateId', authenticate, requireAdmin(), templateController.deleteTemplate);
router.post('/admin/:templateId/toggle-featured', authenticate, requireAdmin(), templateController.toggleFeatured);
router.post('/admin/:templateId/archive', authenticate, requireAdmin(), templateController.archiveTemplate);
router.post('/admin/:templateId/activate', authenticate, requireAdmin(), templateController.activateTemplate);
router.post('/admin/batch-upload', authenticate, requireAdmin(), templateController.batchUploadTemplates);

module.exports = router;