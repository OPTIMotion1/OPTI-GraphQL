require('dotenv').config();
const { getAssets } = require('./src/services/voltcred.service');

async function checkDevice453() {
  try {
    console.log('Fetching all assets to find Device 453...\n');
    const result = await getAssets();
    
    // Find device 453
    const asset453 = result.assets.find(a => 
      a.iot_devices?.some(d => d.id === 453)
    );
    
    if (!asset453) {
      console.log('❌ Device 453 not found!');
      return;
    }
    
    const device453 = asset453.iot_devices.find(d => d.id === 453);
    
    console.log('=== DEVICE 453 ===');
    console.log('Vehicle Name:', asset453.name);
    console.log('Asset ID:', asset453.id);
    console.log('Device ID:', device453.id);
    console.log('Device IMEI:', device453.device_id);
    console.log('Device Type:', device453.iot_type_code);
    console.log('Connection:', device453.connection_status);
    console.log('\n=== Comparison ===');
    console.log('F00097:');
    console.log('  Vehicle Name: F00097');
    console.log('  Asset ID: 477');
    console.log('  Device ID: 477');
    console.log('  IMEI: 864540081617540');
    console.log('\nDevice 453:');
    console.log('  Vehicle Name:', asset453.name);
    console.log('  Asset ID:', asset453.id);
    console.log('  Device ID:', device453.id);
    console.log('  IMEI:', device453.device_id);
    
    if (asset453.name === 'F00097' || asset453.name === '864540081617540') {
      console.log('\n⚠️ SAME VEHICLE! Device 453 belongs to F00097');
    } else {
      console.log('\n✓ DIFFERENT VEHICLES');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkDevice453();
