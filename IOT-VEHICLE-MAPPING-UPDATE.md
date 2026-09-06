# IOT Vehicle Mapping Update

**Date:** September 6, 2026  
**Updated by:** User request

## New Mappings Added ✅

| IOT IMEI | Vehicle ID | VoltCred Status | Connection |
|----------|------------|-----------------|------------|
| **864540080671084** | **J00019** (Chassis-J00019) | Offline | Disconnected |
| **864540080376247** | **J00011** (Vin-J00011) | Stopped | Connected |

## Current Mapping Status

**Total Vehicles:** 11 IMEIs tracked  
**Mapped:** 3 vehicles (SL217030, J00011, J00019)  
**Unmapped:** 8 vehicles still showing as "UNKNOWN"

## Updated File

File: `backend/data/vehicle-imei-mapping.json`

```json
{
  "864540080383862": "SL217030",  ✅ Previously mapped
  "864540080376247": "J00011",    ✅ NEW - Vin-J00011
  "864540080671084": "J00019",    ✅ NEW - Chassis-J00019
  "864540080665904": "UNKNOWN",   ⚠️ Needs mapping
  "864540080668049": "UNKNOWN",   ⚠️ Needs mapping
  "864540080667991": "UNKNOWN",   ⚠️ Needs mapping
  "864540080671050": "UNKNOWN",   ⚠️ Needs mapping
  "864540080667363": "UNKNOWN",   ⚠️ Needs mapping
  "864540080666142": "UNKNOWN",   ⚠️ Needs mapping
  "864540080671035": "UNKNOWN",   ⚠️ Needs mapping
  "864540080668015": "UNKNOWN"    ⚠️ Needs mapping
}
```

## What This Means

### Dashboard Impact
Once deployed, the dashboard will now show:
- **J00011** instead of "864540080376247"
- **J00019** instead of "864540080671084"

### Operator Name Matching
If these vehicles (J00011, J00019) are rented and exist in Optimotion API:
- Dashboard will automatically show **rider name**
- Dashboard will show **rider phone number**
- Dashboard will show **rental status** and **due date**

## Device Status Details

### J00011 (IMEI: 864540080376247)
- **Device ID:** 300
- **Status:** Stopped (vehicle not moving)
- **Connection:** ✅ Connected to VoltCred
- **Lock/Unlock:** Commands will work immediately (device is online)

### J00019 (IMEI: 864540080671084)
- **Device ID:** 246
- **Status:** Offline
- **Connection:** ❌ Disconnected from VoltCred
- **Lock/Unlock:** Commands will queue until device comes online (10-15 min delay typical for gt06)

## Next Steps

1. **Deploy to GitHub** - Push this change
2. **Render Auto-Deploy** - Wait ~30 seconds for deployment
3. **Test Dashboard** - Refresh and verify vehicle names show correctly
4. **Map Remaining 8 Vehicles** - Identify which physical vehicles have the remaining IMEIs

## How to Map More Vehicles

Run this command to see all devices:
```bash
cd backend
node find-iot-devices.js
```

Then update `backend/data/vehicle-imei-mapping.json` with the correct vehicle IDs.
