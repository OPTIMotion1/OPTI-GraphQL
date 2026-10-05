// Check if VoltCred API has immobilizer status field
require('dotenv').config();
const { graphqlRequest } = require('./src/services/voltcred.service');

async function checkImmobilizerField() {
  console.log('=== Checking VoltCred API for immobilizer status ===\n');
  
  // Test device: 864540081870131 (F00112)
  const deviceId = 488; // Asset ID from our unmapped list check
  
  try {
    // Query 1: Check device state with all available fields
    console.log('1. Querying device state with immobilizer field...\n');
    
    const query1 = `
      query GetDeviceState($deviceId: Int!) {
        device(id: $deviceId) {
          id
          device_id
          name
          connection_status
          immobilizer
          state {
            immobilizer {
              value
              observed
              unit
            }
            engine_status {
              value
              observed
            }
            ignition {
              value
              observed
            }
          }
        }
      }
    `;
    
    try {
      const result1 = await graphqlRequest(query1, { deviceId: parseInt(deviceId, 10) });
      console.log('✅ Device query result:');
      console.log(JSON.stringify(result1, null, 2));
    } catch (error) {
      console.log('❌ Error with immobilizer field:', error.message);
      console.log('   This field might not exist or requires different query structure\n');
    }
    
    // Query 2: Try asset-level query
    console.log('\n2. Querying asset-level immobilizer status...\n');
    
    const query2 = `
      query GetAssetState {
        assetsWithPagination(limit: 1, offset: 0) {
          rows {
            id
            name
            state {
              immobilizer {
                value
                observed
                unit
              }
              engine_status {
                value
                observed
              }
            }
            primary_iot_device {
              id
              device_id
              immobilizer
              state {
                immobilizer {
                  value
                  observed
                }
              }
            }
          }
        }
      }
    `;
    
    try {
      const result2 = await graphqlRequest(query2);
      console.log('✅ Asset query result:');
      console.log(JSON.stringify(result2, null, 2));
    } catch (error) {
      console.log('❌ Error:', error.message);
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

checkImmobilizerField();
