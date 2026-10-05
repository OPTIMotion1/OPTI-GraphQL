require('dotenv').config();
const { sendDeviceCommand } = require('./src/services/voltcred.service');

const DEVICE_ID = 471; // IMEI 864540081618068

async function unlockDevice() {
  try {
    console.log(`Sending UNLOCK command to Device ${DEVICE_ID} (IMEI 864540081618068)...\n`);
    
    const result = await sendDeviceCommand(DEVICE_ID, 'engine_restore');
    
    console.log('✅ UNLOCK command sent successfully!\n');
    console.log('Command Details:');
    console.log('  Command ID:', result.id);
    console.log('  Command Code:', result.command_code);
    console.log('  Status:', result.status);
    console.log('  Execution Time:', result.execution_time);
    console.log('\nThe vehicle will unlock shortly.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

unlockDevice();
