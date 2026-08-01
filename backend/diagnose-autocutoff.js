#!/usr/bin/env node
const axios = require('axios');

const API_URL = 'https://opti-graphql-1.onrender.com';

console.log('\n🔍 Diagnosing Auto-Cutoff Issue');
console.log('='.repeat(70));

async function diagnose() {
  try {
    // Step 1: Login
    console.log('\n1️⃣  Logging in...');
    const loginRes = await axios.post(`${API_URL}/api/auth/login`, {
      username: 'admin',
      password: 'opti2024'
    });
    
    const token = loginRes.data.token;
    console.log('   ✅ Login successful');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // Step 2: Test Auto-Cutoff API
    console.log('\n2️⃣  Testing /api/auto-cutoff/rentals...');
    
    const startTime = Date.now();
    const rentalsRes = await axios.get(`${API_URL}/api/auto-cutoff/rentals`, { 
      headers,
      timeout: 60000,
      validateStatus: () => true
    });
    const duration = Date.now() - startTime;
    
    console.log(`   Response Status: ${rentalsRes.status}`);
    console.log(`   Response Time: ${duration}ms`);
    
    if (rentalsRes.status !== 200) {
      console.log('\n❌ API returned error:');
      console.log(JSON.stringify(rentalsRes.data, null, 2));
      return;
    }
    
    const data = rentalsRes.data;
    
    console.log('\n📊 Response Structure:');
    console.log(`   success: ${data.success}`);
    console.log(`   all: ${data.all?.length || 0} rentals`);
    console.log(`   overdue: ${data.overdue?.length || 0} rentals`);
    console.log(`   stats.totalRiders: ${data.stats?.totalRiders || 0}`);
    console.log(`   stats.overdueCount: ${data.stats?.overdueCount || 0}`);
    
    if (data.all && data.all.length > 0) {
      console.log('\n✅ Data is being returned!');
      console.log('\n   Sample rental:');
      console.log(JSON.stringify(data.all[0], null, 2));
    } else {
      console.log('\n❌ No rental data returned!');
      console.log('   This means Optimotion API is not returning data.');
      console.log('   Possible causes:');
      console.log('   1. RENEWALS_API_COOKIE expired (most likely)');
      console.log('   2. Optimotion API endpoint changed');
      console.log('   3. Network/firewall issue');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === 'ECONNABORTED') {
      console.error('   Request timed out - API is too slow or unresponsive');
    }
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2).substring(0, 500));
    }
  }
}

diagnose();
