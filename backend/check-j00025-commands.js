// Check command history for J00025 (IMEI: 864540080666142)
require('dotenv').config();
const { getAssets } = require('./src/services/voltcred.service');

async function checkJ00025Commands() {
  console.log('=== Checking J00025 Command History ===\n');
  
  try {
    const result = await getAssets();
    const assets = result.assets || [];
    
    // Find J00025
    const j00025 = assets.find(a => a.name === '864540080666142' || a.name === 'J00025');
    
    if (!j00025) {
      console.log('❌ J00025 not found');
      return;
    }
    
    console.log(`✓ Found: ${j00025.name} (Asset ID: ${j00025.id})`);
    console.log(`Status: ${j00025.status}`);
    console.log(`Connection: ${j00025.iot_devices?.[0]?.connection_status}\n`);
    
    // Check immobilizer state
    console.log('=== Hardware State ===');
    const immobilized = j00025.state?.immobilized;
    console.log(`immobilized: ${immobilized?.value} (observed: ${immobilized?.observed})`);
    
    const immoCmd = j00025.state?.immobilizer_command_type;
    const immoCmdStatus = j00025.state?.immobilizer_command_status;
    const immoCmdAt = j00025.state?.immobilizer_command_at;
    
    if (immoCmd?.value) {
      console.log(`Last immobilizer command: ${immoCmd.value}`);
      console.log(`Command status: ${immoCmdStatus?.value}`);
      console.log(`Command sent at: ${immoCmdAt?.value}`);
    }
    
    // Check command history
    console.log('\n=== Command History ===');
    if (j00025.command_history && j00025.command_history.length > 0) {
      console.log(`Total commands: ${j00025.command_history.length}\n`);
      
      j00025.command_history.slice(0, 5).forEach((cmd, i) => {
        console.log(`${i + 1}. ${cmd.command_code} (ID: ${cmd.id})`);
        console.log(`   Status: ${cmd.status}`);
        console.log(`   Time: ${cmd.execution_time}`);
        console.log(`   Response: ${cmd.response}`);
        console.log('');
      });
    } else {
      console.log('❌ No command history found');
    }
    
    // Analyze why command shows as failed
    console.log('\n=== Analysis ===');
    if (immobilized?.value === false && immoCmdStatus?.value === 'failed') {
      console.log('⚠️  Command shows "failed" BUT device is actually unlocked');
      console.log('   Reason: VoltCred timeout - device was offline when command sent');
      console.log('   Device came online later and executed the command');
      console.log('   This is the same issue we documented earlier');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkJ00025Commands();
