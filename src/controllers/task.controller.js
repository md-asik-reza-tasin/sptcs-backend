const Task = require("../models/Task");
const Project = require("../models/Project");
const User = require("../models/User");

const allowedStatuses = ["todo", "in_progress", "completed"];
const allowedPriorities = ["high", "medium", "low"];

const isPastDate = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selectedDate = new Date(date);
  selectedDate.setHours(0, 0, 0, 0);

  return selectedDate < today;
};

const escapeRegex = (text) => {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const findDuplicateTaskTitle = (title, project, taskId) => {
  const filter = {
    project,
    title: { $regex: `^${escapeRegex(title)}$`, $options: "i" },
  };

  if (taskId) {
    filter._id = { $ne: taskId };
  }

  return Task.findOne(filter);
};

const populateTask = (query) => {
  return query
    .populate("project", "name status")
    .populate("assignedMember", "name email role")
    .populate("createdBy", "name email role")
    .populate("comments.user", "name email role");
};

const createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      project,
      assignedMember,
      dueDate,
      priority,
      status,
      attachments,
    } = req.body;

    if (!title || !description || !project || !assignedMember || !dueDate) {
      return res.status(400).json({
        success: false,
        message: "Title, description, project, assigned member, and due date are required",
      });
    }

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task status",
      });
    }

    if (priority && !allowedPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task priority",
      });
    }

    const projectExists = await Project.findById(project);

    if (!projectExists) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const assignedUser = await User.findById(assignedMember);

    if (!assignedUser) {
      return res.status(404).json({
        success: false,
        message: "Assigned member not found",
      });
    }

    const duplicateTask = await findDuplicateTaskTitle(title, project);

    if (duplicateTask) {
      return res.status(400).json({
        success: false,
        message: "This task already exists in the project.",
      });
    }

    if (isPastDate(dueDate)) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid deadline.",
      });
    }

    const task = await Task.create({
      title,
      description,
      project,
      assignedMember,
      dueDate,
      priority,
      status,
      attachments,
      createdBy: req.user._id,
    });

    const populatedTask = await populateTask(Task.findById(task._id));

    return res.status(201).json({
      success: true,
      message: "Task created successfully",
      data: populatedTask,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getTasks = async (req, res) => {
  try {
    const { project, status, priority, assignedMember } = req.query;
    const filter = {};

    if (project) filter.project = project;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedMember) filter.assignedMember = assignedMember;

    const tasks = await Task.find(filter)
      .populate("project", "name status")
      .populate("assignedMember", "name email role")
      .populate("createdBy", "name email role")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Tasks fetched successfully",
      data: tasks,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getTaskById = async (req, res) => {
  try {
    const task = await populateTask(Task.findById(req.params.id));

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Task fetched successfully",
      data: task,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const updateTask = async (req, res) => {
  try {
    const { title, description, assignedMember, dueDate, priority, status, attachments } = req.body;

    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task status",
      });
    }

    if (priority && !allowedPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task priority",
      });
    }

    if (title) {
      const duplicateTask = await findDuplicateTaskTitle(title, task.project, task._id);

      if (duplicateTask) {
        return res.status(400).json({
          success: false,
          message: "This task already exists in the project.",
        });
      }
    }

    if (dueDate && isPastDate(dueDate)) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid deadline.",
      });
    }

    if (task.status === "completed" && assignedMember) {
      return res.status(400).json({
        success: false,
        message: "Completed tasks cannot be reassigned.",
      });
    }

    if (assignedMember) {
      const assignedUser = await User.findById(assignedMember);

      if (!assignedUser) {
        return res.status(404).json({
          success: false,
          message: "Assigned member not found",
        });
      }
    }

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      { title, description, assignedMember, dueDate, priority, status, attachments },
      { new: true, runValidators: true }
    )
      .populate("project", "name status")
      .populate("assignedMember", "name email role")
      .populate("createdBy", "name email role")
      .populate("comments.user", "name email role");

    return res.status(200).json({
      success: true,
      message: "Task updated successfully",
      data: updatedTask,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    await task.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Task deleted successfully",
      data: null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task status",
      });
    }

    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    if (
      req.user.role === "member" &&
      task.assignedMember.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to update this task",
      });
    }

    task.status = status;
    await task.save();

    const updatedTask = await populateTask(Task.findById(task._id));

    return res.status(200).json({
      success: true,
      message: "Task status updated successfully",
      data: updatedTask,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const addComment = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Comment message is required",
      });
    }

    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    task.comments.push({
      user: req.user._id,
      message,
    });

    await task.save();

    const updatedTask = await populateTask(Task.findById(task._id));

    return res.status(200).json({
      success: true,
      message: "Comment added successfully",
      data: updatedTask,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  updateTaskStatus,
  addComment,
};
