const express = require("express");
const {
  createTask,
  getTasks,
  getMyTasks,
  getMemberTasks,
  getTaskById,
  updateTask,
  deleteTask,
  updateTaskStatus,
  addComment,
} = require("../controllers/task.controller");
const { protect } = require("../middleware/auth.middleware");
const { authorize } = require("../middleware/role.middleware");

const router = express.Router();

router.post("/", protect, authorize("admin", "manager"), createTask);
router.get("/", protect, getTasks);
router.get("/my-tasks", protect, getMyTasks);
router.get("/member/:memberId", protect, getMemberTasks);
router.get("/:id", protect, getTaskById);
router.patch("/:id", protect, authorize("admin", "manager"), updateTask);
router.delete("/:id", protect, authorize("admin", "manager"), deleteTask);
router.patch("/:id/status", protect, updateTaskStatus);
router.post("/:id/comments", protect, addComment);

module.exports = router;
