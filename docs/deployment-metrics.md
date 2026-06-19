# Deployment Metrics

Track how well deployments are going using **DORA** metrics, recorded automatically
on every successful deploy.

- Workflow: [`.github/workflows/deployment-metrics.yml`](../.github/workflows/deployment-metrics.yml)
- Script: [`scripts/deployment-metrics.mjs`](../scripts/deployment-metrics.mjs) (no dependencies, Node >= 18)

## What is measured
- **Lead Time for Changes** — how long code waits between being committed and being
  deployed. Reported as **median / p90 / max** across every commit since the previous
  deploy marker, plus a DORA rating (Elite `<1d`, High `<1w`, Medium `<1mo`, Low `>1mo`).
- **Deployment Frequency** — cadence of deploys, derived from deploy tags
  (`deploys/week` + counts in the last 7/30 days) with commit throughput as a
  secondary signal, plus a DORA rating.
- **Deployment context** — commit SHA, ref, actor, environment, target URL, and a
  link back to the Actions run.

The script is resilient by design: if anything goes wrong it logs a warning and
still exits `0`, so metrics collection can never break a deploy.

## How to read the output
Every run produces three things:
1. A **job summary** table on the workflow run page (GitHub → Actions → the run).
2. A **`deployment-metrics.json`** artifact (downloadable from the run, retained 90 days).
3. Pretty JSON in the step logs.

`deployment-metrics.json` shape (`schema: grudge.deployment-metrics/v1`):
```json
{
  "schema": "grudge.deployment-metrics/v1",
  "generatedAt": "2026-06-19T14:51:44.364Z",
  "repository": "MolochDaGod/Dungeon-Crawler-Quest",
  "deployment": { "event": "deployment_status", "shortSha": "d4e4f38a", "environment": "production", "state": "success", "targetUrl": "https://...", "previousDeployTag": "v1.2.0" },
  "leadTimeForChanges": { "sampleSize": 12, "medianSeconds": 5400, "p90Seconds": 86400, "maxSeconds": 172800, "rating": "Elite (<1 day)" },
  "deploymentFrequency": { "deploymentsPerWeek": 9.3, "rating": "Elite (multiple/day)", "deployTagsLast7Days": 9, "commitsLast30Days": 140 }
}
```

## When it runs (triggers)
- **`deployment_status`** — fires on each deploy GitHub knows about; metrics are
  recorded only when `state == success`. **Vercel** posts these automatically once
  the Vercel GitHub integration is connected to the repo, so no extra config is
  needed for Vercel-deployed sites.
- **`release: [published]`** — records metrics when you publish a GitHub Release.
- **`workflow_dispatch`** — run on demand from the Actions tab (optionally override
  the deploy-tag glob).

## Getting accurate Deployment Frequency
Frequency is most accurate when each deploy is marked by a tag. Two easy options:
- Tag releases you ship: `git tag v1.4.0 && git push --tags`.
- Or adopt a per-deploy tag scheme and point the workflow at it via the
  `deploy_tag_pattern` input or the `DEPLOY_TAG_PATTERN` env (default `v*`),
  e.g. `deploy-2026-06-19-1`.

Without any matching tags, the script falls back to a 30-day commit window so you
still get a lead-time signal on the very first run.

## Exporting to a dashboard (optional)
Set a repo/org Actions secret `METRICS_WEBHOOK_URL` and each run will `POST` the
JSON payload there (e.g. to a collector on `api.grudge-studio.com` or
`dash.grudge-studio.com`). The POST is best-effort and never fails the job.

## Run it locally
```bash
npm run metrics:deploy          # prints JSON + writes ./deployment-metrics.json
node scripts/deployment-metrics.mjs --out /tmp/metrics.json
DEPLOY_TAG_PATTERN='release-*' npm run metrics:deploy
```

## Follow-up: runtime Web Vitals (client-side)
The metrics above cover the *deployment process*. To also measure the *deployed
site's* real-user performance (LCP, INP, CLS, TTFB), add the `web-vitals` package
and report to your collector. Kept out of the build here to stay dependency-light;
enable when you want runtime metrics:
```ts
// client/src/lib/reportWebVitals.ts
import { onCLS, onINP, onLCP, onTTFB } from 'web-vitals';
const send = (m: { name: string; value: number; id: string }) =>
  navigator.sendBeacon?.('/api/metrics/web-vitals', JSON.stringify(m));
export function reportWebVitals() { onCLS(send); onINP(send); onLCP(send); onTTFB(send); }
```
Then call `reportWebVitals()` from the client entry point and accept the beacon at
`/api/metrics/web-vitals`.
