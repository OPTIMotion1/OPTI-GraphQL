const express = require("express");
const router = express.Router();
const { sendDeviceCommand } = require("../services/voltcred.service");
const { verifyToken, canSendCommand } = require("../middleware/auth.middleware");
const { logCommand } = require("../services/activity-log.service");

// Kept in sync with voltcred.service.js — full CommandType enum from the
// VoltCred Customer API Postman collection.
const ALLOWED_COMMANDS = [
  "engine_cutoff",
  "engine_restore",
  "location_request",
];

// POST /api/command  { "deviceId": 284, "commandType": "engine_cutoff", "vehicleName": "SL215442" }
router.post("/", verifyToken, canSendCommand, async (req, res) => {
  const { deviceId, commandType, vehicleName, vehicleId } = req.body;

  if (!deviceId) {
    return res.status(400).json({ success: false, error: "deviceId is required" });
  }

  if (!ALLOWED_COMMANDS.includes(commandType)) {
    return res.status(400).json({
      success: false,
      error: `Command "${commandType}" not permitted. Allowed: ${ALLOWED_COMMANDS.join(", ")}`,
    });
  }

  try {
    const result = await sendDeviceCommand(deviceId, commandType);
    
    // Log command activity with authenticated user
    logCommand(req.user, { id: vehicleId, name: vehicleName || deviceId }, commandType, result);
    
    res.json({
      success: true,
      message: `Command "${commandType}" sent. Status: ${result?.status || "pending"}. Vehicle confirms execution separately.`,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.log("ERROR sending command:", error.message);
    
    // Log failed command with authenticated user
    logCommand(req.user, { id: vehicleId, name: vehicleName || deviceId }, commandType, null);
    
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;