#!/usr/bin/env node
require('dotenv').config();
const axios = require('axios');

const GRAPHQL_URL = process.env.VOLTCRED_GRAPHQL_URL;
const EMAIL = process.env.VOLTCRED_EMAIL;
const PASSWORD = process.env.VOLTCRED_PASSWORD;

async function diagnoseVehicleData() {
  console.log('🔍 Diagnosing Vehicle Data from VoltCred\n');

  try {
    // Login
    const loginQuery = `
      mutation Login($email: String!, $password: String!) {
        sessionCreateV2(data: { email: $email, password: $password }) {
          token success messageKey
        }
      }
    `;

    const loginRes = await axios.post(
      GRAPHQL_URL,
      { query: loginQuery, variables: { email: EMAIL, password: PASSWORD }},
      { headers: { "Content-Type": "application/json", "Cookie": "device=web" }}
    );

    const token = loginRes.data?.data?.sessionCreateV2?.token;
    console.log('✅ Logged in\n');

    // Get full vehicle data
    const query = `
      query ListAssetsPage($limit: Int, $offset: Int) {
        assetsWithPagination(limit: $limit, offset: $offset) {
          total
          counts {
            moving
            idle
            stopped
            offline
            untracked
            total
          }
          rows {
            id
            name
            license_plate
            operator_name
            model
            asset_type
            status
            primary_iot_device {
              id
              name
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
              state {
                key
                label
                kind
                unit
                value
                observed
                updated_at
                stale
                writable
                direction
              }
            }
            iot_devices {
              id
              name
              device_id
              iot_type_code
              connection_status
            }
          }
        }
      }
    `;

    const res = await axios.post(
      GRAPHQL_URL,
      { query, variables: { limit: 10, offset: 0 }},
      { 
        headers: {
          "Content-Type": "application/json",
          "Cookie": `authorization=${token}; device=web`,
        }
      }
    );

    const result = res.data?.data?.assetsWithPagination;
    
    console.log('📊 Total vehicles:', result.total);
    console.log('📊 Moving:', result.counts.moving);
    console.log('📊 Vehicles in response:', result.rows.length);
    console.log('');

    // Find a moving vehicle
    const movingVehicle = result.rows.find(v => v.status === 'moving');
    
    if (movingVehicle) {
      console.log('🚗 Found MOVING vehicle:\n');
      console.log('ID:', movingVehicle.id);
      console.log('Name:', movingVehicle.name);
      console.log('License Plate:', movingVehicle.license_plate);
      console.log('Operator Name:', movingVehicle.operator_name);
      console.log('Model:', movingVehicle.model);
      console.log('Status:', movingVehicle.status);
      console.log('');
      
      console.log('📡 Primary IoT Device:');
      if (movingVehicle.primary_iot_device) {
        const dev = movingVehicle.primary_iot_device;
        console.log('  ID:', dev.id);
        console.log('  Name:', dev.name);
        console.log('  Device ID:', dev.device_id);
        console.log('  Type:', dev.iot_type_code);
        console.log('  Connection:', dev.connection_status);
        console.log('  Last Comm:', dev.last_communication);
        console.log('');
        
        console.log('  📍 Location:');
        if (dev.location) {
          console.log('    Lat:', dev.location.latitude);
          console.log('    Lng:', dev.location.longitude);
          console.log('    Address:', dev.location.address);
          console.log('    Speed:', dev.location.speed);
          console.log('    Bearing:', dev.location.bearing);
          console.log('    Timestamp:', dev.location.timestamp);
        } else {
          console.log('    ❌ No location data');
        }
        console.log('');
        
        console.log('  🔧 Device State:');
        if (dev.state && dev.state.length > 0) {
          dev.state.forEach(s => {
            console.log(`    ${s.key}: ${s.value} (${s.label})`);
            console.log(`      Observed: ${s.observed}, Stale: ${s.stale}, Writable: ${s.writable}`);
          });
        } else {
          console.log('    ❌ No state data');
        }
      } else {
        console.log('  ❌ No primary_iot_device');
      }
      console.log('');
      
      console.log('📋 All IoT Devices:', movingVehicle.iot_devices.length);
      movingVehicle.iot_devices.forEach((dev, i) => {
        console.log(`  ${i + 1}. ${dev.name || dev.device_id} (${dev.iot_type_code}) - ${dev.connection_status}`);
      });
    } else {
      console.log('⚠️  No moving vehicles found in first 10');
    }
    
    console.log('\n\n📄 FULL RAW DATA (First Vehicle):');
    console.log(JSON.stringify(result.rows[0], null, 2));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

diagnoseVehicleData();
