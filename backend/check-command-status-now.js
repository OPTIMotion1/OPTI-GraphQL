// Quick script to check if commands are actually failing or just status reporting is broken
require('dotenv').config();
const { graphqlRequest } = require('./src/services/voltcred.service');

async function checkCommandStatus() {
  console.log('\n=== CHECKING COMMAND STATUS ===\n');
  
  // Get all assets to find device IDs
  const assetsQuery = `
    query {
      assetsWithPagination(limit: 50) {
        rows {
          id
          name
          iot_devices {
            id
            device_id
            iot_type_code
            connection_status
          }
        }
      }
    }
  `;
  
  const assetsData = await graphqlRequest(assetsQuery);
  const assets = assetsData.assetsWithPagination.rows;
  
  console.log(`✓ Found ${assets.length} total vehicles\n`);
  
  // Find old batch vs new batch devices
  const oldBatchIMEIs = [
    '864540080383862', '864540080376247', '864540080671084', '864540080377468',
    '864540080668049', '864540080666142', '864540080379563', '864540080667991',
    '864540080667363', '864540080671035', '864540080377880', '864540080668015',
    '864540080376650', '864540080671050', '864540080665904', '864540080667207',
    '864540080379464', '864540080378227', '864540080667371', '864540080670656'
  ];
  
  const newBatchIMEIs = [
    '864540081617854', '864540081618324', '864540080379407', '864540081617375',
    '864540081617771', '864540081617870', '864540081617458', '864540081617334',
    '864540081617920', '864540081617946', '864540081618001', '864540081617789',
    '864540081618159', '864540081618217', '864540081617912', '864540081617904',
    '864540081617862', '864540081618092', '864540081617938', '864540081617797'
  ];
  
  const oldDevices = [];
  const newDevices = [];
  
  assets.forEach(asset => {
    asset.iot_devices.forEach(device => {
      if (oldBatchIMEIs.includes(device.device_id)) {
        oldDevices.push({ ...device, assetName: asset.name });
      } else if (newBatchIMEIs.includes(device.device_id)) {
        newDevices.push({ ...device, assetName: asset.name });
      }
    });
  });
  
  console.log(`📊 Old Batch: ${oldDevices.length} devices (should have working commands)`);
  console.log(`📊 New Batch: ${newDevices.length} devices (commands failing)\n`);
  
  // Check command history for a few devices from each batch
  const commandsQuery = `
    query GetCommands($deviceId: Int!) {
      deviceCommands(device_id: $deviceId) {
        id
        command_code
        status
        execution_time
        response
      }
    }
  `;
  
  console.log('=== OLD BATCH DEVICE (should work) ===\n');
  const oldDevice = oldDevices[0];
  if (oldDevice) {
    console.log(`Vehicle: ${oldDevice.assetName}`);
    console.log(`IMEI: ${oldDevice.device_id}`);
    console.log(`Device ID: ${oldDevice.id}`);
    console.log(`Connection: ${oldDevice.connection_status}\n`);
    
    const oldCommands = await graphqlRequest(commandsQuery, { deviceId: parseInt(oldDevice.id, 10) });
    const recentOld = oldCommands.deviceCommands.slice(0, 3);
    
    console.log('Recent Commands:');
    recentOld.forEach((cmd, i) => {
      const statusEmoji = {
        'pending': '⏳',
        'sent': '📤',
        'delivered': '✅',
        'completed': '✓',
        'failed': '❌',
        'superseded': '⊗'
      }[cmd.status] || '•';
      
      console.log(`  ${i + 1}. ${statusEmoji} ${cmd.command_code} - Status: ${cmd.status}`);
      console.log(`     Time: ${cmd.execution_time}`);
      if (cmd.response) console.log(`     Response: ${cmd.response}`);
    });
  }
  
  console.log('\n=== NEW BATCH DEVICE (commands failing) ===\n');
  const newDevice = newDevices[0];
  if (newDevice) {
    console.log(`Vehicle: ${newDevice.assetName}`);
    console.log(`IMEI: ${newDevice.device_id}`);
    console.log(`Device ID: ${newDevice.id}`);
    console.log(`Connection: ${newDevice.connection_status}\n`);
    
    const newCommands = await graphqlRequest(commandsQuery, { deviceId: parseInt(newDevice.id, 10) });
    const recentNew = newCommands.deviceCommands.slice(0, 3);
    
    if (recentNew.length === 0) {
      console.log('  ℹ️  No commands sent to this device yet');
    } else {
      console.log('Recent Commands:');
      recentNew.forEach((cmd, i) => {
        const statusEmoji = {
          'pending': '⏳',
          'sent': '📤',
          'delivered': '✅',
          'completed': '✓',
          'failed': '❌',
          'superseded': '⊗'
        }[cmd.status] || '•';
        
        console.log(`  ${i + 1}. ${statusEmoji} ${cmd.command_code} - Status: ${cmd.status}`);
        console.log(`     Time: ${cmd.execution_time}`);
        if (cmd.response) console.log(`     Response: ${cmd.response}`);
        
        if (cmd.status === 'failed') {
          console.log(`     ⚠️  CONFIRMED: Command FAILED on new batch device!`);
        }
      });
    }
  }
  
  console.log('\n=== ANALYSIS ===\n');
  console.log('KEY QUESTIONS TO ASK VOLTCRED:\n');
  console.log('1. WHY do commands immediately fail on the 20 NEW devices?');
  console.log('   - Same account, same API calls, different result');
  console.log('   - Old devices: Commands work (status: delivered)');
  console.log('   - New devices: Commands fail immediately (status: failed)\n');
  
  console.log('2. ARE THE NEW DEVICES FULLY PROVISIONED?');
  console.log('   - Can they receive commands from the backend?');
  console.log('   - Are they configured to accept engine_cutoff/restore?\n');
  
  console.log('3. PHYSICAL TESTING RESULTS:');
  console.log('   - You said commands ARE executing physically');
  console.log('   - But VoltCred API shows status: "failed"');
  console.log('   - This means: Either the device executed before reporting failure,');
  console.log('     OR there\'s a status reporting bug\n');
  
  console.log('=== WHAT TO SEND TO VOLTCRED ===\n');
  console.log('Subject: Commands Showing "Failed" Status But Executing Physically\n');
  console.log('Message:');
  console.log('---');
  console.log('Hi VoltCred Team,\n');
  console.log('We are seeing a strange issue with the 20 new devices added to our account:');
  console.log('- Account: support@optimotion.in');
  console.log(`- New Device Example: ${newDevice?.device_id} (Device ID: ${newDevice?.id})\n`);
  console.log('ISSUE: When we send engine_cutoff/engine_restore commands via executeDeviceCommand:');
  console.log('1. VoltCred API immediately returns status: "failed"');
  console.log('2. BUT the vehicle physically locks/unlocks (command IS executing!)\n');
  console.log('QUESTIONS:');
  console.log('1. Why does the API show "failed" if the command executed?');
  console.log('2. Is this a status reporting bug?');
  console.log('3. Should we ignore "failed" status and track via command history instead?');
  console.log('4. Are the new devices fully provisioned to report command execution?\n');
  console.log('For comparison, the 20 OLD devices work fine:');
  console.log(`- Old Device Example: ${oldDevice?.device_id} (Device ID: ${oldDevice?.id})`);
  console.log('- Commands show status: "delivered" and work as expected\n');
  console.log('Can you please check the backend logs and advise?');
  console.log('---\n');
}

checkCommandStatus().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
