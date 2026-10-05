require('dotenv').config();
const { sendDeviceCommand } = require('./src/services/voltcred.service');

const DEVICE_ID = 477; // F00097 - IMEI 864540081617540

async function unlockNow() {
  try {
    console.log('Sending UNLOCK command to F00097 (Device 477)...\n');
    
    const result = await sendDeviceCommand(DEVICE_ID, 'engine_restore');
    
    console.log('✅ UNLOCK command sent successfully!\n');
    console.log('Command Details:');
    console.log('  ID:', result.id);
    console.log('  Command:', result.command_code);
    console.log('  Status:', result.status);
    console.log('  Execution Time:', result.execution_time);
    console.log('\n⏳ gt06 device will unlock in 10-20 minutes when it wakes from sleep cycle.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.message.includes('Asset Manager')) {
      console.error('\n🔴 Permission Denied: Your account does not have Asset Manager permission.');
      console.error('Contact VoltCred support to grant this permission.');
    }
  }
}

unlockNow();
