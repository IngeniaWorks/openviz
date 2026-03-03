#!/usr/bin/env bash
set -euo pipefail

cd /workspace

if [ ! -d node_modules ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
  echo "[container] Installing npm dependencies..."
  npm install
fi

echo "[container] Running setup in container mode..."
npm run setup:container

echo "[container] Starting development server..."
npm run dev
