#!/usr/bin/env bash
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="${REPL_HOME:-.}/mockup"

echo "pnpm version: $(pnpm --version)"

if [ -d "$TARGET" ]; then
  echo "Mockup sandbox already exists at $TARGET"
else
  echo "Setting up mockup sandbox at $TARGET..."
  cp -r "$SKILL_DIR/templates/." "$TARGET/"
  echo "Copied template scaffold to $TARGET"
fi

echo "Installing dependencies..."
cd "$TARGET"
if ! pnpm install --silent 2>/dev/null; then
  pnpm install
fi

# Detect the port from the existing vite config
PORT=8000
if [ -f "$TARGET/vite.config.ts" ]; then
  DETECTED_PORT=$(grep -oP 'port:\s*\K[0-9]+' "$TARGET/vite.config.ts" 2>/dev/null || true)
  if [ -n "$DETECTED_PORT" ]; then
    PORT="$DETECTED_PORT"
  fi
fi

DOMAIN="${REPLIT_DOMAINS:-localhost}"
DEV_URL="https://${DOMAIN}:${PORT}"

echo ""
echo "=== Mockup Sandbox Ready ==="
echo "pnpm: $(pnpm --version)"
echo "Dev URL: ${DEV_URL}"
echo "Preview URL pattern: ${DEV_URL}/preview/{folder}/{ComponentName}"
echo "Components dir: ${TARGET}/src/components/mockups/"
echo ""
echo "Next steps:"
echo "1. Create a workflow with isCanvasWorkflow: true"
echo "   configureWorkflow({ name: 'Mockup Sandbox', command: 'cd mockup && pnpm install && pnpm run dev', waitForPort: ${PORT}, outputType: 'webview', isCanvasWorkflow: true })"
echo "2. Create components in mockup/src/components/mockups/"
echo "3. Embed on canvas: ${DEV_URL}/preview/YourComponent"
