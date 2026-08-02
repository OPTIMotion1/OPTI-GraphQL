const express = require('express');
const router = express.Router();
const { checkAndExecuteAutoCutoff } = require('../services/auto-cutoff.service');
const { 
  getCutoffLogs, 
  getCutoffStats, 
  resetCutoffStatus 
} = require('../services/cutoff-tracker.service');
const { getOverdueRentals, getAllRentals } = require('../services/renewals.service');
const { sendBulkTemplateMessages, sendTemplateMessage } = require('../services/getgabs.service');
const { verifyToken, isAdmin } = require('../middleware/auth.middleware');

// ============================================================================
// POST /api/auto-cutoff/check-and-execute
// Main endpoint: Check for overdue rentals and execute cutoffs
// ============================================================================
router.post('/check-and-execute', verifyToken, isAdmin, async (req, res) => {
  try {
    const { minOverdueDays = 1, autoNotify = false } = req.body;
    
    console.log(`[Auto-Cutoff] Initiated by ${req.user.name} (${req.user.role})`);
    console.log(`[Auto-Cutoff] Auto-notify enabled: ${autoNotify}`);
    
    const result = await checkAndExecuteAutoCutoff(minOverdueDays);
    
    // If autoNotify is enabled and we have successful cutoffs, send notifications
    if (autoNotify && result.successful > 0) {
      console.log(`[Auto-Cutoff] Auto-notify: Sending notifications to ${result.successful} riders`);
      
      try {
        const successfulRentals = result.details.filter(d => d.status === 'locked');
        const targets = successfulRentals
          .filter(rental => rental.riderPhone)
          .map(rental => ({
            rentalId: rental.rentalId,
            to: rental.riderPhone,
            riderName: rental.riderName || 'Rider',
            components: [
              {
                type: 'BODY',
                parameters: [
                  { 
                    type: 'text', 
                    text: rental.riderName || 'Rider'
                  }
                ]
              }
            ]
          }));
        
        if (targets.length > 0) {
          const notifyResults = await sendBulkTemplateMessages(targets, {
            apiKey: process.env.GETGABS_API_KEY,
            sender: process.env.GETGABS_SENDER,
            campaignId: process.env.GETGABS_CAMPAIGN_ID,
            templateName: process.env.GETGABS_TEMPLATE_NAME,
            languageCode: process.env.GETGABS_TEMPLATE_LANGUAGE,
          });
          
          const notifySuccess = notifyResults.filter(r => r.success).length;
          console.log(`[Auto-Cutoff] Auto-notify: Sent ${notifySuccess}/${targets.length} notifications`);
          
          result.notifications = {
            sent: notifySuccess,
            failed: targets.length - notifySuccess,
            total: targets.length
          };
        }
      } catch (notifyError) {
        console.error('[Auto-Cutoff] Auto-notify error:', notifyError);
        result.notificationError = notifyError.message;
      }
    }
    
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
// GET /api/auto-cutoff/templates
// Get available WhatsApp templates for notifications
// ============================================================================
router.get('/templates', verifyToken, async (req, res) => {
  try {
    const templates = [
      {
        id: 'rent_due_today_t0',
        name: 'T0 - Due Today',
        campaignId: '23224',
        description: 'Sent when rent is due today (2 variables: name, rent)',
        variables: ['person_name', 'rent']
      },
      {
        id: 'rent_reminder_dashboard',
        name: 'Reminder - Tomorrow Due',
        campaignId: '23213',
        description: 'Sent when rent is due tomorrow with discount (3 variables: name, rent, discounted_amount)',
        variables: ['person_name', 'rent', 'discounted_amount']
      },
      {
        id: 'overdue_rental_cutoff',
        name: 'Cutoff - Overdue Warning',
        campaignId: '23215',
        description: 'Sent when rent is overdue (1 variable: name)',
        variables: ['person_name']
      }
    ];

    res.json({
      success: true,
      templates
    });
  } catch (error) {
    console.error('[Auto-Cutoff] Error fetching templates:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// POST /api/auto-cutoff/notify
// Send WhatsApp template notifications for selected or filtered riders
// Supports template selection (T0, reminder, cutoff)
// ============================================================================
router.post('/notify', verifyToken, isAdmin, async (req, res) => {
  try {
    const { rentalIds, minOverdueDays, templateName } = req.body || {};

    // Template configurations
    const TEMPLATES = {
      'rent_due_today_t0': {
        campaignId: '23224',
        name: 'rent_due_today_t0',
        variableCount: 2, // person_name, rent
        description: 'T0 - Due today notification (2 variables)'
      },
      'rent_reminder_t1': {
        campaignId: '23321',
        name: 'rent_reminder_t1',
        variableCount: 2, // person_name, rent
        description: 'T1 - Day before due notification (2 variables)'
      },
      'rent_reminder_dashboard': {
        campaignId: '23213',
        name: 'rent_reminder_dashboard',
        variableCount: 3, // person_name, rent, discounted_amount
        description: 'Reminder - Tomorrow due with discount (3 variables)'
      },
      'overdue_rental_cutoff': {
        campaignId: '23215',
        name: 'overdue_rental_cutoff',
        variableCount: 1, // person_name
        description: 'Cutoff - Overdue warning (1 variable)'
      }
    };

    // Default to cutoff template if not specified
    const selectedTemplate = templateName || 'overdue_rental_cutoff';
    const template = TEMPLATES[selectedTemplate];

    if (!template) {
      return res.status(400).json({
        success: false,
        error: `Invalid template: ${selectedTemplate}. Valid options: ${Object.keys(TEMPLATES).join(', ')}`
      });
    }

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
      .map((rental) => {
        const orig = rental.originalData || {};
        const totalDue = orig.totalDue || orig.total_due || orig.total_amount || orig.dueAmount || orig.due_amount || orig.amount || 0;
        const discount = orig.t1_discount || orig.discount || 0;
        const discountedAmount = totalDue - discount;

        // Build components based on template
        const components = [{
          type: 'BODY',
          parameters: []
        }];

        if (template.variableCount >= 1) {
          components[0].parameters.push({
            type: 'text',
            text: rental.riderName || 'Rider'
          });
        }

        if (template.variableCount >= 2) {
          components[0].parameters.push({
            type: 'text',
            text: String(totalDue)
          });
        }

        if (template.variableCount >= 3) {
          components[0].parameters.push({
            type: 'text',
            text: String(discountedAmount)
          });
        }

        return {
          rentalId: rental.rentalId,
          to: rental.riderPhone,
          components
        };
      });

    if (!targets.length) {
      return res.status(400).json({
        success: false,
        error: 'No valid rider phone numbers found for notification'
      });
    }

    console.log(`[Auto-Cutoff] Sending ${template.description} to ${targets.length} riders`);

    const results = await sendBulkTemplateMessages(targets, {
      apiKey: process.env.GETGABS_API_KEY,
      sender: process.env.GETGABS_SENDER,
      campaignId: template.campaignId,
      templateName: template.name,
      languageCode: process.env.GETGABS_TEMPLATE_LANGUAGE || 'en_US',
    });

    const successCount = results.filter((item) => item.success).length;
    const failedItems = results.filter((item) => !item.success);

    res.json({
      success: true,
      requested: results.length,
      successCount,
      failures: failedItems,
      template: selectedTemplate,
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
// POST /api/auto-cutoff/lock-individual
// Lock individual rider and optionally send WhatsApp notification
// ============================================================================
router.post('/lock-individual', verifyToken, isAdmin, async (req, res) => {
  try {
    const { rentalId, vehicleId, autoNotify = false } = req.body;
    
    if (!rentalId || !vehicleId) {
      return res.status(400).json({
        success: false,
        error: 'rentalId and vehicleId are required'
      });
    }
    
    console.log(`[Auto-Cutoff] Individual lock requested for rental ${rentalId}, vehicle ${vehicleId}`);
    console.log(`[Auto-Cutoff] Auto-notify: ${autoNotify}`);
    
    // Get rental details
    const allRentals = await getAllRentals();
    const rental = allRentals.find(r => r.rentalId === rentalId);
    
    if (!rental) {
      return res.status(404).json({
        success: false,
        error: `Rental ${rentalId} not found`
      });
    }
    
    // Execute cutoff for this specific rental
    const { executeSingleCutoff } = require('../services/auto-cutoff.service');
    const cutoffResult = await executeSingleCutoff(rental);
    
    let notificationResult = null;
    
    // If autoNotify is enabled and cutoff was successful, send notification
    if (autoNotify && cutoffResult.success && rental.riderPhone) {
      console.log(`[Auto-Cutoff] Sending notification to ${rental.riderName} at ${rental.riderPhone}`);
      
      try {
        const notifyResult = await sendTemplateMessage(rental.riderPhone, {
          receiverName: rental.riderName || 'Rider',
          riderName: rental.riderName || 'Rider',
          components: [
            {
              type: 'BODY',
              parameters: [
                { 
                  type: 'text', 
                  text: rental.riderName || 'Rider'
                }
              ]
            }
          ]
        });
        
        notificationResult = {
          success: true,
          messageId: notifyResult.messages?.[0]?.id,
          status: notifyResult.messages?.[0]?.message_status
        };
        
        console.log(`[Auto-Cutoff] Notification sent successfully`);
      } catch (notifyError) {
        console.error('[Auto-Cutoff] Notification error:', notifyError);
        notificationResult = {
          success: false,
          error: notifyError.message
        };
      }
    }
    
    res.json({
      success: cutoffResult.success,
      rentalId,
      vehicleId,
      riderName: rental.riderName,
      riderPhone: rental.riderPhone,
      cutoff: cutoffResult,
      notification: notificationResult,
      autoNotifyEnabled: autoNotify
    });
    
  } catch (error) {
    console.error('[Auto-Cutoff] Error locking individual:', error);
    res.status(500).json({
      success: false,
      error: error.message
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
