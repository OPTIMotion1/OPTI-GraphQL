require('dotenv').config();
const { login, graphqlRequest } = require('./src/services/voltcred.service');

const GET_ALL_ASSETS = `
  query ListAssetsPage($limit: Int, $offset: Int) {
    assetsWithPagination(limit: $limit, offset: $offset) {
      total
      rows {
        id
        name
        primary_iot_device {
          id
          device_id
          connection_status
        }
      }
    }
  }
`;

async function getAllJSeriesVehicles() {
  try {
    console.log('Logging into VoltCred...');
    await login();
    
    console.log('Fetching all assets...');
    
    const response = await graphqlRequest(GET_ALL_ASSETS, {
      limit: 200,
      offset: 0
    });
    
    const allAssets = response.assetsWithPagination?.rows || [];
    
    console.log(`\nTotal assets fetched: ${allAssets.length}`);
    
    console.log(`\n=== ALL VEHICLES WITH IMEI ===\n`);
    
    allAssets
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      .forEach(vehicle => {
        const imei = vehicle.primary_iot_device?.device_id || 'NO DEVICE';
        const status = vehicle.primary_iot_device?.connection_status || 'N/A';
        const id = vehicle.id;
        
        console.log(`Name: ${(vehicle.name || 'UNNAMED').padEnd(18)} | IMEI: ${imei.padEnd(18)} | Status: ${status.padEnd(12)} | ID: ${id}`);
      });
    
    // Now load the mapping file to show which are J-series
    const fs = require('fs');
    const path = require('path');
    const mappingPath = path.join(__dirname, 'data', 'vehicle-imei-mapping.json');
    
    let mapping = {};
    try {
      const mappingData = fs.readFileSync(mappingPath, 'utf8');
      mapping = JSON.parse(mappingData);
      delete mapping._comment;
      delete mapping._instructions;
    } catch (err) {
      console.log('\nNote: Could not load mapping file');
    }
    
    console.log(`\n=== J-SERIES VEHICLES (from mapping) ===\n`);
    
    Object.entries(mapping)
      .filter(([imei, chassis]) => chassis.startsWith('J00'))
      .sort((a, b) => a[1].localeCompare(b[1]))
      .forEach(([imei, chassis]) => {
        const vehicle = allAssets.find(v => v.name === imei || v.primary_iot_device?.device_id === imei);
        const status = vehicle?.primary_iot_device?.connection_status || 'NOT FOUND';
        console.log(`${chassis.padEnd(10)} | IMEI: ${imei.padEnd(18)} | Status: ${status}`);
      });
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

getAllJSeriesVehicles();
