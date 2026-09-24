#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if ! command -v docker >/dev/null 2>&1; then
  echo "[dev] Docker is required. Start Docker Desktop and try again."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "[dev] Docker is not running. Start Docker Desktop and try again."
  exit 1
fi

echo "[dev] Starting PostgreSQL and Redis..."
if [[ -f .env.docker ]]; then
  docker compose --env-file .env.docker up -d --wait postgres redis
  export DATABASE_URL="${DATABASE_URL:-postgres://openviz:openviz@localhost:5434/openviz}"
  export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
else
  docker compose up -d --wait postgres redis
fi

echo "[dev] Starting Next.js and the collaboration WebSocket server..."

cleanup() {
  trap - INT TERM EXIT
  [[ -n "${NEXT_PID:-}" ]] && kill "$NEXT_PID" 2>/dev/null || true
  [[ -n "${COLLAB_PID:-}" ]] && kill "$COLLAB_PID" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

NODE_OPTIONS='--max-old-space-size=8192' pnpm exec next dev &
NEXT_PID=$!

pnpm exec tsx server/collab/index.ts &
COLLAB_PID=$!

while kill -0 "$NEXT_PID" 2>/dev/null && kill -0 "$COLLAB_PID" 2>/dev/null; do
  sleep 1
done

if ! kill -0 "$NEXT_PID" 2>/dev/null; then
  wait "$NEXT_PID"
  exit $?
fi

wait "$COLLAB_PID"
exit $?