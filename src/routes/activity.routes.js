const express = require("express");
const { getActivities } = require("../controllers/activity.controller");
const { protect } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", protect, getActivities);

module.exports = router;
