const express = require('express');
const subscriptionController = require("../controllers/subscriptionController");
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get("/", authenticate, subscriptionController.getAvailablePlans);

module.exports = router;