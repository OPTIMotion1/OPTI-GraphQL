require('dotenv').config();
const { getAssets, getDeviceCommands } = require('./src/services/voltcred.service');

// Problem vehicles - commands failing and going offline after lock
const PROBLEM_IMEIS = [
  '864540080666142', // J00025
  '864540080667363', // J00032
  '864540081617334', // J00022
  '864540081617771', // J00028
  '864540080376650'  // J00017
];

async function checkProblemVehicles() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 CHECKING PROBLEM VEHICLES - Command History Analysis');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Get all assets
    const result = await getAssets();
    const assets = result.assets || [];
    
    console.log(`📊 Total vehicles in system: ${assets.length}\n`);

    // Find problem vehicles
    for (const imei of PROBLEM_IMEIS) {
      const asset = assets.find(a => a.name === imei || a.iot_devices?.some(d => d.device_id === imei));
      
      if (!asset) {
        console.log(`❌ Vehicle ${imei} NOT FOUND in VoltCred\n`);
        continue;
      }

      const primaryDevice = asset.iot_devices?.find(d => d.is_primary);
      if (!primaryDevice) {
        console.log(`❌ ${imei} - No primary device found\n`);
        continue;
      }

      console.log(`\n${'='.repeat(70)}`);
      console.log(`🚗 Vehicle: ${asset.name === imei ? 'UNMAPPED' : asset.name} (IMEI: ${imei})`);
      console.log(`${'='.repeat(70)}`);
      
      // Connection status
      const connectionStatus = primaryDevice.connection_status || 'unknown';
      const statusEmoji = connectionStatus === 'connected' ? '🟢' : connectionStatus === 'disconnected' ? '🔴' : '⚪';
      console.log(`${statusEmoji} Connection: ${connectionStatus}`);
      console.log(`📍 Last Communication: ${primaryDevice.last_communication || 'Never'}`);
      
      // Hardware state
      const immobilized = asset.state?.immobilized?.value;
      const lockEmoji = immobilized === true ? '🔒' : immobilized === false ? '🔓' : '❓';
      console.log(`${lockEmoji} Immobilizer State: ${immobilized === true ? 'LOCKED' : immobilized === false ? 'UNLOCKED' : 'UNKNOWN'}`);
      
      // Get command history
      console.log(`\n📋 Command History (Device ID: ${primaryDevice.id}):`);
      console.log('─'.repeat(70));
      
      try {
        const commands = await getDeviceCommands(primaryDevice.id);
        
        if (!commands || commands.length === 0) {
          console.log('   No commands found');
        } else {
          console.log(`   Total commands: ${commands.length}\n`);
          
          // Show last 5 commands
          const recentCommands = commands.slice(0, 5);
          
          recentCommands.forEach((cmd, idx) => {
            const statusEmoji = {
              'pending': '⏳',
              'sent': '📤',
              'delivered': '✅',
              'completed': '✅',
              'failed': '❌',
              'timeout': '⏱️',
              'superseded': '🔄'
            }[cmd.status] || '•';
            
            const cmdTime = new Date(cmd.execution_time + 'Z');
            const timeAgo = Math.floor((Date.now() - cmdTime.getTime()) / 1000 / 60);
            const timeStr = timeAgo < 60 ? `${timeAgo}m ago` : 
                           timeAgo < 1440 ? `${Math.floor(timeAgo / 60)}h ago` : 
                           `${Math.floor(timeAgo / 1440)}d ago`;
            
            console.log(`   ${idx + 1}. ${statusEmoji} ${cmd.command_code.toUpperCase()}`);
            console.log(`      Status: ${cmd.status.toUpperCase()}`);
            console.log(`      Time: ${cmdTime.toISOString()} (${timeStr})`);
            if (cmd.response) {
              console.log(`      Response: ${cmd.response}`);
            }
            console.log('');
          });
        }
      } catch (error) {
        console.log(`   ❌ Error fetching commands: ${error.message}`);
      }
    }

    console.log('\n' + '━'.repeat(70));
    console.log('✅ Analysis Complete');
    console.log('━'.repeat(70));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

checkProblemVehicles();
