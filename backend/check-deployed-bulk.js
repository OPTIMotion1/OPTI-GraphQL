#!/usr/bin/env node
const axios = require('axios');

const API_URL = 'https://opti-graphql-1.onrender.com';

async function checkDeployedJobs() {
  try {
    // Login
    console.log('🔐 Logging in to deployed backend...');
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
    
    console.log('📋 Fetching all bulk notification jobs from Render...\n');
    
    const res = await axios.get(`${API_URL}/api/bulk-notify/jobs`, {
      headers,
      timeout: 30000,
      validateStatus: () => true
    });
    
    if (res.status !== 200) {
      console.log('❌ HTTP Error:', res.status);
      console.log('Response:', JSON.stringify(res.data, null, 2));
      return;
    }
    
    if (!res.data.success) {
      console.log('❌ API Error:', res.data.error);
      return;
    }
    
    const jobs = res.data.jobs || [];
    
    if (jobs.length === 0) {
      console.log('ℹ️  No bulk notification jobs found in memory.');
      console.log('   (Note: Jobs are stored in memory and cleared on restart)');
      return;
    }
    
    console.log(`Found ${jobs.length} job(s):\n`);
    console.log('═'.repeat(110));
    console.log('Job ID            | Status       | Total | ✅ Sent | ❌ Failed | Started');
    console.log('═'.repeat(110));
    
    jobs.forEach(job => {
      const startTime = new Date(job.startTime).toLocaleString('en-IN', { 
        dateStyle: 'short', 
        timeStyle: 'short' 
      });
      
      const statusIcon = job.status === 'completed' ? '✅' : 
                        job.status === 'in_progress' ? '⏳' : '❓';
      
      const sentColor = job.sent === job.total ? '🟢' : job.sent > 0 ? '🟡' : '🔴';
      
      console.log(
        `${job.jobId.padEnd(18)} | ${statusIcon} ${job.status.padEnd(11)} | ${String(job.total).padStart(5)} | ${sentColor} ${String(job.sent).padStart(4)} | ${String(job.failed).padStart(6)} | ${startTime}`
      );
    });
    
    console.log('═'.repeat(110));
    
    // Show details of most recent job
    if (jobs.length > 0) {
      const latestJob = jobs[0];
      console.log('\n📊 Most Recent Job Details:');
      console.log('─'.repeat(60));
      
      // Fetch full details
      const detailRes = await axios.get(`${API_URL}/api/bulk-notify/status/${latestJob.jobId}`, {
        headers,
        timeout: 30000,
        validateStatus: () => true
      });
      
      if (detailRes.status === 200 && detailRes.data.success) {
        const details = detailRes.data;
        console.log(`Job ID: ${latestJob.jobId}`);
        console.log(`Status: ${details.status}`);
        console.log(`Total: ${details.total} recipients`);
        console.log(`✅ Successfully sent: ${details.sent}`);
        console.log(`❌ Failed: ${details.failed}`);
        console.log(`⏳ Pending: ${details.pending}`);
        console.log(`Started: ${new Date(details.startTime).toLocaleString()}`);
        if (details.endTime) {
          console.log(`Completed: ${new Date(details.endTime).toLocaleString()}`);
          console.log(`Duration: ${(details.durationMs / 1000).toFixed(2)} seconds`);
        }
        
        // Show sample results
        if (details.results && details.results.length > 0) {
          console.log('\n📝 Sample Results (first 5 and last 5):');
          
          const firstFive = details.results.slice(0, 5);
          const lastFive = details.results.slice(-5);
          
          console.log('\n  First 5:');
          firstFive.forEach((r, i) => {
            const icon = r.success ? '✅' : '❌';
            const msg = r.success 
              ? `${r.name} (${r.phone}) - Delivered` 
              : `${r.name} (${r.phone}) - ${r.error}`;
            console.log(`  ${i + 1}. ${icon} ${msg}`);
          });
          
          if (details.results.length > 10) {
            console.log('\n  ...');
          }
          
          if (details.results.length > 5) {
            console.log('\n  Last 5:');
            lastFive.forEach((r, i) => {
              const icon = r.success ? '✅' : '❌';
              const msg = r.success 
                ? `${r.name} (${r.phone}) - Delivered` 
                : `${r.name} (${r.phone}) - ${r.error}`;
              console.log(`  ${details.results.length - 4 + i}. ${icon} ${msg}`);
            });
          }
          
          // Count failures by error type
          const failures = details.results.filter(r => !r.success);
          if (failures.length > 0) {
            console.log('\n❌ Failed Notifications Breakdown:');
            const errorCounts = {};
            failures.forEach(f => {
              const errMsg = f.error || 'Unknown error';
              errorCounts[errMsg] = (errorCounts[errMsg] || 0) + 1;
            });
            Object.entries(errorCounts).forEach(([err, count]) => {
              console.log(`  - ${err}: ${count} recipient(s)`);
            });
          }
        }
      }
    }
    
    console.log('\n' + '─'.repeat(60));
    console.log('✅ Check complete!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === 'ECONNABORTED') {
      console.error('   Request timed out - Render might be slow or down');
    }
  }
}

checkDeployedJobs();
