// Check what state keys are available for a device
require('dotenv').config();
const { getAssets } = require('./src/services/voltcred.service');

async function checkDeviceStateKeys() {
  console.log('=== Checking device state keys for F00112 ===\n');
  
  try {
    const result = await getAssets();
    const assets = result.assets || [];
    
    // Find F00112 (IMEI: 864540081870131)
    const f00112 = assets.find(a => a.name === '864540081870131' || a.name === 'F00112');
    
    if (!f00112) {
      console.log('❌ F00112 not found in assets');
      console.log('\nAvailable assets with "81870" in name:');
      assets.filter(a => a.name?.includes('81870')).forEach(a => {
        console.log(`  - ${a.name} (Asset ID: ${a.id})`);
      });
      return;
    }
    
    console.log(`✅ Found F00112: ${f00112.name} (Asset ID: ${f00112.id})`);
    console.log(`   Status: ${f00112.status}`);
    console.log(`   Connection: ${f00112.primary_iot_device?.connection_status}\n`);
    
    // Check primary device state
    if (f00112.primary_iot_device?.state) {
      console.log('=== PRIMARY DEVICE STATE ===');
      console.log('Available state keys:\n');
      
      f00112.primary_iot_device.state.forEach(field => {
        console.log(`Key: "${field.key}"`);
        console.log(`  Label: ${field.label}`);
        console.log(`  Value: ${field.value}`);
        console.log(`  Writable: ${field.writable}`);
        console.log('');
      });
    } else {
      console.log('❌ No state data available for primary device');
    }
    
    // Check all IoT devices
    console.log('\n=== ALL IOT DEVICES STATE ===');
    (f00112.iot_devices || []).forEach((device, index) => {
      console.log(`\nDevice ${index + 1}: ${device.device_id} (${device.iot_type_code})`);
      console.log(`Connection: ${device.connection_status}`);
      
      if (device.state && device.state.length > 0) {
        console.log('State keys:');
        device.state.forEach(field => {
          console.log(`  - ${field.key}: ${field.value} (${field.label})`);
        });
      } else {
        console.log('  No state data');
      }
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkDeviceStateKeys();
