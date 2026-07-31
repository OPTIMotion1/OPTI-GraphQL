#!/usr/bin/env node
const axios = require('axios');

const API_URL = process.env.DEPLOYED_URL || 'https://opti-graphql-1.onrender.com';
const USERNAME = process.env.API_USERNAME || 'admin';
const PASSWORD = process.env.API_PASSWORD || 'opti2024';

console.log('\n📊 Checking Command Status on Deployed API');
console.log('='.repeat(60));

async function main() {
  try {
    // Step 1: Login
    console.log('\n1️⃣  Logging in...');
    const loginRes = await axios.post(`${API_URL}/api/auth/login`, {
      username: USERNAME,
      password: PASSWORD
    });
    const token = loginRes.data.token;
    console.log('   ✅ Authenticated');

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Step 2: Get all assets to find device 306
    console.log('\n2️⃣  Fetching assets...');
    const assetsRes = await axios.get(`${API_URL}/api/assets`, { headers });
    const assets = assetsRes.data;
    console.log(`   ✅ Found ${assets?.length || 0} assets`);

    // Find device 306 (IMEI: 864540080376650)
    let targetAsset = null;
    let targetDevice = null;
    
    if (assets && Array.isArray(assets)) {
      for (const asset of assets) {
        if (asset.iot_devices && asset.iot_devices.length > 0) {
          const device = asset.iot_devices.find(d => 
            d.id === 306 || d.device_id === '864540080376650'
          );
          if (device) {
            targetAsset = asset;
            targetDevice = device;
            break;
          }
        }
      }
    }

    if (targetDevice) {
      console.log('\n3️⃣  Target Device Found:');
      console.log(`   Asset: ${targetAsset.name} (ID: ${targetAsset.id})`);
      console.log(`   Device: ${targetDevice.device_id} (ID: ${targetDevice.id})`);
      console.log(`   Status: ${targetAsset.status}`);
      console.log(`   Connection: ${targetDevice.connection_status}`);
      console.log(`   Last Communication: ${targetDevice.last_communication || 'Unknown'}`);
    } else {
      console.log('\n3️⃣  ⚠️  Target device (306 / 864540080376650) not found');
    }

    // Step 3: Try to send a test command (location_request is safest)
    console.log('\n4️⃣  Testing Command API...');
    console.log('   Sending location_request command to device 306...');
    
    try {
      const cmdRes = await axios.post(`${API_URL}/api/command`, {
        deviceId: 306,
        commandType: 'location_request'
      }, { headers });

      console.log('   ✅ Command sent successfully!');
      console.log('   Response:', JSON.stringify(cmdRes.data, null, 2));
    } catch (cmdError) {
      if (cmdError.response) {
        console.log('   ❌ Command failed:');
        console.log(`   Status: ${cmdError.response.status}`);
        console.log('   Error:', JSON.stringify(cmdError.response.data, null, 2));
      } else {
        console.log('   ❌ Command failed:', cmdError.message);
      }
    }

    // Step 4: Check recent cutoff logs
    console.log('\n5️⃣  Checking recent auto-cutoff logs...');
    const logsRes = await axios.get(`${API_URL}/api/auto-cutoff/logs?limit=10`, { headers });
    
    if (logsRes.data.logs && logsRes.data.logs.length > 0) {
      console.log(`   ✅ Found ${logsRes.data.logs.length} recent logs:`);
      logsRes.data.logs.forEach((log, i) => {
        console.log(`   ${i + 1}. Rental: ${log.rentalId} | Status: ${log.cutoffStatus} | ${log.lastAttemptAt}`);
        if (log.error) {
          console.log(`      Error: ${log.error}`);
        }
      });
    } else {
      console.log('   ℹ️  No cutoff logs found');
    }

    // Step 5: VoltCred API direct test
    console.log('\n6️⃣  Testing VoltCred Connection...');
    console.log('   Checking if backend can reach VoltCred API...');
    console.log('   💡 If commands are failing, check:');
    console.log('      - VOLTCRED_EMAIL and VOLTCRED_PASSWORD are correct');
    console.log('      - VoltCred API is accessible from Render servers');
    console.log('      - Device is online and can receive commands');

    console.log('\n' + '='.repeat(60));
    console.log('✅ DIAGNOSTIC COMPLETE');
    console.log('='.repeat(60));
    console.log('\n📝 Next Steps:');
    console.log('   1. Check Render logs for detailed error messages');
    console.log('   2. Verify VoltCred credentials in Render env vars');
    console.log('   3. Test from UI: Commands tab → Select device → Send command');
    console.log('   4. If still failing, check VoltCred dashboard for command history\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

main();
