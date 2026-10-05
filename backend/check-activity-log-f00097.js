require('dotenv').config();
const fs = require('fs');
const path = require('path');

const DEVICE_IMEI = '864540081617540';
const DEVICE_ID = 477;

console.log(`Checking activity logs for F00097 (Device ID: ${DEVICE_ID}, IMEI: ${DEVICE_IMEI})...\n`);

// Check if activity log file exists
const activityLogPath = path.join(__dirname, 'data', 'activity-log.json');

if (!fs.existsSync(activityLogPath)) {
  console.log('❌ No activity log file found at:', activityLogPath);
  console.log('This means the backend has not logged any commands yet.');
  process.exit(0);
}

try {
  const logData = fs.readFileSync(activityLogPath, 'utf8');
  const logs = JSON.parse(logData);
  
  console.log(`Total activity logs: ${logs.length}`);
  
  // Filter logs related to F00097 / 864540081617540
  const f00097Logs = logs.filter(log => {
    if (log.type === 'command') {
      return log.deviceId == DEVICE_ID || 
             log.deviceImei === DEVICE_IMEI ||
             (log.details && (
               log.details.deviceId == DEVICE_ID || 
               log.details.deviceImei === DEVICE_IMEI
             ));
    }
    return false;
  });
  
  console.log(`\n=== Commands sent to F00097 (${f00097Logs.length} total) ===\n`);
  
  if (f00097Logs.length === 0) {
    console.log('❌ No commands found in activity log for this device!');
    console.log('\nThis means:');
    console.log('1. Commands were sent before activity logging was implemented');
    console.log('2. Commands were sent directly to VoltCred API (not through our dashboard)');
    console.log('3. The device ID might be different');
  } else {
    f00097Logs.forEach((log, index) => {
      const timestamp = new Date(log.timestamp);
      const minutesAgo = Math.floor((Date.now() - timestamp.getTime()) / 1000 / 60);
      
      console.log(`[${index + 1}] ${log.action || log.commandType}`);
      console.log(`    User: ${log.user?.name || log.userName || 'Unknown'}`);
      console.log(`    Time: ${timestamp.toLocaleString()} (${minutesAgo}m ago)`);
      console.log(`    Command: ${log.commandType || log.details?.commandType || 'N/A'}`);
      console.log(`    Status: ${log.status || log.result || 'N/A'}`);
      if (log.commandId) {
        console.log(`    Command ID: ${log.commandId}`);
      }
      console.log('');
    });
  }
  
  // Show last 5 commands regardless of device
  console.log('\n=== Last 5 Commands (All Devices) ===\n');
  const recentCommands = logs
    .filter(log => log.type === 'command')
    .slice(-5)
    .reverse();
  
  recentCommands.forEach((log, index) => {
    const timestamp = new Date(log.timestamp);
    console.log(`[${index + 1}] Device ${log.deviceId || log.details?.deviceId}: ${log.commandType || log.action}`);
    console.log(`    Time: ${timestamp.toLocaleString()}`);
    console.log(`    User: ${log.user?.name || 'Unknown'}`);
    console.log('');
  });
  
} catch (error) {
  console.error('Error reading activity log:', error.message);
}
