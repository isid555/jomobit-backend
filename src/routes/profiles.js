const express = require('express');
const { authenticate } = require('../middleware/auth');
const profileController = require('../controllers/profileController');

const router = express.Router();

// Profile management endpoints
router.post('/', authenticate, profileController.createProfile);
router.get('/', authenticate, profileController.getUserProfiles);
router.get('/search', authenticate, profileController.searchProfiles);
router.get('/:profileId', authenticate, profileController.getProfileById);
router.put('/:profileId', authenticate, profileController.updateProfile);
router.post('/:profileId/deactivate', authenticate, profileController.deactivateProfile);
router.post('/:profileId/activate', authenticate, profileController.activateProfile);
router.get('/:profileId/generation-summary', authenticate, profileController.getProfileGenerationSummary);

module.exports = router;