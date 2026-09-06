#!/usr/bin/env node
const axios = require('axios');

const API_URL = 'https://opti-graphql-1.onrender.com';
const DEVICE_IMEI = '864540080376247'; // J00011

async function main() {
  try {
    console.log('\n🔍 Checking Recent Commands for J00011');
    console.log('='.repeat(60));
    console.log(`Device IMEI: ${DEVICE_IMEI}\n`);

    // Login
    console.log('1️⃣  Authenticating...');
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

    // Get activity log
    console.log('2️⃣  Fetching activity log...');
    const activityRes = await axios.get(`${API_URL}/api/activity/recent?limit=100`, {
      headers,
      timeout: 30000
    });

    const activities = activityRes.data.logs || [];
    console.log(`   Found ${activities.length} total activities\n`);

    // Filter for commands related to this IMEI
    const deviceCommands = activities.filter(activity => 
      activity.action === 'send_command' && 
      (activity.details?.includes(DEVICE_IMEI) || activity.target?.includes(DEVICE_IMEI))
    );

    if (deviceCommands.length === 0) {
      console.log('✅ No command history found for this device');
      console.log('   Safe to send lock command\n');
      return;
    }

    console.log(`📋 Found ${deviceCommands.length} commands for this device:\n`);
    console.log('─'.repeat(60));

    // Show recent commands
    let latestLock = null;
    let latestUnlock = null;

    deviceCommands.slice(0, 10).forEach((activity, idx) => {
      const timestamp = new Date(activity.timestamp).toLocaleString();
      const details = activity.details || '';
      const isLock = details.toLowerCase().includes('cutoff') || details.toLowerCase().includes('lock');
      const isUnlock = details.toLowerCase().includes('restore') || details.toLowerCase().includes('unlock');
      
      const emoji = isLock ? '🔒' : isUnlock ? '🔓' : '⚡';
      
      console.log(`${emoji} ${timestamp}`);
      console.log(`   User: ${activity.user || 'Unknown'}`);
      console.log(`   Action: ${details}`);
      console.log('');

      if (isLock && !latestLock) {
        latestLock = activity;
      }
      if (isUnlock && !latestUnlock) {
        latestUnlock = activity;
      }
    });

    console.log('─'.repeat(60));
    console.log('🔍 ANALYSIS:');
    console.log('─'.repeat(60));

    if (latestLock && !latestUnlock) {
      const lockTime = new Date(latestLock.timestamp);
      const now = new Date();
      const minutesAgo = Math.floor((now - lockTime) / 1000 / 60);
      
      console.log(`\n🔒 Latest command: LOCK`);
      console.log(`   Sent: ${minutesAgo} minutes ago`);
      console.log(`   Time: ${new Date(latestLock.timestamp).toLocaleString()}`);
      console.log('\n⚠️  WARNING:');
      console.log('   Lock command was recently sent!');
      console.log('   DO NOT send another lock command');
      console.log('   gt06 devices take 10-15 minutes to execute');
      console.log(`   Expected execution: ${15 - minutesAgo} more minutes\n`);
    } else if (latestUnlock) {
      console.log('\n🔓 Latest command: UNLOCK');
      console.log(`   Time: ${new Date(latestUnlock.timestamp).toLocaleString()}`);
      console.log('\n✅ Safe to send lock command if needed\n');
    } else {
      console.log('\n✅ No recent lock/unlock commands found');
      console.log('   Safe to send lock command if needed\n');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      if (error.response.data) {
        console.error('Data:', JSON.stringify(error.response.data, null, 2));
      }
    }
  }
}

main();
