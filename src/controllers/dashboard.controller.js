const Project = require("../models/Project");
const Task = require("../models/Task");
const ActivityLog = require("../models/ActivityLog");

const formatCountMap = (items, keys) => {
  const result = {};

  keys.forEach((key) => {
    result[key] = 0;
  });

  items.forEach((item) => {
    result[item._id] = item.count;
  });

  return result;
};

const getDashboardSummary = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalProjects = await Project.countDocuments();
    const totalTasks = await Task.countDocuments();
    const completedTasks = await Task.countDocuments({ status: "completed" });
    const pendingTasks = await Task.countDocuments({ status: { $ne: "completed" } });
    const overdueTasks = await Task.countDocuments({
      dueDate: { $lt: today },
      status: { $ne: "completed" },
    });

    const recentActivities = await ActivityLog.find()
      .populate("user", "name email role")
      .sort({ createdAt: -1 })
      .limit(10);

    const upcomingDeadlines = await Task.find({
      dueDate: { $gte: today },
      status: { $ne: "completed" },
    })
      .populate("project", "name")
      .populate("assignedMember", "name email")
      .sort({ dueDate: 1 })
      .limit(5);

    const highPriorityTasks = await Task.find({
      priority: "high",
      status: { $ne: "completed" },
    })
      .populate("project", "name")
      .populate("assignedMember", "name email")
      .sort({ createdAt: -1 })
      .limit(5);

    const priorityAggregation = await Task.aggregate([
      {
        $group: {
          _id: "$priority",
          count: { $sum: 1 },
        },
      },
    ]);

    const statusAggregation = await Task.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const memberWorkload = await Task.aggregate([
      {
        $group: {
          _id: "$assignedMember",
          totalTasks: { $sum: 1 },
          completedTasks: {
            $sum: {
              $cond: [{ $eq: ["$status", "completed"] }, 1, 0],
            },
          },
          pendingTasks: {
            $sum: {
              $cond: [{ $ne: ["$status", "completed"] }, 1, 0],
            },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "member",
        },
      },
      { $unwind: "$member" },
      {
        $project: {
          _id: 0,
          member: {
            _id: "$member._id",
            name: "$member.name",
            email: "$member.email",
          },
          totalTasks: 1,
          completedTasks: 1,
          pendingTasks: 1,
        },
      },
      { $sort: { totalTasks: -1 } },
    ]);

    return res.status(200).json({
      success: true,
      message: "Dashboard summary fetched successfully",
      data: {
        totalProjects,
        totalTasks,
        completedTasks,
        pendingTasks,
        overdueTasks,
        recentActivities,
        upcomingDeadlines,
        highPriorityTasks,
        tasksByPriority: formatCountMap(priorityAggregation, ["high", "medium", "low"]),
        taskStatusDistribution: formatCountMap(statusAggregation, [
          "todo",
          "in_progress",
          "completed",
        ]),
        memberWorkload,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getDashboardSummary,
};
