// Check location for device 864540081617896
require('dotenv').config();
const { graphqlRequest } = require('./src/services/voltcred.service');

async function checkLocation() {
  const targetIMEI = '864540081617896';
  
  console.log(`\n=== CHECKING LOCATION FOR ${targetIMEI} ===\n`);
  
  // Get all assets with location data
  const query = `
    query {
      assetsWithPagination(limit: 50) {
        rows {
          id
          name
          status
          primary_iot_device {
            id
            device_id
            location {
              latitude
              longitude
              address
              speed
              bearing
              timestamp
            }
          }
          iot_devices {
            id
            device_id
            iot_type_code
            connection_status
            last_communication
            location {
              latitude
              longitude
              address
              speed
              bearing
              timestamp
            }
          }
        }
      }
    }
  `;
  
  const data = await graphqlRequest(query);
  const assets = data.assetsWithPagination.rows;
  
  // Find the device
  let found = false;
  for (const asset of assets) {
    for (const device of asset.iot_devices) {
      if (device.device_id === targetIMEI) {
        found = true;
        
        console.log('✅ Device Found!\n');
        console.log('DEVICE INFO:');
        console.log(`  IMEI: ${device.device_id}`);
        console.log(`  Device ID: ${device.id}`);
        console.log(`  Type: ${device.iot_type_code}`);
        console.log(`  Connection: ${device.connection_status}`);
        console.log(`  Last Communication: ${device.last_communication}\n`);
        
        console.log('ASSET INFO:');
        console.log(`  Asset ID: ${asset.id}`);
        console.log(`  Asset Name: ${asset.name}`);
        console.log(`  Status: ${asset.status}\n`);
        
        console.log('=== LOCATION DATA ===\n');
        
        // Check primary device location
        console.log('1. PRIMARY DEVICE LOCATION:');
        const primaryLoc = asset.primary_iot_device?.location;
        if (primaryLoc) {
          console.log(`   Latitude: ${primaryLoc.latitude}`);
          console.log(`   Longitude: ${primaryLoc.longitude}`);
          console.log(`   Address: ${primaryLoc.address || 'N/A'}`);
          console.log(`   Speed: ${primaryLoc.speed || 'N/A'}`);
          console.log(`   Bearing: ${primaryLoc.bearing || 'N/A'}`);
          console.log(`   Timestamp: ${primaryLoc.timestamp || 'N/A'}\n`);
          
          // Google Maps link
          const mapsLink = `https://www.google.com/maps?q=${primaryLoc.latitude},${primaryLoc.longitude}`;
          console.log(`   Google Maps: ${mapsLink}\n`);
        } else {
          console.log('   ❌ No primary device location data\n');
        }
        
        // Check device-level location
        console.log('2. DEVICE-LEVEL LOCATION (this specific device):');
        if (device.location) {
          console.log(`   Latitude: ${device.location.latitude}`);
          console.log(`   Longitude: ${device.location.longitude}`);
          console.log(`   Address: ${device.location.address || 'N/A'}`);
          console.log(`   Speed: ${device.location.speed || 'N/A'}`);
          console.log(`   Bearing: ${device.location.bearing || 'N/A'}`);
          console.log(`   Timestamp: ${device.location.timestamp || 'N/A'}\n`);
          
          // Google Maps link
          const mapsLink = `https://www.google.com/maps?q=${device.location.latitude},${device.location.longitude}`;
          console.log(`   Google Maps: ${mapsLink}\n`);
        } else {
          console.log('   ❌ No device-level location data\n');
        }
        
        // Analysis
        console.log('=== ANALYSIS ===\n');
        
        if (primaryLoc || device.location) {
          const loc = device.location || primaryLoc;
          const timeSince = loc.timestamp ? getTimeSince(loc.timestamp) : 'unknown';
          
          console.log(`✅ GPS data available`);
          console.log(`   Last update: ${timeSince}`);
          
          if (device.location) {
            console.log(`   Data source: Device-specific location`);
          } else if (primaryLoc) {
            console.log(`   Data source: Primary device location (inherited)`);
          }
          
          if (loc.address) {
            console.log(`   Reverse geocoded: Yes`);
            console.log(`   Address: ${loc.address}`);
          } else {
            console.log(`   Reverse geocoded: No (only lat/lng)`);
          }
        } else {
          console.log(`❌ No GPS data available for this device`);
          console.log(`   Possible reasons:`);
          console.log(`   - Device never sent GPS data`);
          console.log(`   - Device not properly configured`);
          console.log(`   - GPS antenna issue`);
        }
        
        break;
      }
    }
    if (found) break;
  }
  
  if (!found) {
    console.log(`❌ Device ${targetIMEI} not found in account`);
    console.log(`   This device may not be added to support@optimotion.in yet\n`);
  }
}

function getTimeSince(timestamp) {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days ago`;
  } catch {
    return timestamp;
  }
}

checkLocation().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
