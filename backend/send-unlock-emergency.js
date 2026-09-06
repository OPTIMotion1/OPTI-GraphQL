#!/usr/bin/env node
require('dotenv').config();
const { sendDeviceCommand } = require('./src/services/voltcred.service');
const { getAssets } = require('./src/services/voltcred.service');

const DEVICE_IMEI = '864540080376247'; // J00011

async function main() {
  try {
    console.log('\n🚨 EMERGENCY UNLOCK');
    console.log('='.repeat(60));
    console.log(`Device IMEI: ${DEVICE_IMEI}\n`);

    // Get device ID
    console.log('1️⃣  Finding device...');
    const result = await getAssets();
    const assets = result.assets || [];
    let deviceId = null;

    for (const asset of assets) {
      for (const device of asset.iot_devices || []) {
        if (device.device_id === DEVICE_IMEI) {
          deviceId = parseInt(device.id);
          console.log(`   ✅ Found device ID: ${deviceId}\n`);
          break;
        }
      }
      if (deviceId) break;
    }

    if (!deviceId) {
      console.log('❌ Device not found\n');
      return;
    }

    // Send unlock command
    console.log('2️⃣  Sending UNLOCK (engine_restore) command...');
    const commandResult = await sendDeviceCommand(deviceId, 'engine_restore');
    
    console.log('─'.repeat(60));
    console.log('📤 COMMAND SENT:');
    console.log('─'.repeat(60));
    console.log(JSON.stringify(commandResult, null, 2));
    
    if (commandResult.id && commandResult.status) {
      console.log('\n✅ UNLOCK COMMAND SENT SUCCESSFULLY!');
      console.log('─'.repeat(60));
      console.log(`📋 Command ID: ${commandResult.id}`);
      console.log(`📊 Status: ${commandResult.status}`);
      console.log(`⏰ Execution Time: ${commandResult.execution_time || 'N/A'}`);
      console.log('─'.repeat(60));
      console.log('⏱️  TIMELINE:');
      console.log('   - Now: Command queued on VoltCred server');
      console.log('   - 10-15 min: Device wakes and receives command');
      console.log('   - 10-15 min: Immobilizer relay deactivated');
      console.log('   - 15-20 min: Vehicle can start engine');
      console.log('');
      console.log('📝 INSTRUCTIONS:');
      console.log('   1. Wait 20 minutes before trying to start');
      console.log('   2. Expected unlock time: ' + new Date(Date.now() + 20 * 60 * 1000).toLocaleTimeString());
      console.log('   3. If engine still won\'t start, wait 5 more minutes');
      console.log('   4. Check dashboard after 20 minutes for status\n');
    } else if (commandResult.success) {
      console.log('\n✅ UNLOCK COMMAND SENT SUCCESSFULLY!');
      console.log('─'.repeat(60));
      console.log('⏱️  TIMELINE:');
      console.log('   - Now: Command queued on VoltCred server');
      console.log('   - 10-15 min: Device wakes and receives command');
      console.log('   - 10-15 min: Immobilizer relay deactivated');
      console.log('   - 15-20 min: Vehicle can start engine');
      console.log('');
      console.log('📝 INSTRUCTIONS:');
      console.log('   1. Wait 20 minutes before trying to start');
      console.log('   2. Expected unlock time: ' + new Date(Date.now() + 20 * 60 * 1000).toLocaleTimeString());
      console.log('   3. If engine still won\'t start, wait 5 more minutes');
      console.log('   4. Check dashboard after 20 minutes for status\n');
    } else {
      console.log('\n❌ UNLOCK COMMAND FAILED!');
      console.log('Error:', commandResult.error || 'Unknown error');
      console.log('\nTry from dashboard instead\n');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

main();
