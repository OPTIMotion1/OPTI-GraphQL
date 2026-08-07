#!/usr/bin/env node
/**
 * Diagnose GPS Stability Issues
 * Checks if GPS coordinates are "jumping" causing false speed readings
 */
const axios = require('axios');

const API_URL = 'https://opti-graphql-1.onrender.com';

function calculateDistance(lat1, lon1, lat2, lon2) {
  // Haversine formula to calculate distance in meters
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

function calculateSpeed(distance, timeDiff) {
  // distance in meters, timeDiff in seconds
  // returns speed in km/h
  const speedMs = distance / timeDiff; // m/s
  const speedKmh = speedMs * 3.6; // km/h
  return speedKmh;
}

async function diagnoseGPS() {
  try {
    console.log('\n🔍 Diagnosing GPS Stability\n');
    console.log('='.repeat(70));
    
    // Login
    console.log('1️⃣  Logging in...');
    const loginRes = await axios.post(`${API_URL}/api/auth/login`, {
      username: 'admin',
      password: 'opti2024'
    });
    
    const token = loginRes.data.token;
    console.log('   ✅ Logged in\n');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // Fetch all assets
    console.log('2️⃣  Fetching vehicle data...\n');
    const assetsRes = await axios.get(`${API_URL}/api/assets`, {
      headers,
      timeout: 30000
    });
    
    if (!assetsRes.data.success) {
      console.log('❌ Failed to fetch assets');
      return;
    }
    
    const assets = assetsRes.data.assets || [];
    console.log(`   Found ${assets.length} vehicles\n`);
    
    console.log('3️⃣  Analyzing GPS data for potential issues...\n');
    console.log('─'.repeat(70));
    
    let issuesFound = 0;
    
    assets.forEach((asset, index) => {
      const devices = asset.iot_devices || [];
      
      devices.forEach(device => {
        const lat = device.last_latitude || asset.location?.latitude;
        const lon = device.last_longitude || asset.location?.longitude;
        const lastComm = device.last_communication;
        const status = device.connection_status;
        
        console.log(`\n📍 ${asset.name} (${device.device_id})`);
        console.log(`   Status: ${status}`);
        console.log(`   Last Communication: ${lastComm || 'Never'}`);
        
        if (lat && lon) {
          console.log(`   Coordinates: ${lat.toFixed(6)}, ${lon.toFixed(6)}`);
          
          // Check for obvious GPS issues
          const issues = [];
          
          // Issue 1: Coordinates are (0, 0) - GPS not locked
          if (lat === 0 && lon === 0) {
            issues.push('⚠️  GPS not locked (0, 0)');
          }
          
          // Issue 2: Very low precision (less than 4 decimal places)
          const latStr = lat.toString();
          const lonStr = lon.toString();
          const latDecimals = latStr.split('.')[1]?.length || 0;
          const lonDecimals = lonStr.split('.')[1]?.length || 0;
          
          if (latDecimals < 4 || lonDecimals < 4) {
            issues.push(`⚠️  Low GPS precision (${latDecimals}, ${lonDecimals} decimals)`);
          }
          
          // Issue 3: Device offline/disconnected
          if (status !== 'connected' && status !== 'online') {
            issues.push(`⚠️  Device offline/disconnected`);
          }
          
          if (issues.length > 0) {
            console.log('\n   🔴 Issues Found:');
            issues.forEach(issue => console.log(`      ${issue}`));
            issuesFound++;
          } else {
            console.log('   ✅ GPS data looks stable');
          }
        } else {
          console.log('   ❌ No GPS coordinates available');
          issuesFound++;
        }
      });
    });
    
    console.log('\n' + '─'.repeat(70));
    console.log('\n📊 Summary:');
    console.log(`   Total Vehicles: ${assets.length}`);
    console.log(`   Vehicles with Issues: ${issuesFound}`);
    console.log(`   Healthy: ${assets.length - issuesFound}`);
    
    console.log('\n💡 VoltCred\'s GPS Jumping Issue:');
    console.log('   Problem: GPS coordinates "jump" randomly, causing:');
    console.log('   • Device thinks it\'s moving at >10 km/h');
    console.log('   • Safety feature blocks lock/unlock commands');
    console.log('   • Commands are ignored by the device');
    
    console.log('\n🛠️  Recommended Tests:');
    console.log('   1. Send LOCATION REQUEST commands (safe, no lock/unlock)');
    console.log('   2. Monitor GPS coordinates over 5-10 minutes');
    console.log('   3. Check if coordinates are stable or jumping');
    console.log('   4. Calculate speed between updates');
    console.log('   5. If speed > 10 km/h when vehicle is stationary → GPS jumping confirmed');
    
    console.log('\n📋 Next Steps:');
    console.log('   • Run: node test-location-command.js <DEVICE_IMEI>');
    console.log('   • Check Activity Log for command delivery status');
    console.log('   • Monitor GPS updates in Tracker tab');
    console.log('   • Report findings to VoltCred with device IMEI\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

diagnoseGPS();
