/**
 * grudge-auth.js — Grudge Auth Gateway integration
 * Gateway: https://auth-gateway-otb8qmmyd-grudgenexus.vercel.app
 *
 * Usage:
 *   import { requireGrudgeAuth, getGrudgeUser } from './grudge-auth.js';
 *   requireGrudgeAuth(); // redirects to gateway if not logged in
 *   const user = getGrudgeUser(); // { token, grudgeId, username, userId }
 */
export const GRUDGE_GATEWAY_URL = 'https://auth-gateway-otb8qmmyd-grudgenexus.vercel.app';
export function getGrudgeToken() { return localStorage.getItem('grudge_auth_token') || null; }
export function getGrudgeUser() {
  const token = getGrudgeToken();
  if (!token) return null;
  return { token, userId: localStorage.getItem('grudge_user_id') || null, grudgeId: localStorage.getItem('grudge_id') || null, username: localStorage.getItem('grudge_username') || 'Player' };
}
export function isGrudgeAuthenticated() { return !!getGrudgeToken(); }
export function redirectToGrudgeGateway(returnUrl) {
  window.location.href = `${GRUDGE_GATEWAY_URL}?return=${encodeURIComponent(returnUrl || window.location.href)}`;
}
export function requireGrudgeAuth(returnUrl) { if (!isGrudgeAuthenticated()) redirectToGrudgeGateway(returnUrl); }
export function grudgeSignOut() { ['grudge_auth_token','grudge_user_id','grudge_id','grudge_username','grudge_session_token','grudge-session','discordUser','grudge_current_user','grudge_auth_user'].forEach(k => localStorage.removeItem(k)); }
export function grudgeAuthHeaders() { const t = getGrudgeToken(); return t ? { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }; }
