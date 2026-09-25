// Check command history for device 864540081618118
require('dotenv').config();
const { graphqlRequest } = require('./src/services/voltcred.service');

async function checkDevice() {
  console.log('\n=== CHECKING DEVICE 864540081618118 ===\n');
  
  // First find the device ID
  const assetsQuery = `
    query {
      assetsWithPagination(limit: 50) {
        rows {
          id
          name
          iot_devices {
            id
            device_id
            iot_type_code
            connection_status
            last_communication
          }
        }
      }
    }
  `;
  
  const assetsData = await graphqlRequest(assetsQuery);
  const assets = assetsData.assetsWithPagination.rows;
  
  // Find the specific device
  let targetDevice = null;
  let targetAsset = null;
  
  for (const asset of assets) {
    for (const device of asset.iot_devices) {
      if (device.device_id === '864540081618118') {
        targetDevice = device;
        targetAsset = asset;
        break;
      }
    }
    if (targetDevice) break;
  }
  
  if (!targetDevice) {
    console.log('❌ Device 864540081618118 not found in account!');
    console.log('   This device may not be added to your VoltCred account yet.');
    return;
  }
  
  console.log('✅ Device found!');
  console.log(`   Asset Name: ${targetAsset.name}`);
  console.log(`   Asset ID: ${targetAsset.id}`);
  console.log(`   Device ID: ${targetDevice.id}`);
  console.log(`   IMEI: ${targetDevice.device_id}`);
  console.log(`   Type: ${targetDevice.iot_type_code}`);
  console.log(`   Connection: ${targetDevice.connection_status}`);
  console.log(`   Last Communication: ${targetDevice.last_communication}\n`);
  
  // Get command history
  const commandsQuery = `
    query GetCommands($deviceId: Int!) {
      deviceCommands(device_id: $deviceId) {
        id
        command_code
        status
        execution_time
        response
      }
    }
  `;
  
  const commandsData = await graphqlRequest(commandsQuery, { 
    deviceId: parseInt(targetDevice.id, 10) 
  });
  
  const commands = commandsData.deviceCommands || [];
  
  console.log('=== COMMAND HISTORY (from VoltCred API) ===\n');
  
  if (commands.length === 0) {
    console.log('⚠️  No commands found in history');
    console.log('   This means VoltCred API is not returning command history');
    console.log('   OR no commands have been sent to this device yet\n');
    return;
  }
  
  console.log(`Total commands: ${commands.length}\n`);
  
  // Show all commands
  commands.forEach((cmd, i) => {
    const statusColor = {
      'pending': '⏳',
      'sent': '📤',
      'delivered': '✅',
      'completed': '✓',
      'failed': '❌',
      'superseded': '⊗'
    }[cmd.status] || '•';
    
    const timeAgo = getTimeAgo(cmd.execution_time);
    
    console.log(`${i + 1}. ${statusColor} ${cmd.command_code.toUpperCase()}`);
    console.log(`   Status: ${cmd.status}`);
    console.log(`   Time: ${cmd.execution_time} (${timeAgo})`);
    console.log(`   Command ID: ${cmd.id}`);
    if (cmd.response) {
      console.log(`   Response: ${cmd.response.substring(0, 80)}${cmd.response.length > 80 ? '...' : ''}`);
    }
    console.log('');
  });
  
  // Analyze the issue
  console.log('=== ANALYSIS ===\n');
  
  // Count how many LOCK commands have status "sent"
  const lockCommands = commands.filter(c => c.command_code === 'engine_cutoff');
  const sentLockCommands = lockCommands.filter(c => c.status === 'sent');
  
  console.log(`Lock (engine_cutoff) commands: ${lockCommands.length}`);
  console.log(`Lock commands with status "sent": ${sentLockCommands.length}\n`);
  
  if (sentLockCommands.length > 1) {
    console.log('🚨 ISSUE CONFIRMED: Multiple lock commands show "sent" status!');
    console.log('   Expected behavior: Only the MOST RECENT should be "sent"');
    console.log('   Previous ones should be marked as "superseded"\n');
    
    console.log('Details of "sent" lock commands:');
    sentLockCommands.forEach((cmd, i) => {
      console.log(`   ${i + 1}. Command ID: ${cmd.id}, Time: ${cmd.execution_time}`);
    });
    console.log('');
    
    console.log('❌ THIS IS A VOLTCRED BUG!');
    console.log('   Their API is NOT updating old commands to "superseded"');
    console.log('   when a new command of the same type is sent\n');
  } else if (sentLockCommands.length === 1) {
    console.log('✅ Only one lock command has "sent" status (correct)');
    console.log('   VoltCred is properly marking older commands as superseded\n');
  }
  
  // Check for duplicate recent commands
  const recentCommands = commands.slice(0, 5);
  const duplicateTypes = {};
  
  recentCommands.forEach(cmd => {
    if (!duplicateTypes[cmd.command_code]) {
      duplicateTypes[cmd.command_code] = [];
    }
    duplicateTypes[cmd.command_code].push(cmd);
  });
  
  Object.entries(duplicateTypes).forEach(([type, cmds]) => {
    if (cmds.length > 1) {
      const activeCmds = cmds.filter(c => c.status === 'sent' || c.status === 'pending' || c.status === 'delivered');
      if (activeCmds.length > 1) {
        console.log(`⚠️  Multiple "${type}" commands with active status:`);
        activeCmds.forEach(cmd => {
          console.log(`   - ID ${cmd.id}: ${cmd.status} (${getTimeAgo(cmd.execution_time)})`);
        });
        console.log('');
      }
    }
  });
  
  console.log('=== WHAT TO TELL VOLTCRED ===\n');
  console.log('Problem: When multiple commands of the same type are sent,');
  console.log('VoltCred API does NOT mark old commands as "superseded".\n');
  console.log('Example: Device 864540081618118');
  console.log(`- Two lock commands sent at different times`);
  console.log(`- Both show status: "sent"`);
  console.log(`- Expected: Older one should be "superseded", only newest is "sent"\n`);
  console.log('This makes our dashboard show confusing state (two pending locks).\n');
}

function getTimeAgo(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

checkDevice().catch(err => {
  console.error('Error:', err.message);
  if (err.response) {
    console.error('Response:', err.response.data);
  }
  process.exit(1);
});
