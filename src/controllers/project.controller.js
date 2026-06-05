const Project = require("../models/Project");
const createActivity = require("../utils/createActivity");
const createNotification = require("../utils/createNotification");
const Task = require("../models/Task");
const User = require("../models/User");

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

const getPagination = (pageQuery, limitQuery) => {
  const page = Math.max(parseInt(pageQuery, 10) || 1, 1);
  const limit = Math.max(parseInt(limitQuery, 10) || 10, 1);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

const createProject = async (req, res) => {
  try {
    const { name, description, deadline, status } = req.body;

    if (!name || !description || !deadline) {
      return res.status(400).json({
        success: false,
        message: "Name, description, and deadline are required",
      });
    }

    if (isPastDate(deadline)) {
      return res.status(400).json({
        success: false,
        message: "Deadline cannot be in the past",
      });
    }

    const project = await Project.create({
      name,
      description,
      deadline,
      status,
      createdBy: req.user._id,
      members: [{ user: req.user._id, role: req.user.role }],
    });

    await createActivity(
      req.user._id,
      "create_project",
      "project",
      project._id,
      `Project "${project.name}" created`
    );

    return res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: project,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getProjects = async (req, res) => {
  try {
    const { search, status, sort } = req.query;
    const { page, limit, skip } = getPagination(req.query.page, req.query.limit);
    const filter = {};
    const sortOptions = {
      latest: { createdAt: -1 },
      nearestDeadline: { deadline: 1 },
      recentlyUpdated: { updatedAt: -1 },
    };

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ name: regex }, { description: regex }];
    }

    if (status) {
      filter.status = status;
    }

    const total = await Project.countDocuments(filter);
    const projects = await Project.find(filter)
      .populate("createdBy", "name email role")
      .populate("members.user", "name email role")
      .sort(sortOptions[sort] || sortOptions.latest)
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      success: true,
      message: "Projects fetched successfully",
      total,
      page,
      pages: Math.ceil(total / limit),
      count: projects.length,
      data: projects,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("createdBy", "name email role")
      .populate("members.user", "name email role");

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Project fetched successfully",
      data: project,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const addMemberToProject = async (req, res) => {
  try {
    const { userId, role } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User is required",
      });
    }

    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const alreadyAdded = project.members.some((member) => {
      return member.user.toString() === userId.toString();
    });

    if (alreadyAdded) {
      return res.status(400).json({
        success: false,
        message: "User already added to this project",
      });
    }

    project.members.push({
      user: userId,
      role: role || "member",
    });

    await project.save();

    await createActivity(
      req.user._id,
      "add_project_member",
      "project",
      project._id,
      `Member "${user.name}" added to project "${project.name}"`
    );

    await createNotification({
      recipient: userId,
      sender: req.user._id,
      type: "project_member_added",
      message: `You have been added to project "${project.name}"`,
      entityType: "project",
      entityId: project._id,
    });

    const updatedProject = await Project.findById(project._id)
      .populate("createdBy", "name email role")
      .populate("members.user", "name email role");

    return res.status(200).json({
      success: true,
      message: "Member added to project successfully",
      data: updatedProject,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getProjectMembers = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("members.user", "name email role");

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Project members fetched successfully",
      data: project.members,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const removeMemberFromProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    project.members = project.members.filter((member) => {
      return member.user.toString() !== req.params.userId.toString();
    });

    await project.save();

    const updatedProject = await Project.findById(project._id)
      .populate("members.user", "name email role");

    return res.status(200).json({
      success: true,
      message: "Member removed from project successfully",
      data: updatedProject.members,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getProjectWorkload = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("members.user", "name email role");

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const tasks = await Task.find({ project: project._id })
      .populate("assignedMember", "name email role");

    const workload = project.members.map((projectMember) => {
      const memberTasks = tasks.filter((task) => {
        return (
          task.assignedMember &&
          task.assignedMember._id.toString() === projectMember.user._id.toString()
        );
      });
      const completedTasks = memberTasks.filter((task) => {
        return task.status === "completed";
      }).length;

      return {
        member: projectMember.user,
        projectRole: projectMember.role,
        totalTasks: memberTasks.length,
        completedTasks,
        pendingTasks: memberTasks.length - completedTasks,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Project workload fetched successfully",
      data: workload,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const updateProject = async (req, res) => {
  try {
    const { name, description, deadline, status } = req.body;

    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    if (deadline && isPastDate(deadline)) {
      return res.status(400).json({
        success: false,
        message: "Deadline cannot be in the past",
      });
    }

    const updatedProject = await Project.findByIdAndUpdate(
      req.params.id,
      { name, description, deadline, status },
      { new: true, runValidators: true }
    )
      .populate("createdBy", "name email role")
      .populate("members.user", "name email role");

    await createActivity(
      req.user._id,
      "update_project",
      "project",
      updatedProject._id,
      `Project "${updatedProject.name}" updated`
    );

    return res.status(200).json({
      success: true,
      message: "Project updated successfully",
      data: updatedProject,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    await createActivity(
      req.user._id,
      "delete_project",
      "project",
      project._id,
      `Project "${project.name}" deleted`
    );

    await project.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Project deleted successfully",
      data: null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createProject,
  getProjects,
  getProjectById,
  addMemberToProject,
  getProjectMembers,
  removeMemberFromProject,
  getProjectWorkload,
  updateProject,
  deleteProject,
};
