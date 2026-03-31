import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useRoute } from 'wouter';
import OpenWorldPage from './open-world';

/**
 * Genesis Island Page
 *
 * Routes:
 *   /genesis-admin     → test/admin instance (no UUID, uses "admin" as instance ID)
 *   /genesis/:instanceId → player/guild instance (UUID from URL)
 *
 * This page wraps the standard OpenWorldPage but forces Zone 10 (Genesis Island)
 * as the starting zone. The instanceId is stored in sessionStorage so the
 * open-world engine can read it for multiplayer room routing.
 *
 * Future: the instanceId will be passed to the Colyseus game-server to join
 * the correct room instance for that guild's island.
 */

export default function GenesisPage() {
  // Extract instance ID from route params
  const [matchAdmin] = useRoute('/genesis-admin');
  const [matchInstance, params] = useRoute('/genesis/:instanceId');

  const instanceId = matchAdmin ? 'admin' : (params?.instanceId || 'admin');

  // Store the genesis instance context so the game engine can read it
  useEffect(() => {
    sessionStorage.setItem('genesis_instance_id', instanceId);
    sessionStorage.setItem('genesis_force_zone', '10');

    return () => {
      // Cleanup when leaving genesis
      sessionStorage.removeItem('genesis_instance_id');
      sessionStorage.removeItem('genesis_force_zone');
    };
  }, [instanceId]);

  // Render the standard open world page — it will detect zone 10 from
  // the genesis_force_zone sessionStorage key or from the new player
  // spawn logic in createOpenWorldState()
  return <OpenWorldPage />;
}
