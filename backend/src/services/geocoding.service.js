const axios = require('axios');

// Cache to avoid repeated API calls for same coordinates
const addressCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Reverse geocode coordinates to address using OpenStreetMap Nominatim API
 * Free, no API key required, but has rate limits (1 request/second)
 */
async function reverseGeocode(latitude, longitude) {
  if (!latitude || !longitude) return null;
  
  const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  
  // Check cache first
  const cached = addressCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
    return cached.address;
  }
  
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
        lat: latitude,
        lon: longitude,
        format: 'json',
        addressdetails: 1,
        zoom: 16 // Street level detail
      },
      headers: {
        'User-Agent': 'OPTI-Tracker/1.0' // Required by Nominatim
      },
      timeout: 5000 // 5 second timeout
    });
    
    if (response.data && response.data.display_name) {
      const address = response.data.display_name;
      
      // Cache the result
      addressCache.set(cacheKey, {
        address,
        timestamp: Date.now()
      });
      
      return address;
    }
    
    return null;
  } catch (error) {
    console.error(`[Geocoding] Error for ${latitude},${longitude}:`, error.message);
    return null;
  }
}

/**
 * Batch reverse geocode with rate limiting (1 req/sec for Nominatim)
 */
async function batchReverseGeocode(locations) {
  const results = [];
  
  for (const location of locations) {
    if (location.latitude && location.longitude) {
      const address = await reverseGeocode(location.latitude, location.longitude);
      results.push({
        ...location,
        address: address || location.address || null
      });
      
      // Rate limit: wait 1 second between requests
      if (locations.indexOf(location) < locations.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } else {
      results.push(location);
    }
  }
  
  return results;
}

module.exports = {
  reverseGeocode,
  batchReverseGeocode
};
