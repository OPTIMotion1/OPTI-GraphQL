// Send unlock command to device 864540081617896
require('dotenv').config();
const { graphqlRequest, sendDeviceCommand, getDeviceCommands } = require('./src/services/voltcred.service');

async function unlockVehicle() {
  const targetIMEI = '864540081617896';
  const deviceId = 461; // From previous check
  
  console.log(`\n=== UNLOCK COMMAND FOR ${targetIMEI} ===\n`);
  
  // First, check current command history
  console.log('[1] Checking current lock state...');
  
  try {
    const commands = await getDeviceCommands(deviceId);
    
    if (commands.length > 0) {
      console.log(`   Found ${commands.length} commands in history\n`);
      
      const recentCommands = commands.slice(0, 3);
      console.log('   Recent commands:');
      recentCommands.forEach((cmd, i) => {
        const statusEmoji = {
          'pending': '⏳',
          'sent': '📤',
          'delivered': '✅',
          'completed': '✓',
          'failed': '❌',
          'superseded': '⊗'
        }[cmd.status] || '•';
        
        console.log(`   ${i + 1}. ${statusEmoji} ${cmd.command_code} - ${cmd.status} (${cmd.execution_time})`);
      });
      
      const latestCmd = commands[0];
      if (latestCmd.command_code === 'engine_cutoff' && 
          (latestCmd.status === 'sent' || latestCmd.status === 'delivered' || latestCmd.status === 'pending')) {
        console.log(`\n   ⚠️  Latest command is LOCK with status "${latestCmd.status}"`);
        console.log(`   Vehicle might be locked. Sending unlock...`);
      } else if (latestCmd.command_code === 'engine_restore') {
        console.log(`\n   ℹ️  Latest command is already UNLOCK`);
        console.log(`   Sending unlock anyway to ensure vehicle is unlocked...`);
      }
    } else {
      console.log('   No command history found\n');
    }
  } catch (err) {
    console.log(`   Could not fetch command history: ${err.message}\n`);
  }
  
  // Send unlock command
  console.log(`\n[2] Sending UNLOCK command to device ${deviceId}...`);
  
  try {
    const result = await sendDeviceCommand(deviceId, 'engine_restore');
    
    console.log('\n✅ UNLOCK COMMAND SENT!\n');
    console.log('Response from VoltCred API:');
    console.log(`   Command ID: ${result.id}`);
    console.log(`   Command Code: ${result.command_code}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Execution Time: ${result.execution_time}`);
    
    if (result.response) {
      console.log(`   Response: ${result.response}\n`);
    }
    
    // Interpret the status
    console.log('\n=== WHAT HAPPENS NEXT ===\n');
    
    if (result.status === 'sent' || result.status === 'pending' || result.status === 'delivered') {
      console.log('✅ Command queued successfully!');
      console.log('   Device will receive the unlock command');
      console.log('   gt06 devices take 10-20 minutes to execute (sleep cycle)');
      console.log('   Vehicle will unlock automatically\n');
      
      console.log('⏰ Timeline:');
      console.log('   Now: Command sent to VoltCred server');
      console.log('   0-5 min: Command waiting in queue');
      console.log('   5-20 min: Device wakes up and receives command');
      console.log('   20 min: Vehicle should be UNLOCKED\n');
    } else if (result.status === 'failed') {
      console.log('❌ Command shows "failed" status');
      console.log('   BUT based on previous testing, command might still execute!');
      console.log('   VoltCred has a status reporting bug');
      console.log('   Check the vehicle physically in 10-20 minutes\n');
      
      if (result.response && result.response.includes('queued')) {
        console.log('✅ Response says "queued" - command is actually working!');
        console.log('   Ignore the "failed" status - this is VoltCred\'s bug\n');
      }
    }
    
    console.log('📱 Check the dashboard to see command status');
    console.log('🚗 Physically check the vehicle in 15-20 minutes\n');
    
  } catch (err) {
    console.error('\n❌ FAILED TO SEND UNLOCK COMMAND\n');
    console.error(`Error: ${err.message}`);
    
    if (err.message.includes('unauthorized') || err.message.includes('permission')) {
      console.error('\n   Issue: Account does not have permission to send commands');
      console.error('   Solution: Contact VoltCred to enable command permission\n');
    } else if (err.message.includes('device not found')) {
      console.error('\n   Issue: Device ID not found in VoltCred system');
      console.error('   Solution: Verify device is properly registered\n');
    } else {
      console.error('\n   This might be a VoltCred API issue');
      console.error('   Try again in a few minutes\n');
    }
    
    process.exit(1);
  }
}

unlockVehicle().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
