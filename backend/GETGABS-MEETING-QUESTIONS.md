# Questions for GetGabs Support Meeting

## Issue Summary
We are unable to send template messages via the GetGabs API. All attempts return:
```json
{"status":false,"msg":"Wrong parameters!"}
```

## Our Configuration
- **API Key**: `8Fjs5ti3mp0KYm2OIejkvkY5xR8pFHWQlJRppQQSqEKLXFa77t` ✅
- **Sender Number**: `9121581421` ✅
- **Template Name**: `overdue_rental_cutoff` ✅
- **Template Status**: APPROVED (en_US language) ✅
- **Template Variables**: 1 variable (Rider Name)
- **API Endpoint**: `https://app.getgabs.com/whatsappbusiness/send-templated-message`

## What We've Tested (ALL FAILED)

### 1. WhatsApp Business API Standard Format
```json
{
  "api_key": "8Fjs5ti3mp0KYm2OIejkvkY5xR8pFHWQlJRppQQSqEKLXFa77t",
  "sender": "9121581421",
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "918886926806",
  "type": "template",
  "template": {
    "name": "overdue_rental_cutoff",
    "language": {"code": "en_US"},
    "components": [{
      "type": "BODY",
      "parameters": [{"type": "text", "text": "Test User"}]
    }]
  }
}
```
**Result**: `{"status":false,"msg":"Wrong parameters!"}`

### 2. GetGabs Simplified Format
```json
{
  "api_key": "8Fjs5ti3mp0KYm2OIejkvkY5xR8pFHWQlJRppQQSqEKLXFa77t",
  "sender": "9121581421",
  "number": "918886926806",
  "type": "Template",
  "template_name": "overdue_rental_cutoff",
  "template_language_code": "en_US",
  "template_body_params": ["Test User"]
}
```
**Result**: `{"status":false,"msg":"Wrong parameters!"}`

### 3. Minimal Format
```json
{
  "api_key": "8Fjs5ti3mp0KYm2OIejkvkY5xR8pFHWQlJRppQQSqEKLXFa77t",
  "sender": "9121581421",
  "number": "918886926806",
  "template_name": "overdue_rental_cutoff",
  "template_body_params": ["Test User"]
}
```
**Result**: `{"status":false,"msg":"Wrong parameters!"}`

### 4. Different Variations Tested
- ✅ Language code: Both `en_US` and `en`
- ✅ Sender formats: `9121581421`, `21581421`, `+9121581421`
- ✅ Component types: `BODY`, `body`, uppercase/lowercase
- ✅ With and without `campaign_id`
- ✅ Direct curl calls (not just Node.js)
- ✅ Different parameter structures

**ALL formats return the same error**: `{"status":false,"msg":"Wrong parameters!"}`

---

## Questions to Ask GetGabs Support

### 1. **API Key Permissions**
❓ Does our API key (`8Fjs...`) have permission to send template messages?
- Can you verify the API key is active and has proper permissions?
- Are there any permission restrictions on this key?

### 2. **Sender Number Configuration**
❓ Is the sender number `9121581421` properly linked to our API key?
- Can you confirm this sender is active and verified?
- Is this sender allowed to send template messages?

### 3. **Template Access**
❓ Is the template `overdue_rental_cutoff` accessible via this API key?
- Can you verify the template is in APPROVED status?
- Is this template accessible from the API (not just the panel)?
- Are there any restrictions on which templates can be used via API?

### 4. **Campaign ID Requirement**
❓ Is `campaign_id` required for template messages?
- If yes, where can we find our campaign ID?
- How do we create/get a campaign ID?
- Is campaign_id optional or mandatory?

### 5. **Correct API Format**
❓ What is the EXACT JSON payload format for sending template messages?
- Can you provide a working example for our specific template?
- Which fields are required vs optional?
- Are there any undocumented required fields?

### 6. **Account Setup**
❓ Are there any missing setup steps for our account?
- Is there a whitelist or approval process for API access?
- Do we need to enable any features in the dashboard?
- Are there any account-level restrictions preventing API usage?

### 7. **API Endpoint**
❓ Is `https://app.getgabs.com/whatsappbusiness/send-templated-message` the correct endpoint?
- Should we be using a different URL?
- Is there a different endpoint for production vs testing?

### 8. **Error Details**
❓ Can you provide more details about "Wrong parameters!" error?
- Which specific parameter is wrong/missing?
- Is there any way to get more detailed error messages?
- Can you check server logs for our API calls to see the actual issue?

---

## Expected Outcome
We need:
1. **A working API payload example** for our specific template
2. **Confirmation that our account is properly configured** for API access
3. **Any missing configuration steps** we need to complete
4. **Clear documentation** on the template message API format

---

## Test Numbers
- Test recipient: `918886926806`
- Any test numbers we should use instead?

---

## Additional Context
- **Use Case**: Auto-notification system for overdue vehicle rentals
- **Volume**: ~24 messages/day initially
- **Integration**: Node.js backend
- **Deployment**: Production (Render.com)
- **Timeline**: Need to go live ASAP

---

## Contact Information
[Add your contact details here]

---

**Note**: Once GetGabs provides the correct format/fixes account configuration, our integration code is ready to use immediately - no code changes needed on our end.
