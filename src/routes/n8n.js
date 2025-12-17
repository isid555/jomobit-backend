const express = require("express");
const { verifyN8NRequestKey } = require("../middleware/n8n");
const n8nController = require("../controllers/n8nController");

const router = express.Router();

router.patch(
  "/job/status",
  verifyN8NRequestKey,
  n8nController.updateJobStatus.bind(n8nController)
);

module.exports = router;