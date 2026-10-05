// Check immobilizer_command_status values across all devices
require('dotenv').config();
const { getAssets } = require('./src/services/voltcred.service');

async function checkImmobilizerCommandStatus() {
  console.log('=== Checking immobilizer_command_status values ===\n');
  
  try {
    const result = await getAssets();
    const assets = result.assets || [];
    
    // Collect all unique immobilizer_command_status values
    const statusValues = new Map();
    
    assets.forEach(asset => {
      const cmdStatus = asset.state?.immobilizer_command_status;
      const cmdType = asset.state?.immobilizer_command_type;
      const cmdAt = asset.state?.immobilizer_command_at;
      const immobilized = asset.state?.immobilized;
      
      if (cmdStatus && cmdStatus.value !== null) {
        const key = cmdStatus.value;
        if (!statusValues.has(key)) {
          statusValues.set(key, []);
        }
        statusValues.get(key).push({
          name: asset.name,
          cmdType: cmdType?.value,
          cmdStatus: cmdStatus.value,
          cmdAt: cmdAt?.value,
          immobilized: immobilized?.value,
          status: asset.status
        });
      }
    });
    
    console.log('=== UNIQUE IMMOBILIZER_COMMAND_STATUS VALUES ===\n');
    
    if (statusValues.size === 0) {
      console.log('❌ No immobilizer_command_status values found');
      return;
    }
    
    statusValues.forEach((devices, status) => {
      console.log(`\n📊 Status: "${status}" (${devices.length} devices)`);
      devices.slice(0, 3).forEach(d => {
        console.log(`   ${d.name}: ${d.cmdType} at ${d.cmdAt}`);
        console.log(`      Immobilized: ${d.immobilized}, Connection: ${d.status}`);
      });
    });
    
    console.log('\n\n=== F00112 (J00027) IMMOBILIZER COMMAND STATE ===');
    const f00112 = assets.find(a => a.name === '864540081617375' || a.name === 'J00027');
    
    if (f00112) {
      console.log(`Vehicle: ${f00112.name}`);
      console.log(`Connection: ${f00112.status}`);
      console.log(`\nImmobilizer State:`);
      console.log(`  immobilized: ${f00112.state?.immobilized?.value}`);
      console.log(`  immobilizer_command_type: ${f00112.state?.immobilizer_command_type?.value}`);
      console.log(`  immobilizer_command_status: ${f00112.state?.immobilizer_command_status?.value}`);
      console.log(`  immobilizer_command_at: ${f00112.state?.immobilizer_command_at?.value}`);
    } else {
      console.log('❌ J00027 not found');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkImmobilizerCommandStatus();
