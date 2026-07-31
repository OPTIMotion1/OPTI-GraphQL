#!/usr/bin/env node
const axios = require('axios');

const API_URL = process.env.DEPLOYED_URL || 'https://opti-graphql-1.onrender.com';
const DEVICE_IMEI = process.argv[2] || '864540080376650';

console.log('\n🔍 Checking Device Lock Status');
console.log('='.repeat(60));

async function main() {
  try {
    // Login
    console.log('1️⃣  Authenticating...');
    const loginRes = await axios.post(`${API_URL}/api/auth/login`, {
      username: 'admin',
      password: 'opti2024'
    });
    const token = loginRes.data.token;
    console.log('   ✅ Logged in\n');

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Get assets
    console.log('2️⃣  Fetching device information...');
    const assetsRes = await axios.get(`${API_URL}/api/assets`, { headers, timeout: 30000 });
    const assets = assetsRes.data;

    if (!assets || assets.length === 0) {
      console.log('   ⚠️  No assets found (VoltCred might be slow to respond)');
      console.log('   💡 Try again in a few seconds\n');
      return;
    }

    // Find device
    let targetDevice = null;
    let targetAsset = null;

    for (const asset of assets) {
      if (asset.iot_devices && asset.iot_devices.length > 0) {
        const device = asset.iot_devices.find(d => 
          d.device_id === DEVICE_IMEI || d.id === 306
        );
        if (device) {
          targetDevice = device;
          targetAsset = asset;
          break;
        }
      }
    }

    if (!targetDevice) {
      console.log(`   ❌ Device ${DEVICE_IMEI} not found\n`);
      return;
    }

    console.log('   ✅ Device found!\n');
    console.log('─'.repeat(60));
    console.log('📋 DEVICE STATUS');
    console.log('─'.repeat(60));
    console.log(`\n🏷️  Asset: ${targetAsset.name} (ID: ${targetAsset.id})`);
    console.log(`📱 Device IMEI: ${targetDevice.device_id}`);
    console.log(`🆔 Device ID: ${targetDevice.id}`);
    console.log(`📡 Connection: ${targetDevice.connection_status || 'unknown'}`);
    console.log(`🚗 Vehicle Status: ${targetAsset.status || 'unknown'}`);
    console.log(`📍 Last Communication: ${targetDevice.last_communication || 'N/A'}`);
    
    // Check lock state from device properties
    if (targetDevice.properties) {
      console.log(`\n🔧 Device Properties:`);
      console.log(JSON.stringify(targetDevice.properties, null, 2));
    }

    // Interpret lock state
    console.log('\n─'.repeat(60));
    console.log('🔐 LOCK STATE ANALYSIS');
    console.log('─'.repeat(60));
    
    if (targetDevice.connection_status === 'disconnected' || targetDevice.connection_status === 'offline') {
      console.log('⚠️  Device is OFFLINE - cannot determine actual lock state');
      console.log('   Commands may be queued until device comes online');
    } else if (targetDevice.connection_status === 'connected') {
      console.log('✅ Device is ONLINE');
      
      // Check if there's a lock_state property
      if (targetDevice.lock_state) {
        console.log(`   Current Lock State: ${targetDevice.lock_state}`);
      } else {
        console.log('   ℹ️  Lock state not available in device data');
        console.log('   💡 Based on last commands:');
        console.log('      - Command #125: engine_cutoff (Lock) at 12:50:30');
        console.log('      - Command #126: engine_restore (Unlock) at 12:50:42');
        console.log('      - Expected state: UNLOCKED (if commands executed)');
      }
    }

    console.log('\n─'.repeat(60));
    console.log('💡 TO LOCK THIS VEHICLE:');
    console.log('─'.repeat(60));
    console.log('Via script:');
    console.log(`   node test-command-deployed.js 306 engine_cutoff\n`);
    console.log('Via UI:');
    console.log('   1. Go to https://opti-graphql-1.onrender.com');
    console.log('   2. Login → Commands tab');
    console.log('   3. Find Asset #328');
    console.log('   4. Click 🔒 Lock button\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
    }
  }
}

main();
