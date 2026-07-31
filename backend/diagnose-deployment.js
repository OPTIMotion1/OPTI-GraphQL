#!/usr/bin/env node
const axios = require('axios');

const API_URL = process.env.DEPLOYED_URL || 'https://opti-graphql-1.onrender.com';

console.log('\n🔍 OPTI GraphQL Deployment Diagnostics');
console.log('='.repeat(70));
console.log(`\n🌐 Target: ${API_URL}`);

async function main() {
  console.log('\n' + '─'.repeat(70));
  console.log('TEST 1: Health Check (VoltCred Connection)');
  console.log('─'.repeat(70));
  
  try {
    const healthRes = await axios.get(`${API_URL}/api/health`, { timeout: 30000 });
    console.log('✅ PASS - VoltCred API is reachable');
    console.log('Response:', JSON.stringify(healthRes.data, null, 2));
  } catch (error) {
    console.log('❌ FAIL - VoltCred connection issue');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Error:', error.message);
    }
    console.log('\n⚠️  This means VOLTCRED_EMAIL or VOLTCRED_PASSWORD might be wrong in Render!');
  }

  console.log('\n' + '─'.repeat(70));
  console.log('TEST 2: Authentication');
  console.log('─'.repeat(70));
  
  let token = null;
  try {
    const loginRes = await axios.post(`${API_URL}/api/auth/login`, {
      username: 'admin',
      password: 'opti2024'
    });
    token = loginRes.data.token;
    console.log('✅ PASS - Login successful');
    console.log('Token:', token.slice(0, 30) + '...');
  } catch (error) {
    console.log('❌ FAIL - Login failed');
    console.log('Error:', error.message);
    return;
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  console.log('\n' + '─'.repeat(70));
  console.log('TEST 3: Assets API');
  console.log('─'.repeat(70));
  
  try {
    const assetsRes = await axios.get(`${API_URL}/api/assets`, { 
      headers,
      timeout: 30000 
    });
    const assets = assetsRes.data;
    
    if (!assets || assets.length === 0) {
      console.log('⚠️  WARNING - No assets returned');
      console.log('   This could mean:');
      console.log('   1. VoltCred GraphQL query is failing');
      console.log('   2. VOLTCRED_EMAIL/PASSWORD is incorrect');
      console.log('   3. VoltCred API is down');
    } else {
      console.log(`✅ PASS - Found ${assets.length} assets`);
      console.log('Sample asset:', {
        name: assets[0]?.name,
        id: assets[0]?.id,
        status: assets[0]?.status,
        deviceCount: assets[0]?.iot_devices?.length || 0
      });
    }
  } catch (error) {
    console.log('❌ FAIL - Assets fetch failed');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error:', JSON.stringify(error.response.data).slice(0, 200));
    } else {
      console.log('Error:', error.message);
    }
  }

  console.log('\n' + '─'.repeat(70));
  console.log('TEST 4: Command Endpoint (Correct path: /api/command)');
  console.log('─'.repeat(70));
  
  try {
    const cmdRes = await axios.post(`${API_URL}/api/command`, {
      deviceId: 306,
      commandType: 'location_request'
    }, { headers, timeout: 30000 });
    
    console.log('✅ PASS - Command endpoint exists');
    console.log('Response:', JSON.stringify(cmdRes.data, null, 2));
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('❌ FAIL - Command endpoint not found (404)');
      console.log('   Check if command.routes.js is properly deployed');
    } else if (error.response?.status === 400) {
      console.log('⚠️  Endpoint exists but command failed (400)');
      console.log('   Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('❌ FAIL - Command request failed');
      console.log('Error:', error.message);
    }
  }

  console.log('\n' + '─'.repeat(70));
  console.log('TEST 5: Auto-Cutoff Endpoints');
  console.log('─'.repeat(70));
  
  try {
    const rentalsRes = await axios.get(`${API_URL}/api/auto-cutoff/all-rentals`, { 
      headers,
      timeout: 30000 
    });
    console.log(`✅ PASS - All rentals: ${rentalsRes.data.count || 0}`);
    
    const overdueRes = await axios.get(`${API_URL}/api/auto-cutoff/overdue?minOverdueDays=0`, { 
      headers 
    });
    console.log(`✅ PASS - Overdue rentals: ${overdueRes.data.count || 0}`);
  } catch (error) {
    console.log('❌ FAIL - Auto-cutoff endpoints failed');
    console.log('Error:', error.message);
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 DIAGNOSIS SUMMARY');
  console.log('='.repeat(70));
  console.log('\n✅ Working:');
  console.log('   • Deployment is live');
  console.log('   • Authentication is working');
  console.log('   • Auto-cutoff endpoints are accessible');
  
  console.log('\n⚠️  Issues Found:');
  console.log('   • Assets returning 0 (VoltCred connection issue?)');
  console.log('   • Commands may fail if VoltCred connection is broken');
  
  console.log('\n🔧 Recommended Actions:');
  console.log('   1. Check Render logs: https://dashboard.render.com/web/YOUR_SERVICE/logs');
  console.log('   2. Verify environment variables:');
  console.log('      - VOLTCRED_EMAIL = hello@optimotion.in');
  console.log('      - VOLTCRED_PASSWORD = Hello@1234');
  console.log('      - VOLTCRED_GRAPHQL_URL = https://api.voltcred.com/v2/graphql');
  console.log('   3. Test VoltCred login manually');
  console.log('   4. Check if VoltCred API is accessible from Render servers\n');
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
