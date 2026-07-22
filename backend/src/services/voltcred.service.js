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
      if (msg === "unauthorized") {
        await login();
        const retry = await makeRequest();
        if (retry.data?.errors?.length) throw new Error(retry.data.errors[0].message);
        return retry.data?.data;
      }
      throw new Error(msg || "GraphQL error");
    }

    return response.data?.data;
  } catch (error) {
    if (error.response?.status === 401) {
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
  const query = `
    query ListAssets($limit: Int!, $offset: Int!) {
      assets(limit: $limit, offset: $offset) {
        id
        name
        license_plate
        asset_type
        status
        location { latitude longitude address }
        iot_devices {
          id
          name
          device_id
          iot_type_code
          connection_status
          last_latitude
          last_longitude
          last_communication
          last_update
        }
      }
    }
  `;

  // Paginate through all assets — VoltCred may cap each page at fewer records
  // than the total fleet size. We keep fetching until a page comes back empty.
  const PAGE_SIZE = 50;
  let all = [];
  let offset = 0;

  while (true) {
    const data = await graphqlRequest(query, { limit: PAGE_SIZE, offset });
    const page = data?.assets || [];
    all = all.concat(page);
    console.log(`getAssets: fetched ${page.length} assets at offset ${offset} (total so far: ${all.length})`);

    if (page.length < PAGE_SIZE) break; // last page
    offset += PAGE_SIZE;
  }

  return all;
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

module.exports = { login, getAssets, sendDeviceCommand, graphqlRequest };