#!/usr/bin/env node
require('dotenv').config();
const { getAssets } = require('./src/services/voltcred.service');
const axios = require('axios');

const VOLTCRED_API_URL = 'https://api.voltcred.com/v2/graphql';
const VOLTCRED_API_KEY = process.env.VOLTCRED_API_KEY;
const DEVICE_IMEI = '864540080376247'; // J00011

async function main() {
  try {
    console.log('\n🔍 Checking Command History for J00011');
    console.log('='.repeat(60));
    console.log(`Device IMEI: ${DEVICE_IMEI}\n`);

    // Get device ID
    const result = await getAssets();
    const assets = result.assets || [];
    let deviceId = null;

    for (const asset of assets) {
      for (const device of asset.iot_devices || []) {
        if (device.device_id === DEVICE_IMEI) {
          deviceId = parseInt(device.id);
          console.log(`Found device ID: ${deviceId}\n`);
          break;
        }
      }
      if (deviceId) break;
    }

    if (!deviceId) {
      console.log('❌ Device not found\n');
      return;
    }

    // Query commands for this device
    const query = `
      query {
        deviceCommands(device_id: ${deviceId}, limit: 20) {
          id
          command_type
          status
          executed_at
        }
      }
    `;

    const response = await axios.post(VOLTCRED_API_URL, 
      { query },
      {
        headers: {
          'Authorization': `Bearer ${VOLTCRED_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    if (response.data.errors) {
      console.error('❌ GraphQL Errors:', JSON.stringify(response.data.errors, null, 2));
      return;
    }

    const commands = response.data?.data?.deviceCommands || [];

    if (commands.length === 0) {
      console.log('✅ No commands found for this device');
      console.log('   Safe to send lock command\n');
      return;
    }

    console.log(`📋 Found ${commands.length} recent commands:\n`);
    console.log('─'.repeat(60));

    // Find latest lock/unlock commands
    let latestLock = null;
    let latestUnlock = null;
    let pendingCommands = [];

    commands.forEach(cmd => {
      const status = cmd.status || 'unknown';
      const emoji = status === 'pending' ? '⏳' : 
                    status === 'completed' ? '✅' : 
                    status === 'failed' ? '❌' : '⚠️';
      
      console.log(`${emoji} Command #${cmd.id}`);
      console.log(`   Type: ${cmd.command_type}`);
      console.log(`   Status: ${status}`);
      console.log(`   Requested: ${cmd.requested_at}`);
      if (cmd.executed_at) {
        console.log(`   Executed: ${cmd.executed_at}`);
      }
      if (cmd.result) {
        console.log(`   Result: ${cmd.result}`);
      }
      console.log('');

      // Track pending commands
      if (status === 'pending' || status === 'queued') {
        pendingCommands.push(cmd);
      }

      // Track latest lock/unlock
      if (cmd.command_type === 'engine_cutoff' && (!latestLock || cmd.id > latestLock.id)) {
        latestLock = cmd;
      }
      if (cmd.command_type === 'engine_restore' && (!latestUnlock || cmd.id > latestUnlock.id)) {
        latestUnlock = cmd;
      }
    });

    console.log('─'.repeat(60));
    console.log('🔍 ANALYSIS:');
    console.log('─'.repeat(60));

    // Check for pending commands
    if (pendingCommands.length > 0) {
      console.log('⚠️  PENDING COMMANDS DETECTED!');
      pendingCommands.forEach(cmd => {
        console.log(`   ⏳ Command #${cmd.id}: ${cmd.command_type} (${cmd.status})`);
      });
      console.log('\n❌ DO NOT SEND NEW COMMANDS!');
      console.log('   Wait for pending commands to complete first');
      console.log('   Device may be offline/sleeping (typical for gt06)');
      console.log('   Commands will execute when device wakes (10-15 min)\n');
      return;
    }

    // Determine current state
    if (!latestLock && !latestUnlock) {
      console.log('✅ No lock/unlock commands in history');
      console.log('   Vehicle is likely UNLOCKED (default state)');
      console.log('   Safe to send lock command if needed\n');
      return;
    }

    if (latestLock && !latestUnlock) {
      console.log(`🔒 Latest command: LOCK (Command #${latestLock.id})`);
      console.log(`   Status: ${latestLock.status}`);
      if (latestLock.status === 'completed') {
        console.log('   ⚠️  Vehicle should be LOCKED');
        console.log('   DO NOT send another lock command!\n');
      } else {
        console.log('   Vehicle lock state uncertain\n');
      }
    } else if (latestUnlock && !latestLock) {
      console.log(`🔓 Latest command: UNLOCK (Command #${latestUnlock.id})`);
      console.log(`   Status: ${latestUnlock.status}`);
      if (latestUnlock.status === 'completed') {
        console.log('   ✅ Vehicle should be UNLOCKED');
        console.log('   Safe to send lock command if needed\n');
      }
    } else {
      // Compare timestamps
      const lockId = parseInt(latestLock.id);
      const unlockId = parseInt(latestUnlock.id);
      
      if (lockId > unlockId) {
        console.log(`🔒 Latest command: LOCK (Command #${latestLock.id})`);
        console.log(`   Status: ${latestLock.status}`);
        if (latestLock.status === 'completed') {
          console.log('   ⚠️  Vehicle should be LOCKED');
          console.log('   DO NOT send another lock command!\n');
        }
      } else {
        console.log(`🔓 Latest command: UNLOCK (Command #${latestUnlock.id})`);
        console.log(`   Status: ${latestUnlock.status}`);
        if (latestUnlock.status === 'completed') {
          console.log('   ✅ Vehicle should be UNLOCKED');
          console.log('   Safe to send lock command if needed\n');
        }
      }
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

main();
