const Project = require("../models/Project");

const isPastDate = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selectedDate = new Date(date);
  selectedDate.setHours(0, 0, 0, 0);

  return selectedDate < today;
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
    const projects = await Project.find()
      .populate("createdBy", "name email role")
      .populate("members.user", "name email role")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Projects fetched successfully",
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
  updateProject,
  deleteProject,
};
