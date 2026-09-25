require('dotenv').config();
const { login, graphqlRequest } = require('./src/services/voltcred.service');

async function checkDevice() {
  try {
    console.log('Logging into VoltCred...');
    await login();
    
    const deviceImei = '864540081617540';
    console.log(`\nChecking device: ${deviceImei}`);
    console.log('='.repeat(60));
    
    // First, find the device ID
    const assetsQuery = `
      query AssetsWithPagination($first: Int!, $after: String) {
        assetsWithPagination(first: $first, after: $after) {
          edges {
            node {
              id
              name
              imei
              status
              latestTelemetry {
                ignition
                location {
                  latitude
                  longitude
                }
              }
            }
          }
        }
      }
    `;
    
    const assetsResult = await graphqlRequest(assetsQuery, { first: 100, after: null });
    const assets = assetsResult?.data?.assetsWithPagination?.edges || [];
    
    const device = assets.find(edge => edge.node.imei === deviceImei);
    
    if (!device) {
      console.log(`❌ Device ${deviceImei} not found`);
      return;
    }
    
    console.log(`\n✅ Device Found:`);
    console.log(`   ID: ${device.node.id}`);
    console.log(`   Name: ${device.node.name}`);
    console.log(`   IMEI: ${device.node.imei}`);
    console.log(`   Status: ${device.node.status}`);
    console.log(`   Ignition: ${device.node.latestTelemetry?.ignition || 'N/A'}`);
    
    if (device.node.latestTelemetry?.location) {
      const loc = device.node.latestTelemetry.location;
      console.log(`   Location: ${loc.latitude}, ${loc.longitude}`);
    }
    
    // Now get command history
    console.log(`\n📋 Command History:`);
    console.log('='.repeat(60));
    
    const commandsQuery = `
      query DeviceCommands($deviceId: ID!, $first: Int!) {
        deviceCommands(deviceId: $deviceId, first: $first) {
          edges {
            node {
              id
              command
              status
              createdAt
              updatedAt
              response
            }
          }
        }
      }
    `;
    
    const commandsResult = await graphqlRequest(commandsQuery, {
      deviceId: device.node.id,
      first: 20
    });
    
    const commands = commandsResult?.data?.deviceCommands?.edges || [];
    
    if (commands.length === 0) {
      console.log('No commands found for this device');
      return;
    }
    
    console.log(`\nTotal Commands: ${commands.length}\n`);
    
    // Sort by createdAt (newest first)
    const sortedCommands = [...commands].sort((a, b) => 
      new Date(b.node.createdAt) - new Date(a.node.createdAt)
    );
    
    sortedCommands.forEach((edge, index) => {
      const cmd = edge.node;
      const createdDate = new Date(cmd.createdAt);
      const updatedDate = new Date(cmd.updatedAt);
      
      console.log(`Command #${index + 1}:`);
      console.log(`   ID: ${cmd.id}`);
      console.log(`   Type: ${cmd.command}`);
      console.log(`   Status: ${cmd.status}`);
      console.log(`   Created: ${createdDate.toISOString()}`);
      console.log(`   Updated: ${updatedDate.toISOString()}`);
      
      if (cmd.response) {
        console.log(`   Response: ${cmd.response}`);
      }
      
      console.log('');
    });
    
    // Check for unlock commands specifically
    const unlockCommands = sortedCommands.filter(edge => 
      edge.node.command === 'engine_restore' || edge.node.command.includes('unlock')
    );
    
    if (unlockCommands.length > 0) {
      console.log(`\n🔓 Unlock Commands (${unlockCommands.length} total):`);
      console.log('='.repeat(60));
      
      unlockCommands.forEach((edge, index) => {
        const cmd = edge.node;
        console.log(`\nUnlock #${index + 1}:`);
        console.log(`   Command ID: ${cmd.id}`);
        console.log(`   Status: ${cmd.status}`);
        console.log(`   Created: ${new Date(cmd.createdAt).toISOString()}`);
        console.log(`   Updated: ${new Date(cmd.updatedAt).toISOString()}`);
        
        if (cmd.status === 'pending') {
          const ageMinutes = Math.floor((Date.now() - new Date(cmd.createdAt)) / 1000 / 60);
          console.log(`   ⚠️  STILL PENDING after ${ageMinutes} minutes`);
          console.log(`   Note: GT06 devices sleep for 10-20 minutes between wake cycles`);
        }
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

checkDevice();
