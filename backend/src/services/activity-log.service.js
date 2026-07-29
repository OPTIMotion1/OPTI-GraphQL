// In-memory activity log (replace with database in production)
const activityLogs = [];

// Log a command
const logCommand = (user, vehicle, commandType, commandResult) => {
  const log = {
    id: activityLogs.length + 1,
    timestamp: new Date().toISOString(),
    user_id: user.id,
    user_name: user.name,
    user_role: user.role,
    vehicle_id: vehicle.id,
    vehicle_name: vehicle.name,
    command_type: commandType,
    command_id: commandResult?.id,
    command_status: commandResult?.status,
    success: !!commandResult
  };

  activityLogs.push(log);
  
  // Keep only last 1000 logs in memory
  if (activityLogs.length > 1000) {
    activityLogs.shift();
  }

  console.log(`[ACTIVITY] ${user.name} (${user.role}) sent ${commandType} to ${vehicle.name}`);
  
  return log;
};

// Get recent activity logs
const getRecentLogs = (limit = 50) => {
  return activityLogs.slice(-limit).reverse();
};

// Get logs for specific user
const getUserLogs = (userId, limit = 50) => {
  return activityLogs
    .filter(log => log.user_id === userId)
    .slice(-limit)
    .reverse();
};

// Get logs for specific vehicle
const getVehicleLogs = (vehicleId, limit = 50) => {
  return activityLogs
    .filter(log => log.vehicle_id === vehicleId)
    .slice(-limit)
    .reverse();
};

module.exports = {
  logCommand,
  getRecentLogs,
  getUserLogs,
  getVehicleLogs
};
