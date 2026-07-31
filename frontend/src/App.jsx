import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";
import { useAuth } from './AuthContext';
import { LoginPage } from './LoginPage';
import { useAuthenticatedFetch } from './useAuthenticatedFetch';
import { ConfirmDialog } from './ConfirmDialog';

const API_BASE = import.meta.env.DEV ? "http://localhost:5001" : "";
const DEFAULT_CENTER = [17.522624444444443, 78.41514388888889];

const NAV_ITEMS = [
  { key: "dashboard", label: "🗺️ Dashboard" },
  { key: "tracker",   label: "📡 Tracker"   },
  { key: "vehicles",  label: "🚗 Vehicles"  },
  { key: "commands",  label: "⚡ Commands"  },
  { key: "autocutoff", label: "🤖 Auto-Cutoff" },
  { key: "bulknotify", label: "📤 Bulk Notify" },
  { key: "activity",  label: "📋 Activity"  },
  { key: "settings",  label: "⚙️ Settings"  },
];

const COMMAND_LABELS = {
  engine_cutoff:    { label: "Lock",   emoji: "🔒", danger: true,  desc: "Immobilize — cut the engine",   types: ["gps_generic", "gt06"] },
  engine_restore:   { label: "Unlock", emoji: "🔓", danger: false, desc: "Mobilize — restore the engine", types: ["gps_generic", "gt06"] },
  location_request: { label: "Locate", emoji: "📍", danger: false, desc: "Request a fresh GPS fix",       types: ["gps_generic", "gt06"] },
};

function getCommandsForDevice(iotTypeCode) {
  return Object.entries(COMMAND_LABELS).filter(([, meta]) =>
    !meta.types || meta.types.includes(iotTypeCode)
  );
}

const CONN_LABELS = {
  connected:    { label: "Connected",    tone: "online"  },
  online:       { label: "Connected",    tone: "online"  },
  disconnected: { label: "Disconnected", tone: "offline" },
  unknown:      { label: "Unknown",      tone: "unknown" },
};

// Custom map icons
function makeIcon(color) {
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 6px ${color}88;"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
}
const ICON_MOVING  = makeIcon("#22D37A");
const ICON_OFFLINE = makeIcon("#FF5C5C");
const ICON_UNKNOWN = makeIcon("#6B7588");

function fmtTime(ts) {
  if (!ts) return null;
  const d = new Date(ts.replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function useRelativeTime(date) {
  const [label, setLabel] = useState(null);
  useEffect(() => {
    if (!date) { setLabel(null); return; }
    const update = () => {
      const secs = Math.floor((Date.now() - date.getTime()) / 1000);
      if (secs < 10)  return setLabel("just now");
      if (secs < 60)  return setLabel(`${secs}s ago`);
      const mins = Math.floor(secs / 60);
      if (mins < 60)  return setLabel(`${mins}m ago`);
      setLabel(`${Math.floor(mins / 60)}h ago`);
    };
    update();
    const t = setInterval(update, 15000);
    return () => clearInterval(t);
  }, [date]);
  return label;
}

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved ? saved === "dark" : true;
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);
  return [dark, setDark];
}

function useAssets(authenticatedFetch) {
  const [assets, setAssets]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [permBlocked, setPermBlocked] = useState(false);
  const [lastFetched, setLastFetched] = useState(null);

  const load = useCallback(async () => {
    try {
      const res  = await authenticatedFetch('/api/assets');
      const data = await res.json();
      if (data.permissionBlocked) {
        setPermBlocked(true); setAssets([]);
      } else if (!data.success) {
        throw new Error(data.error || "Failed to load assets");
      } else {
        setAssets(data.assets || []); setPermBlocked(false); setError(null);
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
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  return { assets, loading, error, permBlocked, lastFetched, reload: load };
}

function useFilteredAssets(assets) {
  const [query, setQuery]   = useState("");
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

// Map fly-to helper component
function MapFlyTo({ center, zoom = 15 }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom, { duration: 1 });
  }, [center, map, zoom]);
  return null;
}

function SearchFilterBar({ query, onQuery, status, onStatus, count, total }) {
  return (
    <div className="search-bar">
      <div className="search-input-wrap">
        <span className="search-icon">🔍</span>
        <input className="search-input" type="text"
          placeholder="Search by name, IMEI, or license plate…"
          value={query} onChange={(e) => onQuery(e.target.value)} />
        {query && <button className="search-clear" onClick={() => onQuery("")}>✕</button>}
      </div>
      <div className="status-filter">
        {["all", "online", "offline"].map((s) => (
          <button key={s}
            className={`status-chip ${status === s ? "status-chip-active" : ""}`}
            onClick={() => onStatus(s)}>
            {s === "all" ? "All" : s === "online" ? "Online" : "Offline"}
          </button>
        ))}
      </div>
      <span className="search-count">{count} of {total}</span>
    </div>
  );
}

function DeviceRow({ device, asset, onCommand, commandStatus, lockState }) {
  const conn   = CONN_LABELS[device.connection_status] || CONN_LABELS.unknown;
  const status = commandStatus[device.id];
  const lat    = device.last_latitude  || asset?.location?.latitude;
  const lng    = device.last_longitude || asset?.location?.longitude;
  const hasFix = lat && lng;
  const isBms  = device.iot_type_code === "battery_bms";
  const availableCommands = getCommandsForDevice(device.iot_type_code);
  const isLocked = lockState?.[device.device_id] === 'locked';

  return (
    <div className="device-detail">
      <div className="device-detail-head">
        <div className="device-detail-id">
          <span className="device-name">{device.name || device.device_id}</span>
          <span className="tag tag-mono">{device.device_id}</span>
          {device.iot_type_code && (
            <span className={`tag ${isBms ? "tag-bms" : "tag-gps"}`}>{device.iot_type_code}</span>
          )}
          {!isBms && (
            <span className={`tag ${isLocked ? "tag-locked" : "tag-unlocked"}`}>
              {isLocked ? "🔒 Locked" : "🔓 Unlocked"}
            </span>
          )}
        </div>
        <span className={`conn-pill conn-${conn.tone}`}>
          <span className={`conn-dot dot-${conn.tone}`} /> {conn.label}
        </span>
      </div>
      {isBms && (
        <div className="bms-notice">⚡ Battery BMS sensor — engine commands not supported on this device type.</div>
      )}
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
            {hasFix
              ? `${parseFloat(lat).toFixed(5)}, ${parseFloat(lng).toFixed(5)}${!device.last_latitude ? " (asset)" : ""}`
              : "No GPS fix reported"}
          </span>
          {hasFix && (
            <div className="location-actions">
              <button 
                className="location-btn location-maps"
                onClick={() => window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank')}
                title="Open in Google Maps"
              >
                🗺️ View on Map
              </button>
              <button 
                className="location-btn location-whatsapp"
                onClick={() => {
                  const mapLink = `https://www.google.com/maps?q=${lat},${lng}`;
                  const message = `Vehicle Location: ${asset.name}\n${mapLink}`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
                }}
                title="Share via WhatsApp"
              >
                💬 WhatsApp
              </button>
              <button 
                className="location-btn location-copy"
                onClick={() => {
                  const mapLink = `https://www.google.com/maps?q=${lat},${lng}`;
                  navigator.clipboard.writeText(mapLink);
                  alert('📋 Location link copied!');
                }}
                title="Copy Google Maps link"
              >
                📋 Copy
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="device-commands-full">
        {isLocked ? (
          // Only show Unlock when locked
          <button
            className="cmd-btn cmd-safe"
            disabled={status?.state === "pending"}
            title="Mobilize — restore the engine"
            onClick={() => onCommand(device.id, device.id, 'engine_restore', device.device_id)}>
            🔓 Unlock
          </button>
        ) : (
          // Only show Lock when unlocked
          <button
            className="cmd-btn cmd-danger"
            disabled={status?.state === "pending"}
            title="Immobilize — cut the engine"
            onClick={() => onCommand(device.id, device.id, 'engine_cutoff', device.device_id)}>
            🔒 Lock
          </button>
        )}
        {/* Always show Locate button */}
        <button
          className="cmd-btn cmd-safe"
          disabled={status?.state === "pending"}
          title="Request a fresh GPS fix"
          onClick={() => onCommand(device.id, device.id, 'location_request', device.device_id)}>
          📍 Locate
        </button>
      </div>
      {status && status.state !== 'error' && <span className={`cmd-status cmd-${status.state}`}>{status.message}</span>}
    </div>
  );
}

function AssetCard({ asset, onCommand, commandStatus, lockState }) {
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
            {asset.license_plate && asset.license_plate !== asset.name && asset.license_plate !== "false" && (
              <span className="tag">{asset.license_plate}</span>
            )}
            {asset.asset_type ? <span className="tag">{asset.asset_type}</span> : <span className="tag tag-muted">type unset</span>}
            <span className="tag">{devices.length} device{devices.length === 1 ? "" : "s"}</span>
          </div>
        </div>
        <div className="asset-header-right">
          <span className={`status-pill ${isOnline ? "pill-online" : "pill-offline"}`}>{asset.status || "unknown"}</span>
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
          {devices.length === 0 && <p className="muted">No IoT devices attached.</p>}
          {devices.map((d) => (
            <DeviceRow key={d.id} device={d} asset={asset} onCommand={onCommand} commandStatus={commandStatus} lockState={lockState} />
          ))}
        </div>
      )}
    </div>
  );
}

function ConfirmModal({ pending, onConfirm, onCancel }) {
  if (!pending) return null;
  const meta = COMMAND_LABELS[pending.commandType];
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>{meta?.emoji} {meta?.label}?</h3>
        <p className="muted">Sending <strong>{pending.commandType}</strong> to device ID <strong>{pending.deviceId}</strong>.</p>
        <p className="modal-source">Via <strong>VoltCred GraphQL</strong> — <code>executeDeviceCommand</code></p>
        {meta?.danger && (
          <p className="modal-warning">⚠️ Only immobilize if the vehicle is stationary and safe to stop.</p>
        )}
        <div className="modal-actions">
          <button className="modal-btn modal-cancel" onClick={onCancel}>Cancel</button>
          <button className={`modal-btn ${meta?.danger ? "modal-confirm-danger" : "modal-confirm"}`} onClick={onConfirm}>
            Yes, {meta?.label.toLowerCase()}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── TRACKER TAB — full-screen map with search ────────────────────────────────
function TrackerTab({ assets, onCommand, commandStatus, lockState }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [flyTo, setFlyTo] = useState(null);
  const [moreDetailsExpanded, setMoreDetailsExpanded] = useState(false);

  const positions = assets.filter((a) => a.location?.latitude && a.location?.longitude);

  const handleSearch = (q) => {
    setSearchQuery(q);
    if (!q) { setSelectedAsset(null); setFlyTo(null); return; }
    const lower = q.toLowerCase();
    const match = assets.find((a) => {
      const haystack = [a.name, a.license_plate, a.id,
        ...(a.iot_devices || []).map((d) => d.device_id)
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(lower);
    });
    if (match && match.location?.latitude) {
      setSelectedAsset(match);
      setFlyTo([match.location.latitude, match.location.longitude]);
      setMoreDetailsExpanded(false);
    }
  };

  const getIcon = (a) => {
    if (a.status === "moving" || a.status === "idle") return ICON_MOVING;
    if (a.status === "offline") return ICON_OFFLINE;
    return ICON_UNKNOWN;
  };

  const primaryDevice = (selectedAsset?.iot_devices || [])[0];

  return (
    <div className="tracker-wrap">
      <div className="tracker-search-bar">
        <span className="search-icon">🔍</span>
        <input className="tracker-search-input" type="text"
          placeholder="Search vehicle by name, IMEI, or license plate…"
          value={searchQuery} onChange={(e) => handleSearch(e.target.value)} />
        {searchQuery && <button className="search-clear" onClick={() => handleSearch("")}>✕</button>}
        {searchQuery && !selectedAsset && <span className="tracker-no-result">No vehicle found</span>}
      </div>

      <div className="tracker-map-container">
        <MapContainer center={DEFAULT_CENTER} zoom={12} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
          {flyTo && <MapFlyTo center={flyTo} zoom={15} />}
          {positions.map((a) => (
            <Marker key={a.id} position={[a.location.latitude, a.location.longitude]} icon={getIcon(a)}
              eventHandlers={{ click: () => { setSelectedAsset(a); setMoreDetailsExpanded(false); } }}>
              <Popup>
                <div className="map-popup">
                  <strong>{a.name}</strong>
                  <span className={`popup-status ${a.status === "moving" ? "popup-online" : "popup-offline"}`}>
                    {a.status || "unknown"}
                  </span>
                  <div className="popup-row"><span>📍</span><span>{a.location.latitude.toFixed(5)}, {a.location.longitude.toFixed(5)}</span></div>
                  {a.location.address && <div className="popup-row"><span>🏠</span><span>{a.location.address}</span></div>}
                  {(a.iot_devices || []).map((d) => (
                    <div key={d.id} className="popup-row">
                      <span>📡</span><span>{d.device_id} — {d.connection_status || "unknown"}</span>
                    </div>
                  ))}
                  <div className="popup-row muted">
                    Last comm: {fmtTime((a.iot_devices || [])[0]?.last_communication) || "Never"}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {selectedAsset && (
        <div className="tracker-sidebar">
          <div className="tracker-sidebar-head">
            <span className="tracker-vehicle-name">{selectedAsset.name || "Unnamed"}</span>
            <button className="tracker-close" onClick={() => setSelectedAsset(null)}>✕</button>
          </div>

          {/* IMEI / Device ID */}
          {primaryDevice && (
            <div className="tracker-imei-box">
              <span className="tracker-imei-label">IMEI / Device ID</span>
              <span className="tracker-imei-value">{primaryDevice.device_id}</span>
            </div>
          )}

          {/* Key Info Grid */}
          <div className="tracker-key-info">
            <div className="ti-info-item">
              <span className="ti-label">Fix Time</span>
              <span className="ti-value">{fmtTime(primaryDevice?.last_communication) || "Never"}</span>
            </div>
            <div className="ti-info-item">
              <span className="ti-label">Status</span>
              <span className={`status-pill ${selectedAsset.status === "moving" ? "pill-online" : "pill-offline"}`}>
                {selectedAsset.status || "unknown"}
              </span>
            </div>
            <div className="ti-info-item">
              <span className="ti-label">Address</span>
              <span className="ti-value">{selectedAsset.location?.address || "—"}</span>
            </div>
            <div className="ti-info-item">
              <span className="ti-label">Speed</span>
              <span className="ti-value ti-muted">Not available *</span>
            </div>
            <div className="ti-info-item">
              <span className="ti-label">Total Distance</span>
              <span className="ti-value ti-muted">Not available *</span>
            </div>
            <div className="ti-info-item">
              <span className="ti-label">Connection</span>
              <span className={`conn-pill conn-${(CONN_LABELS[primaryDevice?.connection_status] || CONN_LABELS.unknown).tone}`}>
                <span className={`conn-dot dot-${(CONN_LABELS[primaryDevice?.connection_status] || CONN_LABELS.unknown).tone}`} />
                {(CONN_LABELS[primaryDevice?.connection_status] || CONN_LABELS.unknown).label}
              </span>
            </div>
          </div>

          {/* More Details Button */}
          <button className="tracker-more-details-btn" onClick={() => setMoreDetailsExpanded(!moreDetailsExpanded)}>
            {moreDetailsExpanded ? "▼" : "▶"} More Details
          </button>

          {/* Expanded Details */}
          {moreDetailsExpanded && (
            <div className="tracker-more-details">
              <div className="ti-field"><span className="ti-label">Asset ID</span>
                <span className="ti-value">{selectedAsset.id}</span>
              </div>
              <div className="ti-field"><span className="ti-label">Asset Type</span>
                <span className="ti-value">{selectedAsset.asset_type || "—"}</span>
              </div>
              <div className="ti-field"><span className="ti-label">License Plate</span>
                <span className="ti-value">{selectedAsset.license_plate || "—"}</span>
              </div>
              <div className="ti-field"><span className="ti-label">Coordinates</span>
                <span className="ti-value">
                  {selectedAsset.location?.latitude ? `${selectedAsset.location.latitude.toFixed(5)}, ${selectedAsset.location.longitude.toFixed(5)}` : "No GPS"}
                </span>
                {selectedAsset.location?.latitude && (
                  <div className="location-actions" style={{ marginTop: '8px' }}>
                    <button 
                      className="location-btn location-maps"
                      onClick={() => window.open(`https://www.google.com/maps?q=${selectedAsset.location.latitude},${selectedAsset.location.longitude}`, '_blank')}
                      title="Open in Google Maps"
                    >
                      🗺️ View on Map
                    </button>
                    <button 
                      className="location-btn location-whatsapp"
                      onClick={() => {
                        const mapLink = `https://www.google.com/maps?q=${selectedAsset.location.latitude},${selectedAsset.location.longitude}`;
                        const message = `Vehicle Location: ${selectedAsset.name}\n${mapLink}`;
                        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
                      }}
                      title="Share via WhatsApp"
                    >
                      💬 WhatsApp
                    </button>
                    <button 
                      className="location-btn location-copy"
                      onClick={() => {
                        const mapLink = `https://www.google.com/maps?q=${selectedAsset.location.latitude},${selectedAsset.location.longitude}`;
                        navigator.clipboard.writeText(mapLink);
                        alert('📋 Location link copied!');
                      }}
                      title="Copy Google Maps link"
                    >
                      📋 Copy
                    </button>
                  </div>
                )}
              </div>
              {primaryDevice && (
                <>
                  <div className="ti-field"><span className="ti-label">Device Name</span>
                    <span className="ti-value">{primaryDevice.name || "—"}</span>
                  </div>
                  <div className="ti-field"><span className="ti-label">Device Type</span>
                    <span className="ti-value">{primaryDevice.iot_type_code || "—"}</span>
                  </div>
                  <div className="ti-field"><span className="ti-label">Last Update</span>
                    <span className="ti-value">{fmtTime(primaryDevice.last_update) || "Never"}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Command Buttons */}
          <div className="tracker-commands">
            {(selectedAsset.iot_devices || []).flatMap((d) => {
              const isLocked = lockState?.[d.device_id] === 'locked';
              const isBms = d.iot_type_code === 'battery_bms';
              
              if (isBms) return [];
              
              return [
                isLocked ? (
                  <button key={`${d.id}-unlock`}
                    className="cmd-btn cmd-safe"
                    title="Mobilize — restore the engine"
                    onClick={() => onCommand(d.id, d.id, 'engine_restore', d.device_id)}>
                    🔓 Unlock
                  </button>
                ) : (
                  <button key={`${d.id}-lock`}
                    className="cmd-btn cmd-danger"
                    title="Immobilize — cut the engine"
                    onClick={() => onCommand(d.id, d.id, 'engine_cutoff', d.device_id)}>
                    🔒 Lock
                  </button>
                ),
                <button key={`${d.id}-locate`}
                  className="cmd-btn cmd-safe"
                  title="Request a fresh GPS fix"
                  onClick={() => onCommand(d.id, d.id, 'location_request', d.device_id)}>
                  📍 Locate
                </button>
              ];
            })}
          </div>

          {/* Disclaimer for unavailable fields */}
          <p className="tracker-disclaimer">* Not available in VoltCred GraphQL schema. Contact VoltCred to enable these fields.</p>
        </div>
      )}
    </div>
  );
}

// ── DASHBOARD TAB ────────────────────────────────────────────────────────────
function DashboardTab({ assets, permBlocked, onCommand, commandStatus, lockState }) {
  const online  = assets.filter((a) => a.status === "moving" || a.status === "idle").length;
  const offline = assets.length - online;
  const { query, setQuery, status, setStatus, filtered } = useFilteredAssets(assets);
  const positions = assets.filter((a) => a.location?.latitude && a.location?.longitude);

  const getIcon = (a) => {
    if (a.status === "moving" || a.status === "idle") return ICON_MOVING;
    if (a.status === "offline") return ICON_OFFLINE;
    return ICON_UNKNOWN;
  };

  if (permBlocked) return (
    <div className="perm-notice">
      <div className="perm-icon">🔐</div>
      <h3>Assets permission not yet enabled</h3>
      <p>Login working. VoltCred needs to enable the <code>assets</code> query for <strong>hello@optimotion.in</strong>.</p>
    </div>
  );

  return (
    <>
      <div className="cards">
        <div className="card"><span className="card-label">Total Assets</span><span className="card-value">{assets.length}</span></div>
        <div className="card card-online-tone"><span className="card-label">Online</span><span className="card-value">{online}</span></div>
        <div className="card card-offline-tone"><span className="card-label">Offline</span><span className="card-value">{offline}</span></div>
        <div className="card"><span className="card-label">Data Source</span><span className="card-value-sm">VoltCred GraphQL</span></div>
      </div>

      <div className="map-box">
        <MapContainer center={positions[0] ? [positions[0].location.latitude, positions[0].location.longitude] : DEFAULT_CENTER} zoom={12} style={{ height: 320, width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {positions.map((a) => (
            <Marker key={a.id} position={[a.location.latitude, a.location.longitude]} icon={getIcon(a)}>
              <Popup>
                <div className="map-popup">
                  <strong>{a.name}</strong>
                  <span className={`popup-status ${a.status === "moving" ? "popup-online" : "popup-offline"}`}>{a.status}</span>
                  <div className="popup-row"><span>📍</span><span>{a.location.latitude.toFixed(5)}, {a.location.longitude.toFixed(5)}</span></div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        {positions.length === 0 && assets.length > 0 && (
          <div className="map-empty-note">No GPS coordinates reported yet.</div>
        )}
      </div>

      <div className="panel" style={{ marginTop: 22 }}>
        <div className="panel-head"><h2>Vehicle list</h2></div>
        <SearchFilterBar query={query} onQuery={setQuery} status={status} onStatus={setStatus} count={filtered.length} total={assets.length} />
        {filtered.length === 0 ? <p className="muted" style={{ marginTop: 14 }}>No vehicles match.</p> : (
          <div className="vehicle-table">
            <div className="vt-row vt-head">
              <span>Name / IMEI</span><span>Status</span><span>Type</span><span>Devices</span><span>Last comm.</span>
            </div>
            {filtered.map((a) => {
              const isOnline = a.status === "moving" || a.status === "idle";
              const devices  = a.iot_devices || [];
              const lastComm = devices.map((d) => d.last_communication).filter(Boolean).sort().pop();
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
  );
}

// ── VEHICLES TAB ─────────────────────────────────────────────────────────────
function VehiclesTab({ assets, permBlocked, loading, onCommand, commandStatus, lockState }) {
  const { query, setQuery, status, setStatus, filtered } = useFilteredAssets(assets);
  if (permBlocked) return <div className="perm-notice"><div className="perm-icon">🔐</div><h3>Assets permission not enabled</h3></div>;
  if (loading) return <p className="muted">Loading assets…</p>;
  if (assets.length === 0) return <p className="muted">No assets found.</p>;
  return (
    <>
      <SearchFilterBar query={query} onQuery={setQuery} status={status} onStatus={setStatus} count={filtered.length} total={assets.length} />
      {filtered.length === 0 ? <p className="muted" style={{ marginTop: 14 }}>No vehicles match.</p> : (
        <div className="asset-grid" style={{ marginTop: 16 }}>
          {filtered.map((a) => (
            <AssetCard key={a.id} asset={a} onCommand={onCommand} commandStatus={commandStatus} lockState={lockState} />
          ))}
        </div>
      )}
    </>
  );
}

// ── COMMANDS TAB ─────────────────────────────────────────────────────────────
function CommandsTab({ assets, authenticatedFetch }) {
  const [deviceId, setDeviceId]       = useState("");
  const [commandType, setCommandType] = useState("engine_cutoff");
  const [result, setResult]           = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);

  const send = async () => {
    if (!deviceId) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const res  = await authenticatedFetch('/api/command', {
        method: "POST",
        body: JSON.stringify({ deviceId: parseInt(deviceId, 10), commandType }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setResult(data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const meta = COMMAND_LABELS[commandType];

  // Build device picker from assets
  const deviceOptions = assets.flatMap((a) =>
    (a.iot_devices || []).map((d) => ({
      label: `${a.name} — ${d.device_id} (ID: ${d.id})`,
      value: d.id,
    }))
  );

  return (
    <div className="panel">
      <h2>Send Command</h2>
      <p className="muted" style={{ marginBottom: 20 }}>
        Send a remote command to a device via VoltCred GraphQL <code>executeDeviceCommand</code>.
      </p>
      <div className="cmd-form">
        <div className="form-group">
          <label className="form-label">Select Vehicle / Device</label>
          <select className="form-select" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
            <option value="">— pick a device —</option>
            {deviceOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span className="form-hint">Or enter device ID manually below</span>
        </div>
        <div className="form-group">
          <label className="form-label">Device ID (numeric)</label>
          <input className="form-input" type="number" placeholder="e.g. 303" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Command</label>
          <select className="form-select" value={commandType} onChange={(e) => setCommandType(e.target.value)}>
            {Object.entries(COMMAND_LABELS).map(([cmd, m]) => (
              <option key={cmd} value={cmd}>{m.emoji} {cmd} — {m.desc}</option>
            ))}
          </select>
          {meta && <span className="form-hint">{meta.emoji} {meta.desc}</span>}
        </div>
        <button className={`send-btn ${meta?.danger ? "send-danger" : "send-safe"}`} onClick={send} disabled={loading || !deviceId}>
          {loading ? "Sending…" : `${meta?.emoji} Send ${commandType}`}
        </button>
      </div>
      {result && (
        <div className="result-box result-success">
          <strong>✅ Success</strong><p>{result.message}</p>
          {result.result && <pre className="result-json">{JSON.stringify(result.result, null, 2)}</pre>}
        </div>
      )}
      {error && (
        <div className="result-box result-error">
          <strong>❌ Failed</strong><p>{error}</p>
        </div>
      )}
    </div>
  );
}

// ── SETTINGS TAB ─────────────────────────────────────────────────────────────
function SettingsTab({ dark, setDark }) {
  return (
    <div className="panel">
      <h2>Settings</h2>
      <div className="settings-row">
        <div><span className="settings-label">Theme</span><p className="muted">{dark ? "Dark mode" : "Light mode"}</p></div>
        <button className="theme-toggle-btn" onClick={() => setDark(!dark)}>{dark ? "☀️ Light" : "🌙 Dark"}</button>
      </div>
      <div className="settings-row">
        <div><span className="settings-label">API Endpoint</span><p className="muted">{import.meta.env.DEV ? "http://localhost:5001" : window.location.origin}</p></div>
      </div>
      <div className="settings-row">
        <div><span className="settings-label">GraphQL URL</span><p className="muted">Configured via VOLTCRED_GRAPHQL_URL in backend .env</p></div>
      </div>
      <div className="settings-row">
        <div><span className="settings-label">Auto-refresh</span><p className="muted">Every 5 minutes — use ↻ Refresh to fetch immediately</p></div>
      </div>
      <div className="settings-row">
        <div><span className="settings-label">Supported commands</span><p className="muted">{Object.keys(COMMAND_LABELS).join(", ")}</p></div>
      </div>
      <div className="settings-row">
        <div><span className="settings-label">Account</span><p className="muted">hello@optimotion.in (org_id: 183)</p></div>
      </div>
    </div>
  );
}

// ── ACTIVITY LOG TAB ──────────────────────────────────────────────────────────
function ActivityTab({ assets, commandStatus }) {
  const [activities, setActivities] = useState([]);
  const activityRef = useRef([]);

  // Track commands sent
  useEffect(() => {
    const newActivity = Object.entries(commandStatus).map(([deviceId, status]) => ({
      id: `${deviceId}-${Date.now()}`,
      deviceId,
      status: status.state,
      message: status.message,
      timestamp: new Date(),
    }));
    
    if (newActivity.length > 0) {
      activityRef.current = [...newActivity, ...activityRef.current].slice(0, 50);
      setActivities(activityRef.current);
    }
  }, [commandStatus]);

  const getDeviceName = (deviceId) => {
    for (const asset of assets) {
      const device = (asset.iot_devices || []).find((d) => d.id === parseInt(deviceId, 10));
      if (device) return `${asset.name} (${device.device_id})`;
    }
    return `Device ${deviceId}`;
  };

  const getActivityIcon = (state) => {
    if (state === "success") return "✅";
    if (state === "error") return "❌";
    if (state === "pending") return "⏳";
    return "•";
  };

  const getActivityColor = (state) => {
    if (state === "success") return "activity-success";
    if (state === "error") return "activity-error";
    if (state === "pending") return "activity-pending";
    return "activity-neutral";
  };

  return (
    <div className="panel">
      <h2>Activity Log</h2>
      <p className="muted" style={{ marginBottom: 16 }}>Recent commands and system events.</p>
      {activities.length === 0 ? (
        <p className="muted">No activity yet.</p>
      ) : (
        <div className="activity-list">
          {activities.map((act) => (
            <div key={act.id} className={`activity-item ${getActivityColor(act.status)}`}>
              <span className="activity-icon">{getActivityIcon(act.status)}</span>
              <div className="activity-content">
                <div className="activity-device">{getDeviceName(act.deviceId)}</div>
                <div className="activity-message">{act.message}</div>
              </div>
              <span className="activity-time">{act.timestamp.toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── RIDER ACTIONS MENU COMPONENT ─────────────────────────────────────────────
function RiderActionsMenu({ rental, onAction }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          fontSize: 12, 
          padding: '6px 12px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: 4,
          background: '#3B82F6',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontWeight: 500,
          transition: 'background 0.2s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = '#2563EB'}
        onMouseLeave={(e) => e.currentTarget.style.background = '#3B82F6'}
      >
        <span style={{ color: '#FFFFFF' }}>Actions</span> {isOpen ? '▲' : '▼'}
      </button>
      
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 4,
          background: 'var(--bg2)',
          border: '1px solid var(--border2)',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          minWidth: 180,
          zIndex: 1000,
          overflow: 'hidden'
        }}>
          <button
            onClick={() => {
              setIsOpen(false);
              onAction('lock');
            }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text)',
              fontSize: 13,
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg4)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <span>🔒</span>
            <span>Lock Vehicle</span>
          </button>
          
          <button
            onClick={() => {
              setIsOpen(false);
              onAction('notify');
            }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text)',
              fontSize: 13,
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderTop: '1px solid var(--border)',
              transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg4)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <span>📱</span>
            <span>Send Notification</span>
          </button>
          
          <button
            onClick={() => {
              setIsOpen(false);
              onAction('lock_and_notify');
            }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text)',
              fontSize: 13,
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderTop: '1px solid var(--border)',
              transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg4)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <span>🔒📱</span>
            <span style={{ fontWeight: 600 }}>Lock & Notify</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ── AUTO-CUTOFF TAB ──────────────────────────────────────────────────────────
function AutoCutoffTab({ authenticatedFetch, user }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [overdueRentals, setOverdueRentals] = useState([]);
  const [allRentals, setAllRentals] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingOverdue, setLoadingOverdue] = useState(false);
  const [minOverdueDays, setMinOverdueDays] = useState(0);  // Default to 0 to show all overdue
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRiders, setSelectedRiders] = useState([]);
  const [showOnlyOverdue, setShowOnlyOverdue] = useState(false);  // NEW: Toggle to show all or overdue only
  const [autoNotify, setAutoNotify] = useState(true);  // NEW: Auto-send WhatsApp notifications on lock
  const ridersPerPage = 10;

  // Fetch stats and logs on mount
  useEffect(() => {
    fetchStats();
    fetchLogs();
    fetchAllRentals();
    fetchOverdueRentals();
  }, []);

  // Refresh overdue rentals when minOverdueDays changes
  useEffect(() => {
    fetchOverdueRentals();
  }, [minOverdueDays]);

  const fetchAllRentals = async () => {
    try {
      const res = await authenticatedFetch('/api/auto-cutoff/all-rentals');
      const data = await res.json();
      if (data.success) {
        setAllRentals(data.rentals || []);
      }
    } catch (error) {
      console.error('Error fetching all rentals:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await authenticatedFetch('/api/auto-cutoff/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await authenticatedFetch('/api/auto-cutoff/logs?limit=20');
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchOverdueRentals = async () => {
    setLoadingOverdue(true);
    try {
      const res = await authenticatedFetch(`/api/auto-cutoff/overdue?minOverdueDays=${minOverdueDays}`);
      const data = await res.json();
      if (data.success) {
        setOverdueRentals(data.overdueRentals || []);
      }
    } catch (error) {
      console.error('Error fetching overdue rentals:', error);
      setOverdueRentals([]);
    } finally {
      setLoadingOverdue(false);
    }
  };

  const executeAutoCutoff = async () => {
    if (user?.role !== 'admin' && user?.role !== 'super_admin') {
      alert('❌ Admin access required');
      return;
    }

    const notifyMsg = autoNotify ? ' and send WhatsApp notifications' : '';
    if (!confirm(`Execute auto-cutoff for ${overdueRentals.length} rentals that are ${minOverdueDays}+ days overdue${notifyMsg}?`)) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await authenticatedFetch('/api/auto-cutoff/check-and-execute', {
        method: 'POST',
        body: JSON.stringify({ 
          minOverdueDays,
          autoNotify 
        }),
      });
      const data = await res.json();
      setResult(data);
      
      // Show notification results if auto-notify was enabled
      if (autoNotify && data.notifications) {
        alert(`✅ Cutoff completed!\n\nLocked: ${data.successful}\nNotifications sent: ${data.notifications.sent}/${data.notifications.total}`);
      }
      
      // Refresh stats and logs after execution
      await fetchStats();
      await fetchLogs();
      await fetchOverdueRentals();
    } catch (error) {
      setResult({
        success: false,
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifyResult, setNotifyResult] = useState(null);

  const notifySelectedRiders = async () => {
    if (!isAdmin) {
      alert('❌ Admin access required');
      return;
    }

    const count = selectedRiders.length;
    if (count === 0) {
      return notifyAllFiltered();
    }

    if (!confirm(`Send notifications to ${count} selected rider(s)?`)) {
      return;
    }

    setNotifyLoading(true);
    setNotifyResult(null);

    try {
      const res = await authenticatedFetch('/api/auto-cutoff/notify', {
        method: 'POST',
        body: JSON.stringify({ rentalIds: selectedRiders }),
      });
      const data = await res.json();
      setNotifyResult(data);

      if (!data.success) {
        throw new Error(data.error || 'Notification API returned failure');
      }

      setSelectedRiders([]);
      alert(`✅ Notifications requested: ${data.successCount}/${data.requested} succeeded.`);
    } catch (error) {
      setNotifyResult({ success: false, error: error.message });
      alert(`❌ Failed to send notifications: ${error.message}`);
    } finally {
      setNotifyLoading(false);
    }
  };

  const notifyAllFiltered = async () => {
    if (!isAdmin) {
      alert('❌ Admin access required');
      return;
    }

    const count = showOnlyOverdue ? overdueRentals.length : allRentals.length;
    if (count === 0) {
      alert('⚠️ No riders match current filter.');
      return;
    }

    if (!confirm(`Send notifications to ALL ${count} rider(s) matching current filter?`)) {
      return;
    }

    setNotifyLoading(true);
    setNotifyResult(null);

    try {
      const body = showOnlyOverdue
        ? { minOverdueDays }
        : { rentalIds: allRentals.map((r) => r.rentalId) };

      const res = await authenticatedFetch('/api/auto-cutoff/notify', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setNotifyResult(data);

      if (!data.success) {
        throw new Error(data.error || 'Notification API returned failure');
      }

      if (showOnlyOverdue) {
        setSelectedRiders([]);
      }

      alert(`✅ Notifications requested: ${data.successCount}/${data.requested} succeeded.`);
    } catch (error) {
      setNotifyResult({ success: false, error: error.message });
      alert(`❌ Failed to send notifications: ${error.message}`);
    } finally {
      setNotifyLoading(false);
    }
  };

  const toggleSelectRider = (rentalId) => {
    setSelectedRiders(prev => 
      prev.includes(rentalId) 
        ? prev.filter(id => id !== rentalId)
        : [...prev, rentalId]
    );
  };

  const toggleSelectAll = (filteredRentals) => {
    if (selectedRiders.length === filteredRentals.length) {
      setSelectedRiders([]);
    } else {
      setSelectedRiders(filteredRentals.map(r => r.rentalId));
    }
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  return (
    <div>
      {/* Simple Stats Cards */}
      <div className="cards" style={{ marginBottom: 22 }}>
        <div className="card">
          <span className="card-label">Total Riders</span>
          <span className="card-value">{allRentals.length}</span>
        </div>
        <div className="card card-offline-tone">
          <span className="card-label">Overdue</span>
          <span className="card-value">{overdueRentals.length}</span>
        </div>
        <div className="card card-online-tone">
          <span className="card-label">Successful Cutoffs</span>
          <span className="card-value">{stats?.successful || 0}</span>
        </div>
        <div className="card">
          <span className="card-label">Pending</span>
          <span className="card-value">{stats?.pending || 0}</span>
        </div>
      </div>

      {/* Main Panel */}
      <div className="panel" style={{ marginBottom: 22 }}>
        <div className="panel-head" style={{ marginBottom: 18 }}>
          <h2>All Riders ({allRentals.length})</h2>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 13, color: 'var(--text3)', whiteSpace: 'nowrap' }}>Filter:</label>
              <select
                value={showOnlyOverdue ? 'overdue' : 'all'}
                onChange={(e) => {
                  setShowOnlyOverdue(e.target.value === 'overdue');
                  setCurrentPage(1);
                }}
                style={{ padding: '6px 10px', background: 'var(--bg4)', border: '1px solid var(--border3)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }}
              >
                <option value="all">All Riders (257)</option>
                <option value="overdue">Overdue Only ({overdueRentals.length})</option>
              </select>
            </div>
            {showOnlyOverdue && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 13, color: 'var(--text3)', whiteSpace: 'nowrap' }}>Exact Days:</label>
                <input
                  type="number"
                  value={minOverdueDays}
                  onChange={(e) => {
                    setMinOverdueDays(parseInt(e.target.value) || 0);
                    setCurrentPage(1);
                  }}
                  style={{ width: 70, padding: '6px 10px', background: 'var(--bg4)', border: '1px solid var(--border3)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }}
                />
                <span style={{ fontSize: 11, color: 'var(--text5)' }}>(0 = due today, -7 = only -7 days overdue)</span>
              </div>
            )}
            <button className="refresh-btn" onClick={() => { fetchAllRentals(); fetchOverdueRentals(); }}>
              ↻ Refresh
            </button>
            {isAdmin && (
              <>
                <button 
                  className="refresh-btn" 
                  onClick={notifyAllFiltered}
                  style={{ background: '#16A34A' }}
                  disabled={selectedRiders.length === 0 && (showOnlyOverdue ? overdueRentals.length === 0 : allRentals.length === 0)}
                >
                  📱 Notify All ({selectedRiders.length || (showOnlyOverdue ? overdueRentals.length : allRentals.length)})
                </button>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text)', cursor: 'pointer', userSelect: 'none' }}>
                  <input 
                    type="checkbox" 
                    checked={autoNotify} 
                    onChange={(e) => setAutoNotify(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>Auto-notify on lock</span>
                </label>
                <button 
                  className="refresh-btn" 
                  onClick={executeAutoCutoff} 
                  disabled={loading}
                  style={{ background: loading ? 'var(--text4)' : '#DC2626' }}
                >
                  {loading ? '⏳ Executing...' : `🔒 Lock All${autoNotify ? ' & Notify' : ''}`}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: 16 }}>
          <input
            className="search-input"
            placeholder="Search by Booking ID, Rider Name, Phone, Vehicle ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', maxWidth: 600 }}
          />
        </div>

        {/* Simple Clean Table - Like Optimotion Dashboard */}
        {loadingOverdue ? (
          <p className="muted">Loading rentals...</p>
        ) : (
          (() => {
            // Choose data source based on filter
            const sourceData = showOnlyOverdue ? overdueRentals : allRentals;
            
            const q = (searchQuery || '').trim().toLowerCase();
            const filtered = sourceData.filter((r) => {
              if (!q) return true;
              const orig = r.originalData || {};
              const riderName = r.riderName || orig.riderName || orig.rider_name || orig.customerName || orig.customer_name || '';
              const riderPhone = r.riderPhone || orig.riderUID || orig.rider_uid || orig.riderPhone || orig.rider_phone || orig.customerPhone || orig.customer_phone || orig.phone || '';
              
              return (
                String(r.rentalId || '').toLowerCase().includes(q) ||
                String(r.vehicleId || '').toLowerCase().includes(q) ||
                String(r.vehicleImei || '').toLowerCase().includes(q) ||
                String(riderName).toLowerCase().includes(q) ||
                String(riderPhone).toLowerCase().includes(q)
              );
            });

            if (filtered.length === 0) {
              return <p className="muted">No rentals found.</p>;
            }

            // Pagination
            const totalPages = Math.ceil(filtered.length / ridersPerPage);
            const startIdx = (currentPage - 1) * ridersPerPage;
            const endIdx = startIdx + ridersPerPage;
            const paginatedRentals = filtered.slice(startIdx, endIdx);

            return (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border2)', textAlign: 'left' }}>
                      <th style={{ padding: '12px 10px', color: 'var(--text3)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', width: 40 }}>
                        <input 
                          type="checkbox" 
                          checked={selectedRiders.length === paginatedRentals.length && paginatedRentals.length > 0}
                          onChange={() => toggleSelectAll(paginatedRentals)}
                          style={{ cursor: 'pointer' }}
                        />
                      </th>
                      <th style={{ padding: '12px 10px', color: 'var(--text3)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>Booking ID</th>
                      <th style={{ padding: '12px 10px', color: 'var(--text3)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>Rider Phone</th>
                      <th style={{ padding: '12px 10px', color: 'var(--text3)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>Rider Name</th>
                      <th style={{ padding: '12px 10px', color: 'var(--text3)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>Package</th>
                      <th style={{ padding: '12px 10px', color: 'var(--text3)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>Vehicle ID</th>
                      <th style={{ padding: '12px 10px', color: 'var(--text3)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>Plan End</th>
                      <th style={{ padding: '12px 10px', color: 'var(--text3)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>Overdue</th>
                      <th style={{ padding: '12px 10px', color: 'var(--text3)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>Total Due</th>
                      <th style={{ padding: '12px 10px', color: 'var(--text3)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRentals.map((r, idx) => {
                      const orig = r.originalData || {};
                      const riderName = r.riderName || orig.riderName || orig.rider_name || orig.customerName || orig.customer_name || orig.userName || orig.user_name || orig.name || '—';
                      const riderPhone = r.riderPhone || orig.riderUID || orig.rider_uid || orig.riderPhone || orig.rider_phone || orig.customerPhone || orig.customer_phone || orig.phone || orig.mobile || orig.phoneNumber || orig.phone_number || orig.mobileNumber || orig.mobile_number || orig.contact || orig.contactNumber || orig.contact_number || '—';
                      const packageName = orig.package || orig.packageName || orig.package_name || orig.plan || orig.planName || orig.planType || '—';
                      const totalDue = orig.totalDue || orig.total_due || orig.total_amount || orig.dueAmount || orig.due_amount || orig.amount || orig.pendingAmount || orig.pending_amount || '';

                      return (
                        <tr 
                          key={r.rentalId || idx} 
                          style={{ 
                            borderBottom: '1px solid var(--border)', 
                            background: idx % 2 === 0 ? 'transparent' : 'var(--bg4)',
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg4)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'var(--bg4)'}
                        >
                          <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={selectedRiders.includes(r.rentalId)}
                              onChange={() => toggleSelectRider(r.rentalId)}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>
                          <td style={{ padding: '12px 10px', fontFamily: 'monospace', fontWeight: 600 }}>{r.rentalId}</td>
                          <td style={{ padding: '12px 10px' }}>{riderPhone}</td>
                          <td style={{ padding: '12px 10px', fontWeight: 500 }}>{riderName}</td>
                          <td style={{ padding: '12px 10px' }}>{packageName}</td>
                          <td style={{ padding: '12px 10px', fontFamily: 'monospace' }}>{r.vehicleId || '—'}</td>
                          <td style={{ padding: '12px 10px' }}>{r.dueDate ? new Date(r.dueDate).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}</td>
                          <td style={{ padding: '12px 10px' }}>
                            {r.overdueDays < 0 ? (
                              <span style={{ 
                                color: Math.abs(r.overdueDays) >= 7 ? 'var(--red)' : Math.abs(r.overdueDays) >= 3 ? 'var(--orange)' : 'var(--yellow)',
                                fontWeight: 600 
                              }}>
                                🔴 {r.overdueDays} days overdue
                              </span>
                            ) : r.overdueDays === 0 ? (
                              <span style={{ color: 'var(--orange)', fontWeight: 600 }}>
                                ⚠️ Due Today
                              </span>
                            ) : (
                              <span style={{ color: 'var(--green)', fontWeight: 500 }}>
                                ✅ {r.overdueDays} days left
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px 10px', fontWeight: 600 }}>
                            {totalDue ? `₹${totalDue}` : '—'}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            {isAdmin && (
                              <RiderActionsMenu 
                                rental={r}
                                onAction={async (action) => {
                                  if (action === 'lock') {
                                    if (confirm(`Lock vehicle ${r.vehicleId}?`)) {
                                      try {
                                        const res = await authenticatedFetch('/api/auto-cutoff/lock-individual', {
                                          method: 'POST',
                                          body: JSON.stringify({
                                            rentalId: r.rentalId,
                                            vehicleId: r.vehicleId,
                                            autoNotify: false
                                          })
                                        });
                                        const data = await res.json();
                                        if (data.success) {
                                          alert(`✅ Vehicle locked successfully!`);
                                          fetchStats();
                                          fetchLogs();
                                        } else {
                                          alert(`❌ Lock failed: ${data.error || 'Unknown error'}`);
                                        }
                                      } catch (err) {
                                        alert(`❌ Error: ${err.message}`);
                                      }
                                    }
                                  } else if (action === 'notify') {
                                    if (confirm(`Send WhatsApp notification to ${r.riderName}?`)) {
                                      try {
                                        const res = await authenticatedFetch('/api/auto-cutoff/notify', {
                                          method: 'POST',
                                          body: JSON.stringify({
                                            rentalIds: [r.rentalId]
                                          })
                                        });
                                        const data = await res.json();
                                        if (data.success && data.successCount > 0) {
                                          alert(`✅ Notification sent to ${r.riderName}!`);
                                        } else {
                                          alert(`❌ Notification failed: ${data.error || 'Unknown error'}`);
                                        }
                                      } catch (err) {
                                        alert(`❌ Error: ${err.message}`);
                                      }
                                    }
                                  } else if (action === 'lock_and_notify') {
                                    if (confirm(`Lock vehicle ${r.vehicleId} and send WhatsApp notification to ${r.riderName}?`)) {
                                      try {
                                        const res = await authenticatedFetch('/api/auto-cutoff/lock-individual', {
                                          method: 'POST',
                                          body: JSON.stringify({
                                            rentalId: r.rentalId,
                                            vehicleId: r.vehicleId,
                                            autoNotify: true
                                          })
                                        });
                                        const data = await res.json();
                                        if (data.success) {
                                          const notifyStatus = data.notification?.success ? '✅ Notified' : '⚠️ Lock OK, notification failed';
                                          alert(`✅ Vehicle locked!\n${notifyStatus}`);
                                          fetchStats();
                                          fetchLogs();
                                        } else {
                                          alert(`❌ Lock failed: ${data.error || 'Unknown error'}`);
                                        }
                                      } catch (err) {
                                        alert(`❌ Error: ${err.message}`);
                                      }
                                    }
                                  }
                                }}
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                
                {/* Pagination Controls */}
                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ fontSize: 13, color: 'var(--text4)' }}>
                    Showing {startIdx + 1}-{Math.min(endIdx, filtered.length)} of {filtered.length} rentals
                    {searchQuery && <span> (filtered by "{searchQuery}")</span>}
                  </div>
                  
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button 
                      className="cmd-btn" 
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      style={{ fontSize: 13, padding: '6px 12px' }}
                    >
                      ← Prev
                    </button>
                    
                    <span style={{ fontSize: 13, color: 'var(--text3)' }}>
                      Page {currentPage} of {totalPages}
                    </span>
                    
                    <button 
                      className="cmd-btn" 
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      style={{ fontSize: 13, padding: '6px 12px' }}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              </div>
            );
          })()
        )}
      </div>

      {/* Execution Result */}
      {result && (
        <div className={`result-box ${result.success ? 'result-success' : 'result-error'}`} style={{ marginBottom: 22 }}>
          <div><strong>{result.message || (result.success ? 'Cutoff Executed' : 'Failed')}</strong></div>
          {result.success && (
            <div style={{ marginTop: 8, fontSize: 13 }}>
              <div>Total: {result.totalOverdue} | Successful: {result.successful} | Failed: {result.failed} | Skipped: {result.skipped}</div>
            </div>
          )}
          {result.error && <div style={{ marginTop: 8, color: 'var(--red)' }}>Error: {result.error}</div>}
        </div>
      )}

      {/* Cutoff Logs - Simplified */}
      <div className="panel">
        <div className="panel-head">
          <h2>Recent Cutoff Logs</h2>
          <button className="refresh-btn" onClick={fetchLogs} disabled={loadingLogs}>
            {loadingLogs ? 'Loading...' : '↻ Refresh'}
          </button>
        </div>

        {loadingLogs ? (
          <p className="muted">Loading logs...</p>
        ) : logs.length === 0 ? (
          <p className="muted">No cutoff logs yet.</p>
        ) : (
          <div className="activity-list">
            {logs.slice(0, 10).map((log) => (
              <div
                key={log.id}
                className={`activity-item ${
                  log.cutoffStatus === 'success' ? 'activity-success' :
                  log.cutoffStatus === 'failed' ? 'activity-error' :
                  'activity-pending'
                }`}
              >
                <div className="activity-icon">
                  {log.cutoffStatus === 'success' ? '✅' :
                   log.cutoffStatus === 'failed' ? '❌' : '⏳'}
                </div>
                <div className="activity-content">
                  <div className="activity-device">
                    {log.rentalId} → {log.vehicleId || 'N/A'} | {log.overdueDays} days overdue
                  </div>
                  <div className="activity-message">
                    {log.cutoffStatus} | Retries: {log.retryCount}
                    {log.lastError && ` | ${log.lastError}`}
                  </div>
                </div>
                <div className="activity-time">
                  {new Date(log.lastAttemptAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── BULK NOTIFY TAB ──────────────────────────────────────────────────────────
function BulkNotifyTab({ authenticatedFetch }) {
  const [csvFile, setCsvFile] = useState(null);
  const [csvData, setCsvData] = useState(null);
  const [template, setTemplate] = useState('rent_reminder_dashboard');
  const [columnMapping, setColumnMapping] = useState({ name: 'person_name', phone: 'phone', var1: 'person_name', var2: 'rent' });
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('csvFile', file);

    try {
      const response = await authenticatedFetch(`${API_BASE}/api/bulk-notify/upload`, {
        method: 'POST',
        body: formData,
        headers: {}, // Let browser set Content-Type with boundary
      });

      setCsvData(response);
      setCsvFile(file.name);
    } catch (error) {
      alert('Error uploading CSV: ' + error.message);
    }
  };

  const handleSend = async () => {
    if (!csvData || !csvData.data) {
      alert('Please upload a CSV file first');
      return;
    }

    if (!window.confirm(`Send WhatsApp messages to ${csvData.totalRows} recipients?`)) {
      return;
    }

    setSending(true);
    
    try {
      // Map CSV data to recipients format
      const recipients = csvData.data.map(row => ({
        phone: row[columnMapping.phone],
        name: row[columnMapping.name],
        variables: [row[columnMapping.var1], row[columnMapping.var2]]
      }));

      const response = await authenticatedFetch(`${API_BASE}/api/bulk-notify/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients,
          template: {
            name: template,
            campaignId: '23073'
          },
          rateLimit: 5  // 5 messages per second
        }),
      });

      alert(`✅ Bulk send started! Job ID: ${response.jobId}\nCheck Activity tab for status.`);
      
      // Reset
      setCsvFile(null);
      setCsvData(null);
      setSending(false);

    } catch (error) {
      alert('Error sending: ' + error.message);
      setSending(false);
    }
  };

  return (
    <div style={{ padding: 30, maxWidth: 1200, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 10, fontSize: 24, fontWeight: 600 }}>📤 Bulk WhatsApp Notifications</h2>
      <p style={{ color: 'var(--text2)', marginBottom: 30 }}>Upload a CSV file to send template messages to multiple recipients</p>

      {/* Step 1: Upload CSV */}
      <div style={{ background: 'var(--bg3)', padding: 25, borderRadius: 12, marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 15 }}>1️⃣ Upload CSV File</h3>
        <input 
          type="file" 
          accept=".csv" 
          onChange={handleFileUpload}
          style={{ 
            padding: 10, 
            borderRadius: 8, 
            border: '2px dashed var(--border)',
            background: 'var(--bg2)',
            color: 'var(--text1)',
            cursor: 'pointer',
            width: '100%'
          }}
        />
        {csvFile && (
          <p style={{ marginTop: 10, color: 'var(--success)', fontSize: 14 }}>
            ✅ Loaded: {csvFile} ({csvData?.totalRows} rows)
          </p>
        )}
      </div>

      {/* Step 2: Template Selection */}
      {csvData && (
        <>
          <div style={{ background: 'var(--bg3)', padding: 25, borderRadius: 12, marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 15 }}>2️⃣ Select Template</h3>
            <select 
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              style={{ 
                padding: 10, 
                borderRadius: 8, 
                border: '1px solid var(--border)',
                background: 'var(--bg2)',
                color: 'var(--text1)',
                width: '100%'
              }}
            >
              <option value="rent_reminder_dashboard">Rent Reminder (2 variables)</option>
              <option value="overdue_rental_cutoff">Overdue Cutoff Warning (1 variable)</option>
            </select>
          </div>

          {/* Step 3: Column Mapping */}
          <div style={{ background: 'var(--bg3)', padding: 25, borderRadius: 12, marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 15 }}>3️⃣ Map CSV Columns</h3>
            <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 15 }}>Available columns: {csvData.columns.join(', ')}</p>
            
            <div style={{ display: 'grid', gap: 15 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontSize: 13, color: 'var(--text2)' }}>Phone Number Column:</label>
                <select 
                  value={columnMapping.phone}
                  onChange={(e) => setColumnMapping({...columnMapping, phone: e.target.value})}
                  style={{ 
                    padding: 8, 
                    borderRadius: 6, 
                    border: '1px solid var(--border)',
                    background: 'var(--bg2)',
                    color: 'var(--text1)',
                    width: '100%'
                  }}
                >
                  {csvData.columns.map(col => <option key={col} value={col}>{col}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 5, fontSize: 13, color: 'var(--text2)' }}>Recipient Name Column:</label>
                <select 
                  value={columnMapping.name}
                  onChange={(e) => setColumnMapping({...columnMapping, name: e.target.value})}
                  style={{ 
                    padding: 8, 
                    borderRadius: 6, 
                    border: '1px solid var(--border)',
                    background: 'var(--bg2)',
                    color: 'var(--text1)',
                    width: '100%'
                  }}
                >
                  {csvData.columns.map(col => <option key={col} value={col}>{col}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 5, fontSize: 13, color: 'var(--text2)' }}>Variable 1 (Customer Name):</label>
                <select 
                  value={columnMapping.var1}
                  onChange={(e) => setColumnMapping({...columnMapping, var1: e.target.value})}
                  style={{ 
                    padding: 8, 
                    borderRadius: 6, 
                    border: '1px solid var(--border)',
                    background: 'var(--bg2)',
                    color: 'var(--text1)',
                    width: '100%'
                  }}
                >
                  {csvData.columns.map(col => <option key={col} value={col}>{col}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 5, fontSize: 13, color: 'var(--text2)' }}>Variable 2 (Vehicle Rent):</label>
                <select 
                  value={columnMapping.var2}
                  onChange={(e) => setColumnMapping({...columnMapping, var2: e.target.value})}
                  style={{ 
                    padding: 8, 
                    borderRadius: 6, 
                    border: '1px solid var(--border)',
                    background: 'var(--bg2)',
                    color: 'var(--text1)',
                    width: '100%'
                  }}
                >
                  {csvData.columns.map(col => <option key={col} value={col}>{col}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Step 4: Preview */}
          <div style={{ background: 'var(--bg3)', padding: 25, borderRadius: 12, marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 15 }}>4️⃣ Preview (First 3 rows)</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: 10, textAlign: 'left', color: 'var(--text3)' }}>Phone</th>
                    <th style={{ padding: 10, textAlign: 'left', color: 'var(--text3)' }}>Name</th>
                    <th style={{ padding: 10, textAlign: 'left', color: 'var(--text3)' }}>Variable 1</th>
                    <th style={{ padding: 10, textAlign: 'left', color: 'var(--text3)' }}>Variable 2</th>
                  </tr>
                </thead>
                <tbody>
                  {csvData.preview.slice(0, 3).map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: 10 }}>{row[columnMapping.phone]}</td>
                      <td style={{ padding: 10 }}>{row[columnMapping.name]}</td>
                      <td style={{ padding: 10 }}>{row[columnMapping.var1]}</td>
                      <td style={{ padding: 10 }}>{row[columnMapping.var2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Step 5: Send */}
          <div style={{ textAlign: 'center' }}>
            <button 
              onClick={handleSend}
              disabled={sending}
              style={{ 
                padding: '15px 40px', 
                borderRadius: 10, 
                border: 'none',
                background: sending ? 'var(--text3)' : 'var(--success)',
                color: '#FFFFFF',
                fontSize: 16,
                fontWeight: 600,
                cursor: sending ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {sending ? '⏳ Sending...' : `📤 Send to ${csvData.totalRows} Recipients`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const { isAuthenticated, loading: authLoading, user, logout } = useAuth();
  const authenticatedFetch = useAuthenticatedFetch();
  
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const [activeTab, setActiveTab]         = useState("dashboard");
  const [commandStatus, setCommandStatus] = useState({});
  const [pendingConfirm, setPendingConfirm] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dark, setDark] = useDarkMode();
  
  // Lock state management - persisted in localStorage
  const [lockState, setLockState] = useState(() => {
    try {
      const saved = localStorage.getItem('vehicleLockState');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  
  // Save lock state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('vehicleLockState', JSON.stringify(lockState));
  }, [lockState]);

  const { assets, loading, error, permBlocked, lastFetched, reload } = useAssets(authenticatedFetch);
  const relativeTime = useRelativeTime(lastFetched);
  
  // Show loading state while checking authentication
  if (authLoading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: '16px', color: 'var(--text3)' }}>Loading...</div>;
  }
  
  // If not authenticated, show login page
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const requestCommand = (deviceId, assetId, commandType, deviceImei) => {
    setPendingConfirm({ deviceId, assetId, commandType, deviceImei });
  };

  const confirmCommand = async () => {
    const { deviceId, assetId, commandType, deviceImei } = pendingConfirm;
    setPendingConfirm(null);
    setCommandStatus((p) => ({ ...p, [assetId]: { state: "pending", message: "Sending…" } }));
    
    try {
      const res  = await authenticatedFetch('/api/command', {
        method: "POST",
        body: JSON.stringify({ deviceId: parseInt(deviceId, 10), commandType }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      
      // Update lock state
      if (commandType === 'engine_cutoff' && deviceImei) {
        setLockState(prev => ({ ...prev, [deviceImei]: 'locked' }));
      } else if (commandType === 'engine_restore' && deviceImei) {
        setLockState(prev => ({ ...prev, [deviceImei]: 'unlocked' }));
      }
      
      const meta = COMMAND_LABELS[commandType];
      setCommandStatus((p) => ({ 
        ...p, 
        [assetId]: { 
          state: "success", 
          message: `${meta.label} command sent successfully` 
        } 
      }));
    } catch (err) {
      setCommandStatus((p) => ({ 
        ...p, 
        [assetId]: { 
          state: "error", 
          message: "Failed — " + err.message 
        } 
      }));
    }
    setTimeout(() => setCommandStatus((p) => { const n = { ...p }; delete n[assetId]; return n; }), 6000);
  };

  const online = assets.filter((a) => a.status === "moving" || a.status === "idle").length;

  return (
    <div className="app">
      <button className="sidebar-toggle" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>☰</button>
      
      <aside className={`sidebar ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="brand">
          <span className="brand-mark">OG</span>
          <span className="brand-name">OPTI GraphQL</span>
        </div>
        
        <div className="sidebar-user-info">
          <div className="user-avatar">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</div>
          <div className="user-details">
            <div className="user-name">{user?.name || 'User'}</div>
            <div className="user-role">{user?.role || 'user'}</div>
          </div>
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
        
        <button className="sidebar-logout" onClick={logout}>🚪 Logout</button>
        
        <div className="sidebar-footer">
          <span className={`pulse-dot ${online > 0 ? "pulse-live" : "pulse-idle"}`} />
          <span>{permBlocked ? "Awaiting permission" : assets.length > 0 ? `${assets.length} assets • ${online} online` : "No data"}</span>
        </div>
      </aside>

      <main className={`content ${activeTab === "tracker" ? "content-full" : ""} ${sidebarCollapsed ? "main-expanded" : ""}`}>
        <div className="topbar">
          <h1>{{ dashboard: "Dashboard", tracker: "Live Tracker", vehicles: "Vehicles", commands: "Commands", autocutoff: "Auto-Cutoff", activity: "Activity Log", settings: "Settings" }[activeTab]}</h1>
          <div className="topbar-right">
            {relativeTime && <span className="last-updated" title={lastFetched?.toLocaleTimeString()}>Updated {relativeTime}</span>}
            <button className={`theme-toggle-prominent ${dark ? "theme-dark" : "theme-light"}`} onClick={() => setDark(!dark)} title="Toggle theme">
              {dark ? "☀️ Light Mode" : "🌙 Dark Mode"}
            </button>
            <button className="refresh-btn" onClick={reload} disabled={loading}>{loading ? "Loading…" : "↻ Refresh"}</button>
          </div>
        </div>

        {error && !permBlocked && <div className="error-banner">{error}</div>}

        {activeTab === "dashboard" && <DashboardTab assets={assets} permBlocked={permBlocked} onCommand={requestCommand} commandStatus={commandStatus} lockState={lockState} />}
        {activeTab === "tracker"   && <TrackerTab   assets={assets} onCommand={requestCommand} commandStatus={commandStatus} lockState={lockState} />}
        {activeTab === "vehicles"  && <VehiclesTab  assets={assets} permBlocked={permBlocked} loading={loading} onCommand={requestCommand} commandStatus={commandStatus} lockState={lockState} />}
        {activeTab === "commands"  && <CommandsTab  assets={assets} authenticatedFetch={authenticatedFetch} />}
        {activeTab === "autocutoff" && <AutoCutoffTab authenticatedFetch={authenticatedFetch} user={user} />}
        {activeTab === "bulknotify" && <BulkNotifyTab authenticatedFetch={authenticatedFetch} />}
        {activeTab === "activity"  && <ActivityTab  assets={assets} commandStatus={commandStatus} />}
        {activeTab === "settings"  && <SettingsTab  dark={dark} setDark={setDark} />}
      </main>

      <ConfirmModal pending={pendingConfirm} onConfirm={confirmCommand} onCancel={() => setPendingConfirm(null)} />
    </div>
  );
}
