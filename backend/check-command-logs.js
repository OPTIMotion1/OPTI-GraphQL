#!/usr/bin/env node
require('dotenv').config();
const { graphqlRequest } = require('./src/services/voltcred.service');

async function main() {
  const IMEI = '864540080671035';
  
  console.log('\n🔍 Checking VoltCred Command Logs');
  console.log('='.repeat(60));
  console.log(`IMEI: ${IMEI}\n`);

  try {
    // First, get the device_id from IMEI
    const assetsQuery = `
      query ListAssetsPage($limit: Int, $offset: Int) {
        assetsWithPagination(limit: $limit, offset: $offset) {
          rows {
            name
            license_plate
            iot_devices {
              id
              device_id
              iot_type_code
            }
          }
        }
      }
    `;
    
    const assetsData = await graphqlRequest(assetsQuery, { limit: 200, offset: 0 });
    const assets = assetsData?.assetsWithPagination?.rows || [];
    
    let deviceId = null;
    let vehicleName = null;
    
    for (const asset of assets) {
      const device = asset.iot_devices?.find(d => d.device_id === IMEI);
      if (device) {
        deviceId = device.id;
        vehicleName = asset.name || asset.license_plate;
        break;
      }
    }
    
    if (!deviceId) {
      console.log('❌ Device not found with IMEI:', IMEI);
      return;
    }
    
    console.log(`✓ Found Device ID: ${deviceId}`);
    console.log(`✓ Vehicle: ${vehicleName}\n`);

    // Try different queries to find command history
    console.log('📋 Attempting to fetch command logs...\n');

    // Attempt 1: Query device commands
    console.log('1️⃣  Trying: deviceCommands query');
    try {
      const commandsQuery = `
        query GetDeviceCommands($deviceId: Int!) {
          deviceCommands(device_id: $deviceId) {
            id
            command_code
            status
            execution_time
            response
          }
        }
      `;
      const commandsData = await graphqlRequest(commandsQuery, { deviceId: parseInt(deviceId) });
      console.log('✅ SUCCESS - Command logs found:');
      console.log(JSON.stringify(commandsData, null, 2));
    } catch (error) {
      console.log('❌ FAILED:', error.message);
    }

    // Attempt 2: Query control history (suggested by API)
    console.log('\n2️⃣  Trying: controlHistory query');
    try {
      const historyQuery = `
        query GetControlHistory($deviceId: Int!, $limit: Int) {
          controlHistory(device_id: $deviceId, limit: $limit) {
            id
            command_code
            status
            execution_time
            response
          }
        }
      `;
      const historyData = await graphqlRequest(historyQuery, { 
        deviceId: parseInt(deviceId),
        limit: 50 
      });
      console.log('✅ SUCCESS - Control history found:');
      console.log(JSON.stringify(historyData, null, 2));
    } catch (error) {
      console.log('❌ FAILED:', error.message);
    }

    // Attempt 3: Query deviceCommand (single)
    console.log('\n3️⃣  Trying: deviceCommand query (single command lookup)');
    try {
      const singleQuery = `
        query GetDeviceCommand($commandId: Int!) {
          deviceCommand(id: $commandId) {
            id
            command_code
            status
            execution_time
            response
          }
        }
      `;
      const singleData = await graphqlRequest(singleQuery, { commandId: 203 });
      console.log('✅ SUCCESS - Single command found:');
      console.log(JSON.stringify(singleData, null, 2));
    } catch (error) {
      console.log('❌ FAILED:', error.message);
    }

    console.log('\n─'.repeat(60));
    console.log('📊 RESULT:');
    console.log('─'.repeat(60));
    console.log('If all attempts failed, VoltCred API does NOT expose');
    console.log('command logs through GraphQL to customers.');
    console.log('');
    console.log('You would need to:');
    console.log('1. Contact VoltCred support directly');
    console.log('2. Ask them to check backend logs for device:', deviceId);
    console.log('3. Request command execution history for this IMEI');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();
