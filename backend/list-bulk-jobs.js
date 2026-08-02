#!/usr/bin/env node
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:5001';

async function listBulkJobs() {
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
    
    console.log('📋 Fetching all bulk notification jobs...\n');
    
    const res = await axios.get(`${API_URL}/api/bulk-notify/jobs`, {
      headers,
      validateStatus: () => true
    });
    
    if (!res.data.success) {
      console.log('❌ Error:', res.data.error);
      return;
    }
    
    const jobs = res.data.jobs || [];
    
    if (jobs.length === 0) {
      console.log('No bulk notification jobs found.');
      return;
    }
    
    console.log(`Found ${jobs.length} job(s):\n`);
    console.log('─'.repeat(100));
    console.log('Job ID           | Status      | Total | Sent | Failed | Started');
    console.log('─'.repeat(100));
    
    jobs.forEach(job => {
      const startTime = new Date(job.startTime).toLocaleString('en-IN', { 
        dateStyle: 'short', 
        timeStyle: 'short' 
      });
      
      const statusIcon = job.status === 'completed' ? '✅' : 
                        job.status === 'in_progress' ? '⏳' : '❓';
      
      console.log(
        `${job.jobId} | ${statusIcon} ${job.status.padEnd(10)} | ${String(job.total).padStart(5)} | ${String(job.sent).padStart(4)} | ${String(job.failed).padStart(6)} | ${startTime}`
      );
    });
    
    console.log('─'.repeat(100));
    console.log('\nℹ️  To see details of a specific job, run:');
    console.log('   node check-bulk-status.js <JOB_ID>');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

listBulkJobs();
