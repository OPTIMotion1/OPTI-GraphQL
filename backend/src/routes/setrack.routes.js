const express = require('express');
const router = express.Router();
const { getSeTrackDevices } = require('../services/setrack.service');

// GET /api/setrack
// Returns vehicle list from SeTrack API
router.get('/', async (req, res) => {
  try {
    // Prevent caching
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    const result = await getSeTrackDevices();
    
    res.json({
      success: true,
      assets: result.devices || [],
      counts: result.counts || null,
      total: result.total || 0
    });
    
  } catch (error) {
    const msg = error.message || 'Failed to fetch SeTrack devices';
    console.error('❌ ERROR fetching SeTrack devices:', msg);
    
    res.status(500).json({
      success: false,
      error: msg
    });
  }
});

module.exports = router;
