const axios = require("axios");



const GRAPHQL_URL = process.env.VOLTCRED_GRAPHQL_URL
  || "https://api-stage.voltcred.com/v2/graphql";

let authToken = null;

// ── Login ─────────────────────────────────────────────────────────────────────
// The Heimdallr gateway REQUIRES Cookie: device=web even on the login call.
// Without it the server returns device_required and no token is issued.
// Confirmed from live testing — do not remove this header.

async function login() {
  const query = `
    mutation Login($email: String!, $password: String!) {
      sessionCreateV2(data: { email: $email, password: $password }) {
        token
        success
        messageKey
      }
    }
  `;

  const response = await axios.post(
    GRAPHQL_URL,
    { query, variables: {
      email: process.env.VOLTCRED_EMAIL,
      password: process.env.VOLTCRED_PASSWORD,
    }},
    { headers: {
      "Content-Type": "application/json",
      "Cookie": "device=web",
    }}
  );

  const result = response.data?.data?.sessionCreateV2;

  if (!result?.success || !result?.token) {
    throw new Error(`GraphQL login failed: ${result?.messageKey || "unknown"}`);
  }

  authToken = result.token;
  console.log("VoltCred GraphQL login successful");
  return authToken;
}

// ── Authenticated request ─────────────────────────────────────────────────────
// Sends Cookie: authorization=<jwt>; device=web on every post-login request.
// Auto re-logs-in once if the token expires (GraphQL-level unauthorized or HTTP 401).

async function graphqlRequest(query, variables = {}) {
  if (!authToken) await login();

  const makeRequest = () => axios.post(
    GRAPHQL_URL,
    { query, variables },
    { headers: {
      "Content-Type": "application/json",
      "Cookie": `authorization=${authToken}; device=web`,
    }}
  );

  try {
    const response = await makeRequest();
    const errors = response.data?.errors;

    if (errors?.length) {
      const msg = errors[0]?.message;
      const extensions = errors[0]?.extensions;
      
      console.error("GraphQL Error:", msg);
      if (extensions) {
        console.error("Error Details:", JSON.stringify(extensions, null, 2));
      }
      
      if (msg === "unauthorized") {
        console.log("Token expired, re-logging in...");
        await login();
        const retry = await makeRequest();
        if (retry.data?.errors?.length) {
          console.error("Retry failed:", retry.data.errors[0]);
          throw new Error(retry.data.errors[0].message);
        }
        return retry.data?.data;
      }
      throw new Error(msg || "GraphQL error");
    }

    return response.data?.data;
  } catch (error) {
    // Capture HTTP-level errors (400, 401, 500, etc.)
    if (error.response) {
      console.error("HTTP Error:", error.response.status, error.response.statusText);
      console.error("Response Data:", JSON.stringify(error.response.data, null, 2));
    }
    
    if (error.response?.status === 401) {
      console.log("401 Unauthorized, re-logging in...");
      await login();
      const retry = await makeRequest();
      return retry.data?.data;
    }
    throw error;
  }
}

// ── Get assets ────────────────────────────────────────────────────────────────
// Returns vehicle list with business metadata (license plate, asset type,
// status, location, IoT devices).
//
// NOTE: As of testing on 2026-06-27, this returns "unauthorized" for the
// Optimotion account on staging. Once VoltCred enables permissions for
// hello@optimotion.in, this will return real asset data automatically.
// No code change needed — just the account permission on VoltCred's side.

async function getAssets() {
  // VoltCred NEW API (updated Aug 2026) - uses 'assetsWithPagination' 
  // Old 'assets' query was removed - now returns paginated structure
  const query = `
    query ListAssetsPage($limit: Int, $offset: Int) {
      assetsWithPagination(limit: $limit, offset: $offset) {
        total
        counts {
          moving
          idle
          stopped
          offline
          untracked
          total
        }
        rows {
          id
          name
          license_plate
          operator_name
          model
          asset_type
          status
          primary_iot_device {
            id
            name
            device_id
            iot_type_code
            connection_status
            last_communication
            location { 
              latitude 
              longitude 
              address 
              speed 
              bearing 
              timestamp 
            }
            state {
              key
              label
              kind
              unit
              value
              observed
              updated_at
              stale
              writable
              direction
            }
          }
          iot_devices {
            id
            name
            device_id
            iot_type_code
            connection_status
            last_communication
            location {
              latitude
              longitude
              address
              speed
              bearing
              timestamp
            }
            state {
              key
              label
              kind
              unit
              value
              observed
              updated_at
              stale
              writable
              direction
            }
          }
        }
      }
    }
  `;

  try {
    const data = await graphqlRequest(query, { limit: 200, offset: 0 });
    const result = data?.assetsWithPagination;
    
    if (!result) {
      console.log('getAssets: No assetsWithPagination in response');
      return { assets: [], counts: null, total: 0 };
    }

    const assets = result.rows || [];
    console.log(`getAssets: fetched ${assets.length} of ${result.total} total assets from VoltCred`);
    console.log(`Status counts - Moving: ${result.counts?.moving}, Idle: ${result.counts?.idle}, Offline: ${result.counts?.offline}, Untracked: ${result.counts?.untracked}`);

    // Map new structure with all new fields
    const mappedAssets = assets.map(asset => {
      const primaryDevice = asset.primary_iot_device;
      const location = primaryDevice?.location;
      
      // Extract device state into easy-to-use object
      const deviceState = {};
      if (primaryDevice?.state) {
        primaryDevice.state.forEach(s => {
          deviceState[s.key] = {
            value: s.value,
            label: s.label,
            observed: s.observed,
            stale: s.stale,
            writable: s.writable,
            unit: s.unit,
            updated_at: s.updated_at
          };
        });
      }

      return {
        id: asset.id,
        name: asset.name,
        license_plate: asset.license_plate,
        operator_name: asset.operator_name,
        model: asset.model,
        asset_type: asset.asset_type || 'vehicle',
        status: asset.status,
        location: location ? {
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address,
          speed: location.speed,
          bearing: location.bearing,
          timestamp: location.timestamp
        } : null,
        // Device state (ignition, immobiliser, battery, etc.)
        state: deviceState,
        primary_device_id: primaryDevice?.id,
        iot_devices: (asset.iot_devices || []).map(device => ({
          id: device.id,
          name: device.name,
          device_id: device.device_id,
          iot_type_code: device.iot_type_code,
          connection_status: device.connection_status,
          last_communication: device.last_communication,
          is_primary: device.id === primaryDevice?.id,
          location: device.location,
          // Device-specific state
          state: (device.state || []).reduce((acc, s) => {
            acc[s.key] = {
              value: s.value,
              label: s.label,
              observed: s.observed,
              stale: s.stale,
              writable: s.writable,
              unit: s.unit,
              updated_at: s.updated_at
            };
            return acc;
          }, {})
        }))
      };
    });

    return { 
      assets: mappedAssets, 
      counts: result.counts,
      total: result.total 
    };
  } catch (error) {
    console.error('Error fetching assets from VoltCred:', error.message);
    // Return empty structure instead of throwing
    return { assets: [], counts: null, total: 0 };
  }
}

// ── Send command ──────────────────────────────────────────────────────────────
// device_id MUST be an Int (not a string) — GraphQL schema requires Int!
// commandType: "engine_cutoff" (lock) or "engine_restore" (unlock)

// Per VoltCred Customer API Postman collection: CommandType enum supports
// engine_cutoff/engine_restore (immobilize/mobilize) plus location_request,
// status_query, and geofence_check.
const ALLOWED_COMMANDS = [
  "engine_cutoff",
  "engine_restore",
  "request_location",
  "location_request", // deprecated but still works — kept for backwards compat
];

async function sendDeviceCommand(deviceId, commandType) {
  if (!ALLOWED_COMMANDS.includes(commandType)) {
    throw new Error(`Command "${commandType}" not allowed. Allowed: ${ALLOWED_COMMANDS.join(", ")}`);
  }

  const mutation = `
    mutation SendCommand($deviceId: Int!, $command: CommandType!) {
      executeDeviceCommand(device_id: $deviceId, command_type: $command) {
        id
        command_code
        status
        execution_time
      }
    }
  `;

  const data = await graphqlRequest(mutation, {
    deviceId: parseInt(deviceId, 10),
    command: commandType,
  });

  return data?.executeDeviceCommand;
}

// ── Get device commands ───────────────────────────────────────────────────────
// Returns command history for a specific device
// Shows all commands sent to the device with their current status

async function getDeviceCommands(deviceId) {
  const query = `
    query GetDeviceCommands($deviceId: Int!) {
      deviceCommands(device_id: $deviceId) {
        id
        command_code
        status
        execution_time
        response
      }
    }
  `;

  const data = await graphqlRequest(query, { deviceId: parseInt(deviceId, 10) });
  return data?.deviceCommands || [];
}

module.exports = { login, getAssets, sendDeviceCommand, getDeviceCommands, graphqlRequest };