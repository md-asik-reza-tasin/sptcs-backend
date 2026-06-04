const express = require("express");
const { getUsers } = require("../controllers/user.controller");
const { protect } = require("../middleware/auth.middleware");
const { authorize } = require("../middleware/role.middleware");

const router = express.Router();

router.get("/", protect, authorize("admin", "manager"), getUsers);

module.exports = router;
