import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { getWaypoints, createWaypoint, updateWaypoint, deleteWaypoint } from '../api/waypoints';
import type { Waypoint, Dimension } from '../types';

// --- Concepts in this file ---
// CRS.Simple: Leaflet normally uses real-world GPS coordinates (latitude/longitude).
//   CRS.Simple turns off that projection and uses a plain pixel grid instead.
//   Perfect for Minecraft since our coords are just numbers, not GPS.
//   In Leaflet, position is always [lat, lng]. With CRS.Simple we map:
//   lat = Minecraft Z,  lng = Minecraft X
//
// useRef: Like useState but changing it does NOT cause a re-render.
//   We use it for the socket because we don't want the whole page
//   to re-render every time the socket connects or sends a message.
//
// Socket.IO real-time: When another user creates/edits/deletes a waypoint,
//   the server broadcasts the event to everyone in the realm's room.
//   We listen for those events and update our local state to match.
//   This is why the map updates live without refreshing.

// ─── Dimension theme config ───────────────────────────────────────────────────
const DIM = {
  overworld: { mapBg: '#1a2e0d', sidebarBg: '#1a1208', border: '#3a2a10', accent: '#4ade80' },
  nether:    { mapBg: '#2a0a0a', sidebarBg: '#1a100a', border: '#3a2010', accent: '#f87171' },
  end:       { mapBg: '#000000', sidebarBg: '#0d0a1a', border: '#2a1a4a', accent: '#c084fc' },
};

// ─── MapClickHandler ──────────────────────────────────────────────────────────
// A tiny helper component that must live INSIDE <MapContainer> to access
// the Leaflet map instance. useMapEvents is a React-Leaflet hook that
// lets us attach event listeners to the map.
const MapClickHandler = ({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
};

// ─── Custom marker icon factory ───────────────────────────────────────────────
// L.divIcon renders a custom HTML element as the marker instead of
// Leaflet's default blue pin. We pass raw HTML as a string.
// If the waypoint has a screenshot, we show it as the icon thumbnail.
const createIcon = (wp: Waypoint, accentColor: string) => L.divIcon({
  className: '',
  html: `
    <div style="
      width:36px;height:36px;border-radius:6px;
      background:#1e1e2e;border:2px solid ${accentColor};
      display:flex;align-items:center;justify-content:center;
      font-size:16px;overflow:hidden;
      box-shadow:0 2px 8px rgba(0,0,0,0.6);
    ">
      ${wp.screenshot_url
        ? `<img src="${wp.screenshot_url}" style="width:100%;height:100%;object-fit:cover"/>`
        : '📍'}
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 36],   // bottom center of icon sits on the coordinate
  popupAnchor: [0, -38],  // popup appears above the icon
});

// ─── Main MapPage component ───────────────────────────────────────────────────
const MapPage = () => {
  const { realmId } = useParams<{ realmId: string }>();
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [waypoints, setWaypoints]         = useState<Waypoint[]>([]);
  const [dimension, setDimension]         = useState<Dimension>('overworld');
  const [loading, setLoading]             = useState(true);
  const [selectedWaypoint, setSelectedWaypoint] = useState<Waypoint | null>(null);

  // Add modal state
  const [showAdd, setShowAdd]     = useState(false);
  const [addForm, setAddForm]     = useState({ name: '', x: '0', y: '64', z: '0', description: '' });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError]   = useState('');

  // Edit modal state
  const [showEdit, setShowEdit]   = useState(false);
  const [editForm, setEditForm]   = useState({ name: '', x: '0', y: '64', z: '0', description: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // useRef stores the socket so it persists across renders without triggering them
  const socketRef = useRef<Socket | null>(null);

  // ── Socket.IO setup ─────────────────────────────────────────────────────────
  // Runs once when the component mounts ([] dependency array).
  // Connects to the backend, joins the realm room, and listens for
  // real-time waypoint events from other users.
  useEffect(() => {
    if (!realmId || !token) return;

    const socket = io('http://localhost:3001', { auth: { token } });
    socketRef.current = socket;

    socket.emit('join-realm', { realmID: realmId });

    // When another user creates a waypoint, add it to our local list
    socket.on('waypoint:created', (wp: Waypoint) => {
      setWaypoints(prev => {
        // Guard against duplicates in case we receive our own create event
        if (prev.find(w => w.id === wp.id)) return prev;
        return [...prev, wp];
      });
    });

    // When another user edits a waypoint, replace it in our local list
    socket.on('waypoint:updated', (wp: Waypoint) => {
      setWaypoints(prev => prev.map(w => w.id === wp.id ? wp : w));
    });

    // When another user deletes a waypoint, remove it from our local list
    socket.on('waypoint:deleted', ({ id }: { id: string }) => {
      setWaypoints(prev => prev.filter(w => w.id !== id));
      setSelectedWaypoint(prev => prev?.id === id ? null : prev);
    });

    // Cleanup: disconnect socket when user navigates away
    return () => { socket.disconnect(); };
  }, [realmId, token]);

  // ── Fetch waypoints when dimension changes ──────────────────────────────────
  // [realmId, dimension] means: re-run whenever realmId OR dimension changes.
  // This re-fetches only waypoints for the currently selected dimension.
  useEffect(() => {
    if (!realmId) return;
    const fetch = async () => {
      setLoading(true);
      setSelectedWaypoint(null);
      try {
        const res = await getWaypoints(realmId, dimension);
        setWaypoints(res.data);
      } catch {
        setWaypoints([]);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [realmId, dimension]);

  // ── Map click handler ───────────────────────────────────────────────────────
  // Pre-fills x/z in the add form from where the user clicked on the map.
  // lat = Z in Minecraft, lng = X in Minecraft (CRS.Simple mapping).
  const handleMapClick = (lat: number, lng: number) => {
    setAddForm(prev => ({
      ...prev,
      x: Math.round(lng).toString(),
      z: Math.round(lat).toString(),
    }));
    setShowAdd(true);
  };

  // ── Create waypoint ─────────────────────────────────────────────────────────
  const handleAddWaypoint = async () => {
    if (!addForm.name.trim()) return;
    setAddError('');
    setAddLoading(true);
    try {
      await createWaypoint({
        realm_id: realmId!,
        name: addForm.name.trim(),
        x: parseInt(addForm.x),
        y: parseInt(addForm.y),
        z: parseInt(addForm.z),
        dimension,
        description: addForm.description || undefined,
      });
      // We DON'T manually update waypoints state here.
      // The socket 'waypoint:created' event handles the state update for everyone,
      // including ourselves. This way the logic stays in one place.
      setShowAdd(false);
      setAddForm({ name: '', x: '0', y: '64', z: '0', description: '' });
    } catch (err: any) {
      setAddError(err.response?.data?.error || 'Failed to create waypoint');
    } finally {
      setAddLoading(false);
    }
  };

  // ── Edit waypoint ───────────────────────────────────────────────────────────
  const handleEditWaypoint = async () => {
    if (!selectedWaypoint || !editForm.name.trim()) return;
    setEditError('');
    setEditLoading(true);
    try {
      await updateWaypoint(selectedWaypoint.id, {
        name: editForm.name.trim(),
        x: parseInt(editForm.x),
        y: parseInt(editForm.y),
        z: parseInt(editForm.z),
        dimension,
        description: editForm.description || undefined,
      });
      // Socket 'waypoint:updated' handles the state update
      setShowEdit(false);
      setSelectedWaypoint(null);
    } catch (err: any) {
      setEditError(err.response?.data?.error || 'Failed to update waypoint');
    } finally {
      setEditLoading(false);
    }
  };

  // ── Delete waypoint ─────────────────────────────────────────────────────────
  const handleDeleteWaypoint = async (id: string) => {
    try {
      await deleteWaypoint(id);
      // Socket 'waypoint:deleted' handles removing it from state
    } catch { /* silently fail */ }
  };

  // ── Open edit modal pre-filled with selected waypoint's data ────────────────
  const openEdit = (wp: Waypoint) => {
    setSelectedWaypoint(wp);
    setEditForm({
      name: wp.name,
      x: wp.x.toString(),
      y: wp.y.toString(),
      z: wp.z.toString(),
      description: wp.description || '',
    });
    setShowEdit(true);
  };

  const dim = DIM[dimension];

  // ── JSX ─────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: dim.mapBg }}>

      {/* ── Navbar ── */}
      <nav
        className="flex items-center justify-between px-6 h-14 flex-shrink-0 border-b z-10"
        style={{ background: dim.sidebarBg, borderColor: dim.border }}
      >
        <div className="inline-flex items-baseline gap-1">
          <span
            className="font-mono font-black text-lg tracking-widest text-fuchsia-400 uppercase px-2 py-0.5 border-2 border-purple-500 rounded-sm"
            style={{ textShadow: '2px 2px 0 #7e22ce, 0 0 10px #d946ef', background: 'rgba(88,28,135,0.4)' }}
          >
            REALM
          </span>
          <span className="font-mono text-lg font-medium text-white tracking-wide">Map</span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs font-mono" style={{ color: dim.accent }}>● {dimension}</span>
          <button
            onClick={() => navigate('/realms')}
            className="text-sm text-purple-400/60 hover:text-fuchsia-400 transition-colors"
          >
            ← Realms
          </button>
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium text-white flex-shrink-0"
            style={{ background: 'rgba(88,28,135,0.6)', border: '1px solid #6b21a8' }}
          >
            {user?.username?.charAt(0).toUpperCase()}
          </div>
        </div>
      </nav>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ── */}
        <div
          className="w-56 flex flex-col flex-shrink-0 border-r overflow-hidden"
          style={{ background: dim.sidebarBg, borderColor: dim.border }}
        >
          {/* Dimension tabs */}
          <div className="flex border-b" style={{ borderColor: dim.border }}>
            {(['overworld', 'nether', 'end'] as Dimension[]).map(d => (
              <button
                key={d}
                onClick={() => setDimension(d)}
                className="flex-1 py-2 text-xs capitalize transition-all border-b-2"
                style={{
                  color: dimension === d ? DIM[d].accent : '#64748b',
                  borderBottomColor: dimension === d ? DIM[d].accent : 'transparent',
                  background: dimension === d ? `${DIM[d].sidebarBg}` : 'transparent',
                }}
              >
                {d}
              </button>
            ))}
          </div>

          {/* Waypoint list */}
          <div className="flex-1 overflow-y-auto p-2">
            <p className="text-xs uppercase tracking-wider px-2 py-1.5" style={{ color: '#475569' }}>
              {loading ? '...' : `${waypoints.length} waypoints`}
            </p>

            {!loading && waypoints.length === 0 && (
              <p className="text-xs text-center py-6 leading-relaxed" style={{ color: '#475569' }}>
                No waypoints yet.<br />Click the map to add one.
              </p>
            )}

            {waypoints.map(wp => (
              <div
                key={wp.id}
                onClick={() => setSelectedWaypoint(selectedWaypoint?.id === wp.id ? null : wp)}
                className="flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer mb-1 transition-all"
                style={{
                  background: selectedWaypoint?.id === wp.id ? `${dim.accent}18` : 'transparent',
                  border: selectedWaypoint?.id === wp.id
                    ? `1px solid ${dim.accent}40`
                    : '1px solid transparent',
                }}
              >
                {/* Waypoint thumbnail */}
                <div
                  className="w-6 h-6 rounded flex items-center justify-center text-xs flex-shrink-0 overflow-hidden"
                  style={{ background: '#1e1e2e', border: `1px solid ${dim.accent}40` }}
                >
                  {wp.screenshot_url
                    ? <img src={wp.screenshot_url} className="w-full h-full object-cover" />
                    : '📍'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{wp.name}</p>
                  <p className="text-xs font-mono" style={{ color: '#475569' }}>
                    {wp.x}, {wp.y}, {wp.z}
                  </p>
                </div>
                {wp.screenshot_url && (
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dim.accent }} />
                )}
              </div>
            ))}
          </div>

          {/* Add button */}
          <div className="p-2 border-t" style={{ borderColor: dim.border }}>
            <button
              onClick={() => setShowAdd(true)}
              className="w-full py-2 rounded-lg text-xs transition-colors"
              style={{
                background: `${dim.accent}10`,
                border: `1px dashed ${dim.accent}50`,
                color: dim.accent,
              }}
            >
              + add waypoint
            </button>
          </div>
        </div>

        {/* ── Map area ── */}
        <div className="flex-1 relative overflow-hidden">

          {/* Parchment border (pointer-events:none so map clicks still register) */}
          <div className="absolute inset-0 pointer-events-none z-10">
            <div className="absolute top-0 left-0 right-0 h-4" style={{ background: 'repeating-linear-gradient(90deg,#c8a96e 0px,#d4b57a 4px,#c0a060 4px,#b89050 8px,#c8a96e 8px,#dfc080 12px,#c8a96e 12px,#c0a060 16px,#c8a96e 16px)', borderBottom: '2px solid #a07840' }} />
            <div className="absolute bottom-0 left-0 right-0 h-4" style={{ background: 'repeating-linear-gradient(90deg,#c8a96e 0px,#d4b57a 4px,#c0a060 4px,#b89050 8px,#c8a96e 8px,#dfc080 12px,#c8a96e 12px,#c0a060 16px,#c8a96e 16px)', borderTop: '2px solid #a07840' }} />
            <div className="absolute top-0 bottom-0 left-0 w-4" style={{ background: 'repeating-linear-gradient(180deg,#c8a96e 0px,#d4b57a 4px,#c0a060 4px,#b89050 8px,#c8a96e 8px,#dfc080 12px,#c8a96e 12px,#c0a060 16px,#c8a96e 16px)', borderRight: '2px solid #a07840' }} />
            <div className="absolute top-0 bottom-0 right-0 w-4" style={{ background: 'repeating-linear-gradient(180deg,#c8a96e 0px,#d4b57a 4px,#c0a060 4px,#b89050 8px,#c8a96e 8px,#dfc080 12px,#c8a96e 12px,#c0a060 16px,#c8a96e 16px)', borderLeft: '2px solid #a07840' }} />
          </div>

          {/* Leaflet map — inset 16px to sit inside the parchment border */}
          <div className="absolute inset-4" style={{ background: dim.mapBg }}>
            <MapContainer
              crs={L.CRS.Simple}
              center={[0, 0]}
              zoom={1}
              minZoom={-3}
              maxZoom={6}
              style={{ height: '100%', width: '100%', background: 'transparent' }}
              zoomControl={false}
            >
              {/* MapClickHandler must be inside MapContainer to use useMapEvents */}
              <MapClickHandler onMapClick={handleMapClick} />

              {waypoints.map(wp => (
                <Marker
                  key={wp.id}
                  position={[wp.z, wp.x]}
                  icon={createIcon(wp, dim.accent)}
                  eventHandlers={{ click: () => setSelectedWaypoint(wp) }}
                >
                  <Popup>
                    {/* Dark inline popup — Leaflet default styles stripped in index.css */}
                    <div style={{
                      background: '#1a1f2e', border: '1px solid #2a2d3a',
                      borderRadius: '10px', padding: '12px', minWidth: '160px', color: 'white',
                    }}>
                      {wp.screenshot_url && (
                        <img
                          src={wp.screenshot_url}
                          style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '6px', marginBottom: '8px' }}
                        />
                      )}
                      <p style={{ fontWeight: 500, color: dim.accent, marginBottom: '4px', fontSize: '13px' }}>{wp.name}</p>
                      <p style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
                        {wp.x}, {wp.y}, {wp.z}
                      </p>
                      {wp.description && (
                        <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>{wp.description}</p>
                      )}
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => openEdit(wp)}
                          style={{ flex: 1, padding: '5px', borderRadius: '4px', fontSize: '11px', background: '#1a2e1e', color: '#4ade80', border: '1px solid #2d4a3e', cursor: 'pointer' }}
                        >
                          edit
                        </button>
                        <button
                          onClick={() => handleDeleteWaypoint(wp.id)}
                          style={{ flex: 1, padding: '5px', borderRadius: '4px', fontSize: '11px', background: '#2e1a1a', color: '#f87171', border: '1px solid #4a2d2d', cursor: 'pointer' }}
                        >
                          delete
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          {/* Coords hint bar */}
          <div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 px-4 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap"
            style={{ background: 'rgba(22,24,32,0.9)', border: '1px solid #2a2d3a', color: '#64748b' }}
          >
            {dimension} · click map to place waypoint
          </div>
        </div>
      </div>

      {/* ── Selected waypoint detail panel ── */}
      {/* Floats over the map on the right when a sidebar item is clicked */}
      {selectedWaypoint && !showEdit && (
        <div
          className="fixed right-6 top-20 z-30 rounded-xl p-4 w-52 border"
          style={{ background: 'rgba(20,15,35,0.95)', borderColor: dim.border, backdropFilter: 'blur(8px)' }}
        >
          {selectedWaypoint.screenshot_url && (
            <img src={selectedWaypoint.screenshot_url} className="w-full h-24 object-cover rounded-lg mb-3" />
          )}
          <p className="font-medium text-sm mb-1" style={{ color: dim.accent }}>{selectedWaypoint.name}</p>
          <p className="text-xs font-mono mb-2" style={{ color: '#64748b' }}>
            {selectedWaypoint.x}, {selectedWaypoint.y}, {selectedWaypoint.z}
          </p>
          {selectedWaypoint.description && (
            <p className="text-xs mb-3" style={{ color: '#94a3b8' }}>{selectedWaypoint.description}</p>
          )}
          <p className="text-xs mb-3" style={{ color: '#475569' }}>by {selectedWaypoint.created_by}</p>
          <div className="flex gap-2">
            <button
              onClick={() => openEdit(selectedWaypoint)}
              className="flex-1 py-1.5 rounded-lg text-xs border transition-colors"
              style={{ background: '#1a2e1e', color: '#4ade80', borderColor: '#2d4a3e' }}
            >
              edit
            </button>
            <button
              onClick={() => handleDeleteWaypoint(selectedWaypoint.id)}
              className="flex-1 py-1.5 rounded-lg text-xs border transition-colors"
              style={{ background: '#2e1a1a', color: '#f87171', borderColor: '#4a2d2d' }}
            >
              delete
            </button>
          </div>
        </div>
      )}

      {/* ── Add Waypoint Modal ── */}
      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setShowAdd(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border p-6"
            style={{ background: 'rgba(20,10,35,0.97)', borderColor: '#4a1a6a', backdropFilter: 'blur(12px)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-medium text-white mb-4">Add Waypoint</h3>

            <label className="block text-xs text-purple-300/80 mb-1">Name</label>
            <input
              type="text"
              value={addForm.name}
              onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-white text-sm outline-none border border-purple-900 bg-black/40 focus:border-fuchsia-500 transition-colors mb-3"
              placeholder="Base camp"
              autoFocus
            />

            {/* X Y Z inputs in a 3-column grid */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {(['x', 'y', 'z'] as const).map(coord => (
                <div key={coord}>
                  <label className="block text-xs text-purple-300/80 mb-1 uppercase">{coord}</label>
                  <input
                    type="number"
                    value={addForm[coord]}
                    onChange={e => setAddForm(p => ({ ...p, [coord]: e.target.value }))}
                    className="w-full rounded-lg px-2 py-2 text-white text-sm outline-none border border-purple-900 bg-black/40 focus:border-fuchsia-500 transition-colors font-mono"
                  />
                </div>
              ))}
            </div>

            <label className="block text-xs text-purple-300/80 mb-1">Description (optional)</label>
            <input
              type="text"
              value={addForm.description}
              onChange={e => setAddForm(p => ({ ...p, description: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-white text-sm outline-none border border-purple-900 bg-black/40 focus:border-fuchsia-500 transition-colors mb-4"
              placeholder="Notes about this waypoint..."
            />

            {addError && <p className="text-red-400 text-xs mb-3">{addError}</p>}

            <div className="flex gap-2">
              <button
                onClick={() => { setShowAdd(false); setAddError(''); }}
                className="flex-1 bg-transparent border border-purple-900 text-purple-400 rounded-lg py-2 text-sm hover:border-purple-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddWaypoint}
                disabled={addLoading || !addForm.name.trim()}
                className="flex-1 bg-purple-800 hover:bg-purple-700 disabled:opacity-50 text-fuchsia-100 font-medium rounded-lg py-2 text-sm border border-purple-600 transition-colors"
              >
                {addLoading ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Waypoint Modal ── */}
      {showEdit && selectedWaypoint && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setShowEdit(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border p-6"
            style={{ background: 'rgba(20,10,35,0.97)', borderColor: '#4a1a6a', backdropFilter: 'blur(12px)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-medium text-white mb-4">Edit Waypoint</h3>

            <label className="block text-xs text-purple-300/80 mb-1">Name</label>
            <input
              type="text"
              value={editForm.name}
              onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-white text-sm outline-none border border-purple-900 bg-black/40 focus:border-fuchsia-500 transition-colors mb-3"
            />

            <div className="grid grid-cols-3 gap-2 mb-3">
              {(['x', 'y', 'z'] as const).map(coord => (
                <div key={coord}>
                  <label className="block text-xs text-purple-300/80 mb-1 uppercase">{coord}</label>
                  <input
                    type="number"
                    value={editForm[coord]}
                    onChange={e => setEditForm(p => ({ ...p, [coord]: e.target.value }))}
                    className="w-full rounded-lg px-2 py-2 text-white text-sm outline-none border border-purple-900 bg-black/40 focus:border-fuchsia-500 transition-colors font-mono"
                  />
                </div>
              ))}
            </div>

            <label className="block text-xs text-purple-300/80 mb-1">Description (optional)</label>
            <input
              type="text"
              value={editForm.description}
              onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-white text-sm outline-none border border-purple-900 bg-black/40 focus:border-fuchsia-500 transition-colors mb-4"
            />

            {editError && <p className="text-red-400 text-xs mb-3">{editError}</p>}

            <div className="flex gap-2">
              <button
                onClick={() => { setShowEdit(false); setEditError(''); }}
                className="flex-1 bg-transparent border border-purple-900 text-purple-400 rounded-lg py-2 text-sm hover:border-purple-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditWaypoint}
                disabled={editLoading || !editForm.name.trim()}
                className="flex-1 bg-purple-800 hover:bg-purple-700 disabled:opacity-50 text-fuchsia-100 font-medium rounded-lg py-2 text-sm border border-purple-600 transition-colors"
              >
                {editLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapPage;