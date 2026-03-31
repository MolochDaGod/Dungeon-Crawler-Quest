import { useEffect, useState } from 'react';
import { useRoute } from 'wouter';
import OpenWorldPage from './open-world';

/**
 * Genesis Island Page
 *
 * Two modes:
 *
 * /genesis-admin
 *   LOCAL ONLY — runs offline, no server connection.
 *   For testing, building, iterating. Instance ID = "admin".
 *   Uses client-side state only (localStorage).
 *
 * /genesis/:instanceId
 *   SERVER-HOSTED — connects to api.grudge-studio.com + ws.grudge-studio.com.
 *   The instanceId is a UUID from the genesis_islands DB table.
 *   Players can visit each other's islands if they have access.
 *   State is persisted on the Grudge backend (structures, harvestables, etc.).
 *   Multiplayer via Colyseus/Socket.IO room keyed to the instanceId.
 */

// Backend endpoints
const API_BASE = 'https://api.grudge-studio.com';
const WS_BASE = 'https://ws.grudge-studio.com';

export default function GenesisPage() {
  const [matchAdmin] = useRoute('/genesis-admin');
  const [, params] = useRoute('/genesis/:instanceId');

  const isLocal = !!matchAdmin;
  const instanceId = isLocal ? 'admin' : (params?.instanceId || 'admin');

  const [serverReady, setServerReady] = useState(isLocal); // local is always ready
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Store context for the open-world engine
    sessionStorage.setItem('genesis_instance_id', instanceId);
    sessionStorage.setItem('genesis_force_zone', '10');
    sessionStorage.setItem('genesis_mode', isLocal ? 'local' : 'server');

    if (!isLocal) {
      // Server mode: validate the island exists and player has access
      sessionStorage.setItem('genesis_api_base', API_BASE);
      sessionStorage.setItem('genesis_ws_base', WS_BASE);

      const token = localStorage.getItem('grudge_auth_token');
      if (!token) {
        setError('Not authenticated. Please log in first.');
        return;
      }

      // Fetch island data from backend
      fetch(`${API_BASE}/islands/genesis/${instanceId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
        .then(res => {
          if (res.status === 404) throw new Error('Island not found');
          if (res.status === 403) throw new Error('No access to this island');
          if (!res.ok) throw new Error(`Server error: ${res.status}`);
          return res.json();
        })
        .then(data => {
          // Store island data for the engine
          sessionStorage.setItem('genesis_island_data', JSON.stringify(data));
          setServerReady(true);
        })
        .catch(err => {
          console.warn('[Genesis] Server fetch failed, falling back to local:', err.message);
          // Fallback: run in local mode if server unreachable
          sessionStorage.setItem('genesis_mode', 'local');
          setServerReady(true);
        });
    }

    return () => {
      sessionStorage.removeItem('genesis_instance_id');
      sessionStorage.removeItem('genesis_force_zone');
      sessionStorage.removeItem('genesis_mode');
      sessionStorage.removeItem('genesis_api_base');
      sessionStorage.removeItem('genesis_ws_base');
      sessionStorage.removeItem('genesis_island_data');
    };
  }, [instanceId, isLocal]);

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a1a', color: '#ef4444', fontFamily: 'monospace', fontSize: '18px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏔️</div>
          <div>{error}</div>
          <div style={{ color: '#666', fontSize: '14px', marginTop: '12px' }}>Instance: {instanceId}</div>
        </div>
      </div>
    );
  }

  if (!serverReady) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a1a', color: '#22d3ee', fontFamily: 'monospace', fontSize: '18px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', animation: 'spin 2s linear infinite' }}>⚓</div>
          <div>Sailing to island...</div>
          <div style={{ color: '#666', fontSize: '14px', marginTop: '12px' }}>{instanceId}</div>
        </div>
      </div>
    );
  }

  // Genesis always uses 3D BabylonJS renderer
  // The open-world game logic runs the same, but rendering is 3D
  return <OpenWorldPage force3D={true} />;
}
