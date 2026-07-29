const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const LOGS_FILE = path.join(__dirname, '../../data/cutoff-logs.json');
const MAX_RETRIES = 3;

/**
 * Ensure data directory and logs file exist
 */
async function ensureLogsFileExists() {
  try {
    const dataDir = path.dirname(LOGS_FILE);
    await fs.mkdir(dataDir, { recursive: true });
    
    try {
      await fs.access(LOGS_FILE);
    } catch {
      // File doesn't exist, create it
      await fs.writeFile(LOGS_FILE, JSON.stringify({ logs: [] }, null, 2));
    }
  } catch (error) {
    console.error('Error ensuring logs file exists:', error);
    throw error;
  }
}

/**
 * Read all cutoff logs
 * @returns {Promise<Array>} List of cutoff logs
 */
async function readLogs() {
  await ensureLogsFileExists();
  try {
    const data = await fs.readFile(LOGS_FILE, 'utf8');
    const parsed = JSON.parse(data);
    return parsed.logs || [];
  } catch (error) {
    console.error('Error reading logs:', error);
    return [];
  }
}

/**
 * Write logs to file
 * @param {Array} logs - Array of log entries
 */
async function writeLogs(logs) {
  await ensureLogsFileExists();
  await fs.writeFile(LOGS_FILE, JSON.stringify({ logs }, null, 2));
}

/**
 * Check if cutoff was already attempted for a rental
 * @param {string} rentalId - Rental ID to check
 * @returns {Promise<Object|null>} Existing log entry or null
 */
async function findExistingCutoff(rentalId) {
  const logs = await readLogs();
  return logs.find(log => log.rentalId === rentalId) || null;
}

/**
 * Check if rental is eligible for cutoff (not already successful or max retries exceeded)
 * @param {string} rentalId - Rental ID to check
 * @returns {Promise<{eligible: boolean, reason: string, existingLog: Object|null}>}
 */
async function isEligibleForCutoff(rentalId) {
  const existingLog = await findExistingCutoff(rentalId);
  
  if (!existingLog) {
    return { eligible: true, reason: 'No previous cutoff attempt', existingLog: null };
  }
  
  if (existingLog.cutoffStatus === 'success') {
    return { 
      eligible: false, 
      reason: 'Vehicle already immobilized', 
      existingLog 
    };
  }
  
  if (existingLog.retryCount >= MAX_RETRIES) {
    return { 
      eligible: false, 
      reason: `Max retries (${MAX_RETRIES}) exceeded`, 
      existingLog 
    };
  }
  
  // Failed or pending - eligible for retry
  return { 
    eligible: true, 
    reason: `Retry attempt ${existingLog.retryCount + 1}/${MAX_RETRIES}`, 
    existingLog 
  };
}

/**
 * Log a cutoff attempt
 * @param {Object} cutoffData - Cutoff attempt data
 * @returns {Promise<Object>} Created/updated log entry
 */
async function logCutoffAttempt(cutoffData) {
  const {
    rentalId,
    vehicleId,
    deviceId,
    deviceImei,
    overdueDate,
    overdueDays,
    cutoffStatus,
    commandId,
    voltCredResponse,
    error
  } = cutoffData;
  
  const logs = await readLogs();
  const existingIndex = logs.findIndex(log => log.rentalId === rentalId);
  
  const timestamp = new Date().toISOString();
  
  if (existingIndex >= 0) {
    // Update existing log
    const existing = logs[existingIndex];
    logs[existingIndex] = {
      ...existing,
      cutoffStatus,
      commandId: commandId || existing.commandId,
      voltCredResponse: voltCredResponse || existing.voltCredResponse,
      retryCount: existing.retryCount + 1,
      lastAttemptAt: timestamp,
      lastError: error || null,
      updatedAt: timestamp
    };
    await writeLogs(logs);
    return logs[existingIndex];
  } else {
    // Create new log
    const newLog = {
      id: uuidv4(),
      rentalId,
      vehicleId,
      deviceId,
      deviceImei,
      overdueDate,
      overdueDays,
      cutoffAttemptedAt: timestamp,
      lastAttemptAt: timestamp,
      cutoffStatus,
      commandId: commandId || null,
      voltCredResponse: voltCredResponse || null,
      retryCount: 0,
      lastError: error || null,
      notificationSent: false,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    
    logs.push(newLog);
    await writeLogs(logs);
    return newLog;
  }
}

/**
 * Get all cutoff logs with optional filtering
 * @param {Object} filters - Optional filters (status, rentalId, etc.)
 * @returns {Promise<Array>} Filtered logs
 */
async function getCutoffLogs(filters = {}) {
  const logs = await readLogs();
  
  if (!filters || Object.keys(filters).length === 0) {
    return logs;
  }
  
  return logs.filter(log => {
    if (filters.status && log.cutoffStatus !== filters.status) return false;
    if (filters.rentalId && log.rentalId !== filters.rentalId) return false;
    if (filters.vehicleId && log.vehicleId !== filters.vehicleId) return false;
    return true;
  });
}

/**
 * Reset cutoff status for a rental (for manual intervention)
 * @param {string} rentalId - Rental ID to reset
 * @returns {Promise<boolean>} Success status
 */
async function resetCutoffStatus(rentalId) {
  const logs = await readLogs();
  const index = logs.findIndex(log => log.rentalId === rentalId);
  
  if (index === -1) {
    return false;
  }
  
  logs.splice(index, 1);
  await writeLogs(logs);
  return true;
}

/**
 * Get cutoff statistics
 * @returns {Promise<Object>} Statistics summary
 */
async function getCutoffStats() {
  const logs = await readLogs();
  
  return {
    total: logs.length,
    successful: logs.filter(l => l.cutoffStatus === 'success').length,
    failed: logs.filter(l => l.cutoffStatus === 'failed').length,
    pending: logs.filter(l => l.cutoffStatus === 'pending').length,
    maxRetriesExceeded: logs.filter(l => l.retryCount >= MAX_RETRIES).length,
    recentAttempts: logs
      .filter(l => {
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return new Date(l.lastAttemptAt) > dayAgo;
      })
      .length
  };
}

module.exports = {
  findExistingCutoff,
  isEligibleForCutoff,
  logCutoffAttempt,
  getCutoffLogs,
  resetCutoffStatus,
  getCutoffStats,
  MAX_RETRIES
};
