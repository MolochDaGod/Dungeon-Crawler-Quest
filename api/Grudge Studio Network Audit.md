Grudge Backend Connection Guide
> Reference architecture for connecting any Grudge Studio app to the backend services.
> This guide documents the working, production-verified pattern used by GDevelop Assistant
> and should be followed by all Grudge Studio apps and sites.
Architecture Overview
Browser (React client)
  │
  │  /api/grudge/game/*
  │  /api/grudge/account/*
  │  /api/grudge/id/*
  │  /api/grudge/launcher/*
  │
  ▼
Express Server (dev) / Vercel Serverless (prod)
  │  setupGrudgeProxy(app)  ← MUST be registered in BOTH entry points
  │
  ▼
Grudge Backend Services (VPS — Coolify/Docker + Traefik)
  ├── api.grudge-studio.com       (Game API — characters, economy, crafting, islands)
  ├── account.grudge-studio.com   (Account API — profile, settings, linked accounts)
  ├── id.grudge-studio.com        (ID API — auth, JWT verification, SSO)
  └── launcher.grudge-studio.com  (Launcher API — app registry, updates, versioning)
The client never calls backend services directly. All requests go through the Express
proxy at /api/grudge/{service}/*, which forwards to the correct upstream service. This
avoids CORS issues and keeps backend URLs/keys off the client.
Service Map
| Client Path | Env Var | Default URL | Purpose |
|---|---|---|---|
| /api/grudge/game/* | GRUDGE_GAME_API | https://api.grudge-studio.com | Characters, economy, crafting, islands |
| /api/grudge/account/* | GRUDGE_ACCOUNT_API | https://account.grudge-studio.com | Profile, settings, linked accounts |
| /api/grudge/id/* | GRUDGE_ID_API | https://id.grudge-studio.com | Auth, JWT verification, SSO |
| /api/grudge/launcher/* | GRUDGE_LAUNCHER_API | https://launcher.grudge-studio.com | App registry, updates, versioning |
Critical: Dual Registration Pattern
The proxy must be registered in both server entry points:
1. Dev Server (server/routes.ts or server/index.ts)
import { setupGrudgeProxy } from "./routes/grudgeProxy";
// ... after other middleware ...
setupGrudgeProxy(app);
2. Vercel Serverless (server/vercelApp.ts)
import { setupGrudgeProxy } from "./routes/grudgeProxy";
// ... after auth setup ...
setupGrudgeProxy(app);
**If you forget to register in vercelApp.ts, all /api/grudge/* calls will 404 on
Vercel deployments while working fine locally.** This was the root cause of the initial
connection failure and is the #1 gotcha when deploying Grudge apps.
Domain Convention
Always use grudge-studio.com (with hyphen) for all backend service URLs.
✅ api.grudge-studio.com
✅ id.grudge-studio.com
✅ account.grudge-studio.com
❌ api.grudgestudio.com (no hyphen — legacy, do not use)
❌ grudgestudio.com (no hyphen — legacy, do not use)
The Cloudflare DNS and Traefik routing are configured for the hyphenated domain.
Environment Variables
Add these to your .env and Vercel project settings:
# Grudge Backend Proxy Targets (override defaults if needed)
GRUDGE_GAME_API=https://api.grudge-studio.com
GRUDGE_ACCOUNT_API=https://account.grudge-studio.com
GRUDGE_ID_API=https://id.grudge-studio.com
GRUDGE_LAUNCHER_API=https://launcher.grudge-studio.com
# Cross-service auth verification (Grudge ID service)
GRUDGE_BACKEND_URL=https://id.grudge-studio.com
# Auth URL (if different from ID API)
GRUDGE_AUTH_URL=https://id.grudge-studio.com
These env vars have sensible defaults in the proxy code, so they're only required if
you're pointing to a non-standard backend (e.g., local dev, staging).
Client API Pattern
The frontend API client (client/src/lib/grudgeBackendApi.ts) uses relative paths:
// ✅ Correct — relative path, goes through the server proxy
const res = await fetch("/api/grudge/game/characters");
// ❌ Wrong — direct backend call, will fail on CORS
const res = await fetch("https://api.grudge-studio.com/characters");
All API calls from the client should use the grudgeBackendApi typed client or
the React Query hooks (useGrudgeAPI.ts, useGrudgePlayer.ts).
CORS Configuration
Server-side (Express)
The vercelApp.ts sets permissive CORS headers for the API:
res.setHeader("Access-Control-Allow-Origin", "*");
res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-grudge-user-id");
Production CORS whitelist (config/production.json)
{
  "security": {
    "cors": {
      "origins": [
        "https://gdevelop-assistant.vercel.app",
        "https://gdevelop-assistant-git-main-grudgenexus.vercel.app",
        "https://*.vercel.app",
        "https://*.grudge-studio.com"
      ]
    }
  }
}
When adding a new Grudge Studio app, ensure its domain is covered by the wildcards or
add it explicitly.
OAuth Redirect Domain Handling
The auth system (server/grudgeAuth.ts) dynamically builds OAuth redirect URLs based
on the incoming request's Host header. It supports:
*.vercel.app — Any Vercel preview or production deployment
*.grudge-studio.com — Any Grudge Studio subdomain
*.grudgestudio.com — Legacy domain (no hyphen)
localhost:* — Local development
This means no hardcoded redirect URLs are needed. New Vercel deployments and preview
branches automatically work for OAuth without configuration changes.
Health Monitoring
/api/health Endpoint
Every Grudge app should expose a /api/health endpoint that pings the backend:
app.get("/api/health", async (_req, res) => {
  let backendOk = false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch(`${BACKEND}/health`, { signal: ctrl.signal });
    clearTimeout(t);
    backendOk = r.ok;
  } catch {}
  res.json({
    status: "healthy",
    service: "Your App Name",
    timestamp: new Date().toISOString(),
    env: {
      grudgeBackend: backendOk ? "reachable" : "unreachable",
      backendUrl: BACKEND,
    },
  });
});
Connections Page (/connections)
GDevelop Assistant includes a live probe dashboard at /connections that checks all 4
backend services in real-time. Use this as a reference when building connection monitoring
into other Grudge Studio apps:
Source: client/src/pages/connections.tsx
Probes: Hits /api/grudge/{service}/health for each service
Tools: Account/wallet backend operations, AI chat and code agent launchers
Checklist: Adding Backend to a New Grudge App
Copy server/routes/grudgeProxy.ts into your new project
Register setupGrudgeProxy(app) in both dev and production entry points
Set env vars in .env and Vercel project settings (or rely on defaults)
Use relative paths (/api/grudge/{service}/*) in all client-side API calls
Add CORS wildcard support for *.vercel.app and *.grudge-studio.com
Expose /api/health with a backend reachability check
Use grudge-studio.com (hyphenated) for all backend URLs — never grudgestudio.com
Test by visiting /connections (or your equivalent) on the deployed URL
Document your service-specific proxy routes in your project's README
Troubleshooting
| Symptom | Cause | Fix |
|---|---|---|
| All /api/grudge/* calls return 404 on Vercel | setupGrudgeProxy(app) not called in vercelApp.ts | Add the import and call after auth setup |
| CORS errors in browser console | Backend URL called directly from client | Use relative /api/grudge/* paths through proxy |
| Backend "unreachable" on health check | Wrong domain (no hyphen) or VPS down | Verify grudge-studio.com (with hyphen), check VPS |
| OAuth redirects to wrong URL | Hardcoded redirect domain | Use dynamic buildAuthRedirect() from request Host |
| 401 on API calls after login | SESSION_SECRET mismatch | Sync secret across all apps sharing the accounts table |
| Slow API responses (1-5s each) | JWT falls back to remote verification | Ensure SESSION_SECRET matches the auth-gateway |
File Reference
| File | Purpose |
|---|---|
| server/routes/grudgeProxy.ts | Proxy registration and forwarding logic |
| server/vercelApp.ts | Vercel serverless entry — must call setupGrudgeProxy() |
| server/routes.ts | Dev server entry — must call setupGrudgeProxy() |
| server/grudgeAuth.ts | Auth flows + dynamic OAuth redirect handling |
| server/middleware/grudgeJwt.ts | JWT verification (local → remote fallback) |
| client/src/lib/grudgeBackendApi.ts | Typed API client using relative proxy paths |
| client/src/pages/connections.tsx | Live backend health probe dashboard |
| config/production.json | CORS whitelist and production config |
| .env.example | All env vars with descriptions |