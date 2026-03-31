import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import type { GenesisScene } from '@/game/babylon-genesis-scene';

export default function GenesisPlayPage() {
  const [, setLocation] = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GenesisScene | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;

    (async () => {
      try {
        const { createGenesisScene } = await import('@/game/babylon-genesis-scene');
        if (disposed) return;
        const genesis = await createGenesisScene(containerRef.current!);
        if (disposed) { genesis.dispose(); return; }
        sceneRef.current = genesis;
        setLoading(false);
      } catch (err: any) {
        console.error('[GenesisPlay] Failed:', err);
        setError(err?.message || 'Failed to initialize 3D scene');
        setLoading(false);
      }
    })();

    return () => {
      disposed = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-50">
          <div className="text-center">
            <div className="text-2xl font-bold text-[#c5a059] mb-4">GENESIS ISLAND</div>
            <div className="text-sm text-gray-400 mb-6">Loading BabylonJS 9 + Havok Physics...</div>
            <div className="w-48 h-1 bg-gray-800 rounded mx-auto overflow-hidden">
              <div className="h-full bg-[#c5a059] rounded animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-50">
          <div className="text-center max-w-md">
            <div className="text-xl font-bold text-red-500 mb-4">Scene Error</div>
            <div className="text-sm text-gray-400 mb-6">{error}</div>
            <button
              className="px-4 py-2 bg-[#c5a059] text-black font-bold rounded hover:bg-[#d4b068]"
              onClick={() => setLocation('/')}
            >
              Return to Menu
            </button>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="absolute top-4 left-4 pointer-events-auto">
            <div className="bg-black/70 border border-[#c5a059]/40 rounded px-3 py-2 text-xs text-gray-300">
              <div className="font-bold text-[#c5a059] mb-1">Controls</div>
              <div>WASD — Move</div>
              <div>Shift — Sprint</div>
              <div>Mouse — Look / Orbit</div>
              <div>Scroll — Zoom</div>
            </div>
          </div>
          <div className="absolute top-4 right-4 pointer-events-auto">
            <button
              className="px-3 py-1.5 bg-black/70 border border-[#c5a059]/40 text-[#c5a059] text-xs font-bold rounded hover:bg-black/90"
              onClick={() => setLocation('/')}
            >
              ← Back
            </button>
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <div className="text-[#c5a059] text-sm font-bold opacity-50">
              GENESIS ISLAND — BabylonJS 9 + Havok
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
