// Check all state fields returned by VoltCred for all devices
require('dotenv').config();
const { getAssets } = require('./src/services/voltcred.service');

async function checkAllStateFields() {
  console.log('=== Checking all state fields from VoltCred ===\n');
  
  try {
    const result = await getAssets();
    const assets = result.assets || [];
    
    console.log(`Total assets: ${assets.length}\n`);
    
    // Collect all unique state keys
    const allStateKeys = new Set();
    
    assets.forEach(asset => {
      if (asset.state) {
        Object.keys(asset.state).forEach(key => allStateKeys.add(key));
      }
    });
    
    console.log('=== ALL UNIQUE STATE KEYS ACROSS ALL DEVICES ===');
    console.log(Array.from(allStateKeys).sort().join('\n'));
    console.log(`\nTotal unique keys: ${allStateKeys.size}\n`);
    
    // Check for immobilizer-related keys
    console.log('=== IMMOBILIZER-RELATED KEYS ===');
    const immoKeys = Array.from(allStateKeys).filter(k => 
      k.toLowerCase().includes('immob') || 
      k.toLowerCase().includes('lock') || 
      k.toLowerCase().includes('relay')
    );
    
    if (immoKeys.length > 0) {
      console.log(immoKeys.join('\n'));
    } else {
      console.log('❌ No immobilizer-related keys found');
    }
    
    // Find F00112 and show its state
    console.log('\n=== CHECKING F00112 STATE ===');
    const f00112 = assets.find(a => a.name === '864540081870131' || a.name === 'F00112');
    
    if (f00112) {
      console.log(`Found F00112 (Asset ID: ${f00112.id})`);
      console.log(`Status: ${f00112.status}`);
      console.log(`State keys available:`);
      if (f00112.state && Object.keys(f00112.state).length > 0) {
        Object.entries(f00112.state).forEach(([key, value]) => {
          console.log(`  ${key}: ${JSON.stringify(value)}`);
        });
      } else {
        console.log('  ❌ No state data');
      }
      
      // Check IoT devices
      console.log('\nIoT Devices:');
      (f00112.iot_devices || []).forEach((device, i) => {
        console.log(`  Device ${i + 1}: ${device.device_id} (${device.iot_type_code})`);
        console.log(`    Connection: ${device.connection_status}`);
        console.log(`    State keys: ${Object.keys(device.state || {}).join(', ') || 'none'}`);
      });
    } else {
      console.log('❌ F00112 not found');
    }
    
    // Sample a few connected devices to see if they have immobilizer state
    console.log('\n=== SAMPLE: CONNECTED DEVICES WITH STATE ===');
    const connectedWithState = assets.filter(a => 
      (a.status === 'moving' || a.status === 'idle') && 
      a.state && Object.keys(a.state).length > 0
    ).slice(0, 3);
    
    connectedWithState.forEach(asset => {
      console.log(`\n${asset.name} (${asset.status})`);
      console.log(`State keys: ${Object.keys(asset.state).join(', ')}`);
      if (asset.state.immobiliser_status || asset.state.immobilizer_status) {
        const immo = asset.state.immobiliser_status || asset.state.immobilizer_status;
        console.log(`  ✅ HAS IMMOBILIZER: ${JSON.stringify(immo)}`);
      }
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkAllStateFields();
