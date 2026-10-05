require('dotenv').config();
const { login, graphqlRequest } = require('./src/services/voltcred.service');

const DEVICE_IMEI = '864540081617540';
const DEVICE_ID = 477; // F00097

const GET_DEVICE_COMMANDS = `
  query GetDeviceCommands($deviceId: Int!) {
    deviceCommands(device_id: $deviceId) {
      id
      command_code
      status
      execution_time
      response
    }
  }
`;

async function checkCommands() {
  try {
    console.log(`Checking command history for device ${DEVICE_ID} (${DEVICE_IMEI})...`);
    await login();
    
    const data = await graphqlRequest(GET_DEVICE_COMMANDS, { deviceId: DEVICE_ID });
    
    const commands = data?.deviceCommands || [];
    
    console.log(`\n=== Device ${DEVICE_ID} (${DEVICE_IMEI}) - F00097 ===`);
    console.log(`\n=== Command History (${commands.length} total) ===\n`);
    
    if (commands.length === 0) {
      console.log('❌ No commands found in history!');
      console.log('\nPossible reasons:');
      console.log('1. No commands have been sent to this device yet');
      console.log('2. VoltCred API cleared the command history');
      console.log('3. Commands are being sent to a different device ID');
    } else {
      commands.forEach((cmd, index) => {
        const timeAgo = Math.floor((Date.now() - new Date(cmd.execution_time + 'Z').getTime()) / 1000 / 60);
        console.log(`[${index + 1}] ${cmd.command_code}`);
        console.log(`    ID: ${cmd.id}`);
        console.log(`    Status: ${cmd.status}`);
        console.log(`    Execution: ${cmd.execution_time} (${timeAgo}m ago)`);
        console.log(`    Response: ${cmd.response || 'N/A'}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

checkCommands();
