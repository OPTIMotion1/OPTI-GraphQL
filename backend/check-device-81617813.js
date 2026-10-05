require('dotenv').config();
const { getAssets } = require('./src/services/voltcred.service');

const IMEI = '864540081617813';

async function checkDevice() {
  try {
    console.log(`Checking status for IMEI ${IMEI}...\n`);
    const result = await getAssets();
    
    const asset = result.assets.find(a => 
      a.name === IMEI || 
      a.iot_devices?.some(d => d.device_id === IMEI)
    );
    
    if (!asset) {
      console.log('❌ Device not found in VoltCred API');
      return;
    }
    
    const device = asset.iot_devices?.find(d => d.device_id === IMEI);
    
    console.log('=== Device Information ===');
    console.log('Vehicle Name:', asset.name);
    console.log('Asset ID:', asset.id);
    console.log('Asset Status:', asset.status);
    console.log('\n=== Device Details ===');
    console.log('Device ID:', device?.id);
    console.log('IMEI:', device?.device_id);
    console.log('Device Type:', device?.iot_type_code);
    console.log('Connection Status:', device?.connection_status);
    console.log('Last Communication:', device?.last_communication || 'Never');
    
    if (device?.connection_status === 'disconnected' || asset.status === 'offline') {
      console.log('\n✅ Confirmed: Device is OFFLINE/DISCONNECTED in VoltCred API');
    } else {
      console.log('\n✅ Device is', device?.connection_status?.toUpperCase(), 'in VoltCred API');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkDevice();
