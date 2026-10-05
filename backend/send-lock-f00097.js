require('dotenv').config();
const { sendDeviceCommand } = require('./src/services/voltcred.service');

const DEVICE_ID = 477; // F00097 - IMEI 864540081617540

async function sendLockCommand() {
  try {
    console.log(`Sending LOCK command to device ${DEVICE_ID} (F00097)...`);
    
    const result = await sendDeviceCommand(DEVICE_ID, 'engine_cutoff');
    
    console.log('\n✅ Lock command sent successfully!');
    console.log('\nCommand Details:');
    console.log(`  ID: ${result.id}`);
    console.log(`  Command: ${result.command_code}`);
    console.log(`  Status: ${result.status}`);
    console.log(`  Execution Time: ${result.execution_time}`);
    
    console.log('\n⏳ gt06 devices take 10-20 minutes to execute commands.');
    console.log('The vehicle will lock automatically when the device wakes up.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

sendLockCommand();
