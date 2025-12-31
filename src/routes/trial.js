const express = require('express');
const trialController = require('../controllers/trialController');

const router = express.Router();

/**
 * @swagger
 * /trial/templates:
 *   get:
 *     summary: Get featured templates for trial users (No authentication required)
 *     description: |
 *       Retrieve a curated list of featured templates for guest/trial users.
 *       Returns recently added featured templates without requiring authentication.
 *       This endpoint is specifically designed for the trial/guest mode experience.
 *     tags: [Trial]
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: Maximum number of templates to return (default 15, max 50)
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 15
 *           example: 15
 *     responses:
 *       200:
 *         description: Trial templates retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 templates:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Template'
 *                 count:
 *                   type: integer
 *                   example: 15
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/templates', trialController.getTrialTemplates);

module.exports = router;
