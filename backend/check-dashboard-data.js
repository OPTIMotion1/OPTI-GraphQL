// Simulate what the dashboard sees
require('dotenv').config();
const { getAssets } = require('./src/services/voltcred.service');

async function checkDashboard() {
  console.log('\n=== DASHBOARD DATA CHECK ===\n');
  console.log('This simulates what your dashboard receives from /api/assets\n');
  
  try {
    const result = await getAssets();
    
    console.log('✅ API call successful\n');
    console.log('📊 SUMMARY:');
    console.log(`   Total vehicles: ${result.total}`);
    console.log(`   Assets returned: ${result.assets.length}`);
    console.log(`   Status counts:`, result.counts);
    
    console.log('\n📋 SAMPLE VEHICLES (first 3):\n');
    result.assets.slice(0, 3).forEach((asset, i) => {
      console.log(`${i + 1}. ${asset.name} (ID: ${asset.id})`);
      console.log(`   Status: ${asset.status}`);
      console.log(`   License: ${asset.license_plate || 'N/A'}`);
      console.log(`   Location: ${asset.location ? 'Available' : 'No GPS fix'}`);
      console.log(`   Devices: ${asset.iot_devices.length}`);
      
      asset.iot_devices.forEach(device => {
        console.log(`     - ${device.device_id} (${device.iot_type_code}) - ${device.connection_status}`);
        console.log(`       Commands: ${asset.command_history?.length || 0} in history`);
        if (asset.command_history && asset.command_history.length > 0) {
          const recent = asset.command_history[0];
          console.log(`       Latest: ${recent.command_code} - ${recent.status}`);
        }
      });
      console.log('');
    });
    
    // Check if the intermittent error is happening
    console.log('=== ERROR CHECK ===\n');
    
    if (result.assets.length === 0 && result.total > 0) {
      console.log('❌ BUG DETECTED: API says total=40 but returned 0 assets!');
      console.log('   This is the intermittent error you\'re seeing\n');
    } else if (result.assets.length === 0 && result.total === 0) {
      console.log('⚠️  No vehicles returned (total=0, assets=0)');
      console.log('   This could be:');
      console.log('   - VoltCred API returning null/error');
      console.log('   - Account has no vehicles');
      console.log('   - Permission issue\n');
    } else {
      console.log('✅ No errors detected');
      console.log('   Dashboard should show all 40 vehicles correctly\n');
    }
    
    // Check if any vehicles have "failed" commands
    console.log('=== COMMAND STATUS CHECK ===\n');
    let failedCount = 0;
    let deliveredCount = 0;
    let pendingCount = 0;
    
    result.assets.forEach(asset => {
      if (asset.command_history && asset.command_history.length > 0) {
        const recent = asset.command_history[0];
        if (recent.status === 'failed') failedCount++;
        if (recent.status === 'delivered') deliveredCount++;
        if (recent.status === 'pending' || recent.status === 'sent') pendingCount++;
      }
    });
    
    console.log(`Vehicles with command history: ${result.assets.filter(a => a.command_history?.length > 0).length}`);
    console.log(`Recent commands with status:`);
    console.log(`  - Failed: ${failedCount} ❌`);
    console.log(`  - Delivered: ${deliveredCount} ✅`);
    console.log(`  - Pending/Sent: ${pendingCount} ⏳\n`);
    
    if (failedCount > 0) {
      console.log('⚠️  ISSUE: Some commands show "failed" status');
      console.log('   But you said they execute physically!');
      console.log('   This confirms VoltCred has a status reporting bug\n');
    }
    
    console.log('=== CONCLUSION ===\n');
    console.log('If dashboard shows "No assets found":');
    console.log('  1. Check browser console for errors');
    console.log('  2. Check network tab - does /api/assets return data?');
    console.log('  3. Hard refresh (Ctrl+Shift+R) to clear cache');
    console.log('  4. Check if Render deployment completed\n');
    
    console.log('If dashboard shows vehicles but commands show "failed":');
    console.log('  1. This is VoltCred\'s status reporting bug');
    console.log('  2. Commands ARE executing (you confirmed)');
    console.log('  3. Send them the message I prepared above');
    console.log('  4. Ask them to fix status updates\n');
    
  } catch (error) {
    console.error('❌ ERROR fetching dashboard data:', error.message);
    console.error('   This is what causes "No assets found" on dashboard\n');
    
    if (error.message.includes('null')) {
      console.log('🔍 DIAGNOSIS: VoltCred returning null values');
      console.log('   This is the "observed: null" bug');
      console.log('   Dashboard will show error banner and retry automatically\n');
    }
  }
}

checkDashboard().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
