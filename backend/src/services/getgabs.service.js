const axios = require('axios');

const GETGABS_API_KEY = process.env.GETGABS_API_KEY;
const GETGABS_API_URL = process.env.GETGABS_API_URL || 'https://app.getgabs.com/whatsappbusiness/send-templated-message';
const GETGABS_SENDER = process.env.GETGABS_SENDER || '9121581421';
const GETGABS_CAMPAIGN_ID = process.env.GETGABS_CAMPAIGN_ID || '';
const GETGABS_TEMPLATE_NAME = process.env.GETGABS_TEMPLATE_NAME || 'overdue_rental_cutoff';
const GETGABS_TEMPLATE_LANGUAGE = process.env.GETGABS_TEMPLATE_LANGUAGE || 'en_US';

function normalizePhoneNumber(rawPhone) {
  if (!rawPhone) return null;
  const digits = String(rawPhone).replace(/\D/g, '');
  if (!digits) return null;
  
  // If starts with 91 and has 12 digits total, return as is
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  // If 10 digits, add 91 prefix
  if (digits.length === 10) {
    return `91${digits}`;
  }
  // If starts with 0 and has 11 digits, remove 0 and add 91
  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`;
  }
  // Return as is for other cases
  return digits;
}

function buildTemplatePayload({ to, receiverName, sender, apiKey, campaignId, templateName, languageCode, components }) {
  if (!apiKey) {
    throw new Error('GetGabs API key is not configured. Set GETGABS_API_KEY in environment.');
  }
  if (!sender) {
    throw new Error('GetGabs sender number is not configured. Set GETGABS_SENDER in environment.');
  }
  if (!templateName) {
    throw new Error('GetGabs template name is not configured. Set GETGABS_TEMPLATE_NAME in environment.');
  }
  if (!campaignId) {
    throw new Error('GetGabs campaign ID is not configured. Set GETGABS_CAMPAIGN_ID in environment.');
  }

  // GetGabs API format - EXACT format from documentation
  const payload = {
    api_key: apiKey,
    sender: sender,
    campaign_id: campaignId,
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    receiver_name: receiverName || 'Customer', // Required field
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: languageCode || 'en_US'
      }
    }
  };

  // Add components if provided (for template variables)
  if (components && Array.isArray(components) && components.length > 0) {
    payload.template.components = components;
  }

  return payload;
}

async function sendTemplateMessage(to, options = {}) {
  const normalizedTo = normalizePhoneNumber(to);
  if (!normalizedTo) {
    throw new Error(`Invalid recipient phone number: ${to}`);
  }

  const payload = buildTemplatePayload({
    to: normalizedTo,
    receiverName: options.receiverName || options.riderName || 'Customer',
    sender: options.sender || GETGABS_SENDER,
    apiKey: options.apiKey || GETGABS_API_KEY,
    campaignId: options.campaignId || GETGABS_CAMPAIGN_ID,
    templateName: options.templateName || GETGABS_TEMPLATE_NAME,
    languageCode: options.languageCode || GETGABS_TEMPLATE_LANGUAGE,
    components: options.components,
  });

  // Debug: Log the payload being sent
  console.log('[GetGabs] Sending payload:', JSON.stringify(payload, null, 2));

  const response = await axios.post(GETGABS_API_URL, payload, {
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: 30000,
    validateStatus: () => true
  });

  console.log('[GetGabs] Response status:', response.status);
  console.log('[GetGabs] Response data:', JSON.stringify(response.data, null, 2));

  if (response.status >= 200 && response.status < 300) {
    return response.data;
  }

  const responseBody = response.data && typeof response.data === 'object'
    ? JSON.stringify(response.data)
    : String(response.data);

  throw new Error(`GetGabs send failed (${response.status}): ${responseBody}`);
}

async function sendBulkTemplateMessages(targets = [], options = {}) {
  if (!Array.isArray(targets)) {
    throw new Error('GetGabs bulk send targets must be an array');
  }

  const results = await Promise.allSettled(targets.map(async (target) => {
    try {
      const payload = {
        to: target.to,
        receiverName: target.riderName || target.receiverName || 'Customer',
        sender: options.sender,
        apiKey: options.apiKey,
        campaignId: options.campaignId,
        templateName: options.templateName,
        languageCode: options.languageCode,
        components: target.components
      };

      const data = await sendTemplateMessage(payload.to, payload);
      return {
        rentalId: target.rentalId,
        to: target.to,
        success: true,
        response: data
      };
    } catch (error) {
      return {
        rentalId: target.rentalId,
        to: target.to,
        success: false,
        error: error.message
      };
    }
  }));

  return results.map((result) => result.status === 'fulfilled' ? result.value : {
    success: false,
    error: result.reason?.message || String(result.reason)
  });
}

module.exports = {
  normalizePhoneNumber,
  sendTemplateMessage,
  sendBulkTemplateMessages,
};
