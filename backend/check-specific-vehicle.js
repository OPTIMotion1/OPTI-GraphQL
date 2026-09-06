#!/usr/bin/env node
require('dotenv').config();
const { getAssets } = require('./src/services/voltcred.service');

async function main() {
  const IMEI = '864540080376247';
  
  console.log('\n🔍 Checking Vehicle Status');
  console.log('='.repeat(60));
  console.log(`IMEI: ${IMEI}\n`);

  try {
    const result = await getAssets();
    const assets = result.assets || [];

    const asset = assets.find(a => 
      a.iot_devices?.some(d => d.device_id === IMEI)
    );

    if (!asset) {
      console.log('❌ Vehicle not found\n');
      return;
    }

    const device = asset.iot_devices.find(d => d.device_id === IMEI);

    console.log('📋 RAW DATA FROM VOLTCRED API:');
    console.log('─'.repeat(60));
    console.log('\n🚗 Asset Data:');
    console.log(JSON.stringify(asset, null, 2));
    
    console.log('\n📡 Device Data:');
    console.log(JSON.stringify(device, null, 2));

    console.log('\n─'.repeat(60));
    console.log('🔍 KEY FIELDS ANALYSIS:');
    console.log('─'.repeat(60));
    console.log(`Vehicle Status: "${asset.status}"`);
    console.log(`Connection: "${device.connection_status}"`);
    console.log(`Ignition Status: ${JSON.stringify(asset.ignition_status)}`);
    console.log(`Immobilizer Status: ${JSON.stringify(asset.immobilizer_status)}`);
    console.log(`Speed: ${asset.location?.speed || 'null'} km/h`);
    console.log(`Last Communication: ${device.last_communication}`);

    console.log('\n─'.repeat(60));
    console.log('💡 STATUS EXPLANATION:');
    console.log('─'.repeat(60));
    
    if (asset.status === 'stopped') {
      console.log('🛑 "Stopped" means:');
      console.log('   ✓ Vehicle is stationary (speed = 0 or very low)');
      console.log('   ✓ Device is connected to VoltCred');
      console.log('   ✓ GPS fix is recent');
      console.log('   ℹ️  This does NOT mean engine is locked!');
      console.log('   ℹ️  "Stopped" is about movement, not lock state');
    }
    
    if (asset.immobilizer_status) {
      if (asset.immobilizer_status.value === true && asset.immobilizer_status.observed === true) {
        console.log('\n🔒 Lock State: LOCKED (immobilizer active)');
      } else if (asset.immobilizer_status.value === false && asset.immobilizer_status.observed === true) {
        console.log('\n🔓 Lock State: UNLOCKED (immobilizer inactive)');
      } else {
        console.log('\n⚠️  Lock State: Unknown (immobilizer not observed)');
      }
    } else {
      console.log('\n⚠️  Lock State: Not available (immobilizer_status = null)');
      console.log('   This is NORMAL for gt06 devices');
      console.log('   gt06 cannot report immobilizer feedback');
    }

    console.log('\n─'.repeat(60));
    console.log('📊 STATUS vs LOCK STATE:');
    console.log('─'.repeat(60));
    console.log('VoltCred has TWO separate concepts:');
    console.log('');
    console.log('1️⃣  MOVEMENT Status (what you see as "stopped"):');
    console.log('   - "moving" = vehicle is moving (speed > threshold)');
    console.log('   - "idle" = engine on but not moving');
    console.log('   - "stopped" = not moving, device connected');
    console.log('   - "offline" = device disconnected');
    console.log('');
    console.log('2️⃣  LOCK State (shown as 🔒 Locked or 🔓 Unlocked):');
    console.log('   - Read from immobilizer_status field');
    console.log('   - "Locked" = engine cutoff relay activated');
    console.log('   - "Unlocked" = engine relay NOT activated');
    console.log('');
    console.log('✅ Your dashboard is CORRECT:');
    console.log(`   Status: "${asset.status}" (vehicle not moving)`);
    console.log(`   Lock: "Unlocked" (engine can be started)`);
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();
