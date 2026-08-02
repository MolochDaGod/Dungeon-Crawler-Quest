#!/usr/bin/env node
// @ts-check
/*
 * deployment-metrics.mjs
 * ---------------------------------------------------------------------------
 * Compute DORA-style deployment metrics from local git history. No third-party
 * dependencies — only Node built-ins — so it runs anywhere Node >= 18 is present
 * (uses the global `fetch` for the optional webhook).
 *
 * Metrics produced:
 *   • Lead Time for Changes  — time from each change's commit to this deploy,
 *                              summarized as median / p90 / max across all commits
 *                              since the previous deploy marker (tag).
 *   • Deployment Frequency   — cadence derived from deploy tags (deploys/week) plus
 *                              commit throughput to the default branch.
 *   • Current deployment     — sha, ref, actor, environment, target URL, run link.
 *
 * Outputs:
 *   • Pretty JSON to stdout.
 *   • JSON file (default ./deployment-metrics.json, override with --out <file> or
 *     METRICS_OUT_FILE) for artifact upload.
 *   • Markdown appended to $GITHUB_STEP_SUMMARY when set (the Actions job summary).
 *   • Optional POST of the JSON to $METRICS_WEBHOOK_URL when that env var is set.
 *
 * Env (all optional — sensible fallbacks for local runs):
 *   GITHUB_SHA, GITHUB_REF_NAME, GITHUB_ACTOR, GITHUB_REPOSITORY,
 *   GITHUB_RUN_ID, GITHUB_SERVER_URL, GITHUB_EVENT_NAME, GITHUB_EVENT_PATH,
 *   GITHUB_STEP_SUMMARY, DEPLOY_TAG_PATTERN (glob, default "v*"),
 *   METRICS_WEBHOOK_URL, METRICS_OUT_FILE.
 *
 * This script is intentionally resilient: metrics collection must never break a
 * deployment pipeline, so soft failures are logged and it still exits 0.
 * ---------------------------------------------------------------------------
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync, appendFileSync } from 'node:fs';

const NOW = new Date();
const args = process.argv.slice(2);
const argVal = (name) => {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
};

const env = process.env;
const OUT_FILE = argVal('--out') ?? env.METRICS_OUT_FILE ?? 'deployment-metrics.json';
const DEPLOY_TAG_PATTERN = env.DEPLOY_TAG_PATTERN ?? 'v*';

/** Run git with array args (no shell => no injection). Returns trimmed stdout, or '' on error. */
function git(gitArgs, { allowFail = true } = {}) {
  try {
    return execFileSync('git', gitArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (err) {
    if (!allowFail) throw err;
    return '';
  }
}

function isGitRepo() {
  return git(['rev-parse', '--is-inside-work-tree']) === 'true';
}

// ----- statistics helpers --------------------------------------------------
function percentile(sortedAsc, p) {
  if (sortedAsc.length === 0) return null;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const rank = (p / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (rank - lo);
}

function humanizeSeconds(sec) {
  if (sec == null || Number.isNaN(sec)) return 'n/a';
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = sec / 60;
  if (m < 60) return `${m.toFixed(1)}m`;
  const h = m / 60;
  if (h < 24) return `${h.toFixed(1)}h`;
  const d = h / 24;
  return `${d.toFixed(2)}d`;
}

// DORA performance bands.
function leadTimeRating(seconds) {
  if (seconds == null) return 'n/a';
  const day = 86400;
  if (seconds < day) return 'Elite (<1 day)';
  if (seconds < 7 * day) return 'High (<1 week)';
  if (seconds < 30 * day) return 'Medium (<1 month)';
  return 'Low (>1 month)';
}

function deployFrequencyRating(perWeek) {
  if (perWeek == null) return 'n/a';
  if (perWeek >= 7) return 'Elite (multiple/day)';
  if (perWeek >= 1) return 'High (>=1/week)';
  if (perWeek >= 0.25) return 'Medium (>=1/month)';
  return 'Low (<1/month)';
}

// ----- event payload (deployment_status etc.) ------------------------------
function readEventPayload() {
  const p = env.GITHUB_EVENT_PATH;
  if (!p || !existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

// ----- core metric computation ---------------------------------------------
function findPreviousDeployTag(headSha) {
  // Tags matching the deploy pattern, newest first by creation date.
  const raw = git(['tag', '--list', DEPLOY_TAG_PATTERN, '--sort=-creatordate']);
  if (!raw) return null;
  const tags = raw.split('\n').filter(Boolean);
  for (const tag of tags) {
    const tagSha = git(['rev-list', '-n', '1', tag]);
    if (!tagSha || tagSha === headSha) continue; // skip a tag pointing at HEAD itself
    // Only consider tags that are ancestors of HEAD (i.e. already deployed history).
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', tag, 'HEAD'], { stdio: 'ignore' });
    } catch {
      continue;
    }
    const ts = Number(git(['log', '-1', '--format=%ct', tag]));
    return { tag, sha: tagSha, committedAt: Number.isFinite(ts) ? ts : null };
  }
  return null;
}

function collectChangeCommits(prevTag) {
  // Range of commits being deployed: (prevTag, HEAD]. Without a prev tag, fall
  // back to the last 30 days so the first-ever run still yields a signal.
  const range = prevTag ? `${prevTag.tag}..HEAD` : undefined;
  const fmt = '%H%x09%ct'; // sha <TAB> committer-unix-time
  const gitArgs = ['log', `--pretty=${fmt}`];
  if (range) gitArgs.push(range);
  else gitArgs.push('--since=30.days', 'HEAD');
  const raw = git(gitArgs);
  if (!raw) return [];
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [sha, ct] = line.split('\t');
      return { sha, committedAt: Number(ct) };
    })
    .filter((c) => Number.isFinite(c.committedAt));
}

function computeLeadTime(commits, deployUnix) {
  if (commits.length === 0) {
    return { sampleSize: 0, medianSeconds: null, p90Seconds: null, maxSeconds: null, rating: 'n/a' };
  }
  const deltas = commits
    .map((c) => deployUnix - c.committedAt)
    .filter((d) => d >= 0)
    .sort((a, b) => a - b);
  const median = percentile(deltas, 50);
  return {
    sampleSize: deltas.length,
    medianSeconds: median,
    p90Seconds: percentile(deltas, 90),
    maxSeconds: deltas[deltas.length - 1] ?? null,
    rating: leadTimeRating(median),
  };
}

function computeDeploymentFrequency() {
  const raw = git(['tag', '--list', DEPLOY_TAG_PATTERN, '--sort=creatordate', '--format=%(creatordate:unix)']);
  const stamps = raw ? raw.split('\n').filter(Boolean).map(Number).filter(Number.isFinite) : [];
  const nowUnix = Math.floor(NOW.getTime() / 1000);
  const within = (days) => stamps.filter((t) => nowUnix - t <= days * 86400).length;

  let perWeek = null;
  if (stamps.length >= 2) {
    const spanDays = (stamps[stamps.length - 1] - stamps[0]) / 86400;
    if (spanDays > 0) perWeek = (stamps.length - 1) / (spanDays / 7);
  } else if (stamps.length === 1) {
    perWeek = within(7); // single tag: best-effort recent cadence
  }

  // Commit throughput to the current branch as a secondary signal.
  const commits30 = Number(git(['rev-list', '--count', '--since=30.days', 'HEAD'])) || 0;
  const commits7 = Number(git(['rev-list', '--count', '--since=7.days', 'HEAD'])) || 0;

  return {
    deployTagPattern: DEPLOY_TAG_PATTERN,
    totalDeployTags: stamps.length,
    deployTagsLast7Days: within(7),
    deployTagsLast30Days: within(30),
    deploymentsPerWeek: perWeek == null ? null : Number(perWeek.toFixed(2)),
    rating: deployFrequencyRating(perWeek),
    commitsLast7Days: commits7,
    commitsLast30Days: commits30,
  };
}

function buildMetrics() {
  const event = readEventPayload();
  const headSha = env.GITHUB_SHA || git(['rev-parse', 'HEAD']) || 'unknown';
  const shortSha = headSha !== 'unknown' ? headSha.slice(0, 8) : 'unknown';
  const deployUnix = Math.floor(NOW.getTime() / 1000);

  const prevTag = findPreviousDeployTag(headSha);
  const commits = collectChangeCommits(prevTag);
  const leadTime = computeLeadTime(commits, deployUnix);
  const frequency = computeDeploymentFrequency();

  // Deployment context — prefer the Actions deployment_status payload when present.
  const ds = event?.deployment_status;
  const dep = event?.deployment;
  const serverUrl = env.GITHUB_SERVER_URL || 'https://github.com';
  const repo = env.GITHUB_REPOSITORY || git(['config', '--get', 'remote.origin.url']);
  const runUrl = env.GITHUB_RUN_ID && env.GITHUB_REPOSITORY
    ? `${serverUrl}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`
    : null;

  return {
    schema: 'grudge.deployment-metrics/v1',
    generatedAt: NOW.toISOString(),
    repository: repo || null,
    deployment: {
      event: env.GITHUB_EVENT_NAME || 'local',
      sha: headSha,
      shortSha,
      ref: env.GITHUB_REF_NAME || git(['rev-parse', '--abbrev-ref', 'HEAD']) || null,
      actor: env.GITHUB_ACTOR || git(['log', '-1', '--format=%an']) || null,
      environment: ds?.environment || dep?.environment || env.DEPLOY_ENVIRONMENT || null,
      state: ds?.state || null,
      targetUrl: ds?.target_url || ds?.environment_url || null,
      runUrl,
      previousDeployTag: prevTag?.tag || null,
    },
    leadTimeForChanges: leadTime,
    deploymentFrequency: frequency,
  };
}

// ----- rendering -----------------------------------------------------------
function toMarkdown(m) {
  const lt = m.leadTimeForChanges;
  const fr = m.deploymentFrequency;
  const d = m.deployment;
  const line = (label, val) => `| ${label} | ${val} |`;
  return [
    '## 🚀 Deployment Metrics (DORA)',
    '',
    `**Deploy** \`${d.shortSha}\` on \`${d.ref ?? '?'}\`` +
      `${d.environment ? ` → \`${d.environment}\`` : ''}` +
      `${d.targetUrl ? ` · [target](${d.targetUrl})` : ''}` +
      `${d.state ? ` · state: \`${d.state}\`` : ''}`,
    '',
    '### Lead Time for Changes',
    '| Metric | Value |',
    '| --- | --- |',
    line('Rating', lt.rating),
    line('Median', humanizeSeconds(lt.medianSeconds)),
    line('p90', humanizeSeconds(lt.p90Seconds)),
    line('Max', humanizeSeconds(lt.maxSeconds)),
    line('Commits in window', String(lt.sampleSize)),
    line('Previous deploy tag', d.previousDeployTag ?? '_none (used 30-day window)_'),
    '',
    '### Deployment Frequency',
    '| Metric | Value |',
    '| --- | --- |',
    line('Rating', fr.rating),
    line('Deploys / week', fr.deploymentsPerWeek == null ? 'n/a' : String(fr.deploymentsPerWeek)),
    line('Deploy tags (7d / 30d)', `${fr.deployTagsLast7Days} / ${fr.deployTagsLast30Days}`),
    line('Commits (7d / 30d)', `${fr.commitsLast7Days} / ${fr.commitsLast30Days}`),
    line('Tag pattern', `\`${fr.deployTagPattern}\``),
    '',
    `_Generated ${m.generatedAt}${d.runUrl ? ` · [run](${d.runUrl})` : ''}_`,
    '',
  ].join('\n');
}

async function postWebhook(metrics) {
  const url = env.METRICS_WEBHOOK_URL;
  if (!url) return;
  if (typeof fetch !== 'function') {
    console.warn('[deployment-metrics] fetch unavailable (need Node >= 18); skipping webhook.');
    return;
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(metrics),
    });
    if (!res.ok) console.warn(`[deployment-metrics] webhook responded ${res.status}`);
    else console.log('[deployment-metrics] metrics posted to webhook.');
  } catch (err) {
    console.warn(`[deployment-metrics] webhook POST failed: ${err?.message ?? err}`);
  }
}

// ----- main ----------------------------------------------------------------
async function main() {
  if (!isGitRepo()) {
    console.warn('[deployment-metrics] not a git repository; nothing to compute.');
    return;
  }

  const metrics = buildMetrics();
  const json = JSON.stringify(metrics, null, 2);

  // 1) stdout
  console.log(json);

  // 2) artifact file
  try {
    writeFileSync(OUT_FILE, json + '\n', 'utf8');
    console.log(`[deployment-metrics] wrote ${OUT_FILE}`);
  } catch (err) {
    console.warn(`[deployment-metrics] could not write ${OUT_FILE}: ${err?.message ?? err}`);
  }

  // 3) GitHub Actions job summary
  const summaryPath = env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    try {
      appendFileSync(summaryPath, toMarkdown(metrics) + '\n', 'utf8');
    } catch (err) {
      console.warn(`[deployment-metrics] could not write job summary: ${err?.message ?? err}`);
    }
  }

  // 4) optional webhook
  await postWebhook(metrics);
}

main().catch((err) => {
  // Never fail the pipeline because of metrics.
  console.warn(`[deployment-metrics] unexpected error (ignored): ${err?.stack ?? err}`);
  process.exit(0);
});
