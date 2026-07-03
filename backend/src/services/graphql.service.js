const axios = require("axios");

const GRAPHQL_URL = process.env.VOLTCRED_GRAPHQL_URL
  || "https://api-stage.voltcred.com/v2/graphql";

let authToken = null;

// ── Login ─────────────────────────────────────────────────────────────────────
// The Heimdallr gateway requires Cookie: device=web on EVERY request,
// including the login call itself — without it the server returns
// "device_required" even with correct credentials.

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
// Sends Cookie: authorization=<jwt>; device=web on every authenticated call.
// Auto re-logs in once if the token is expired (401 or "unauthorized").

async function gql(query, variables = {}) {
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
      if (errors[0].message === "unauthorized") {
        await login();
        const retry = await makeRequest();
        if (retry.data?.errors?.length) throw new Error(retry.data.errors[0].message);
        return retry.data?.data;
      }
      throw new Error(errors[0].message);
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

// ── Assets ────────────────────────────────────────────────────────────────────
// Returns all assets with embedded IoT device telemetry.
// NOTE: currently returns "unauthorized" for Optimotion account on staging —
// this is a VoltCred account permissions issue, not a code bug.
// Once VoltCred enables assets access for this account, this will return
// license_plate, asset_type, connection_status, and last known position.

async function getAssets() {
  const query = `
    query ListAssets {
      assets(limit: 50) {
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
  const data = await gql(query);
  return data?.assets || [];
}

// ── Send command ──────────────────────────────────────────────────────────────
// device_id MUST be an Int (not a string) — GraphQL schema requires Int!
// Allowed commands: engine_cutoff (lock), engine_restore (unlock)

const ALLOWED_COMMANDS = ["engine_cutoff", "engine_restore"];

async function sendCommand(deviceId, commandType) {
  if (!ALLOWED_COMMANDS.includes(commandType)) {
    throw new Error(
      `Command "${commandType}" not allowed. Allowed: ${ALLOWED_COMMANDS.join(", ")}`
    );
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

  const data = await gql(mutation, {
    deviceId: parseInt(deviceId, 10),
    command: commandType,
  });

  return data?.executeDeviceCommand;
}

module.exports = { login, getAssets, sendCommand };
