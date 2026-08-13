const express = require("express");
const router = express.Router();
const { getAssets } = require("../services/voltcred.service");
// const { verifyToken } = require("../middleware/auth.middleware");

// GET /api/assets
// Returns vehicle list from VoltCred GraphQL vehicles query.
// Returns empty array with success=true if no vehicles found.
router.get("/", async (req, res) => {
  try {
    const result = await getAssets();
    
    // Return success with counts and total
    res.json({ 
      success: true, 
      assets: result.assets || [],
      counts: result.counts || null,
      total: result.total || 0,
      message: (result.assets || []).length === 0 
        ? 'No vehicles found. Contact VoltCred to add vehicles to your account (hello@optimotion.in).' 
        : undefined
    });
  } catch (error) {
    const msg = error.message || "Failed to fetch assets";
    const isPermission = msg.includes("unauthorized");

    // Enhanced error logging for debugging
    console.error("❌ ERROR fetching assets:", msg);
    if (error.response) {
      console.error("   Response Status:", error.response.status);
      console.error("   Response Data:", JSON.stringify(error.response.data, null, 2));
    }
    if (error.stack) {
      console.error("   Stack:", error.stack.split('\n').slice(0, 3).join('\n'));
    }

    res.status(isPermission ? 403 : 500).json({
      success: false,
      permissionBlocked: isPermission,
      error: isPermission
        ? "Assets query is not authorized for this account. Ask VoltCred to enable assets permission for hello@optimotion.in on the GraphQL API."
        : msg,
      details: error.response?.data || null,
    });
  }
});

module.exports = router;
