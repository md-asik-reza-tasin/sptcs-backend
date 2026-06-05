const express = require("express");
const {
  createProject,
  getProjects,
  getProjectById,
  addMemberToProject,
  getProjectMembers,
  removeMemberFromProject,
  getProjectWorkload,
  updateProject,
  deleteProject,
} = require("../controllers/project.controller");
const { protect } = require("../middleware/auth.middleware");
const { authorize } = require("../middleware/role.middleware");

const router = express.Router();

router.post("/", protect, authorize("admin", "manager"), createProject);
router.get("/", protect, getProjects);
router.post("/:id/members", protect, authorize("admin", "manager"), addMemberToProject);
router.get("/:id/members", protect, getProjectMembers);
router.delete("/:id/members/:userId", protect, authorize("admin", "manager"), removeMemberFromProject);
router.get("/:id/workload", protect, getProjectWorkload);
router.get("/:id", protect, getProjectById);
router.patch("/:id", protect, authorize("admin", "manager"), updateProject);
router.delete("/:id", protect, authorize("admin"), deleteProject);

module.exports = router;
