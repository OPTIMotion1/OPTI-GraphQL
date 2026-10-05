const axios = require('axios');
const { reverseGeocode } = require('./geocoding.service');

const SETRACK_API_URL = process.env.SETRACK_API_URL || 'https://mvts1.millitrack.com/api/middleMan/getDeviceInfo';
const SETRACK_ACCESS_TOKEN = process.env.SETRACK_ACCESS_TOKEN;

// Get all devices from SeTrack API
async function getSeTrackDevices() {
  try {
    const response = await axios.get(SETRACK_API_URL, {
      params: {
        accessToken: SETRACK_ACCESS_TOKEN
      },
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.data.successful) {
      throw new Error(response.data.message || 'SeTrack API returned unsuccessful');
    }
    
    const devices = response.data.object || [];
    console.log(`[SeTrack] Fetched ${devices.length} devices`);
    
    // Transform SeTrack format to match VoltCred-like structure
    const transformedDevices = [];
    
    for (const device of devices) {
      // Determine status based on lastStatusUpdate
      const lastUpdate = new Date(device.lastStatusUpdate);
      const now = new Date();
      const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);
      
      let status = 'offline';
      if (hoursSinceUpdate < 1) {
        if (device.attributes.ignition && device.speed > 5) {
          status = 'moving';
        } else if (device.attributes.ignition) {
          status = 'idle';
        } else {
          status = 'stopped';
        }
      }
      
      // Use existing address or null (don't wait for geocoding)
      const address = device.address || null;
      
      transformedDevices.push({
        id: `setrack_${device.deviceUniqueId}`,
        name: device.name,
        license_plate: device.name,
        asset_type: 'vehicle',
        status: status,
        location: {
          latitude: device.latitude,
          longitude: device.longitude,
          address: address,
          speed: device.speed,
          bearing: device.course,
          timestamp: device.fixTime
        },
        state: {
          ignition: {
            value: device.attributes.ignition,
            label: 'Ignition',
            observed: true
          },
          battery_level: {
            value: device.attributes.batteryLevel,
            label: 'Battery Level',
            unit: '%',
            observed: true
          },
          odometer: {
            value: device.attributes.totalDistance,
            label: 'Total Distance',
            unit: 'm',
            observed: true
          },
          trip_distance: {
            value: device.attributes.todayDistance,
            label: 'Today Distance',
            unit: 'm',
            observed: true
          },
          speed: {
            value: device.speed,
            label: 'Speed',
            unit: 'km/h',
            observed: true
          },
          motion: {
            value: device.attributes.motion,
            label: 'Motion',
            observed: true
          },
          charge: {
            value: device.attributes.charge,
            label: 'Charging',
            observed: true
          }
        },
        iot_devices: [{
          id: `setrack_dev_${device.deviceUniqueId}`,
          name: device.name,
          device_id: device.deviceUniqueId,
          iot_type_code: 'setrack_gps',
          connection_status: hoursSinceUpdate < 1 ? 'connected' : 'disconnected',
          last_communication: device.lastStatusUpdate,
          is_primary: true,
          location: {
            latitude: device.latitude,
            longitude: device.longitude,
            speed: device.speed,
            bearing: device.course,
            timestamp: device.fixTime
          },
          state: {}
        }],
        // Source indicator
        source: 'setrack'
      });
    }
    
    return {
      devices: transformedDevices,
      total: devices.length,
      counts: {
        moving: transformedDevices.filter(d => d.status === 'moving').length,
        idle: transformedDevices.filter(d => d.status === 'idle').length,
        stopped: transformedDevices.filter(d => d.status === 'stopped').length,
        offline: transformedDevices.filter(d => d.status === 'offline').length
      }
    };
    
  } catch (error) {
    console.error('[SeTrack] Error fetching devices:', error.message);
    throw error;
  }
}

module.exports = { getSeTrackDevices };
