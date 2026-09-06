const express = require("express");
const router = express.Router();
const { getAssets } = require("../services/voltcred.service");
const { getAllRentals } = require("../services/renewals.service");
const fs = require('fs');
const path = require('path');
// const { verifyToken } = require("../middleware/auth.middleware");

// Load IMEI to Vehicle ID mapping
const MAPPING_FILE = path.join(__dirname, '..', '..', 'data', 'vehicle-imei-mapping.json');
let imeiMapping = {};

function loadImeiMapping() {
  try {
    if (fs.existsSync(MAPPING_FILE)) {
      const data = fs.readFileSync(MAPPING_FILE, 'utf8');
      imeiMapping = JSON.parse(data);
      // Remove comment fields
      delete imeiMapping._comment;
      delete imeiMapping._instructions;
      console.log(`[Assets] ✅ Loaded ${Object.keys(imeiMapping).length} IMEI mappings from: ${MAPPING_FILE}`);
      console.log(`[Assets] Mapped vehicles: ${Object.entries(imeiMapping).filter(([k, v]) => v !== 'UNKNOWN').map(([k, v]) => `${k.slice(-6)}→${v}`).join(', ')}`);
    } else {
      console.error('[Assets] ❌ IMEI mapping file NOT FOUND at:', MAPPING_FILE);
      console.error('[Assets] Current directory:', __dirname);
      console.error('[Assets] Computed path:', MAPPING_FILE);
    }
  } catch (error) {
    console.error('[Assets] ❌ Could not load IMEI mapping:', error.message);
    console.error('[Assets] Stack:', error.stack);
  }
}

// Load mapping on startup (force reload on every deploy)
console.log('[Assets] Initializing IMEI mapping...');
loadImeiMapping();

// GET /api/assets
// Returns vehicle list from VoltCred GraphQL vehicles query.
// Enriched with operator names from Optimotion rental data.
// Returns empty array with success=true if no vehicles found.
router.get("/", async (req, res) => {
  try {
    // Prevent caching - force fresh data
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    const result = await getAssets();
    
    // FIRST: Apply IMEI mapping to ALL assets (before rental matching)
    let enrichedAssets = (result.assets || []).map(asset => {
      const mappedName = imeiMapping[asset.name];
      if (mappedName && mappedName !== 'UNKNOWN') {
        console.log(`[Assets] ✓ Mapping vehicle name: ${asset.name} → ${mappedName}`);
        return {
          ...asset,
          name: mappedName
        };
      }
      return asset;
    });
    
    // THEN: Try to match with Optimotion rental data to get operator names
    try {
      const optimotionEnabled = process.env.OPTIMOTION_RENEWALS_FETCH_ENABLED !== 'false';
      const rentals = optimotionEnabled ? await getAllRentals() : [];
      
      if (rentals && rentals.length > 0) {
        console.log(`[Assets] Matching ${enrichedAssets.length} VoltCred assets with ${rentals.length} Optimotion rentals`);
        
        // Create a map of vehicle ID -> rental info
        const rentalMap = {};
        rentals.forEach(rental => {
          if (rental.vehicleId) {
            rentalMap[rental.vehicleId.toUpperCase().trim()] = rental;
          }
        });
        
        // Enrich assets with rental data
        enrichedAssets = enrichedAssets.map(asset => {
          // Step 1: Check if asset name is already a vehicle ID (e.g., "SL217030", "J00011")
          let vehicleKey = (asset.name || '').toUpperCase().trim();
          let rental = rentalMap[vehicleKey];
          
          // Step 2: If not found, check license_plate
          if (!rental && asset.license_plate) {
            vehicleKey = asset.license_plate.toUpperCase().trim();
            rental = rentalMap[vehicleKey];
          }
          
          if (rental) {
            console.log(`[Assets] ✓ Matched ${asset.name} with rental for ${rental.riderName}`);
            
            return {
              ...asset,
              operator_name: rental.riderName || asset.operator_name,
              operator_phone: rental.riderPhone,
              rental_status: rental.status,
              rental_id: rental.rentalId,
              rental_overdue_days: rental.overdueDays,
              rental_hub: rental.hub,
              rental_due_date: rental.dueDate,
              matched_from_optimotion: true
            };
          }
          
          return asset;
        });
        
        const matchedCount = enrichedAssets.filter(a => a.matched_from_optimotion).length;
        console.log(`[Assets] Matched ${matchedCount}/${enrichedAssets.length} assets with Optimotion rental data`);
      }
    } catch (rentalError) {
      console.warn('[Assets] Could not fetch rental data for matching:', rentalError.message);
      // Continue without rental enrichment
    }
    
    // Return success with counts and total
    res.json({ 
      success: true, 
      assets: enrichedAssets,
      counts: result.counts || null,
      total: result.total || 0,
      message: (enrichedAssets || []).length === 0 
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
