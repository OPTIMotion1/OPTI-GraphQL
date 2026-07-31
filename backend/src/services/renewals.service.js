const axios = require('axios');

const RENEWALS_API_URL = process.env.RENEWALS_API_URL || 'https://api.optimotion.in/api/v1/finance/renewals/list';
const RENEWALS_API_USERNAME = process.env.RENEWALS_API_USERNAME;
const RENEWALS_API_PASSWORD = process.env.RENEWALS_API_PASSWORD;
const RENEWALS_API_TOKEN = process.env.RENEWALS_API_TOKEN;
const RENEWALS_API_COOKIE = process.env.RENEWALS_API_COOKIE || process.env.RENEWALS_SESSION_COOKIE;

// Session token cache
let sessionToken = null;
let sessionCookie = RENEWALS_API_COOKIE || null;

function parseTokenFromResponse(data) {
  if (!data || typeof data !== 'object') return null;
  if (typeof data === 'string') return null;

  if (data.token || data.access_token || data.sessionToken || data.authToken) {
    return data.token || data.access_token || data.sessionToken || data.authToken;
  }

  if (data.data && typeof data.data === 'object') {
    const nested = parseTokenFromResponse(data.data);
    if (nested) return nested;
  }

  if (data.user && typeof data.user === 'object') {
    const nested = parseTokenFromResponse(data.user);
    if (nested) return nested;
  }

  return null;
}

function extractRenewalRecords(payload) {
  if (Array.isArray(payload)) return payload;

  if (!payload || typeof payload !== 'object') return [];

  // Optimotion API returns: { success: true, data: { data: [...] } }
  if (payload.data?.data && Array.isArray(payload.data.data)) {
    return payload.data.data;
  }

  const candidates = [
    payload.renewals,
    payload.data?.renewals,
    payload.data?.bookings,
    payload.data,  // Try data directly
    payload.bookings,
    payload.items,
    payload.result,
    payload.data?.items,
    payload.records
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

function buildRenewalsQueryParams() {
  const defaultParams = {
    limit: '500',  // Increased to fetch all records
    page: '1',
    startDate: '2020-01-01T00:00:00.000Z',
    endDate: new Date().toISOString()
  };

  const url = new URL(RENEWALS_API_URL);
  const params = new URLSearchParams(url.search);

  for (const [key, value] of Object.entries(defaultParams)) {
    if (!params.has(key)) {
      params.set(key, value);
    }
  }

  return { baseUrl: `${url.origin}${url.pathname}`, params };
}

function buildAuthHeaders(extraHeaders = {}) {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0',
    Referer: 'https://dashboard.optimotion.in/',
    ...extraHeaders,
  };
}

async function tryLoginVariants() {
  if (!RENEWALS_API_USERNAME || !RENEWALS_API_PASSWORD) {
    console.warn('Renewals API credentials not configured');
    return { token: null, cookie: null };
  }

  const loginUrls = [
    process.env.RENEWALS_LOGIN_URL,
    'https://dashboard.optimotion.in/api/login',
    'https://dashboard.optimotion.in/api/auth/login',
    'https://dashboard.optimotion.in/api/auth/signin',
    'https://dashboard.optimotion.in/api/auth/sign-in',
    'https://dashboard.optimotion.in/login'
  ].filter(Boolean);

  const payloads = [
    { username: RENEWALS_API_USERNAME, password: RENEWALS_API_PASSWORD },
    { email: RENEWALS_API_USERNAME, password: RENEWALS_API_PASSWORD },
    { phone: RENEWALS_API_USERNAME, password: RENEWALS_API_PASSWORD },
    { login: RENEWALS_API_USERNAME, password: RENEWALS_API_PASSWORD },
    { username: RENEWALS_API_USERNAME, pass: RENEWALS_API_PASSWORD },
    { user: RENEWALS_API_USERNAME, pass: RENEWALS_API_PASSWORD }
  ];

  const headerSets = [
    buildAuthHeaders(),
    buildAuthHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' }),
    buildAuthHeaders({ Accept: '*/*' })
  ];

  for (const loginUrl of loginUrls) {
    for (const payload of payloads) {
      for (const headers of headerSets) {
        try {
          const body = headers['Content-Type'] === 'application/x-www-form-urlencoded'
            ? new URLSearchParams(payload).toString()
            : payload;

          const response = await axios.post(loginUrl, body, {
            headers,
            timeout: 30000,  // Increased to 30 seconds
            validateStatus: () => true,
            maxRedirects: 0
          });

          const token = parseTokenFromResponse(response.data);
          const cookie = response.headers['set-cookie']?.[0] || null;

          if (token || cookie) {
            return { token, cookie };
          }
        } catch (error) {
          // Try next variant
        }
      }
    }
  }

  return { token: null, cookie: null };
}

/**
 * Login to Optimotion API
 * @returns {Promise<{accessToken: string, refreshToken: string}>} Access and refresh tokens
 */
async function loginToRenewalsAPI() {
  if (!RENEWALS_API_USERNAME || !RENEWALS_API_PASSWORD) {
    console.warn('Renewals API credentials not configured');
    return { accessToken: null, refreshToken: null };
  }

  try {
    console.log('[loginToRenewalsAPI] Logging in to Optimotion API...');
    
    // Use correct Optimotion API endpoint with +91 prefix
    const phone = RENEWALS_API_USERNAME.startsWith('+91') 
      ? RENEWALS_API_USERNAME 
      : `+91${RENEWALS_API_USERNAME}`;
    
    const response = await axios.post('https://api.optimotion.in/api/v1/customer/login', {
      phone,
      password: RENEWALS_API_PASSWORD
    }, {
      headers: buildAuthHeaders(),
      timeout: 30000,
      validateStatus: () => true
    });

    if (response.status !== 200) {
      throw new Error(`Login failed with status ${response.status}: ${JSON.stringify(response.data)}`);
    }

    const accessToken = response.data?.accessToken || response.data?.access_token || response.data?.token;
    const refreshToken = response.data?.refreshToken || response.data?.refresh_token;
    
    // Also extract from cookies if present
    const setCookie = response.headers['set-cookie'];
    let cookieAccessToken = null;
    let cookieRefreshToken = null;
    
    if (setCookie) {
      setCookie.forEach(cookie => {
        if (cookie.includes('access_token=')) {
          cookieAccessToken = cookie.split('access_token=')[1].split(';')[0];
        }
        if (cookie.includes('refresh_token=')) {
          cookieRefreshToken = cookie.split('refresh_token=')[1].split(';')[0];
        }
      });
    }

    const finalAccessToken = accessToken || cookieAccessToken;
    const finalRefreshToken = refreshToken || cookieRefreshToken;

    if (!finalAccessToken) {
      throw new Error('No access token received from Optimotion API login');
    }

    // Update cache
    sessionToken = finalAccessToken;
    sessionCookie = finalRefreshToken 
      ? `refresh_token=${finalRefreshToken}; access_token=${finalAccessToken}`
      : `access_token=${finalAccessToken}`;
    
    console.log('[loginToRenewalsAPI] Successfully logged in to Optimotion API');
    return { accessToken: finalAccessToken, refreshToken: finalRefreshToken };
  } catch (error) {
    console.error('[loginToRenewalsAPI] Error:', error.message);
    throw new Error(`Renewals API login failed: ${error.message}`);
  }
}

/**
 * Fetch rental/renewal data from Optimotion Dashboard
 * @returns {Promise<Array>} List of renewals with vehicle and due date info
 */
async function fetchRenewals() {
  try {
    const headers = buildAuthHeaders();

    // Option 1: Use static API token if provided
    if (RENEWALS_API_TOKEN) {
      headers['Authorization'] = `Bearer ${RENEWALS_API_TOKEN}`;
    }
    // Option 2: Use a pasted browser session cookie directly
    else if (RENEWALS_API_COOKIE || process.env.RENEWALS_SESSION_COOKIE) {
      headers['Cookie'] = sessionCookie || RENEWALS_API_COOKIE;
    }
    // Option 3: Login and use session token
    else if (RENEWALS_API_USERNAME && RENEWALS_API_PASSWORD) {
      if (!sessionToken && !sessionCookie) {
        await loginToRenewalsAPI();
      }
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      if (sessionCookie) {
        headers['Cookie'] = sessionCookie;
      }
    }
    // Option 4: Basic Auth
    else if (RENEWALS_API_USERNAME && RENEWALS_API_PASSWORD) {
      const basicAuth = Buffer.from(`${RENEWALS_API_USERNAME}:${RENEWALS_API_PASSWORD}`).toString('base64');
      headers['Authorization'] = `Basic ${basicAuth}`;
    }

    const { baseUrl, params } = buildRenewalsQueryParams();
    const response = await axios.get(`${baseUrl}?${params.toString()}`, {
      timeout: 30000,  // Increased to 30 seconds
      headers,
      validateStatus: () => true
    });

    const records = extractRenewalRecords(response.data);
    if (!records || !Array.isArray(records)) {
      throw new Error('No renewal records received from renewals API');
    }

    return records;
  } catch (error) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.log('Session expired, re-logging in...');
      sessionToken = null;
      sessionCookie = null;

      if (RENEWALS_API_USERNAME && RENEWALS_API_PASSWORD) {
        await loginToRenewalsAPI();

        const headers = buildAuthHeaders();
        if (sessionToken) {
          headers['Authorization'] = `Bearer ${sessionToken}`;
        }
        if (sessionCookie) {
          headers['Cookie'] = sessionCookie;
        }

        const { baseUrl, params } = buildRenewalsQueryParams();
        const response = await axios.get(`${baseUrl}?${params.toString()}`, {
          timeout: 30000,  // Increased to 30 seconds
          headers,
          validateStatus: () => true
        });

        const records = extractRenewalRecords(response.data);
        if (!records || !Array.isArray(records)) {
          throw new Error('No renewal records received from renewals API');
        }

        return records;
      }
    }

    console.error('Error fetching renewals:', error.message);
    throw new Error(`Failed to fetch renewals: ${error.message}`);
  }
}

/**
 * Calculate days overdue for a rental
 * IMPORTANT: Returns NEGATIVE values for overdue (matching Optimotion Dashboard)
 * @param {string|Date} dueDate - The rental due date
 * @returns {number} Number of days overdue (NEGATIVE if overdue, POSITIVE if days remaining)
 */
function calculateOverdueDays(dueDate) {
  const due = new Date(dueDate);
  const now = new Date();
  
  // Reset to start of day for accurate day calculation
  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  
  const diffTime = due - now;  // REVERSED: due - now (not now - due)
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  // NEGATIVE = overdue (past due date)
  // POSITIVE = days remaining (future due date)
  // ZERO = due today
  return diffDays;
}

/**
 * Filter rentals that are overdue by at least the specified number of days
 * @param {Array} renewals - List of all renewals
 * @param {number} minOverdueDays - Minimum days overdue (default: 1, use -1 or -2 for ALL overdue)
 * @returns {Array} Overdue renewals with overdue days calculated
 */
function filterOverdueRentals(renewals, minOverdueDays = 1) {
  if (!Array.isArray(renewals)) {
    throw new Error('Renewals must be an array');
  }

  // If minOverdueDays is negative, show ALL overdue rentals (overdueDays < 0)
  const threshold = minOverdueDays < 0 ? 0 : minOverdueDays;

  return renewals
    .map(rental => {
      // Optimotion API field mapping:
      // - bookingId: Booking/rental ID
      // - planEndDate: Due date
      // - riderUID: Phone number (with +91)
      // - riderName: Customer name
      // - vehicleId: Vehicle registration number
      // - hub: Location/hub
      // - totalDue: Amount due
      
      const dueDate = rental.planEndDate || rental.dueDate || rental.due_date || rental.endDate || rental.end_date;
      const rentalId = rental.bookingId || rental.id || rental.rentalId || rental.rental_id || rental.booking_id;
      const vehicleId = rental.vehicleId || rental.vehicle_id || rental.assetId || rental.asset_id || rental.vehicleNumber || rental.vehicle_number;
      const vehicleImei = rental.imei || rental.deviceId || rental.device_id || rental.vehicleImei || rental.vehicle_imei || rental.deviceImei || rental.device_imei;
      const status = rental.status || rental.rentalStatus || rental.rental_status || rental.bookingStatus || rental.booking_status || 'active';
      
      // Extract rider information - Optimotion uses riderUID and riderName
      const riderName = rental.riderName || rental.rider_name || rental.customerName || rental.customer_name || rental.userName || rental.user_name || rental.name || rental.fullName || rental.full_name;
      const riderPhone = rental.riderUID || rental.rider_uid || rental.riderPhone || rental.rider_phone || rental.customerPhone || rental.customer_phone || rental.phone || rental.mobile || rental.mobileNumber || rental.mobile_number || rental.phoneNumber || rental.phone_number || rental.contact || rental.contactNumber || rental.contact_number;
      const riderEmail = rental.riderEmail || rental.rider_email || rental.customerEmail || rental.customer_email || rental.email;
      const vehicleName = rental.vehicleId || rental.vehicle_id;  // Use vehicleId as name
      const hub = rental.hub || rental.location;
      const totalDue = rental.totalDue || rental.total_due || rental.amountDue || rental.amount_due;

      if (!dueDate) {
        console.warn(`Rental ${rentalId} has no due date, skipping`);
        return null;
      }

      const overdueDays = calculateOverdueDays(dueDate);

      // Debug: Log first rental to see field names
      if (renewals.indexOf(rental) === 0) {
        console.log('[filterOverdueRentals] Sample rental data:', JSON.stringify(rental, null, 2));
      }

      return {
        rentalId,
        bookingId: rentalId,  // Alias for compatibility
        vehicleId,
        vehicleName,
        vehicleImei,
        dueDate,
        status,
        overdueDays,
        riderName,
        riderPhone,
        riderEmail,
        hub,
        totalDue,
        originalData: rental // Keep original data for reference
      };
    })
    .filter(rental => {
      if (rental === null) return false;
      
      // Filter logic (NEGATIVE values = overdue):
      // - If minOverdueDays is 0: Show ALL overdue (overdueDays < 0)
      // - If minOverdueDays is negative (e.g., -7): Show ONLY that exact overdue value
      
      if (minOverdueDays === 0) {
        // Show ALL overdue rentals (any negative value)
        return rental.overdueDays < 0;
      } else if (minOverdueDays < 0) {
        // Show ONLY rentals with exactly this overdue value
        return rental.overdueDays === minOverdueDays;
      } else {
        // Positive values: show overdue <= -threshold (e.g., 7 = show -7 and worse)
        return rental.overdueDays <= -minOverdueDays;
      }
    });
}

/**
 * Get ALL rentals (not just overdue)
 * @returns {Promise<Array>} List of all rentals
 */
async function getAllRentals() {
  try {
    console.log('[getAllRentals] Fetching all renewals...');
    const renewals = await fetchRenewals();
    
    console.log(`[getAllRentals] Received ${renewals ? renewals.length : 0} renewals from API`);
    
    if (!renewals || !Array.isArray(renewals)) {
      console.warn('[getAllRentals] No renewals array received');
      return [];
    }

    // Debug: Log first rental structure
    if (renewals.length > 0) {
      console.log('[getAllRentals] Sample rental:', JSON.stringify(renewals[0], null, 2));
    }
    
    const mapped = renewals.map((rental, index) => {
      try {
        // Optimotion API field mapping
        const dueDate = rental.planEndDate || rental.dueDate || rental.due_date || rental.endDate || rental.end_date;
        const rentalId = rental.bookingId || rental.id || rental.rentalId || rental.rental_id || rental.booking_id;
        const vehicleId = rental.vehicleId || rental.vehicle_id || rental.assetId || rental.asset_id || rental.vehicleNumber || rental.vehicle_number;
        const vehicleImei = rental.imei || rental.deviceId || rental.device_id || rental.vehicleImei || rental.vehicle_imei || rental.deviceImei || rental.device_imei;
        const status = rental.status || rental.rentalStatus || rental.rental_status || rental.bookingStatus || rental.booking_status || 'active';
        
        const riderName = rental.riderName || rental.rider_name || rental.customerName || rental.customer_name || rental.userName || rental.user_name || rental.name || rental.fullName || rental.full_name;
        const riderPhone = rental.riderUID || rental.rider_uid || rental.riderPhone || rental.rider_phone || rental.customerPhone || rental.customer_phone || rental.phone || rental.mobile || rental.mobileNumber || rental.mobile_number || rental.phoneNumber || rental.phone_number || rental.contact || rental.contactNumber || rental.contact_number;
        const riderEmail = rental.riderEmail || rental.rider_email || rental.customerEmail || rental.customer_email || rental.email;
        const vehicleName = rental.vehicleId || rental.vehicle_id;
        const hub = rental.hub || rental.location;
        const totalDue = rental.totalDue || rental.total_due || rental.amountDue || rental.amount_due;

        const overdueDays = dueDate ? calculateOverdueDays(dueDate) : 0;

        return {
          rentalId,
          bookingId: rentalId,
          vehicleId,
          vehicleName,
          vehicleImei,
          dueDate,
          status,
          overdueDays,
          riderName,
          riderPhone,
          riderEmail,
          hub,
          totalDue,
          originalData: rental
        };
      } catch (mapError) {
        console.error(`[getAllRentals] Error mapping rental at index ${index}:`, mapError);
        return null;
      }
    }).filter(r => r !== null);

    console.log(`[getAllRentals] Successfully mapped ${mapped.length} rentals`);
    return mapped;
  } catch (error) {
    console.error('[getAllRentals] Error:', error.message, error.stack);
    throw error;
  }
}

/**
 * Get overdue rentals that need vehicle cutoff
 * @param {number} minOverdueDays - Minimum days overdue (default: 1)
 * @returns {Promise<Array>} List of overdue rentals ready for cutoff
 */
async function getOverdueRentals(minOverdueDays = 1) {
  try {
    const renewals = await fetchRenewals();
    
    // Debug: Log first 2 renewals to see actual field names
    console.log('\n=== DEBUGGING: First 2 renewals from API ===');
    console.log(JSON.stringify(renewals.slice(0, 2), null, 2));
    console.log('=== END DEBUG ===\n');
    
    const overdueRentals = filterOverdueRentals(renewals, minOverdueDays);
    
    console.log(`Found ${overdueRentals.length} rentals overdue by ${minOverdueDays}+ days`);
    
    return overdueRentals;
  } catch (error) {
    console.error('Error getting overdue rentals:', error.message);
    throw error;
  }
}

module.exports = {
  loginToRenewalsAPI,
  fetchRenewals,
  calculateOverdueDays,
  filterOverdueRentals,
  getOverdueRentals,
  getAllRentals,
  extractRenewalRecords,
  parseTokenFromResponse,
  buildAuthHeaders
};
