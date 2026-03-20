const colyseus = require('colyseus');

/**
 * OpenWorldRoom — main game room for Dungeon Crawler Quest multiplayer.
 *
 * Matches the client API in client/src/game/multiplayer.ts:
 *   Client sends: move, attack, chat, zone_change, ability
 *   Server broadcasts: player_joined, player_left, player_move, player_attack, chat, zone_change
 */
class OpenWorldRoom extends colyseus.Room {

  /** Max players per room instance */
  maxClients = 50;

  /** In-memory player state keyed by sessionId */
  players = new Map();

  onCreate(options) {
    console.log(`[OpenWorldRoom] created — maxClients=${this.maxClients}`);

    // ── Movement (10 Hz from client) ────────────────────────────
    this.onMessage('move', (client, data) => {
      const player = this.players.get(client.sessionId);
      if (!player) return;

      player.x = data.x ?? player.x;
      player.y = data.y ?? player.y;
      player.facing = data.facing ?? player.facing;
      player.animState = data.animState ?? player.animState;

      this.broadcast('player_move', {
        sessionId: client.sessionId,
        x: player.x,
        y: player.y,
        facing: player.facing,
        animState: player.animState,
      }, { except: client });
    });

    // ── Attack ──────────────────────────────────────────────────
    this.onMessage('attack', (client, data) => {
      const player = this.players.get(client.sessionId);
      if (!player) return;

      this.broadcast('player_attack', {
        sessionId: client.sessionId,
        targetId: data.targetId,
        damage: data.damage,
      }, { except: client });
    });

    // ── Chat ────────────────────────────────────────────────────
    this.onMessage('chat', (client, data) => {
      const player = this.players.get(client.sessionId);
      if (!player) return;
      const text = typeof data.text === 'string' ? data.text.trim() : '';
      if (!text || text.length > 500) return;

      this.broadcast('chat', {
        sender: player.name,
        text,
        timestamp: Date.now(),
        type: 'chat',
      });
    });

    // ── Zone change ─────────────────────────────────────────────
    this.onMessage('zone_change', (client, data) => {
      const player = this.players.get(client.sessionId);
      if (!player) return;

      player.zoneId = data.zoneId;
      this.broadcast('zone_change', {
        sessionId: client.sessionId,
        zoneId: data.zoneId,
      }, { except: client });
    });

    // ── Ability use ─────────────────────────────────────────────
    this.onMessage('ability', (client, data) => {
      const player = this.players.get(client.sessionId);
      if (!player) return;

      this.broadcast('ability_use', {
        sessionId: client.sessionId,
        abilityIndex: data.abilityIndex,
        targetX: data.targetX,
        targetY: data.targetY,
      }, { except: client });
    });
  }

  onJoin(client, options) {
    const player = {
      sessionId: client.sessionId,
      name: options.name || 'Adventurer',
      race: options.race || 'human',
      heroClass: options.heroClass || 'warrior',
      level: options.level || 1,
      x: 0,
      y: 0,
      facing: 0,
      animState: 'idle',
      animTimer: 0,
      hp: 100,
      maxHp: 100,
      zoneId: 0,
    };

    this.players.set(client.sessionId, player);

    // Tell the new player about everyone already here
    for (const [sid, p] of this.players) {
      if (sid !== client.sessionId) {
        client.send('player_joined', p);
      }
    }

    // Tell everyone else about the new player
    this.broadcast('player_joined', player, { except: client });

    console.log(`[OpenWorldRoom] ${player.name} joined (${client.sessionId}) — ${this.players.size} players`);
  }

  onLeave(client, consented) {
    const player = this.players.get(client.sessionId);
    this.players.delete(client.sessionId);

    this.broadcast('player_left', { sessionId: client.sessionId });

    if (player) {
      console.log(`[OpenWorldRoom] ${player.name} left (${client.sessionId}) — ${this.players.size} players`);
    }
  }

  onDispose() {
    console.log('[OpenWorldRoom] disposed');
  }
}

module.exports = { OpenWorldRoom };
