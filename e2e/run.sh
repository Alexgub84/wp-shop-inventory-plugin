#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

cleanup() {
  echo ""
  echo "Tearing down..."
  docker compose down -v --remove-orphans 2>/dev/null || true
}

trap cleanup EXIT

if ! command -v docker &> /dev/null; then
  echo "ERROR: Docker is not installed."
  exit 1
fi

if [ ! -d "../plugin/vendor" ]; then
  echo "Installing plugin Composer dependencies..."
  (cd ../plugin && composer install --no-interaction --quiet)
fi

if [ ! -d "node_modules" ]; then
  echo "Installing E2E test dependencies..."
  npm install --no-fund --no-audit
fi

echo "Starting E2E environment..."
docker compose down -v --remove-orphans 2>/dev/null || true
docker compose up -d --build

TIMEOUT=180
ELAPSED=0
echo "Waiting for services to be ready..."
while [ $ELAPSED -lt $TIMEOUT ]; do
  ROUTER_OK="no"
  PLUGIN_OK="no"
  curl -sf http://localhost:3000/health > /dev/null 2>&1 && ROUTER_OK="yes"
  curl -sf http://localhost:8080/wp-json/wsi/v1/health > /dev/null 2>&1 && PLUGIN_OK="yes"

  if [ "$ROUTER_OK" = "yes" ] && [ "$PLUGIN_OK" = "yes" ]; then
    echo "All services ready!"
    break
  fi

  sleep 5
  ELAPSED=$((ELAPSED + 5))
  echo "  Waiting... ${ELAPSED}/${TIMEOUT}s (router=${ROUTER_OK}, plugin=${PLUGIN_OK})"
done

if [ $ELAPSED -ge $TIMEOUT ]; then
  echo "ERROR: Services failed to start within ${TIMEOUT}s"
  echo ""
  echo "--- Docker Compose Logs ---"
  docker compose logs --tail=50
  exit 1
fi

echo ""
echo "Running E2E tests..."
npx vitest run
