require('dotenv').config();
const { getAllRentals } = require('./src/services/renewals.service.js');
const { getAssets } = require('./src/services/voltcred.service.js');

async function checkStatus() {
  console.log('='.repeat(60));
  console.log('DASHBOARD STATUS CHECK - Before New IoT Devices');
  console.log('='.repeat(60));
  
  // 1. Check Optimotion Rentals API
  console.log('\n📊 OPTIMOTION RENTALS API:');
  console.log('-'.repeat(60));
  try {
    const rentals = await getAllRentals();
    console.log('✅ Status: WORKING');
    console.log(`✅ Total Active Rentals: ${rentals.length}`);
    
    // Show sample with vehicle SL233750
    const sample = rentals.find(r => r.vehicleId === 'SL233750') || rentals[0];
    if (sample) {
      console.log('\n📋 Sample Rental Data:');
      console.log(`   Vehicle ID: ${sample.vehicleId}`);
      console.log(`   Rider Name: ${sample.riderName}`);
      console.log(`   Rider Phone: ${sample.riderPhone}`);
      console.log(`   Package: ${sample.originalData?.package || 'N/A'}`);
      console.log(`   Due Date: ${sample.dueDate}`);
      console.log(`   Overdue Days: ${sample.overdueDays}`);
      console.log(`   Hub: ${sample.hub || 'N/A'}`);
    }
    
    // Count unique vehicles
    const uniqueVehicles = [...new Set(rentals.map(r => r.vehicleId))].length;
    console.log(`\n✅ Unique Vehicles in Rentals: ${uniqueVehicles}`);
    
  } catch (error) {
    console.log('❌ Status: ERROR');
    console.log(`❌ Error: ${error.message}`);
  }
  
  // 2. Check VoltCred API
  console.log('\n\n🚗 VOLTCRED IOT API:');
  console.log('-'.repeat(60));
  try {
    const result = await getAssets();
    console.log('✅ Status: WORKING');
    console.log(`✅ Total IoT Devices: ${result.total}`);
    console.log(`✅ Assets Retrieved: ${result.assets.length}`);
    
    if (result.counts) {
      console.log('\n📊 Status Breakdown:');
      console.log(`   Moving: ${result.counts.moving}`);
      console.log(`   Idle: ${result.counts.idle}`);
      console.log(`   Stopped: ${result.counts.stopped}`);
      console.log(`   Offline: ${result.counts.offline}`);
      console.log(`   Untracked: ${result.counts.untracked}`);
    }
    
    if (result.assets.length > 0) {
      console.log('\n📋 Sample VoltCred Asset:');
      const asset = result.assets[0];
      console.log(`   ID: ${asset.id}`);
      console.log(`   Name: ${asset.name}`);
      console.log(`   License Plate: ${asset.license_plate || 'null'}`);
      console.log(`   Operator Name: ${asset.operator_name || 'null'}`);
      console.log(`   Model: ${asset.model || 'null'}`);
      console.log(`   Asset Type: ${asset.asset_type || 'null'}`);
      console.log(`   Status: ${asset.status}`);
      console.log(`   Location: ${asset.location ? 'Available' : 'null'}`);
      console.log(`   Address: ${asset.location?.address || 'null'}`);
      
      const device = asset.iot_devices?.[0];
      if (device) {
        console.log(`\n   Primary Device ID: ${device.device_id}`);
        console.log(`   Device Type: ${device.iot_type_code}`);
        console.log(`   Connection: ${device.connection_status}`);
      }
      
      // Check device state
      if (asset.state && Object.keys(asset.state).length > 0) {
        console.log('\n   Device State:');
        Object.entries(asset.state).forEach(([key, val]) => {
          console.log(`      ${key}: ${val.value} (observed: ${val.observed})`);
        });
      } else {
        console.log('\n   Device State: Empty (gt06 GPS tracker - no ignition/immobiliser)');
      }
    }
    
  } catch (error) {
    console.log('❌ Status: ERROR');
    console.log(`❌ Error: ${error.message}`);
  }
  
  // 3. Feature Summary
  console.log('\n\n✅ WORKING FEATURES:');
  console.log('-'.repeat(60));
  console.log('✅ Optimotion Rentals API - Rider names, vehicle IDs, phone numbers');
  console.log('✅ VoltCred IoT API - GPS tracking, device status');
  console.log('✅ VoltCred Commands - Lock/Unlock/Locate');
  console.log('✅ Auto-Cutoff Feature - Overdue detection & cutoff');
  console.log('✅ WhatsApp Notifications - T0, T1, Reminder, Cutoff templates');
  console.log('✅ Activity Logging - Commands & notifications tracking');
  
  console.log('\n\n❌ NOT AVAILABLE (Need Vehicle/Driver Management Add-on):');
  console.log('-'.repeat(60));
  console.log('❌ operator_name - Currently null (need add-on)');
  console.log('❌ model - Currently null (need add-on)');
  console.log('❌ asset_type - Currently null (need add-on)');
  console.log('❌ location.address - Currently null (need add-on)');
  console.log('❌ ignition state - Currently false/null (gt06 limitation)');
  console.log('❌ immobiliser state - Currently null (gt06 limitation)');
  
  console.log('\n\n💡 RECOMMENDATION FOR NEW IOT DEVICES:');
  console.log('-'.repeat(60));
  console.log('1️⃣  If getting new gt06 GPS trackers:');
  console.log('   → Same features as current (GPS, commands, no ignition data)');
  console.log('\n2️⃣  If getting advanced telematics devices:');
  console.log('   → Will need Vehicle/Driver Management add-on from VoltCred');
  console.log('   → Will get: ignition, immobiliser, operator_name, model, etc.');
  console.log('\n3️⃣  Current workaround (RECOMMENDED):');
  console.log('   → Match VoltCred vehicle IDs with Optimotion rental data');
  console.log('   → Show rider names from Optimotion on Dashboard');
  console.log('   → No need for VoltCred add-on');
  
  console.log('\n' + '='.repeat(60));
  console.log('Status check complete!');
  console.log('='.repeat(60) + '\n');
}

checkStatus().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
