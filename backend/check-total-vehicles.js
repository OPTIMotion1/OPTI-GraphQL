#!/usr/bin/env node
require('dotenv').config();
const { graphqlRequest, login } = require('./src/services/voltcred.service');

async function main() {
  await login();
  
  // Simple query without state fields that might have nulls
  const query = `
    query {
      assetsWithPagination(limit: 200) {
        total
        rows {
          name
          iot_devices {
            device_id
          }
        }
      }
    }
  `;
  
  const data = await graphqlRequest(query);
  const result = data?.assetsWithPagination;
  
  console.log('\n📊 VoltCred Account Summary');
  console.log('='.repeat(80));
  console.log(`\nTotal Vehicles: ${result.total}`);
  console.log(`\nAll Device IMEIs:\n`);
  
  result.rows.forEach((asset, i) => {
    const imei = asset.iot_devices[0]?.device_id || 'No device';
    console.log(`${i + 1}. ${imei}`);
  });
  
  console.log('\n' + '='.repeat(80));
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
