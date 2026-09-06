#!/usr/bin/env node
require('dotenv').config();
const { getAssets } = require('./src/services/voltcred.service');

async function main() {
  try {
    console.log('\n🔍 Finding IOT Device Mappings');
    console.log('='.repeat(60));
    console.log('Looking for: 80376247, 80671084, 80377468\n');

    const result = await getAssets();
    const assets = result.assets || [];

    console.log(`Found ${assets.length} total assets\n`);

    // Search for devices containing the partial numbers
    const matches = [];
    
    for (const asset of assets) {
      if (asset.iot_devices && asset.iot_devices.length > 0) {
        for (const device of asset.iot_devices) {
          if (device.device_id.includes('80376247') || device.device_id.includes('80671084') || device.device_id.includes('80377468')) {
            matches.push({
              imei: device.device_id,
              deviceId: device.id,
              deviceName: device.name,
              assetId: asset.id,
              assetName: asset.name,
              licensePlate: asset.license_plate,
              status: asset.status,
              connection: device.connection_status
            });
          }
        }
      }
    }

    if (matches.length === 0) {
      console.log('❌ No devices found matching 80376247 or 80671084\n');
      console.log('📋 All devices:');
      assets.forEach(asset => {
        if (asset.iot_devices && asset.iot_devices.length > 0) {
          asset.iot_devices.forEach(device => {
            console.log(`   ${device.device_id} → ${asset.name}`);
          });
        }
      });
    } else {
      console.log('✅ Found matching devices:\n');
      matches.forEach(match => {
        console.log('─'.repeat(60));
        console.log(`IMEI: ${match.imei}`);
        console.log(`Device ID: ${match.deviceId}`);
        console.log(`Device Name: ${match.deviceName}`);
        console.log(`Asset ID: ${match.assetId}`);
        console.log(`Asset Name: ${match.assetName}`);
        console.log(`License Plate: ${match.licensePlate}`);
        console.log(`Status: ${match.status}`);
        console.log(`Connection: ${match.connection}`);
      });
      console.log('─'.repeat(60));
      
      console.log('\n📝 Suggested mapping for vehicle-imei-mapping.json:');
      matches.forEach(match => {
        console.log(`  "${match.imei}": "VEHICLE_ID_HERE",  // Currently: ${match.assetName}`);
      });
    }

    console.log('\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
