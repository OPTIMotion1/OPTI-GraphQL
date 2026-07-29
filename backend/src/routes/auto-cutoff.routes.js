const express = require('express');
const router = express.Router();
const { checkAndExecuteAutoCutoff } = require('../services/auto-cutoff.service');
const { 
  getCutoffLogs, 
  getCutoffStats, 
  resetCutoffStatus 
} = require('../services/cutoff-tracker.service');
const { getOverdueRentals, getAllRentals } = require('../services/renewals.service');
const { sendBulkTemplateMessages } = require('../services/getgabs.service');
const { verifyToken, isAdmin } = require('../middleware/auth.middleware');

// ============================================================================
// POST /api/auto-cutoff/check-and-execute
// Main endpoint: Check for overdue rentals and execute cutoffs
// ============================================================================
router.post('/check-and-execute', verifyToken, isAdmin, async (req, res) => {
  try {
    const { minOverdueDays = 1 } = req.body;
    
    console.log(`[Auto-Cutoff] Initiated by ${req.user.name} (${req.user.role})`);
    
    const result = await checkAndExecuteAutoCutoff(minOverdueDays);
    
    res.json(result);
  } catch (error) {
    console.error('[Auto-Cutoff] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// GET /api/auto-cutoff/logs
// Get cutoff logs with optional filtering
// ============================================================================
router.get('/logs', verifyToken, async (req, res) => {
  try {
    const { status, rentalId, vehicleId, limit = 100 } = req.query;
    
    const filters = {};
    if (status) filters.status = status;
    if (rentalId) filters.rentalId = rentalId;
    if (vehicleId) filters.vehicleId = vehicleId;
    
    let logs = await getCutoffLogs(filters);
    
    // Sort by most recent first
    logs = logs.sort((a, b) => 
      new Date(b.lastAttemptAt) - new Date(a.lastAttemptAt)
    );
    
    // Limit results
    if (limit && logs.length > limit) {
      logs = logs.slice(0, parseInt(limit));
    }
    
    res.json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (error) {
    console.error('[Auto-Cutoff] Error fetching logs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// GET /api/auto-cutoff/stats
// Get cutoff statistics
// ============================================================================
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const stats = await getCutoffStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('[Auto-Cutoff] Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// POST /api/auto-cutoff/reset/:rentalId
// Reset cutoff status for a rental (manual intervention)
// ============================================================================
router.post('/reset/:rentalId', verifyToken, isAdmin, async (req, res) => {
  try {
    const { rentalId } = req.params;
    
    if (!rentalId) {
      return res.status(400).json({
        success: false,
        error: 'rentalId is required'
      });
    }
    
    const success = await resetCutoffStatus(rentalId);
    
    if (success) {
      console.log(`[Auto-Cutoff] Reset status for rental ${rentalId} by ${req.user.name}`);
      res.json({
        success: true,
        message: `Cutoff status reset for rental ${rentalId}`
      });
    } else {
      res.status(404).json({
        success: false,
        error: `No cutoff log found for rental ${rentalId}`
      });
    }
  } catch (error) {
    console.error('[Auto-Cutoff] Error resetting status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// GET /api/auto-cutoff/overdue
// Return overdue renewals for preview
// ============================================================================
router.get('/overdue', verifyToken, isAdmin, async (req, res) => {
  try {
    const rawMinOverdueDays = req.query.minOverdueDays;
    const minOverdueDays = rawMinOverdueDays === undefined || rawMinOverdueDays === ''
      ? 0
      : parseInt(rawMinOverdueDays, 10);
    console.log(`[Auto-Cutoff] Fetching overdue rentals with minOverdueDays=${minOverdueDays}`);
    
    const { getOverdueRentals } = require('../services/renewals.service');
    const overdueRentals = await getOverdueRentals(minOverdueDays);

    console.log(`[Auto-Cutoff] Returning ${overdueRentals.length} overdue rentals`);
    
    res.json({
      success: true,
      count: overdueRentals.length,
      overdueRentals
    });
  } catch (error) {
    console.error('[Auto-Cutoff] Error fetching overdue rentals:', error);
    console.error('[Auto-Cutoff] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ============================================================================
// POST /api/auto-cutoff/notify
// Send WhatsApp template notifications for selected or filtered riders
// ============================================================================
router.post('/notify', verifyToken, isAdmin, async (req, res) => {
  try {
    const { rentalIds, minOverdueDays } = req.body || {};

    let targetRentals = [];

    if (Array.isArray(rentalIds) && rentalIds.length > 0) {
      const allRentals = await getAllRentals();
      targetRentals = allRentals.filter((rental) => rentalIds.includes(rental.rentalId));
    } else if (typeof minOverdueDays === 'number') {
      targetRentals = await getOverdueRentals(minOverdueDays);
    } else {
      return res.status(400).json({
        success: false,
        error: 'rentalIds or minOverdueDays is required to send notifications'
      });
    }

    if (!targetRentals.length) {
      return res.status(400).json({
        success: false,
        error: 'No matching rentals found for notification'
      });
    }

    const targets = targetRentals
      .filter((rental) => rental.riderPhone)
      .map((rental) => ({
        rentalId: rental.rentalId,
        to: rental.riderPhone,
        components: [
          {
            type: 'BODY',  // Changed to uppercase BODY as per GetGabs docs
            parameters: [
              { 
                type: 'text', 
                text: rental.riderName || 'Rider' // {{1}} Rider Name variable
              }
            ]
          }
        ]
      }));

    if (!targets.length) {
      return res.status(400).json({
        success: false,
        error: 'No valid rider phone numbers found for notification'
      });
    }

    const results = await sendBulkTemplateMessages(targets, {
      apiKey: process.env.GETGABS_API_KEY,
      sender: process.env.GETGABS_SENDER,
      campaignId: process.env.GETGABS_CAMPAIGN_ID,
      templateName: process.env.GETGABS_TEMPLATE_NAME,
      languageCode: process.env.GETGABS_TEMPLATE_LANGUAGE,
    });

    const successCount = results.filter((item) => item.success).length;
    const failedItems = results.filter((item) => !item.success);

    res.json({
      success: true,
      requested: results.length,
      successCount,
      failures: failedItems,
      results
    });
  } catch (error) {
    console.error('[Auto-Cutoff] Error sending notification:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ============================================================================
// GET /api/auto-cutoff/all-rentals
// Return ALL rentals (not just overdue)
// ============================================================================
router.get('/all-rentals', verifyToken, isAdmin, async (req, res) => {
  try {
    console.log(`[Auto-Cutoff] Fetching ALL rentals`);
    
    const { getAllRentals } = require('../services/renewals.service');
    const allRentals = await getAllRentals();

    console.log(`[Auto-Cutoff] Returning ${allRentals.length} total rentals`);
    
    res.json({
      success: true,
      count: allRentals.length,
      rentals: allRentals
    });
  } catch (error) {
    console.error('[Auto-Cutoff] Error fetching all rentals:', error);
    console.error('[Auto-Cutoff] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ============================================================================
// GET /api/auto-cutoff/health
// Health check endpoint
// ============================================================================
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'auto-cutoff',
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
