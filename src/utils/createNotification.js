const Notification = require("../models/Notification");

const createNotification = async ({
  recipient,
  sender,
  type,
  message,
  entityType,
  entityId,
}) => {
  if (!recipient || !type || !message) {
    return null;
  }

  return Notification.create({
    recipient,
    sender,
    type,
    message,
    entityType,
    entityId,
  });
};

module.exports = createNotification;
