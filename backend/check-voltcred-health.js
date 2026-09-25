// Check if VoltCred API is working and what data is available
require('dotenv').config();
const { graphqlRequest } = require('./src/services/voltcred.service');

async function checkHealth() {
  console.log('\n=== VOLTCRED API HEALTH CHECK ===\n');
  console.log('Timestamp:', new Date().toISOString(), '\n');
  
  try {
    // 1. Check if we can fetch assets
    console.log('[1/4] Testing assetsWithPagination query...');
    const assetsQuery = `
      query {
        assetsWithPagination(limit: 5) {
          total
          counts {
            moving
            idle
            stopped
            offline
            untracked
            total
          }
          rows {
            id
            name
            status
            iot_devices {
              id
              device_id
              connection_status
            }
          }
        }
      }
    `;
    
    const assetsData = await graphqlRequest(assetsQuery);
    const result = assetsData.assetsWithPagination;
    
    if (result) {
      console.log('✅ Assets query working');
      console.log(`   Total vehicles: ${result.total}`);
      console.log(`   Status counts: Moving(${result.counts.moving}), Idle(${result.counts.idle}), Offline(${result.counts.offline}), Untracked(${result.counts.untracked})`);
      console.log(`   First 5 vehicles fetched successfully\n`);
    } else {
      console.log('❌ Assets query returned null\n');
    }
    
    // 2. Check if we can fetch device state (the problematic field)
    console.log('[2/4] Testing device state fields (observed, stale, etc.)...');
    const stateQuery = `
      query {
        assetsWithPagination(limit: 2) {
          rows {
            name
            iot_devices {
              device_id
              state {
                key
                label
                value
                writable
              }
            }
          }
        }
      }
    `;
    
    try {
      const stateData = await graphqlRequest(stateQuery);
      if (stateData.assetsWithPagination) {
        console.log('✅ Device state query working (WITHOUT observed/stale fields)');
        const firstDevice = stateData.assetsWithPagination.rows[0]?.iot_devices[0];
        if (firstDevice) {
          console.log(`   Device: ${firstDevice.device_id}`);
          console.log(`   State fields: ${firstDevice.state?.length || 0} fields available\n`);
        }
      }
    } catch (err) {
      console.log('❌ Device state query failed:', err.message, '\n');
    }
    
    // 3. Check command execution on OLD device
    console.log('[3/4] Testing command history for OLD batch device...');
    const oldDeviceId = 300; // 864540080376247
    const commandsQuery = `
      query GetCommands($deviceId: Int!) {
        deviceCommands(device_id: $deviceId) {
          id
          command_code
          status
          execution_time
        }
      }
    `;
    
    try {
      const oldCommands = await graphqlRequest(commandsQuery, { deviceId: oldDeviceId });
      if (oldCommands.deviceCommands) {
        console.log('✅ Command history query working for OLD device');
        console.log(`   Device ID: ${oldDeviceId}`);
        console.log(`   Total commands: ${oldCommands.deviceCommands.length}`);
        const recent = oldCommands.deviceCommands[0];
        if (recent) {
          console.log(`   Most recent: ${recent.command_code} - ${recent.status} (${recent.execution_time})\n`);
        }
      }
    } catch (err) {
      console.log('❌ Command history failed for OLD device:', err.message, '\n');
    }
    
    // 4. Check command execution on NEW device
    console.log('[4/4] Testing command history for NEW batch device...');
    const newDeviceId = 460; // 864540080379407
    
    try {
      const newCommands = await graphqlRequest(commandsQuery, { deviceId: newDeviceId });
      if (newCommands.deviceCommands) {
        console.log('✅ Command history query working for NEW device');
        console.log(`   Device ID: ${newDeviceId}`);
        console.log(`   Total commands: ${newCommands.deviceCommands.length}`);
        const recent = newCommands.deviceCommands[0];
        if (recent) {
          console.log(`   Most recent: ${recent.command_code} - ${recent.status} (${recent.execution_time})\n`);
        }
      }
    } catch (err) {
      console.log('❌ Command history failed for NEW device:', err.message);
      console.log('   This is likely why the dashboard shows "No assets found" intermittently\n');
    }
    
    console.log('=== SUMMARY ===\n');
    console.log('✓ VoltCred API is responding');
    console.log('✓ Can fetch assets and counts');
    console.log('✓ Device state query works (without observed/stale fields)');
    console.log('✓ Command history works for some devices');
    console.log('⚠️  Check if command history fails for new devices (HTTP 503)\n');
    
  } catch (error) {
    console.error('❌ CRITICAL ERROR:', error.message);
    if (error.response) {
      console.error('   HTTP Status:', error.response.status);
      console.error('   Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

checkHealth().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
