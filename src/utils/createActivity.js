const ActivityLog = require("../models/ActivityLog");

const createActivity = async (user, action, entityType, entityId, message) => {
  return ActivityLog.create({
    user,
    action,
    entityType,
    entityId,
    message,
  });
};

module.exports = createActivity;
