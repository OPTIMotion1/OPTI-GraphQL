#!/usr/bin/env node
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:5001';

async function checkBulkStatus() {
  try {
    // Login first
    console.log('🔐 Logging in...');
    const loginRes = await axios.post(`${API_URL}/api/auth/login`, {
      username: 'admin',
      password: 'opti2024'
    });
    
    const token = loginRes.data.token;
    console.log('✅ Logged in\n');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // Get latest job ID (you need to provide this)
    const jobId = process.argv[2];
    
    if (!jobId) {
      console.log('❌ Please provide Job ID as argument');
      console.log('Usage: node check-bulk-status.js <JOB_ID>');
      console.log('\nExample: node check-bulk-status.js 1738484312000');
      return;
    }
    
    console.log(`📊 Checking status for Job ID: ${jobId}\n`);
    
    const res = await axios.get(`${API_URL}/api/bulk-notify/status/${jobId}`, {
      headers,
      validateStatus: () => true
    });
    
    if (res.status === 404) {
      console.log('❌ Job not found. Make sure the Job ID is correct.');
      return;
    }
    
    if (!res.data.success) {
      console.log('❌ Error:', res.data.error);
      return;
    }
    
    const status = res.data;
    
    console.log('📋 Job Status:');
    console.log('─'.repeat(60));
    console.log(`Status: ${status.status}`);
    console.log(`Total Recipients: ${status.total}`);
    console.log(`✅ Sent: ${status.sent}`);
    console.log(`❌ Failed: ${status.failed}`);
    console.log(`⏳ Pending: ${status.pending}`);
    console.log(`Started: ${new Date(status.startTime).toLocaleString()}`);
    if (status.endTime) {
      console.log(`Ended: ${new Date(status.endTime).toLocaleString()}`);
      console.log(`Duration: ${(status.durationMs / 1000).toFixed(2)}s`);
    }
    console.log('─'.repeat(60));
    
    // Show recent results
    if (status.results && status.results.length > 0) {
      console.log('\n📝 Recent Results (last 10):');
      status.results.slice(-10).forEach((r, i) => {
        const icon = r.success ? '✅' : '❌';
        const msg = r.success 
          ? `${r.name} (${r.phone}) - ${r.status}` 
          : `${r.name} (${r.phone}) - Error: ${r.error}`;
        console.log(`${icon} ${msg}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkBulkStatus();
