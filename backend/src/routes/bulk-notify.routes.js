const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { sendBulkNotifications } = require('../services/bulk-notify.service');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for CSV upload
const upload = multer({
  dest: uploadsDir,
  fileFilter: (req, file, cb) => {
    console.log('[Bulk Notify] Uploaded file:', file.originalname, 'MIME:', file.mimetype);
    
    // Accept CSV files (be lenient with MIME type)
    if (file.mimetype === 'text/csv' || 
        file.mimetype === 'application/vnd.ms-excel' ||
        file.mimetype === 'application/csv' ||
        file.mimetype === 'text/plain' ||
        file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      console.log('[Bulk Notify] Rejected file - invalid type');
      cb(new Error('Only CSV files are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  }
});

// POST /api/bulk-notify/upload - Parse CSV and return preview
router.post('/upload', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No CSV file uploaded' });
    }

    const results = [];
    const filePath = req.file.path;

    // Parse CSV
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        // Clean up uploaded file
        fs.unlinkSync(filePath);

        if (results.length === 0) {
          return res.status(400).json({ success: false, error: 'CSV file is empty' });
        }

        const columns = Object.keys(results[0] || {});
        if (columns.length === 0) {
          return res.status(400).json({ success: false, error: 'CSV has no columns' });
        }

        // Return parsed data and preview
        res.json({
          success: true,
          totalRows: results.length,
          columns: columns,
          preview: results.slice(0, 5), // First 5 rows for preview
          data: results // Full data for processing
        });
      })
      .on('error', (error) => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        res.status(500).json({ success: false, error: error.message });
      });

  } catch (error) {
    console.error('Error uploading CSV:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/bulk-notify/send - Send bulk notifications
router.post('/send', async (req, res) => {
  try {
    const { 
      recipients,  // Array of { phone, name, variables }
      template,    // Template config
      rateLimit    // Messages per second (default: 5)
    } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ success: false, error: 'Recipients array is required' });
    }

    if (!template || !template.name) {
      return res.status(400).json({ success: false, error: 'Template name is required' });
    }

    // Start bulk sending (non-blocking)
    const jobId = Date.now().toString();
    
    // Send in background
    sendBulkNotifications(jobId, recipients, template, rateLimit || 5)
      .catch(err => console.error('Bulk send error:', err));

    res.json({
      success: true,
      jobId,
      message: `Started sending ${recipients.length} notifications`,
      totalRecipients: recipients.length
    });

  } catch (error) {
    console.error('Error starting bulk send:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/bulk-notify/status/:jobId - Get bulk send status
router.get('/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  
  // Get status from in-memory store or database
  const status = global.bulkNotifyJobs?.[jobId];
  
  if (!status) {
    return res.status(404).json({ success: false, error: 'Job not found' });
  }

  res.json({
    success: true,
    ...status
  });
});

// GET /api/bulk-notify/jobs - List all jobs
router.get('/jobs', (req, res) => {
  try {
    const jobs = global.bulkNotifyJobs || {};
    const jobList = Object.keys(jobs).map(jobId => ({
      jobId,
      status: jobs[jobId].status,
      total: jobs[jobId].total,
      sent: jobs[jobId].sent,
      failed: jobs[jobId].failed,
      startTime: jobs[jobId].startTime,
      endTime: jobs[jobId].endTime
    }));
    
    // Sort by start time (newest first)
    jobList.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    
    res.json({
      success: true,
      jobs: jobList
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/bulk-notify/templates - Get available templates
router.get('/templates', (req, res) => {
  // Return available GetGabs templates
  res.json({
    success: true,
    templates: [
      {
        name: 'rent_due_today_t0',
        displayName: 'Rent Due Today (T0)',
        variables: ['Customer Name', 'Rent Amount'],
        campaignId: '23224'
      },
      {
        name: 'rent_reminder_t1',
        displayName: 'Rent Reminder T1 (Day Before)',
        variables: ['Customer Name', 'Rent Amount'],
        campaignId: '23321'
      },
      {
        name: 'rent_reminder_dashboard',
        displayName: 'Rent Reminder (Tomorrow)',
        variables: ['Customer Name', 'Vehicle Rent', 'Discounted Amount'],
        campaignId: '23213'
      },
      {
        name: 'overdue_rental_cutoff',
        displayName: 'Overdue Cutoff Warning',
        variables: ['Rider Name'],
        campaignId: '23215'
      }
    ]
  });
});

module.exports = router;
