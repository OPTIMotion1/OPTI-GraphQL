const { getOverdueRentals } = require('./renewals.service');
const { getAssets, sendCommand } = require('./graphql.service');
const { 
  isEligibleForCutoff, 
  logCutoffAttempt 
} = require('./cutoff-tracker.service');

/**
 * Match rental vehicle to VoltCred IoT device
 * @param {Object} rental - Rental information
 * @param {Array} assets - VoltCred assets list
 * @returns {Object|null} Matched device or null
 */
function matchRentalToDevice(rental, assets) {
  const { vehicleId, vehicleImei } = rental;
  
  // Try to match by various identifiers
  for (const asset of assets) {
    // Match by asset ID
    if (asset.id && asset.id.toString() === vehicleId?.toString()) {
      const device = asset.iot_devices?.[0];
      if (device) {
        return { asset, device };
      }
    }
    
    // Match by IMEI/device ID
    if (vehicleImei) {
      const device = asset.iot_devices?.find(d => 
        d.device_id === vehicleImei || d.id.toString() === vehicleImei
      );
      if (device) {
        return { asset, device };
      }
    }
    
    // Match by asset name containing vehicle ID
    if (vehicleId && asset.name?.includes(vehicleId.toString())) {
      const device = asset.iot_devices?.[0];
      if (device) {
        return { asset, device };
      }
    }
  }
  
  return null;
}

/**
 * Check safety conditions before sending cutoff command
 * @param {Object} asset - VoltCred asset data
 * @param {Object} device - VoltCred device data
 * @returns {Object} {safe: boolean, reason: string}
 */
function checkSafetyConditions(asset, device) {
  // Safety check 1: Don't cutoff if vehicle is moving
  if (asset.status === 'moving') {
    return { 
      safe: false, 
      reason: 'Vehicle is currently moving - unsafe to immobilize' 
    };
  }
  
  // Safety check 2: Device must be connected or recently disconnected
  if (device.connection_status === 'unknown') {
    return { 
      safe: false, 
      reason: 'Device connection status unknown - cannot verify command delivery' 
    };
  }
  
  // Safety check 3: Check last communication time (device should be reachable)
  if (device.last_communication) {
    const lastComm = new Date(device.last_communication.replace(' ', 'T') + 'Z');
    const hoursSinceComm = (Date.now() - lastComm.getTime()) / (1000 * 60 * 60);
    
    // If no communication for 48+ hours, device might be offline
    if (hoursSinceComm > 48) {
      return {
        safe: false,
        reason: `Device hasn't communicated in ${Math.floor(hoursSinceComm)} hours - may be offline`
      };
    }
  }
  
  // All safety checks passed
  return { safe: true, reason: 'All safety checks passed' };
}

/**
 * Execute cutoff for a single overdue rental
 * @param {Object} rental - Overdue rental data
 * @param {Array} assets - VoltCred assets list
 * @returns {Promise<Object>} Result of cutoff attempt
 */
async function executeCutoffForRental(rental, assets) {
  const { rentalId, vehicleId, overdueDays } = rental;
  
  try {
    // Step 1: Check if eligible (not already cutoff or max retries)
    const eligibility = await isEligibleForCutoff(rentalId);
    
    if (!eligibility.eligible) {
      return {
        rentalId,
        vehicleId,
        success: false,
        skipped: true,
        reason: eligibility.reason,
        existingLog: eligibility.existingLog
      };
    }
    
    // Step 2: Match rental to VoltCred device
    const match = matchRentalToDevice(rental, assets);
    
    if (!match) {
      // Log failure - no matching device found
      await logCutoffAttempt({
        rentalId,
        vehicleId,
        deviceId: null,
        deviceImei: rental.vehicleImei,
        overdueDate: rental.dueDate,
        overdueDays,
        cutoffStatus: 'failed',
        error: 'No matching VoltCred device found'
      });
      
      return {
        rentalId,
        vehicleId,
        success: false,
        reason: 'No matching VoltCred device found'
      };
    }
    
    const { asset, device } = match;
    
    // Step 3: Safety checks
    const safety = checkSafetyConditions(asset, device);
    
    if (!safety.safe) {
      // Log failure - safety check failed
      await logCutoffAttempt({
        rentalId,
        vehicleId,
        deviceId: device.id,
        deviceImei: device.device_id,
        overdueDate: rental.dueDate,
        overdueDays,
        cutoffStatus: 'failed',
        error: `Safety check failed: ${safety.reason}`
      });
      
      return {
        rentalId,
        vehicleId,
        deviceId: device.device_id,
        success: false,
        reason: safety.reason
      };
    }
    
    // Step 4: Send engine_cutoff command
    console.log(`Sending cutoff command for rental ${rentalId}, device ${device.device_id}`);
    
    const commandResult = await sendCommand(device.id, 'engine_cutoff');
    
    // Step 5: Log the attempt
    await logCutoffAttempt({
      rentalId,
      vehicleId: asset.id,
      deviceId: device.id,
      deviceImei: device.device_id,
      overdueDate: rental.dueDate,
      overdueDays,
      cutoffStatus: commandResult ? 'success' : 'failed',
      commandId: commandResult?.id,
      voltCredResponse: commandResult
    });
    
    return {
      rentalId,
      vehicleId: asset.id,
      deviceId: device.device_id,
      assetName: asset.name,
      success: true,
      commandId: commandResult?.id,
      commandStatus: commandResult?.status,
      message: `Cutoff command sent successfully (${eligibility.reason})`
    };
    
  } catch (error) {
    console.error(`Error executing cutoff for rental ${rentalId}:`, error);
    
    // Log the error
    await logCutoffAttempt({
      rentalId,
      vehicleId,
      deviceId: null,
      deviceImei: rental.vehicleImei,
      overdueDate: rental.dueDate,
      overdueDays,
      cutoffStatus: 'failed',
      error: error.message
    });
    
    return {
      rentalId,
      vehicleId,
      success: false,
      error: error.message
    };
  }
}

/**
 * Main function: Check all overdue rentals and execute cutoffs
 * @param {number} minOverdueDays - Minimum days overdue (default: 1)
 * @returns {Promise<Object>} Summary of cutoff operations
 */
async function checkAndExecuteAutoCutoff(minOverdueDays = 1) {
  const startTime = Date.now();
  
  console.log(`Starting auto-cutoff check for rentals ${minOverdueDays}+ days overdue...`);
  
  try {
    // Step 1: Fetch overdue rentals
    const overdueRentals = await getOverdueRentals(minOverdueDays);
    
    if (overdueRentals.length === 0) {
      return {
        success: true,
        message: 'No overdue rentals found',
        totalOverdue: 0,
        processed: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        duration: Date.now() - startTime
      };
    }
    
    // Step 2: Fetch VoltCred assets
    const assets = await getAssets();
    
    if (!assets || assets.length === 0) {
      throw new Error('No VoltCred assets available');
    }
    
    // Step 3: Execute cutoff for each overdue rental
    const results = [];
    
    for (const rental of overdueRentals) {
      const result = await executeCutoffForRental(rental, assets);
      results.push(result);
      
      // Small delay between commands to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Step 4: Summarize results
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success && !r.skipped).length;
    const skipped = results.filter(r => r.skipped).length;
    
    const summary = {
      success: true,
      message: `Auto-cutoff check completed`,
      totalOverdue: overdueRentals.length,
      processed: results.length,
      successful,
      failed,
      skipped,
      details: results,
      duration: Date.now() - startTime
    };
    
    console.log(`Auto-cutoff completed: ${successful} successful, ${failed} failed, ${skipped} skipped`);
    
    return summary;
    
  } catch (error) {
    console.error('Error in auto-cutoff process:', error);
    
    return {
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}

module.exports = {
  matchRentalToDevice,
  checkSafetyConditions,
  executeCutoffForRental,
  checkAndExecuteAutoCutoff
};
