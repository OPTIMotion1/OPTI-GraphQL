const axios = require('axios');

const GETGABS_API_KEY = process.env.GETGABS_API_KEY;
const GETGABS_API_URL = process.env.GETGABS_API_URL;
const GETGABS_SENDER = process.env.GETGABS_SENDER;

// In-memory job status store (use Redis in production)
global.bulkNotifyJobs = global.bulkNotifyJobs || {};

/**
 * Send a single WhatsApp notification via GetGabs
 */
async function sendSingleNotification(phone, name, templateName, campaignId, variables) {
  try {
    // Format phone number (ensure it has country code)
    const formattedPhone = phone.startsWith('91') ? phone : `91${phone}`;
    
    // Build template parameters
    const parameters = variables.map(value => ({
      type: 'text',
      text: String(value)
    }));

    const payload = {
      api_key: GETGABS_API_KEY,
      sender: GETGABS_SENDER,
      campaign_id: campaignId,
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      receiver_name: name,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: 'en_US'
        },
        components: [
          {
            type: 'BODY',
            parameters
          }
        ]
      }
    };

    const response = await axios.post(GETGABS_API_URL, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000,
      validateStatus: () => true
    });

    if (response.status === 200 || response.status === 201) {
      const messageId = response.data?.messages?.[0]?.id;
      const messageStatus = response.data?.messages?.[0]?.message_status;
      
      return {
        success: true,
        phone: formattedPhone,
        name,
        messageId,
        status: messageStatus || 'sent',
        timestamp: new Date().toISOString()
      };
    } else {
      return {
        success: false,
        phone: formattedPhone,
        name,
        error: response.data?.error || `HTTP ${response.status}`,
        timestamp: new Date().toISOString()
      };
    }

  } catch (error) {
    return {
      success: false,
      phone,
      name,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Send bulk notifications with rate limiting
 */
async function sendBulkNotifications(jobId, recipients, template, rateLimit = 5) {
  const startTime = Date.now();
  const results = [];
  
  // Initialize job status
  global.bulkNotifyJobs[jobId] = {
    status: 'in_progress',
    total: recipients.length,
    sent: 0,
    failed: 0,
    pending: recipients.length,
    startTime: new Date().toISOString(),
    results: []
  };

  console.log(`[Bulk Notify] Job ${jobId} started - ${recipients.length} recipients`);

  // Send messages with rate limiting
  const delayMs = 1000 / rateLimit; // Delay between messages
  
  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];
    
    // Send notification
    const result = await sendSingleNotification(
      recipient.phone,
      recipient.name,
      template.name,
      template.campaignId,
      recipient.variables
    );
    
    results.push(result);
    
    // Update job status
    const job = global.bulkNotifyJobs[jobId];
    if (result.success) {
      job.sent++;
    } else {
      job.failed++;
    }
    job.pending = recipients.length - (job.sent + job.failed);
    job.results.push(result);
    
    // Log progress
    if ((i + 1) % 10 === 0 || i === recipients.length - 1) {
      console.log(`[Bulk Notify] Job ${jobId} progress: ${i + 1}/${recipients.length} (${job.sent} sent, ${job.failed} failed)`);
    }
    
    // Rate limiting delay (except for last message)
    if (i < recipients.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // Finalize job
  const duration = Date.now() - startTime;
  global.bulkNotifyJobs[jobId].status = 'completed';
  global.bulkNotifyJobs[jobId].endTime = new Date().toISOString();
  global.bulkNotifyJobs[jobId].durationMs = duration;

  console.log(`[Bulk Notify] Job ${jobId} completed in ${duration}ms - ${results.filter(r => r.success).length} sent, ${results.filter(r => !r.success).length} failed`);

  return results;
}

/**
 * Get job status
 */
function getJobStatus(jobId) {
  return global.bulkNotifyJobs[jobId] || null;
}

module.exports = {
  sendSingleNotification,
  sendBulkNotifications,
  getJobStatus
};
