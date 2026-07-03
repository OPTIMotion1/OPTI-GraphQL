const express = require("express");
const router = express.Router();
const { sendDeviceCommand } = require("../services/voltcred.service");

// Kept in sync with voltcred.service.js — full CommandType enum from the
// VoltCred Customer API Postman collection.
const ALLOWED_COMMANDS = [
  "engine_cutoff",
  "engine_restore",
  "location_request",
  "status_query",
  "geofence_check",
];

// POST /api/command  { "deviceId": 284, "commandType": "engine_cutoff" }
router.post("/", async (req, res) => {
  const { deviceId, commandType } = req.body;

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
    res.json({
      success: true,
      message: `Command "${commandType}" sent. Status: ${result?.status || "pending"}. Vehicle confirms execution separately.`,
      result,
    });
  } catch (error) {
    console.log("ERROR sending command:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;