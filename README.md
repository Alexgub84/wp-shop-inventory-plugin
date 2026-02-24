# WooCommerce Shop Inventory — WhatsApp Bot

Manage your WooCommerce store inventory through WhatsApp. A monorepo with two components: a WordPress plugin that exposes shop data as a secured REST API, and a Node.js service that provides a WhatsApp bot interface via Green API.

```
WhatsApp User <──> Green API <──> Router (Node.js) <──> Plugin (WordPress) <──> WooCommerce DB
```

## How It Works

1. Shop owner installs the WordPress plugin on their WooCommerce site
2. Plugin generates a secure auth token and exposes product data via REST API
3. Router service connects to WhatsApp via Green API and to the plugin via the token
4. Shop owner manages inventory by chatting with the WhatsApp bot

## Monorepo Structure

```
├── plugin/     WordPress/WooCommerce plugin (PHP) — secured REST API
├── router/     Node.js service (TypeScript, Fastify) — WhatsApp bot
├── e2e/        End-to-end tests (Docker)
└── docs/       Shared documentation
```

## Plugin — REST API

Exposes WooCommerce data under `/wp-json/wsi/v1/`. Authenticates requests with a Bearer token.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | No | Plugin status, WooCommerce check |
| GET | `/products` | Yes | List published products |
| POST | `/products` | Yes | Create a new product |

**Stack:** PHP 8.1+, WordPress 6.x, WooCommerce 8.x+, PSR-4 via Composer

```bash
cd plugin && composer install
```

## Router — WhatsApp Bot

Menu-driven WhatsApp bot. Receives messages via Green API webhooks, calls the plugin API, and sends formatted responses.

| Command | Action |
|---------|--------|
| `1` / `list` | List all products with prices and stock |
| `2` / `add` | Add a new product (multi-step conversation) |
| `3` / `help` | Show command menu |

**Stack:** Node.js 20+, TypeScript, Fastify 5, SQLite, Zod, Pino, Vitest

```bash
cd router && npm install && cp .env.example .env
```

## Getting Started

### Prerequisites

- PHP 8.1+ with Composer
- Node.js 20+ with npm
- A WordPress site with WooCommerce installed
- A Green API account for WhatsApp integration

### Setup

1. **Plugin** — Install and activate on your WordPress site. Copy the generated auth token from the activation log.

2. **Router** — Configure `.env` with your shop URL, auth token, and Green API credentials:

```env
PHONE_NUMBER=972501234567
SHOP_URL=https://your-shop.com
AUTH_TOKEN=<token-from-plugin>
GREEN_API_INSTANCE=<your-instance-id>
GREEN_API_TOKEN=<your-green-api-token>
PORT=3000
```

3. **Start the router:**

```bash
cd router && npm run dev
```

## Testing

```bash
# All tests from root
make test

# Plugin only
cd plugin && composer test:unit           # Unit tests (fast, no WordPress)
cd plugin && composer test:integration    # Integration tests (Docker MySQL)
cd plugin && composer test:run            # Lint + all tests

# Router only
cd router && npm test                     # Unit + E2E tests
```

## Documentation

Detailed docs live in the `docs/` folder:

- [Full Project Spec](docs/full-project-spec.md) — product requirements, entities, API, implementation status
- [MVP Spec](docs/mvp-spec.md) — MVP scope, decisions, implementation checklist
- [Architecture](docs/architecture.md) — system design, message flows, decisions
- [Workflow Rules](docs/workflow-rules.md) — git workflow, code standards, security
- [Testing Strategy](docs/testing-strategy.md) — three-tier testing, patterns, commands
- [Dev Lessons](docs/dev-lessons.md) — bug log, lessons learned

## Current Status

**MVP: Complete.** Both the plugin and router are fully implemented and tested.

See the [implementation status](docs/full-project-spec.md#implementation-status) for details.

## Roadmap

- Single product details and updates (`GET/PATCH /products/{id}`)
- Admin settings page (token display, connection status)
- AI-powered natural language commands
- Multi-user phone registry with verification
- Low stock alerts and order notifications
- Premium/free tier gating

## License

Proprietary. All rights reserved.
