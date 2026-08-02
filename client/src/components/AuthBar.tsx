import { useState, useEffect } from 'react';
import {
  getSession,
  isAuthenticated,
  isGuest,
  loginWithDiscord,
  logout,
  onAuthChange,
  type AuthSession,
} from '../game/grudge-auth';

/**
 * AuthBar — Compact auth UI for the top-right corner.
 *
 * - Logged out: "Login with Discord" button
 * - Guest: Shows grudgeId + "Link Discord" upgrade button
 * - Authenticated: Avatar, username, logout
 *
 * Styled to match the dark-fantasy theme (crimson/gold accents).
 */
export function AuthBar() {
  const [session, setSession] = useState<AuthSession | null>(getSession());

  useEffect(() => {
    return onAuthChange((s) => setSession(s));
  }, []);

  if (!session || !isAuthenticated()) {
    return (
      <div style={styles.container}>
        <button onClick={loginWithDiscord} style={styles.discordBtn}>
          <DiscordIcon /> Login with Discord
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {session.avatarUrl && (
        <img
          src={session.avatarUrl}
          alt="avatar"
          style={styles.avatar}
        />
      )}
      <div style={styles.info}>
        <span style={styles.username}>
          {session.displayName || session.username}
        </span>
        <span style={styles.grudgeId}>
          {session.grudgeId}
        </span>
      </div>
      {isGuest() && (
        <button onClick={loginWithDiscord} style={styles.upgradeBtn}>
          Link Discord
        </button>
      )}
      <button onClick={logout} style={styles.logoutBtn} title="Logout">
        ✕
      </button>
    </div>
  );
}

function DiscordIcon() {
  return (
    <svg width="18" height="14" viewBox="0 0 71 55" fill="currentColor" style={{ marginRight: 6 }}>
      <path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.7 40.7 0 00-1.8 3.7 54 54 0 00-16.2 0A26.4 26.4 0 0025.4.3a.2.2 0 00-.2-.1A58.4 58.4 0 0010.5 5a.2.2 0 00-.1 0C1.5 17.2-.9 29 .3 40.6a.2.2 0 000 .2 58.8 58.8 0 0017.7 9 .2.2 0 00.3-.1 42 42 0 003.6-5.9.2.2 0 00-.1-.3 38.7 38.7 0 01-5.5-2.6.2.2 0 01 0-.4l1.1-.9a.2.2 0 01.2 0 42 42 0 0035.6 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .3 36.4 36.4 0 01-5.5 2.7.2.2 0 00-.1.3 47.2 47.2 0 003.6 5.9.2.2 0 00.3 0A58.6 58.6 0 0070.5 40.8a.2.2 0 000-.2c1.4-14.5-2.4-27-10.2-38.1a.2.2 0 00-.1-.1zM23.7 33.3c-3.3 0-6-3-6-6.7s2.6-6.7 6-6.7 6.1 3 6 6.7c0 3.7-2.7 6.7-6 6.7zm22.2 0c-3.3 0-6-3-6-6.7s2.6-6.7 6-6.7 6 3 6 6.7-2.7 6.7-6 6.7z" />
    </svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: 12,
    right: 12,
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(15, 10, 20, 0.9)',
    border: '1px solid rgba(180, 140, 60, 0.4)',
    borderRadius: 8,
    padding: '6px 12px',
    fontFamily: 'Cinzel, serif',
    fontSize: 12,
    color: '#d4c5a0',
    backdropFilter: 'blur(8px)',
  },
  discordBtn: {
    display: 'flex',
    alignItems: 'center',
    background: '#5865F2',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '6px 14px',
    fontSize: 12,
    fontFamily: 'Cinzel, serif',
    cursor: 'pointer',
    fontWeight: 600,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    border: '2px solid rgba(180, 140, 60, 0.6)',
  },
  info: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 1,
  },
  username: {
    color: '#e8d5b8',
    fontWeight: 700,
    fontSize: 13,
  },
  grudgeId: {
    color: '#8a7a5a',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  upgradeBtn: {
    background: 'rgba(88, 101, 242, 0.2)',
    color: '#7289DA',
    border: '1px solid rgba(88, 101, 242, 0.4)',
    borderRadius: 4,
    padding: '3px 8px',
    fontSize: 10,
    cursor: 'pointer',
    fontFamily: 'Cinzel, serif',
  },
  logoutBtn: {
    background: 'none',
    border: 'none',
    color: '#8a5a5a',
    fontSize: 14,
    cursor: 'pointer',
    padding: '2px 4px',
    lineHeight: 1,
  },
};
