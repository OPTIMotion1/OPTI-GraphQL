const fs = require('fs');
const path = require('path');

// File-based activity log (persists across restarts)
const LOG_FILE = path.join(__dirname, '..', '..', 'data', 'activity-logs.json');
const NOTIFICATION_LOG_FILE = path.join(__dirname, '..', '..', 'data', 'notification-logs.json');

// Ensure data directory exists
const dataDir = path.dirname(LOG_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize log files if they don't exist
if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(NOTIFICATION_LOG_FILE)) {
  fs.writeFileSync(NOTIFICATION_LOG_FILE, JSON.stringify([], null, 2));
}

// Load existing logs from file
function loadLogs() {
  try {
    const data = fs.readFileSync(LOG_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[ACTIVITY] Error loading logs:', error.message);
    return [];
  }
}

// Save logs to file
function saveLogs(logs) {
  try {
    // Keep only last 10,000 logs to prevent file from growing too large
    const recentLogs = logs.slice(-10000);
    fs.writeFileSync(LOG_FILE, JSON.stringify(recentLogs, null, 2));
  } catch (error) {
    console.error('[ACTIVITY] Error saving logs:', error.message);
  }
}

// Load notification logs
function loadNotificationLogs() {
  try {
    const data = fs.readFileSync(NOTIFICATION_LOG_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[ACTIVITY] Error loading notification logs:', error.message);
    return [];
  }
}

// Save notification logs
function saveNotificationLogs(logs) {
  try {
    // Keep only last 10,000 logs
    const recentLogs = logs.slice(-10000);
    fs.writeFileSync(NOTIFICATION_LOG_FILE, JSON.stringify(recentLogs, null, 2));
  } catch (error) {
    console.error('[ACTIVITY] Error saving notification logs:', error.message);
  }
}

// Log a command
const logCommand = (user, vehicle, commandType, commandResult) => {
  const logs = loadLogs();
  
  const log = {
    id: Date.now() + Math.random(), // Unique ID
    type: 'command',
    timestamp: new Date().toISOString(),
    user_id: user.id,
    user_name: user.name,
    user_role: user.role,
    vehicle_id: vehicle.id,
    vehicle_name: vehicle.name,
    command_type: commandType,
    command_id: commandResult?.id,
    command_status: commandResult?.status || 'failed',
    success: !!commandResult,
    details: {
      result: commandResult
    }
  };

  logs.push(log);
  saveLogs(logs);

  console.log(`[ACTIVITY] ${user.name} (${user.role}) sent ${commandType} to ${vehicle.name} - ${log.success ? 'SUCCESS' : 'FAILED'}`);
  
  return log;
};

// Log a WhatsApp notification
const logNotification = (user, recipients, templateName, campaignId, results) => {
  const notificationLogs = loadNotificationLogs();
  
  const successCount = results.filter(r => r.success).length;
  const failedCount = results.filter(r => !r.success).length;
  
  const log = {
    id: Date.now() + Math.random(),
    type: 'notification',
    timestamp: new Date().toISOString(),
    user_id: user.id,
    user_name: user.name,
    user_role: user.role,
    template_name: templateName,
    campaign_id: campaignId,
    total_recipients: recipients.length,
    success_count: successCount,
    failed_count: failedCount,
    recipients: results.map(r => ({
      phone: r.phone,
      name: r.name,
      success: r.success,
      error: r.error,
      message_id: r.messageId,
      status: r.status
    }))
  };
  
  notificationLogs.push(log);
  saveNotificationLogs(notificationLogs);
  
  console.log(`[ACTIVITY] ${user.name} (${user.role}) sent ${templateName} to ${recipients.length} recipients - ${successCount} success, ${failedCount} failed`);
  
  return log;
};

// Get recent activity logs (commands + notifications combined)
const getRecentLogs = (limit = 50) => {
  const commandLogs = loadLogs();
  const notificationLogs = loadNotificationLogs();
  
  // Combine and sort by timestamp
  const allLogs = [...commandLogs, ...notificationLogs]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
  
  return allLogs;
};

// Get logs for specific user
const getUserLogs = (userId, limit = 50) => {
  const commandLogs = loadLogs();
  const notificationLogs = loadNotificationLogs();
  
  return [...commandLogs, ...notificationLogs]
    .filter(log => log.user_id === userId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
};

// Get logs for specific vehicle
const getVehicleLogs = (vehicleId, limit = 50) => {
  const logs = loadLogs();
  
  return logs
    .filter(log => log.vehicle_id === vehicleId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
};

// Get notification logs only
const getNotificationLogs = (limit = 50) => {
  const logs = loadNotificationLogs();
  
  return logs
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
};

// Get stats
const getActivityStats = () => {
  const commandLogs = loadLogs();
  const notificationLogs = loadNotificationLogs();
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayLogs = commandLogs.filter(log => new Date(log.timestamp) >= today);
  const todayNotifications = notificationLogs.filter(log => new Date(log.timestamp) >= today);
  
  return {
    total_commands: commandLogs.length,
    total_notifications: notificationLogs.length,
    today_commands: todayLogs.length,
    today_notifications: todayNotifications.length,
    today_notifications_sent: todayNotifications.reduce((sum, log) => sum + log.success_count, 0),
    successful_commands: commandLogs.filter(log => log.success).length,
    failed_commands: commandLogs.filter(log => !log.success).length
  };
};

module.exports = {
  logCommand,
  logNotification,
  getRecentLogs,
  getUserLogs,
  getVehicleLogs,
  getNotificationLogs,
  getActivityStats
};
