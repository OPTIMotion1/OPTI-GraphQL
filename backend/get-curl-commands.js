#!/usr/bin/env node
const axios = require('axios');

const GRAPHQL_URL = "https://api.voltcred.com/v2/graphql";
const EMAIL = "hello@optimotion.in";
const PASSWORD = "Hello@1234";

console.log('\n========================================');
console.log('GENERATING CURL COMMANDS FOR VOLTCRED');
console.log('========================================\n');

async function main() {
  try {
    // Step 1: Login
    console.log('STEP 1: Login Command');
    console.log('----------------------------------------\n');
    
    const loginQuery = {
      query: `mutation Login($email: String!, $password: String!) { sessionCreateV2(data: { email: $email, password: $password }) { token success messageKey } }`,
      variables: { email: EMAIL, password: PASSWORD }
    };
    
    const loginBody = JSON.stringify(loginQuery).replace(/"/g, '\\"');
    
    console.log('curl -X POST https://api.voltcred.com/v2/graphql \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -H "Cookie: device=web" \\');
    console.log(`  -d "${loginBody}"`);
    console.log('\n');
    
    // Actually login to get token
    const loginRes = await axios.post(GRAPHQL_URL, loginQuery, {
      headers: {
        "Content-Type": "application/json",
        "Cookie": "device=web"
      }
    });
    
    const token = loginRes.data.data.sessionCreateV2.token;
    console.log('✅ Login Response:');
    console.log(JSON.stringify(loginRes.data, null, 2));
    console.log('\n');
    
    // Step 2: Send command
    console.log('\n========================================');
    console.log('STEP 2: Command with STATUS field');
    console.log('----------------------------------------\n');
    
    const commandQuery = {
      query: `mutation SendCommand($deviceId: Int!, $command: CommandType!) { executeDeviceCommand(device_id: $deviceId, command_type: $command) { id command_code status execution_time } }`,
      variables: { deviceId: 306, command: "location_request" }
    };
    
    const commandBody = JSON.stringify(commandQuery).replace(/"/g, '\\"');
    
    console.log('curl -X POST https://api.voltcred.com/v2/graphql \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log(`  -H "Cookie: authorization=${token}; device=web" \\`);
    console.log(`  -d "${commandBody}"`);
    console.log('\n');
    
    // Actually send command
    const commandRes = await axios.post(GRAPHQL_URL, commandQuery, {
      headers: {
        "Content-Type": "application/json",
        "Cookie": `authorization=${token}; device=web`
      }
    });
    
    console.log('✅ Command Response:');
    console.log(JSON.stringify(commandRes.data, null, 2));
    
    if (commandRes.data.data.executeDeviceCommand.status) {
      console.log('\n========================================');
      console.log('✅ PROOF: status field EXISTS!');
      console.log('========================================');
      console.log(`Status value: "${commandRes.data.data.executeDeviceCommand.status}"`);
      console.log('\n👉 Copy the curl commands above and send to VoltCred support team');
      console.log('👉 This proves they DO expose the status field\n');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

main();
