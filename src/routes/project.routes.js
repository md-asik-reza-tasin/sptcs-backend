const express = require("express");
const {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
} = require("../controllers/project.controller");
const { protect } = require("../middleware/auth.middleware");
const { authorize } = require("../middleware/role.middleware");

const router = express.Router();

router.post("/", protect, authorize("admin", "manager"), createProject);
router.get("/", protect, getProjects);
router.get("/:id", protect, getProjectById);
router.patch("/:id", protect, authorize("admin", "manager"), updateProject);
router.delete("/:id", protect, authorize("admin"), deleteProject);

module.exports = router;
