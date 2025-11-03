const express = require("express");
const { authenticate } = require("../middleware/auth");
const suggestionController = require("../controllers/suggestionController");

const router = express.Router();

// Suggestion management endpoints
router.get("/", authenticate, suggestionController.getAvailableEndpoints);

// Business name suggestion
router.post('/business-names', authenticate, suggestionController.getBusinessNames);

// Tagline suggestion
router.post('/taglines', authenticate, suggestionController.getTaglines);

// Color palette suggestion
router.post('/color-palettes', authenticate, suggestionController.getColorPalettes);

// Font pair suggestion
router.post('/font-pairs', authenticate, suggestionController.getFontPairs);

// product/service suggestion
router.post('/products', authenticate, suggestionController.getProducts);

// Description suggestion
router.post('/description', authenticate, suggestionController.getDescription);

// Logo suggestion
router.post('/generate/logo', authenticate, suggestionController.genLogo);

module.exports = router;