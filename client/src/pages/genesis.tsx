import { useEffect, useState, useRef } from 'react';
import { useRoute } from 'wouter';
import { buildGenesisScene, type GenesisScene } from '@/game/genesis-scene-builder';

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

  // Genesis renders the 3D island scene directly
  return <GenesisIslandView instanceId={instanceId} isLocal={isLocal} />;
}

// ── 3D Island View Component ───────────────────────────────────

function GenesisIslandView({ instanceId, isLocal }: { instanceId: string; isLocal: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GenesisScene | null>(null);
  const [loading, setLoading] = useState(true);
  const [playerInfo, setPlayerInfo] = useState<{ name: string; race: string; heroClass: string; level: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;

    buildGenesisScene(containerRef.current).then(gs => {
      if (disposed) { gs.dispose(); return; }
      sceneRef.current = gs;
      // Read player info from bridge
      const snap = gs.bridge.getSnapshot();
      setPlayerInfo({ name: snap.name, race: snap.race, heroClass: snap.heroClass, level: snap.level });
      setLoading(false);
    }).catch(err => {
      console.error('[Genesis] Scene build failed:', err?.message || err, err?.stack);
      setError(`Scene failed: ${err?.message || String(err)}`);
      setLoading(false);
    });

    return () => {
      disposed = true;
      if (sceneRef.current) {
        sceneRef.current.dispose();
        sceneRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a1a', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {loading && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.8)', color: '#22d3ee',
          fontFamily: 'monospace', fontSize: '18px',
          zIndex: 10,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⛵</div>
            <div>Building Genesis Island...</div>
            <div style={{ color: '#666', fontSize: '12px', marginTop: '8px' }}>
              {isLocal ? 'Local Mode' : `Instance: ${instanceId}`}
            </div>
          </div>
        </div>
      )}
      {/* HUD overlay */}
      {/* HUD is now rendered by BabylonJS GUI (genesis-hud.ts) */}
    </div>
  );
}
