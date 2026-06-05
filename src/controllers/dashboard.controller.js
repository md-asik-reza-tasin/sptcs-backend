const Project = require("../models/Project");
const Task = require("../models/Task");
const ActivityLog = require("../models/ActivityLog");

const priorityLabels = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const statusLabels = {
  todo: "Todo",
  in_progress: "In Progress",
  completed: "Completed",
};

const formatChartCounts = (items, keys, labels) => {
  return keys.map((key) => {
    const item = items.find((entry) => entry._id === key);

    return {
      name: labels[key],
      value: item?.count || 0,
    };
  });
};

const getDashboardSummary = async (req, res) => {
  try {
    const isMember = req.user.role === "member";
    const taskFilter = isMember ? { assignedMember: req.user._id } : {};
    const openTaskFilter = {
      ...taskFilter,
      status: { $ne: "completed" },
    };
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalProjects = isMember
      ? await Project.countDocuments({ "members.user": req.user._id })
      : await Project.countDocuments();
    const totalTasks = await Task.countDocuments(taskFilter);
    const completedTasks = await Task.countDocuments({
      ...taskFilter,
      status: "completed",
    });
    const pendingTasks = await Task.countDocuments({
      ...taskFilter,
      status: "todo",
    });
    const overdueTasks = await Task.countDocuments({
      ...openTaskFilter,
      dueDate: { $lt: today },
    });

    const recentActivities = isMember
      ? []
      : await ActivityLog.find()
          .populate("user", "name email role")
          .sort({ createdAt: -1 })
          .limit(10);

    const upcomingDeadlines = await Task.find({
      ...openTaskFilter,
      dueDate: { $gte: today },
    })
      .populate("project", "name")
      .populate("assignedMember", "name email")
      .sort({ dueDate: 1 })
      .limit(5);

    const highPriorityTasks = await Task.find({
      ...openTaskFilter,
      priority: "high",
    })
      .populate("project", "name")
      .populate("assignedMember", "name email")
      .sort({ createdAt: -1 })
      .limit(5);

    const priorityAggregation = await Task.aggregate([
      { $match: taskFilter },
      {
        $group: {
          _id: "$priority",
          count: { $sum: 1 },
        },
      },
    ]);

    const statusAggregation = await Task.aggregate([
      { $match: taskFilter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const memberWorkload = await Task.aggregate([
      { $match: taskFilter },
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
            role: "$member.role",
          },
          totalTasks: 1,
          completedTasks: 1,
          pendingTasks: 1,
        },
      },
      { $sort: { totalTasks: -1 } },
      { $limit: isMember ? 1 : 8 },
    ]);

    const projectProgressTrend = await Task.aggregate([
      { $match: taskFilter },
      {
        $group: {
          _id: "$project",
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
          from: "projects",
          localField: "_id",
          foreignField: "_id",
          as: "project",
        },
      },
      { $unwind: "$project" },
      { $sort: { "project.createdAt": -1 } },
      { $limit: 8 },
      {
        $project: {
          _id: 0,
          projectName: "$project.name",
          totalTasks: 1,
          completedTasks: 1,
          pendingTasks: 1,
          progress: {
            $cond: [
              { $eq: ["$totalTasks", 0] },
              0,
              {
                $round: [
                  {
                    $multiply: [
                      { $divide: ["$completedTasks", "$totalTasks"] },
                      100,
                    ],
                  },
                  0,
                ],
              },
            ],
          },
        },
      },
    ]);

    const teamProductivityOverview = memberWorkload.map((item) => {
      const completionRate = item.totalTasks === 0
        ? 0
        : Math.round((item.completedTasks / item.totalTasks) * 100);

      return {
        memberName: item.member?.name || "Unknown",
        email: item.member?.email || "",
        totalTasks: item.totalTasks,
        completedTasks: item.completedTasks,
        pendingTasks: item.pendingTasks,
        completionRate,
      };
    });

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
        tasksByPriority: formatChartCounts(
          priorityAggregation,
          ["high", "medium", "low"],
          priorityLabels
        ),
        taskStatusDistribution: formatChartCounts(
          statusAggregation,
          ["todo", "in_progress", "completed"],
          statusLabels
        ),
        memberWorkload,
        projectProgressTrend,
        teamProductivityOverview,
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
