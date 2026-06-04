const Task = require("../models/Task");
const Project = require("../models/Project");
const User = require("../models/User");
const createActivity = require("../utils/createActivity");

const allowedStatuses = ["todo", "in_progress", "completed"];
const allowedPriorities = ["high", "medium", "low"];
const priorityOrder = { high: 1, medium: 2, low: 3 };

const hasField = (body, field) => {
  return Object.prototype.hasOwnProperty.call(body, field);
};

const isPastDate = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selectedDate = new Date(date);

  if (Number.isNaN(selectedDate.getTime())) {
    return true;
  }

  selectedDate.setHours(0, 0, 0, 0);

  return selectedDate < today;
};

const escapeRegex = (text) => {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const getPagination = (pageQuery, limitQuery) => {
  const page = Math.max(parseInt(pageQuery, 10) || 1, 1);
  const limit = Math.max(parseInt(limitQuery, 10) || 10, 1);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
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

const sendDuplicateTaskResponse = (res) => {
  return res.status(400).json({
    success: false,
    message: "This task already exists in the project.",
  });
};

const sendDeadlineResponse = (res) => {
  return res.status(400).json({
    success: false,
    message: "Please select a valid deadline.",
  });
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

    if (hasField(req.body, "status") && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task status",
      });
    }

    if (hasField(req.body, "priority") && !allowedPriorities.includes(priority)) {
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
      return sendDuplicateTaskResponse(res);
    }

    if (isPastDate(dueDate)) {
      return sendDeadlineResponse(res);
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

    await createActivity(
      req.user._id,
      "create_task",
      "task",
      task._id,
      `Task "${task.title}" created`
    );

    const populatedTask = await populateTask(Task.findById(task._id));

    return res.status(201).json({
      success: true,
      message: "Task created successfully",
      data: populatedTask,
    });
  } catch (error) {
    if (error.code === 11000) {
      return sendDuplicateTaskResponse(res);
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getTasks = async (req, res) => {
  try {
    const {
      search,
      project,
      status,
      priority,
      assignedMember,
      deadlineStatus,
      sort,
    } = req.query;
    const { page, limit, skip } = getPagination(req.query.page, req.query.limit);
    const filter = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ title: regex }, { description: regex }];
    }

    if (project) filter.project = project;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedMember) filter.assignedMember = assignedMember;

    if (deadlineStatus === "overdue") {
      filter.dueDate = { $lt: today };
      filter.status = { $ne: "completed" };
    }

    if (deadlineStatus === "upcoming") {
      filter.dueDate = { $gte: today };
      filter.status = { $ne: "completed" };
    }

    const total = await Task.countDocuments(filter);
    let tasks;

    if (sort === "highestPriority") {
      const allTasks = await Task.find(filter)
        .populate("project", "name status")
        .populate("assignedMember", "name email role")
        .populate("createdBy", "name email role")
        .populate("comments.user", "name email role");

      tasks = allTasks
        .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
        .slice(skip, skip + limit);
    } else {
      const sortOptions = {
        latest: { createdAt: -1 },
        nearestDeadline: { dueDate: 1 },
        recentlyUpdated: { updatedAt: -1 },
      };

      tasks = await Task.find(filter)
        .populate("project", "name status")
        .populate("assignedMember", "name email role")
        .populate("createdBy", "name email role")
        .populate("comments.user", "name email role")
        .sort(sortOptions[sort] || sortOptions.latest)
        .skip(skip)
        .limit(limit);
    }

    return res.status(200).json({
      success: true,
      message: "Tasks fetched successfully",
      total,
      page,
      pages: Math.ceil(total / limit),
      count: tasks.length,
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

    if (hasField(req.body, "status") && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task status",
      });
    }

    if (hasField(req.body, "priority") && !allowedPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task priority",
      });
    }

    if (hasField(req.body, "title")) {
      const duplicateTask = await findDuplicateTaskTitle(title, task.project, task._id);

      if (duplicateTask) {
        return sendDuplicateTaskResponse(res);
      }
    }

    if (hasField(req.body, "dueDate") && isPastDate(dueDate)) {
      return sendDeadlineResponse(res);
    }

    if (task.status === "completed" && hasField(req.body, "assignedMember")) {
      return res.status(400).json({
        success: false,
        message: "Completed tasks cannot be reassigned.",
      });
    }

    if (hasField(req.body, "assignedMember")) {
      const assignedUser = await User.findById(assignedMember);

      if (!assignedUser) {
        return res.status(404).json({
          success: false,
          message: "Assigned member not found",
        });
      }
    }

    const updateData = {};

    if (hasField(req.body, "title")) updateData.title = title;
    if (hasField(req.body, "description")) updateData.description = description;
    if (hasField(req.body, "assignedMember")) updateData.assignedMember = assignedMember;
    if (hasField(req.body, "dueDate")) updateData.dueDate = dueDate;
    if (hasField(req.body, "priority")) updateData.priority = priority;
    if (hasField(req.body, "status")) updateData.status = status;
    if (hasField(req.body, "attachments")) updateData.attachments = attachments;

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate("project", "name status")
      .populate("assignedMember", "name email role")
      .populate("createdBy", "name email role")
      .populate("comments.user", "name email role");

    await createActivity(
      req.user._id,
      "update_task",
      "task",
      updatedTask._id,
      `Task "${updatedTask.title}" updated`
    );

    return res.status(200).json({
      success: true,
      message: "Task updated successfully",
      data: updatedTask,
    });
  } catch (error) {
    if (error.code === 11000) {
      return sendDuplicateTaskResponse(res);
    }

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

    await createActivity(
      req.user._id,
      "delete_task",
      "task",
      task._id,
      `Task "${task.title}" deleted`
    );

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

    await createActivity(
      req.user._id,
      "update_task_status",
      "task",
      task._id,
      `Task "${task.title}" marked as ${status}`
    );

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

    await createActivity(
      req.user._id,
      "add_comment",
      "comment",
      task._id,
      `Comment added on task "${task.title}"`
    );

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
