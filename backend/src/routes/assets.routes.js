const express = require("express");
const router = express.Router();
const { getAssets } = require("../services/voltcred.service");

// GET /api/assets
// Returns vehicle list from VoltCred GraphQL assets query.
// Returns empty array with a clear message if assets are not yet
// authorized for this account — no silent failure.
router.get("/", async (req, res) => {
  try {
    const assets = await getAssets();
    res.json({ success: true, assets });
  } catch (error) {
    const msg = error.message || "Failed to fetch assets";
    const isPermission = msg.includes("unauthorized");

    console.log("ERROR fetching assets:", msg);
    res.status(isPermission ? 403 : 500).json({
      success: false,
      permissionBlocked: isPermission,
      error: isPermission
        ? "Assets query is not authorized for this account. Ask VoltCred to enable assets permission for hello@optimotion.in on the GraphQL API."
        : msg,
    });
  }
});

module.exports = router;
