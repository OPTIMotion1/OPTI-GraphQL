# VoltCred GPS Jumping Issue - Testing Guide

## 🔍 What VoltCred Found

### The Problem:
GPS devices are reporting **unstable coordinates** ("GPS jumping"), which causes:

1. **False Speed Calculations**:
   - Device at Location A (17.5000, 78.4000) at 10:00:00
   - Device at Location B (17.5100, 78.4100) at 10:00:30 ← **~1.5 km away in 30 seconds!**
   - Calculated Speed: **180 km/h** (but vehicle is actually stationary!)

2. **Safety Feature Blocks Commands**:
   - VoltCred devices have a **safety rule**: Don't execute lock/unlock if speed > 10 km/h
   - Purpose: Prevent locking vehicle while it's moving (safety hazard)
   - Result: **Commands are ignored** because device thinks it's moving

3. **Root Cause**:
   - Poor GPS signal
   - GPS antenna issues
   - Interference
   - Device firmware issues
   - Environmental factors (buildings, trees)

---

## 🎯 What Needs to Be Tested

### Goal: Verify command delivery and GPS stability

**Test WITHOUT locking/unlocking vehicles** (for safety)

### Tests to Perform:

#### 1. **Location Request Command** ✅ SAFE
   - Sends: "Please report your GPS position"
   - Does NOT lock/unlock vehicle
   - Tests: Command delivery, device response

#### 2. **GPS Stability Monitoring** ✅ SAFE
   - Monitor GPS coordinates over 5-10 minutes
   - Check if coordinates are jumping
   - Calculate speed between updates
   - Identify problematic devices

#### 3. **Activity Log Verification** ✅ SAFE
   - Check if commands are being logged
   - Check command status (pending, success, failed)
   - Check device response times

---

## 🛠️ How to Test

### Step 1: Diagnose GPS Stability
```bash
node diagnose-gps-stability.js
```

This will:
- ✅ Show all vehicles and their GPS status
- ✅ Identify devices with GPS issues
- ✅ Check coordinate precision
- ✅ List problematic devices

### Step 2: Test Command Delivery (Safe - Location Request)
```bash
node test-location-command.js <DEVICE_IMEI>
```

Example:
```bash
node test-location-command.js 868509065921107
```

This will:
- ✅ Send a LOCATION REQUEST command
- ✅ Wait for device response
- ✅ Check command status
- ✅ NOT lock or unlock the vehicle

### Step 3: Monitor in Dashboard
1. Go to **Tracker** tab
2. Search for the vehicle by IMEI
3. Watch GPS coordinates for 5-10 minutes
4. Check if coordinates are stable or jumping

### Step 4: Check Activity Log
1. Go to **Activity** tab
2. Look for recent commands
3. Check status: Success ✅ or Failed ❌
4. Note any error messages

---

## 📊 What to Look For

### ✅ Good GPS (Stable):
```
Time: 10:00:00 → Lat: 17.500000, Lon: 78.400000
Time: 10:00:30 → Lat: 17.500002, Lon: 78.400001  ← Small change
Time: 10:01:00 → Lat: 17.500003, Lon: 78.400002  ← Small change
Calculated Speed: 0.2 km/h ✅
```

### ❌ Bad GPS (Jumping):
```
Time: 10:00:00 → Lat: 17.500000, Lon: 78.400000
Time: 10:00:30 → Lat: 17.510000, Lon: 78.410000  ← BIG jump!
Time: 10:01:00 → Lat: 17.499000, Lon: 78.399000  ← Jumped back!
Calculated Speed: 120 km/h ❌ (but vehicle is stationary!)
```

---

## 📝 Data to Collect for VoltCred

When reporting to VoltCred, provide:

1. **Device IMEI**: e.g., `868509065921107`
2. **GPS Coordinates** (3-5 samples over 5 minutes):
   ```
   10:00:00 → 17.500000, 78.400000
   10:01:00 → 17.510000, 78.410000
   10:02:00 → 17.499000, 78.399000
   ```
3. **Calculated Speed**: e.g., "120 km/h between updates"
4. **Vehicle Status**: "Stationary, parked in office"
5. **Command Status**: "Location request successful, but lock command ignored"
6. **Connection Status**: "Connected" or "Disconnected"

---

## 🚨 Safety Notes

### ⚠️ DO NOT Test Lock/Unlock Commands:
- ❌ Don't send `engine_cutoff` (lock)
- ❌ Don't send `engine_restore` (unlock)
- ✅ Only use `location_request`

### Why?
- Vehicle might be in use
- Command might execute unexpectedly
- Safety hazard if vehicle is moving
- Could strand riders

---

## 🔧 Possible Solutions (After Testing)

Once you've identified problematic devices, VoltCred may:

1. **Adjust Safety Threshold**:
   - Increase speed limit from 10 km/h to 20 km/h
   - Or disable speed check for specific devices

2. **GPS Filter**:
   - Add GPS smoothing/filtering on device firmware
   - Ignore GPS updates that are too far from previous location

3. **Device Replacement**:
   - If GPS antenna is faulty
   - If device firmware is outdated

4. **Manual Override**:
   - Allow commands when vehicle is confirmed stationary
   - Require photo proof or geofence verification

---

## 📞 Reporting to VoltCred

**Email Template:**

```
Subject: GPS Jumping Issue - Command Delivery Test Results

Hi VoltCred Team,

We've tested command delivery as requested. Here are our findings:

Device IMEI: [IMEI]
Vehicle: [Vehicle Name/ID]

GPS Stability Test:
- Sample 1 (10:00): Lat 17.500000, Lon 78.400000
- Sample 2 (10:01): Lat 17.510000, Lon 78.410000 ← Jumped 1.5 km
- Sample 3 (10:02): Lat 17.499000, Lon 78.399000 ← Jumped back
- Calculated Speed: 180 km/h (vehicle was stationary)

Command Test:
- Command: location_request
- Status: [Success/Failed]
- Response Time: [X seconds]
- Lock Command: Not tested (safety)

Vehicle Status: Parked, stationary in office parking

Please advise on next steps.

Thanks,
[Your Name]
```

---

## 🎯 Summary

| Test | Safe? | Purpose |
|------|-------|---------|
| Location Request | ✅ Yes | Test command delivery |
| GPS Monitoring | ✅ Yes | Identify jumping coordinates |
| Activity Log | ✅ Yes | Verify command status |
| Lock/Unlock | ❌ NO | Don't test - safety hazard |

**Next Steps:**
1. Run `diagnose-gps-stability.js` to identify problematic devices
2. Run `test-location-command.js <IMEI>` on affected devices
3. Monitor GPS for 5-10 minutes in Tracker tab
4. Collect data and report to VoltCred
5. Wait for VoltCred's solution (firmware update, threshold adjustment, etc.)
