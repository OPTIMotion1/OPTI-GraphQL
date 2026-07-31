# 📤 Bulk WhatsApp Notifications Feature

**Status**: ✅ Complete and Ready  
**Date**: July 31, 2026

## Overview

Send WhatsApp template messages to multiple recipients by uploading a CSV file. Perfect for:
- Rent reminders
- Payment notifications
- Bulk announcements
- Custom campaigns

## Features

✅ **CSV Upload** - Support for any CSV format  
✅ **Template Selection** - Choose from existing GetGabs templates  
✅ **Column Mapping** - Flexible mapping of CSV columns to template variables  
✅ **Preview** - See first 3 messages before sending  
✅ **Rate Limiting** - 5 messages/second to avoid API throttling  
✅ **Background Processing** - Non-blocking bulk send  
✅ **Status Tracking** - Monitor sent/failed/pending in real-time  

## How to Use

### 1. Prepare Your CSV File

Example format:
```csv
phone,person_name,rent,bucket,pending_amount
7674858856,Kunja Pushparaju,2400,T1,0
8210385285,Guddu Kumar,1799,T1,0
7719142609,Souvik,2000,T1,0
```

**Requirements**:
- Must have a column for phone numbers
- Must have columns for all template variables
- Phone numbers can be with or without country code (91 is auto-added)
- Maximum file size: 5MB

### 2. Upload CSV

1. Go to **Bulk Notify** tab
2. Click "Choose File" and select your CSV
3. System will parse and show total rows

### 3. Select Template

Choose from available templates:
- **Rent Reminder** (2 variables: Customer Name, Vehicle Rent)
- **Overdue Cutoff Warning** (1 variable: Rider Name)

### 4. Map Columns

Map your CSV columns to:
- **Phone Number** - Column containing phone numbers
- **Recipient Name** - Column containing customer names
- **Variable 1** - First template variable
- **Variable 2** - Second template variable (if applicable)

### 5. Preview & Send

- Preview shows first 3 rows with mapped data
- Click **"Send to X Recipients"**
- Confirm the action
- Messages are sent in background with rate limiting

## API Endpoints

### Upload CSV
```
POST /api/bulk-notify/upload
Content-Type: multipart/form-data

Form Data:
- csvFile: <file>

Response:
{
  "success": true,
  "totalRows": 25,
  "columns": ["phone", "person_name", "rent"],
  "preview": [...],
  "data": [...]
}
```

### Send Bulk Notifications
```
POST /api/bulk-notify/send
Content-Type: application/json

Body:
{
  "recipients": [
    {
      "phone": "7674858856",
      "name": "Kunja Pushparaju",
      "variables": ["Kunja Pushparaju", "2400"]
    }
  ],
  "template": {
    "name": "rent_reminder_dashboard",
    "campaignId": "23073"
  },
  "rateLimit": 5
}

Response:
{
  "success": true,
  "jobId": "1785516303858",
  "message": "Started sending 25 notifications",
  "totalRecipients": 25
}
```

### Get Job Status
```
GET /api/bulk-notify/status/:jobId

Response:
{
  "success": true,
  "status": "in_progress",
  "total": 25,
  "sent": 15,
  "failed": 0,
  "pending": 10,
  "results": [...]
}
```

### Get Templates
```
GET /api/bulk-notify/templates

Response:
{
  "success": true,
  "templates": [
    {
      "name": "rent_reminder_dashboard",
      "displayName": "Rent Reminder",
      "variables": ["Customer Name", "Vehicle Rent"],
      "campaignId": "23073"
    }
  ]
}
```

## Template Configuration

### Rent Reminder Template

**Template Name**: `rent_reminder_dashboard`  
**Campaign ID**: `23073`  
**Variables**: 
1. Customer Name
2. Vehicle Rent

**Message Format**:
```
Hi {{1}},
This is a reminder that your vehicle rent of ₹{{2}} is due soon.
Please pay on time to avoid service interruption.
```

### Overdue Cutoff Warning

**Template Name**: `overdue_rental_cutoff`  
**Campaign ID**: `23073`  
**Variables**: 
1. Rider Name

**Message Format**:
```
Hi {{1}},
Your rental is overdue. Please renew immediately to avoid vehicle lockdown.
```

## Rate Limiting

- **Default**: 5 messages per second
- **Adjustable**: Change `rateLimit` parameter in API call
- **Recommended**: Keep between 3-10 messages/second
- **Why**: Prevents GetGabs API rate limit errors

## Error Handling

### Common Errors

1. **Invalid Phone Number**
   - Skipped with error in results
   - Continue sending to next recipient

2. **API Timeout**
   - Retries automatically (3 attempts)
   - Mark as failed after retries exhausted

3. **Invalid CSV Format**
   - Error message shown immediately
   - No data processed

4. **Template Not Found**
   - Error before sending starts
   - User prompted to select valid template

## Testing

### Test with Small Sample
```bash
# Edit test-bulk-notify.js to add test recipients
node backend/test-bulk-notify.js
```

### Test Full Workflow
1. Create test CSV with 3 rows
2. Upload via UI
3. Map columns
4. Send to test numbers
5. Check WhatsApp

## Files Added

| File | Purpose |
|------|---------|
| `backend/src/routes/bulk-notify.routes.js` | API routes for bulk notify |
| `backend/src/services/bulk-notify.service.js` | Bulk send logic with rate limiting |
| `backend/test-bulk-notify.js` | Test script |
| `frontend/src/App.jsx` | Added BulkNotifyTab component |

## Dependencies Added

```json
{
  "csv-parser": "^3.0.0",
  "multer": "^1.4.5-lts.1"
}
```

## Environment Variables

No new environment variables needed! Uses existing GetGabs configuration:
- `GETGABS_API_KEY`
- `GETGABS_API_URL`
- `GETGABS_SENDER`

## Deployment

### 1. Install Dependencies
```bash
cd backend
npm install csv-parser multer
```

### 2. Commit Changes
```bash
git add .
git commit -m "Add bulk WhatsApp notification feature with CSV upload"
git push origin main
```

### 3. Render Deployment
- Render will auto-deploy on push
- No env var changes needed
- `uploads/` folder created automatically

### 4. Verify
1. Go to https://opti-graphql-1.onrender.com
2. Login and click **Bulk Notify** tab
3. Upload test CSV
4. Send to 1-2 test numbers first

## Future Enhancements

- [ ] Add progress bar with live updates
- [ ] Export results as CSV
- [ ] Schedule bulk sends for specific time
- [ ] Support for more templates
- [ ] Retry failed messages automatically
- [ ] Template preview with actual data
- [ ] CSV validation before upload
- [ ] Support for attachments (images, PDFs)

## Support

**GetGabs API Docs**: https://app.getgabs.com/docs  
**Test Script**: `node backend/test-bulk-notify.js`  
**Sample CSV**: See `AI calling - 31 July 2026-xlsx - Calls.csv`

---

**Feature Complete**: Ready to send bulk WhatsApp notifications! 🎉
