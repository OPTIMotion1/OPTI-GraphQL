const express = require('express');
const { verifyToken } = require('../middleware/auth.middleware');
const { getRecentLogs, getUserLogs, getVehicleLogs } = require('../services/activity-log.service');

const router = express.Router();

// Get recent activity logs
router.get('/recent', verifyToken, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = getRecentLogs(limit);
    
    res.json({
      success: true,
      logs,
      count: logs.length
    });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity logs'
    });
  }
});

// Get logs for current user
router.get('/my-activity', verifyToken, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = getUserLogs(req.user.id, limit);
    
    res.json({
      success: true,
      logs,
      count: logs.length
    });
  } catch (error) {
    console.error('Get user logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your activity logs'
    });
  }
});

// Get logs for specific vehicle
router.get('/vehicle/:vehicleId', verifyToken, (req, res) => {
  try {
    const vehicleId = parseInt(req.params.vehicleId);
    const limit = parseInt(req.query.limit) || 50;
    const logs = getVehicleLogs(vehicleId, limit);
    
    res.json({
      success: true,
      logs,
      count: logs.length
    });
  } catch (error) {
    console.error('Get vehicle logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vehicle activity logs'
    });
  }
});

module.exports = router;
