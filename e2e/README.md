# End-to-End Tests

System-level tests that spin up both the WordPress plugin and the router service via Docker, then test the full flow.

## What This Tests

- Full message flow: simulated WhatsApp webhook → router → plugin REST API → WooCommerce → response
- Authentication between router and plugin (Bearer token)
- Product CRUD through the full stack (add product via multi-step conversation, list products)
- Health endpoints for both services
- Error handling: unregistered phone numbers, invalid payloads, auth failures

## Architecture

Docker Compose boots four services:

1. **MySQL 8.0** — database for WordPress (tmpfs for speed)
2. **WordPress** — Apache + PHP with the plugin mounted as a volume
3. **wp-setup** — One-shot WP-CLI container that installs WordPress core, WooCommerce, activates the plugin, and sets a known auth token
4. **Router** — Built from `router/Dockerfile`, configured to talk to the WordPress container with mock Green API (no real WhatsApp calls)

Tests run on the host machine using vitest, making real HTTP requests to both the router (`localhost:3000`) and the plugin (`localhost:8080`).

## Prerequisites

- Docker and Docker Compose v2
- Node.js 20+
- Composer (for plugin autoloader, if `plugin/vendor/` doesn't exist)
- Ports 3000 and 8080 available

## Running

### Full automated run (recommended)

```bash
cd e2e
bash run.sh
```

This script:
1. Installs plugin Composer deps if needed
2. Installs test Node.js deps if needed
3. Starts all Docker services
4. Waits for services to be ready (up to 180s)
5. Runs the vitest suite
6. Tears down Docker on exit (success or failure)

### Manual run

```bash
cd e2e
npm install
docker compose up -d --build

# Wait for services, then:
npx vitest run

# Cleanup:
docker compose down -v --remove-orphans
```

### From repo root

```bash
make test-e2e
```

## Environment Variables

Tests accept optional overrides:

| Variable | Default | Description |
|----------|---------|-------------|
| `ROUTER_URL` | `http://localhost:3000` | Router base URL |
| `PLUGIN_URL` | `http://localhost:8080` | WordPress base URL |

## Ports Used

| Port | Service |
|------|---------|
| 3000 | Router |
| 8080 | WordPress |
| (internal) | MySQL 3306 |
