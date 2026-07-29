# Auto Cutoff API - Documentation

## Overview

Automatically immobilizes vehicles when rentals become 1+ day overdue by integrating Optimotion Renewals API with VoltCred GraphQL API.

## API Endpoints

### 1. Check and Execute Auto-Cutoff
**POST** `/api/auto-cutoff/check-and-execute`

**Auth Required:** Yes (Admin only)

**Request Body:**
```json
{
  "minOverdueDays": 1  // Optional, default: 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Auto-cutoff check completed",
  "totalOverdue": 5,
  "processed": 5,
  "successful": 3,
  "failed": 1,
  "skipped": 1,
  "details": [
    {
      "rentalId": "rental_123",
      "vehicleId": "328",
      "deviceId": "864540080376650",
      "success": true,
      "commandId": 99,
      "commandStatus": "pending",
      "message": "Cutoff command sent successfully"
    }
  ],
  "duration": 5432
}
```

### 2. Get Cutoff Logs
**GET** `/api/auto-cutoff/logs?status=success&limit=50`

**Auth Required:** Yes

**Query Parameters:**
- `status` - Filter by status (success/failed/pending)
- `rentalId` - Filter by rental ID
- `vehicleId` - Filter by vehicle ID
- `limit` - Max results (default: 100)

**Response:**
```json
{
  "success": true,
  "count": 10,
  "logs": [
    {
      "id": "uuid",
      "rentalId": "rental_123",
      "vehicleId": "328",
      "deviceId": "306",
      "deviceImei": "864540080376650",
      "overdueDate": "2026-07-28",
      "overdueDays": 2,
      "cutoffAttemptedAt": "2026-07-29T08:00:00Z",
      "lastAttemptAt": "2026-07-29T08:00:00Z",
      "cutoffStatus": "success",
      "commandId": 99,
      "voltCredResponse": {},
      "retryCount": 0,
      "lastError": null,
      "notificationSent": false
    }
  ]
}
```

### 3. Get Statistics
**GET** `/api/auto-cutoff/stats`

**Auth Required:** Yes

**Response:**
```json
{
  "success": true,
  "stats": {
    "total": 25,
    "successful": 20,
    "failed": 3,
    "pending": 2,
    "maxRetriesExceeded": 1,
    "recentAttempts": 5
  }
}
```

### 4. Reset Cutoff Status
**POST** `/api/auto-cutoff/reset/:rentalId`

**Auth Required:** Yes (Admin only)

**Use Case:** Manual intervention - allow retry after max attempts or reset successful cutoff

**Response:**
```json
{
  "success": true,
  "message": "Cutoff status reset for rental rental_123"
}
```

### 5. Health Check
**GET** `/api/auto-cutoff/health`

**Auth Required:** No

**Response:**
```json
{
  "success": true,
  "service": "auto-cutoff",
  "status": "operational",
  "timestamp": "2026-07-29T08:00:00Z"
}
```

## Flow Diagram

```
User/Cron Job
      ↓
POST /api/auto-cutoff/check-and-execute
      ↓
1. Fetch Renewals from Optimotion API
      ↓
2. Filter Overdue (1+ days)
      ↓
3. For Each Overdue Rental:
      ↓
   a. Check Eligibility (not already cutoff)
      ↓
   b. Match to VoltCred Device (by ID/IMEI)
      ↓
   c. Safety Checks (not moving, device reachable)
      ↓
   d. Send engine_cutoff Command
      ↓
   e. Log Attempt (cutoff-logs.json)
      ↓
4. Return Summary
```

## Safety Checks

Before sending cutoff command, the system checks:

1. **Vehicle Not Moving**
   - Don't immobilize if `status === 'moving'`
   - Prevents accidents

2. **Device Reachable**
   - Don't cutoff if `connection_status === 'unknown'`
   - Don't cutoff if last communication > 48 hours
   - Ensures command will be delivered

3. **Not Already Immobilized**
   - Check logs for existing successful cutoff
   - Prevents duplicate commands

## Retry Logic

- **Max Retries:** 3 attempts
- **Retry Eligible:** If previous attempt failed or pending
- **Not Eligible:** If already successful or max retries exceeded
- **Retry Strategy:**
  - 1st retry: Immediate
  - 2nd retry: After scheduler runs again
  - 3rd retry: After scheduler runs again
  - After 3 failures: Manual intervention required

## Duplicate Prevention

Uses `cutoff-logs.json` to track all attempts:
- Rental ID is unique identifier
- Status tracked: `success`, `failed`, `pending`
- Retry count incremented on each attempt
- Skips rentals already successfully immobilized

## Error Handling

### Scenarios Handled:

1. **Renewals API Down**
   - Returns error, doesn't attempt cutoff
   - Retry on next scheduler run

2. **No Matching Device**
   - Logs as failed with reason
   - Requires manual review (vehicle not in VoltCred?)

3. **Safety Check Failed**
   - Logs as failed with specific reason
   - Retries on next run (vehicle might have stopped)

4. **VoltCred API Error**
   - Logs error message
   - Eligible for retry

5. **Command Permission Denied**
   - Logs error
   - Requires VoltCred permission fix

## Assumptions Made

1. **Renewals API Format:**
   - Endpoint returns array of rentals
   - Each rental has: `id`, `dueDate`, `vehicleId` or `imei`
   - Due date in ISO format or parseable string

2. **Vehicle Matching:**
   - Vehicle ID in renewals matches Asset ID or device IMEI in VoltCred
   - Falls back to name matching if exact match fails

3. **Single Device Per Vehicle:**
   - Uses first IoT device for each asset
   - Assumes primary device is cutoff-capable

4. **No Real-time Notifications:**
   - Phase 1 doesn't notify users
   - Notification system to be added in Phase 2

## Edge Cases Considered

1. **Rental Extended After Overdue**
   - Manual reset required: `POST /api/auto-cutoff/reset/:rentalId`
   - Allows system to re-evaluate on next run

2. **Multiple Overdue Rentals for Same Vehicle**
   - Only one cutoff executed (first rental found)
   - Others skipped as "already immobilized"

3. **Vehicle Returns While Immobilized**
   - Manual unlock required through dashboard
   - Auto-unlock feature in Phase 2

4. **Rate Limiting**
   - 1-second delay between cutoff commands
   - Prevents VoltCred API rate limit errors

5. **Concurrent Executions**
   - JSON file uses atomic writes
   - Scheduler should ensure only one instance runs

6. **Missing Vehicle in VoltCred**
   - Logged as failed
   - Ops team can add vehicle and reset status

## Testing

### Manual Testing:

```bash
# 1. Check health
curl http://localhost:5001/api/auto-cutoff/health

# 2. Login as admin
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"opti2024"}'

# 3. Execute auto-cutoff (use token from step 2)
curl -X POST http://localhost:5001/api/auto-cutoff/check-and-execute \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"minOverdueDays":1}'

# 4. View logs
curl http://localhost:5001/api/auto-cutoff/logs \
  -H "Authorization: Bearer <token>"

# 5. View stats
curl http://localhost:5001/api/auto-cutoff/stats \
  -H "Authorization: Bearer <token>"
```

### With Mock Data:

Create `test-renewals.json` in backend root for testing without real API.

## Future Enhancements (Phase 2)

1. **Pre-Cutoff Warnings**
   - Send SMS 2 hours before cutoff
   - Give customer chance to pay/extend

2. **User Notifications**
   - SMS on cutoff
   - SMS on auto-unlock after payment

3. **Auto-Unlock**
   - Trigger `engine_restore` when payment received
   - Notify customer

4. **Dashboard UI**
   - View all cutoff attempts
   - Manual override controls
   - Real-time alerts

5. **Advanced Safety**
   - Speed detection (don't cutoff if moving)
   - Geofence integration (cutoff only in safe zones)
   - Weather emergency checks

6. **Analytics**
   - Cutoff success rate
   - Average overdue days before cutoff
   - Recovery rate after cutoff

## Monitoring

### Key Metrics to Track:

- Total overdue rentals
- Successful cutoffs
- Failed cutoffs (by reason)
- Retry rate
- Average execution time
- VoltCred API errors

### Alerts:

- High failure rate (> 20%)
- VoltCred API down
- Multiple retries for same rental
- Permission errors

## Deployment

### Cron Job Setup (Future):

```javascript
// jobs/cutoff-scheduler.job.js
const cron = require('node-cron');
const { checkAndExecuteAutoCutoff } = require('../services/auto-cutoff.service');

// Run every hour
cron.schedule('0 * * * *', async () => {
  console.log('Running auto-cutoff scheduler...');
  try {
    await checkAndExecuteAutoCutoff(1);
  } catch (error) {
    console.error('Auto-cutoff scheduler error:', error);
  }
});
```

## Security Considerations

1. **Admin-Only Access**
   - Only admins can trigger cutoffs
   - Prevents abuse

2. **Audit Logging**
   - All attempts logged with timestamps
   - User info captured in logs

3. **Rate Limiting**
   - Prevents API flooding
   - Max 10 commands per minute

4. **Data Privacy**
   - Don't log sensitive payment info
   - Only store rental/vehicle IDs

## Support

For issues or questions:
1. Check logs: `backend/data/cutoff-logs.json`
2. Check stats endpoint
3. Review failed attempts for common errors
4. Reset status if needed: `POST /api/auto-cutoff/reset/:rentalId`

---

**Status:** Implemented  
**Version:** 1.0.0  
**Last Updated:** July 29, 2026
