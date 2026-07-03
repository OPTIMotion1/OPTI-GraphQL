import { useEffect, useState, useCallback, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";

const API_BASE = import.meta.env.DEV ? "http://localhost:5001" : "";
const DEFAULT_CENTER = [17.522624444444443, 78.41514388888889];

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "vehicles",  label: "Vehicles"  },
  { key: "commands",  label: "Commands"  },
  { key: "settings",  label: "Settings"  },
];

// Full CommandType enum from the VoltCred Customer API Postman collection.
const COMMAND_LABELS = {
  engine_cutoff:    { label: "Lock",            emoji: "🔒", danger: true,  desc: "Immobilize — cut the engine" },
  engine_restore:   { label: "Unlock",          emoji: "🔓", danger: false, desc: "Mobilize — restore the engine" },
  location_request: { label: "Locate",          emoji: "📍", danger: false, desc: "Request a fresh GPS fix" },
  status_query:     { label: "Check status",    emoji: "🔄", danger: false, desc: "Query current device status" },
  geofence_check:   { label: "Geofence check",  emoji: "🛰️", danger: false, desc: "Check geofence boundary state" },
};

const CONN_LABELS = {
  online:       { label: "Connected",    tone: "online"  },
  disconnected: { label: "Disconnected", tone: "offline" },
  unknown:      { label: "Unknown",      tone: "unknown" },
};

function fmtTime(ts) {
  if (!ts) return null;
  const d = new Date(ts.replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function useAssets() {
  const [assets, setAssets]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [permBlocked, setPermBlocked] = useState(false);
  const [lastFetched, setLastFetched] = useState(null);

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`${API_BASE}/api/assets`);
      const data = await res.json();

      if (data.permissionBlocked) {
        setPermBlocked(true);
        setAssets([]);
      } else if (!data.success) {
        throw new Error(data.error || "Failed to load assets");
      } else {
        setAssets(data.assets || []);
        setPermBlocked(false);
        setError(null);
      }
      setLastFetched(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  return { assets, loading, error, permBlocked, lastFetched, reload: load };
}

function PermissionNotice() {
  return (
    <div className="perm-notice">
      <div className="perm-icon">🔐</div>
      <h3>Assets permission not yet enabled</h3>
      <p>
        Login is working and your account is confirmed. VoltCred needs to enable
        the <code>assets</code> query permission for <strong>hello@optimotion.in</strong> on the GraphQL API.
      </p>
      <p className="perm-sub">
        Once that's done, this dashboard will automatically show your full vehicle list — no code changes needed.
      </p>
    </div>
  );
}

// ── Search / filter bar, shared by Dashboard + Vehicles ─────────────────────
function SearchFilterBar({ query, onQuery, status, onStatus, count, total }) {
  return (
    <div className="search-bar">
      <div className="search-input-wrap">
        <span className="search-icon">🔍</span>
        <input
          className="search-input"
          type="text"
          placeholder="Search by name, IMEI, or license plate…"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
        {query && (
          <button className="search-clear" onClick={() => onQuery("")}>✕</button>
        )}
      </div>
      <div className="status-filter">
        {["all", "online", "offline"].map((s) => (
          <button
            key={s}
            className={`status-chip ${status === s ? "status-chip-active" : ""}`}
            onClick={() => onStatus(s)}
          >
            {s === "all" ? "All" : s === "online" ? "Online" : "Offline"}
          </button>
        ))}
      </div>
      <span className="search-count">{count} of {total}</span>
    </div>
  );
}

function useFilteredAssets(assets) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => {
      const isOnline = a.status === "moving" || a.status === "idle";
      if (status === "online" && !isOnline) return false;
      if (status === "offline" && isOnline) return false;
      if (!q) return true;
      const haystack = [
        a.name, a.license_plate, a.asset_type, a.id,
        ...(a.iot_devices || []).map((d) => d.device_id),
        ...(a.iot_devices || []).map((d) => d.name),
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [assets, query, status]);

  return { query, setQuery, status, setStatus, filtered };
}

function DeviceRow({ device, onCommand, commandStatus }) {
  const conn = CONN_LABELS[device.connection_status] || CONN_LABELS.unknown;
  const status = commandStatus[device.id];
  const hasFix = device.last_latitude && device.last_longitude;

  return (
    <div className="device-detail">
      <div className="device-detail-head">
        <div className="device-detail-id">
          <span className="device-name">{device.name || device.device_id}</span>
          <span className="tag tag-mono">{device.device_id}</span>
          {device.iot_type_code && <span className="tag">{device.iot_type_code}</span>}
        </div>
        <span className={`conn-pill conn-${conn.tone}`}>
          <span className={`conn-dot dot-${conn.tone}`} /> {conn.label}
        </span>
      </div>

      <div className="device-detail-grid">
        <div className="dd-field">
          <span className="dd-label">Last communication</span>
          <span className="dd-value">{fmtTime(device.last_communication) || "Never"}</span>
        </div>
        <div className="dd-field">
          <span className="dd-label">Last update</span>
          <span className="dd-value">{fmtTime(device.last_update) || "—"}</span>
        </div>
        <div className="dd-field">
          <span className="dd-label">Last known position</span>
          <span className="dd-value">
            {hasFix ? `${device.last_latitude.toFixed(5)}, ${device.last_longitude.toFixed(5)}` : "No GPS fix reported"}
          </span>
        </div>
      </div>

      <div className="device-commands-full">
        {Object.entries(COMMAND_LABELS).map(([cmd, meta]) => (
          <button
            key={cmd}
            className={`cmd-btn ${meta.danger ? "cmd-danger" : "cmd-safe"}`}
            disabled={status?.state === "pending"}
            title={meta.desc}
            onClick={() => onCommand(device.id, device.id, cmd)}
          >
            {meta.emoji} {meta.label}
          </button>
        ))}
      </div>
      {status && (
        <span className={`cmd-status cmd-${status.state}`}>{status.message}</span>
      )}
    </div>
  );
}

function AssetCard({ asset, onCommand, commandStatus }) {
  const devices  = asset.iot_devices || [];
  const isOnline = asset.status === "moving" || asset.status === "idle";
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`asset-card ${isOnline ? "card-online" : "card-offline"}`}>
      <div className="asset-header" onClick={() => setExpanded((v) => !v)} role="button">
        <div>
          <div className="asset-name">{asset.name || "Unnamed"}</div>
          <div className="asset-meta">
            <span className="tag tag-mono">ID {asset.id}</span>
            {asset.license_plate && asset.license_plate !== asset.name && (
              <span className="tag">{asset.license_plate}</span>
            )}
            {asset.asset_type ? <span className="tag">{asset.asset_type}</span> : <span className="tag tag-muted">type unset</span>}
            <span className="tag">{devices.length} device{devices.length === 1 ? "" : "s"}</span>
          </div>
        </div>
        <div className="asset-header-right">
          <span className={`status-pill ${isOnline ? "pill-online" : "pill-offline"}`}>
            {asset.status || "unknown"}
          </span>
          <span className="expand-arrow">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      <div className="asset-location">
        {asset.location?.latitude
          ? `📍 ${asset.location.address || `${asset.location.latitude.toFixed(4)}, ${asset.location.longitude.toFixed(4)}`}`
          : "📍 No location reported yet"}
      </div>

      {expanded && (
        <div className="device-list-expanded">
          {devices.length === 0 && <p className="muted">No IoT devices attached to this asset.</p>}
          {devices.map((d) => (
            <DeviceRow key={d.id} device={d} onCommand={onCommand} commandStatus={commandStatus} />
          ))}
        </div>
      )}
    </div>
  );
}

function ConfirmModal({ pending, onConfirm, onCancel }) {
  if (!pending) return null;
  const meta    = COMMAND_LABELS[pending.commandType];
  const isDanger = meta?.danger;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>{meta?.emoji} {meta?.label}?</h3>
        <p className="muted">
          Sending <strong>{pending.commandType}</strong> to device ID <strong>{pending.deviceId}</strong>.
        </p>
        <p className="modal-source">
          Sent via <strong>VoltCred GraphQL</strong> — <code>executeDeviceCommand</code> mutation.
        </p>
        {isDanger && (
          <p className="modal-warning">
            ⚠️ Only immobilize if the vehicle is stationary and safe to stop.
          </p>
        )}
        <div className="modal-actions">
          <button className="modal-btn modal-cancel" onClick={onCancel}>Cancel</button>
          <button
            className={`modal-btn ${isDanger ? "modal-confirm-danger" : "modal-confirm"}`}
            onClick={onConfirm}
          >
            Yes, {meta?.label.toLowerCase()}
          </button>
        </div>
      </div>
    </div>
  );
}

function DashboardTab({ assets, permBlocked, onCommand, commandStatus }) {
  const online  = assets.filter((a) => a.status === "moving" || a.status === "idle").length;
  const offline = assets.length - online;
  const { query, setQuery, status, setStatus, filtered } = useFilteredAssets(assets);

  const positions = assets
    .filter((a) => a.location?.latitude && a.location?.longitude)
    .map((a) => ({ id: a.id, name: a.name, lat: a.location.latitude, lng: a.location.longitude }));

  return (
    <>
      <div className="cards">
        <div className="card"><span className="card-label">Total Assets</span><span className="card-value">{assets.length}</span></div>
        <div className="card card-online-tone"><span className="card-label">Online</span><span className="card-value">{online}</span></div>
        <div className="card card-offline-tone"><span className="card-label">Offline</span><span className="card-value">{offline}</span></div>
        <div className="card"><span className="card-label">Data Source</span><span className="card-value-sm">VoltCred GraphQL</span></div>
      </div>

      {permBlocked ? <PermissionNotice /> : (
        <>
          <div className="map-box">
            <MapContainer center={positions[0] ? [positions[0].lat, positions[0].lng] : DEFAULT_CENTER} zoom={12} style={{ height: 360, width: "100%" }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {positions.map((p) => (
                <Marker key={p.id} position={[p.lat, p.lng]}>
                  <Popup><strong>{p.name}</strong></Popup>
                </Marker>
              ))}
            </MapContainer>
            {positions.length === 0 && assets.length > 0 && (
              <div className="map-empty-note">No assets have reported GPS coordinates yet — map will populate automatically once devices send a location fix.</div>
            )}
          </div>

          <div className="panel" style={{ marginTop: 22 }}>
            <div className="panel-head">
              <h2>Vehicle list</h2>
            </div>
            <SearchFilterBar query={query} onQuery={setQuery} status={status} onStatus={setStatus} count={filtered.length} total={assets.length} />
            {filtered.length === 0 ? (
              <p className="muted" style={{ marginTop: 14 }}>No vehicles match this search.</p>
            ) : (
              <div className="vehicle-table">
                <div className="vt-row vt-head">
                  <span>Name / IMEI</span>
                  <span>Status</span>
                  <span>Type</span>
                  <span>Devices</span>
                  <span>Last comm.</span>
                </div>
                {filtered.map((a) => {
                  const isOnline = a.status === "moving" || a.status === "idle";
                  const devices = a.iot_devices || [];
                  const lastComm = devices
                    .map((d) => d.last_communication)
                    .filter(Boolean)
                    .sort()
                    .pop();
                  return (
                    <div className="vt-row" key={a.id}>
                      <span className="vt-name">{a.name}</span>
                      <span className={`status-pill ${isOnline ? "pill-online" : "pill-offline"}`}>{a.status || "unknown"}</span>
                      <span>{a.asset_type || "—"}</span>
                      <span>{devices.length}</span>
                      <span>{fmtTime(lastComm) || "Never"}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

function VehiclesTab({ assets, permBlocked, loading, onCommand, commandStatus }) {
  const { query, setQuery, status, setStatus, filtered } = useFilteredAssets(assets);

  if (permBlocked) return <PermissionNotice />;
  if (loading) return <p className="muted">Loading assets…</p>;
  if (assets.length === 0) return <p className="muted">No assets found.</p>;

  return (
    <>
      <SearchFilterBar query={query} onQuery={setQuery} status={status} onStatus={setStatus} count={filtered.length} total={assets.length} />
      {filtered.length === 0 ? (
        <p className="muted" style={{ marginTop: 14 }}>No vehicles match this search.</p>
      ) : (
        <div className="asset-grid" style={{ marginTop: 16 }}>
          {filtered.map((a) => (
            <AssetCard key={a.id} asset={a} onCommand={onCommand} commandStatus={commandStatus} />
          ))}
        </div>
      )}
    </>
  );
}

function CommandsTab() {
  const [deviceId, setDeviceId]       = useState("");
  const [commandType, setCommandType] = useState("engine_cutoff");
  const [result, setResult]           = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);

  const send = async () => {
    if (!deviceId) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res  = await fetch(`${API_BASE}/api/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: parseInt(deviceId, 10), commandType }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const meta = COMMAND_LABELS[commandType];

  return (
    <div className="panel">
      <h2>Send Command</h2>
      <p className="muted" style={{ marginBottom: 20 }}>
        Send a remote command directly to a device via VoltCred GraphQL (<code>executeDeviceCommand</code>).
        Device ID is the numeric <code>iot_devices[].id</code> from the assets query.
      </p>
      <div className="cmd-form">
        <div className="form-group">
          <label className="form-label">Device ID (numeric)</label>
          <input className="form-input" type="number" placeholder="e.g. 284" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Command</label>
          <select className="form-select" value={commandType} onChange={(e) => setCommandType(e.target.value)}>
            {Object.entries(COMMAND_LABELS).map(([cmd, m]) => (
              <option key={cmd} value={cmd}>{cmd} — {m.desc}</option>
            ))}
          </select>
          {meta && <span className="form-hint">{meta.emoji} {meta.desc}</span>}
        </div>
        <button className={`send-btn ${meta?.danger ? "send-danger" : "send-safe"}`} onClick={send} disabled={loading || !deviceId}>
          {loading ? "Sending…" : `Send ${commandType}`}
        </button>
      </div>
      {result && (
        <div className="result-box result-success">
          <strong>✅ Success</strong>
          <p>{result.message}</p>
          {result.result && <pre className="result-json">{JSON.stringify(result.result, null, 2)}</pre>}
        </div>
      )}
      {error && (
        <div className="result-box result-error">
          <strong>❌ Failed</strong>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}

function SettingsTab() {
  return (
    <div className="panel">
      <h2>Settings</h2>
      <div className="settings-row">
        <div>
          <span className="settings-label">API Endpoint</span>
          <p className="muted">{import.meta.env.DEV ? "http://localhost:5001" : window.location.origin}</p>
        </div>
      </div>
      <div className="settings-row">
        <div>
          <span className="settings-label">GraphQL URL</span>
          <p className="muted">Configured in backend .env — VOLTCRED_GRAPHQL_URL</p>
        </div>
      </div>
      <div className="settings-row">
        <div>
          <span className="settings-label">Auto-refresh interval</span>
          <p className="muted">Every 15 seconds</p>
        </div>
      </div>
      <div className="settings-row">
        <div>
          <span className="settings-label">Supported commands</span>
          <p className="muted">{Object.keys(COMMAND_LABELS).join(", ")}</p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab]           = useState("dashboard");
  const [commandStatus, setCommandStatus]   = useState({});
  const [pendingConfirm, setPendingConfirm] = useState(null);
  const { assets, loading, error, permBlocked, lastFetched, reload } = useAssets();

  const requestCommand = (deviceId, assetId, commandType) => {
    setPendingConfirm({ deviceId, assetId, commandType });
  };

  const confirmCommand = async () => {
    const { deviceId, assetId, commandType } = pendingConfirm;
    setPendingConfirm(null);
    setCommandStatus((p) => ({ ...p, [assetId]: { state: "pending", message: "Sending…" } }));

    try {
      const res  = await fetch(`${API_BASE}/api/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: parseInt(deviceId, 10), commandType }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      const meta = COMMAND_LABELS[commandType];
      setCommandStatus((p) => ({ ...p, [assetId]: { state: "success", message: `${meta.label} sent via GraphQL` } }));
    } catch (err) {
      setCommandStatus((p) => ({ ...p, [assetId]: { state: "error", message: "Failed — " + err.message } }));
    }

    setTimeout(() => {
      setCommandStatus((p) => { const n = { ...p }; delete n[assetId]; return n; });
    }, 6000);
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">OG</span>
          <span className="brand-name">OPTI GraphQL</span>
        </div>
        <nav>
          <ul>
            {NAV_ITEMS.map((item) => (
              <li key={item.key}>
                <button className={`nav-item ${activeTab === item.key ? "nav-active" : ""}`} onClick={() => setActiveTab(item.key)}>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="sidebar-footer">
          <span className={`pulse-dot ${assets.length > 0 ? "pulse-live" : "pulse-idle"}`} />
          <span>{permBlocked ? "Awaiting permission" : assets.length > 0 ? `${assets.length} assets loaded` : "No data"}</span>
        </div>
      </aside>

      <main className="content">
        <div className="topbar">
          <h1>{{ dashboard: "Dashboard", vehicles: "Vehicles", commands: "Commands", settings: "Settings" }[activeTab]}</h1>
          <div className="topbar-right">
            {lastFetched && <span className="last-updated">Updated {lastFetched.toLocaleTimeString()}</span>}
            <button className="refresh-btn" onClick={reload} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button>
          </div>
        </div>

        {error && !permBlocked && <div className="error-banner">{error}</div>}

        {activeTab === "dashboard" && (
          <DashboardTab assets={assets} permBlocked={permBlocked} onCommand={requestCommand} commandStatus={commandStatus} />
        )}

        {activeTab === "vehicles" && (
          <VehiclesTab assets={assets} permBlocked={permBlocked} loading={loading} onCommand={requestCommand} commandStatus={commandStatus} />
        )}

        {activeTab === "commands" && <CommandsTab />}
        {activeTab === "settings" && <SettingsTab />}
      </main>

      <ConfirmModal pending={pendingConfirm} onConfirm={confirmCommand} onCancel={() => setPendingConfirm(null)} />
    </div>
  );
}