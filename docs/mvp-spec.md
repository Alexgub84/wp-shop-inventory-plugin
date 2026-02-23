# MVP Specification

> Scope: A monorepo containing two projects — the WordPress plugin (data API) and the Node.js router (WhatsApp bot). MVP targets a single shop owner with one phone number, two product actions, and a menu-driven bot with no AI.

---

## Monorepo Structure

Both projects live in a single repository. Shared docs and config at the root.

```
wp-shop-inventory-plugin/
├── plugin/                           # WordPress plugin (PHP)
│   ├── wp-shop-inventory.php         # Bootstrap: plugin header, autoloader, init
│   ├── uninstall.php                 # Cleanup wp_options on uninstall
│   ├── composer.json                 # PSR-4 autoload, dev deps
│   ├── phpunit.xml
│   ├── src/
│   │   ├── Plugin.php                # Main class: hooks, init, DI wiring
│   │   ├── Activator.php            # Generate token on activation
│   │   ├── Deactivator.php          # Cleanup transients on deactivation
│   │   ├── Api/
│   │   │   ├── RestController.php    # Registers all routes on rest_api_init
│   │   │   ├── ProductsController.php # GET /products, POST /products
│   │   │   └── HealthController.php  # GET /health
│   │   ├── Auth/
│   │   │   └── TokenAuth.php         # Bearer token permission_callback
│   │   └── Services/
│   │       └── ProductService.php    # Wraps wc_get_products(), product creation
│   └── tests/
│       ├── bootstrap.php
│       ├── Unit/
│       └── Integration/
│
├── router/                           # Node.js router service (TypeScript)
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── .env.example                  # Environment template
│   ├── src/
│   │   ├── index.ts                  # Entry point: loads dotenv, starts Fastify server
│   │   ├── app.ts                    # DI wiring: creates all deps, returns { server, deps }
│   │   ├── config.ts                 # Zod-validated config from env vars
│   │   ├── logger.ts                 # Pino logger + createNoopLogger() for DI
│   │   ├── errors.ts                 # Custom error classes (ConfigError, PluginApiError, etc.)
│   │   ├── server.ts                 # Fastify with GET /health and POST /webhook
│   │   ├── formatter.ts              # Pure functions: format products, menu, prompts
│   │   ├── db.ts                     # SQLite setup, config table, seed from env
│   │   ├── greenapi/
│   │   │   └── sender.ts            # GreenApiSender interface, real + mock implementations
│   │   ├── webhook/
│   │   │   ├── handler.ts           # Parse payload, route to command handler, send response
│   │   │   └── types.ts             # Zod schema for Green API webhook payload
│   │   ├── plugin/
│   │   │   ├── client.ts            # PluginClient: fetch with Bearer auth (injectable fetch)
│   │   │   └── types.ts             # Product, CreateProductInput, PluginClient interface
│   │   ├── commands/
│   │   │   ├── handler.ts           # CommandHandler: routes input to actions
│   │   │   ├── listProducts.ts      # Fetch products from plugin, format for WhatsApp
│   │   │   └── addProduct.ts        # Multi-step product creation (name → price → stock)
│   │   └── session/
│   │       ├── manager.ts           # In-memory session Map with expiry
│   │       └── types.ts             # Session, AddProductStep, SessionManager interface
│   └── tests/
│       ├── mocks/
│       │   ├── greenapi.ts          # Mock sender, logger, payload factories
│       │   └── plugin.ts            # Mock plugin client, product factory
│       ├── unit/                     # Unit tests (mocked deps)
│       └── e2e/                      # E2E tests (Fastify inject)
│
├── docs/                             # Shared project documentation
│   ├── full-project-spec.md
│   ├── mvp-spec.md                   # This file
│   ├── architecture.md
│   ├── workflow-rules.md
│   ├── testing-strategy.md
│   └── dev-lessons.md
├── .cursor/
│   └── rules/
└── .gitignore
```

---

## MVP Scope

### What's IN

| Component | Feature | Details |
|-----------|---------|---------|
| Plugin | Scaffold | Bootstrap, composer.json, autoloader, activation hooks |
| Plugin | Auth token | Generate on activation, store plain text (MVP), validate Bearer |
| Plugin | GET /health | Public. Plugin version, WooCommerce status, PHP version |
| Plugin | GET /products | Auth required. List all published products |
| Plugin | POST /products | Auth required. Create a new product (name, price, stock) |
| Plugin | Unit tests | TokenAuth, ProductsController, ProductService, HealthController |
| Router | Green API integration | Receive webhooks, send messages |
| Router | Single-number config | One phone number, one shop URL, one token in SQLite |
| Router | Command menu (no AI) | Menu-driven: list products, add product, help |
| Router | List products action | Call plugin API, format response for WhatsApp |
| Router | Add product action | Multi-step conversation: collect name, price, stock, then POST |
| Router | Unit tests | Command parsing, formatter, plugin client |

### What's NOT in MVP

- GET /products/{id} (single product details)
- PATCH /products/{id} (update product)
- Low stock alerts or queries
- Order endpoints
- AI/NLP command parsing (menu only)
- Multiple phone numbers or shops
- Phone verification flow
- Premium/free tier gating
- Admin settings page (token displayed in CLI/logs on activation)
- Router registration callback
- Docker E2E tests
- CI/CD pipeline
- HTTPS enforcement

---

## MVP Implementation Checklist

| # | Component | Task | Status |
|---|-----------|------|--------|
| 1 | Docs | Create all project docs (spec, architecture, rules) | Done |
| 2 | Plugin | Scaffold (bootstrap, composer.json, .gitignore, uninstall.php) | Done |
| 3 | Plugin | Activator: generate auth token on activation | Done |
| 4 | Plugin | TokenAuth: validate Bearer token (permission_callback) | Done |
| 5 | Plugin | HealthController: GET /wsi/v1/health | Done |
| 6 | Plugin | ProductService: wrap wc_get_products(), product creation | Done |
| 7 | Plugin | ProductsController: GET /products | Done |
| 8 | Plugin | ProductsController: POST /products | Done |
| 9 | Plugin | Unit tests for all plugin classes | Done |
| 10 | Router | Scaffold (package.json, tsconfig, vitest, .env.example) | Done |
| 11 | Router | Core modules (config, logger, errors) | Done |
| 12 | Router | SQLite setup: single-row config (phone, shop_url, token) | Done |
| 13 | Router | Green API client (send message, mock sender) | Done |
| 14 | Router | Webhook handler (parse payload, route to commands) | Done |
| 15 | Router | Plugin HTTP client (native fetch, Bearer auth) | Done |
| 16 | Router | Session manager (in-memory with expiry) | Done |
| 17 | Router | Formatter (product list, menu, prompts) | Done |
| 18 | Router | Command handler + list/add product actions | Done |
| 19 | Router | Server (Fastify) + App (DI wiring) + Entry point | Done |
| 20 | Router | Unit tests (config, commands, formatter, plugin-client, session, webhook) | Done |
| 21 | Router | E2E tests (full Fastify inject flow) | Done |

---

## Plugin API Contract (MVP)

### GET /wsi/v1/health (public)

Response `200`:
```json
{
  "status": "ok",
  "woocommerce": true,
  "plugin_version": "0.1.0",
  "php_version": "8.1.0"
}
```

### GET /wsi/v1/products (auth required)

Response `200`:
```json
[
  {
    "id": 123,
    "name": "Widget",
    "sku": "WDG-001",
    "price": "19.99",
    "regular_price": "19.99",
    "sale_price": "",
    "stock_quantity": 50,
    "stock_status": "instock",
    "status": "publish",
    "categories": ["Electronics"]
  }
]
```

### POST /wsi/v1/products (auth required)

Request body:
```json
{
  "name": "New Widget",
  "regular_price": "29.99",
  "stock_quantity": 100,
  "description": "A new widget",
  "sku": "NW-001"
}
```

Response `201`:
```json
{
  "id": 456,
  "name": "New Widget",
  "sku": "NW-001",
  "price": "29.99",
  "stock_quantity": 100,
  "status": "publish"
}
```

Response `400` (validation error):
```json
{
  "code": "wsi_invalid_product",
  "message": "Product name is required.",
  "data": { "status": 400 }
}
```

### All Authenticated Endpoints — Error Responses

`401` (missing or invalid token):
```json
{
  "code": "wsi_unauthorized",
  "message": "Invalid or missing authentication token.",
  "data": { "status": 401 }
}
```

---

## Router Bot Flow (MVP)

### Command Menu

The bot uses a fixed menu. No AI, no NLP. User sends a number or keyword.

```
Welcome to Shop Inventory Bot!

Choose an option:
1. List products
2. Add product
3. Help

Reply with the number of your choice.
```

### Command Mapping

| Input | Action | Description |
|-------|--------|-------------|
| `1`, `list`, `products` | listProducts | Fetch and display all products |
| `2`, `add`, `new` | addProduct | Start multi-step add product flow |
| `3`, `help`, `menu` | showMenu | Show the command menu again |
| anything else | showMenu | Unrecognized input, show menu with hint |

### List Products Flow

1. User sends `1`
2. Router calls `GET /wsi/v1/products` with Bearer token
3. Router formats response:

```
📦 Your Products (3):

1. Widget — ₪19.99 — Stock: 50
2. Gadget — ₪29.99 — Stock: 12
3. Doohickey — ₪9.99 — Stock: 0 ⚠️

Reply 1-3 for options, or "menu" for main menu.
```

4. If no products: "No products found. Send 2 to add your first product."

### Add Product Flow (Multi-Step)

Uses in-memory session state. Each step waits for a response.

```
Step 1: "What is the product name?"
        User: "Blue Widget"

Step 2: "What is the price?"
        User: "29.99"

Step 3: "How many in stock?"
        User: "50"

Step 4: Router sends POST /products with { name, regular_price, stock_quantity }

Success: "✅ Product created! Blue Widget — ₪29.99 — Stock: 50"
Error:   "❌ Failed to create product: [error message]. Try again? Send 2."
```

Session timeout: 5 minutes of inactivity → clear session, send "Session expired. Send 'menu' to start over."

---

## Router Database (MVP)

SQLite with a single table. One row for MVP.

### Table: `config`

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Always 1 for MVP |
| phone_number | TEXT NOT NULL | Shop owner's WhatsApp number (with country code) |
| shop_url | TEXT NOT NULL | WordPress site URL (e.g. `https://my-shop.com`) |
| auth_token | TEXT NOT NULL | Bearer token for plugin API |
| created_at | TEXT NOT NULL | ISO timestamp |

### Initial Setup

On first run, the router reads from `.env`:

```env
PHONE_NUMBER=972501234567
SHOP_URL=https://my-shop.com
AUTH_TOKEN=the-plugin-token
GREEN_API_INSTANCE=1234567890
GREEN_API_TOKEN=abc123...
PORT=3000
```

The router inserts these into the `config` table on startup if empty. All subsequent reads come from the DB.

---

## Router Tech Stack (MVP)

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20+ |
| Language | TypeScript (ES modules) |
| Framework | Fastify 5.x |
| HTTP client | Native fetch (injectable for testing) |
| Database | SQLite (via better-sqlite3) |
| Config validation | Zod |
| Logging | Pino (structured, with noop logger for DI) |
| Environment | dotenv |
| Testing | Vitest |
| Linting | TypeScript strict mode (`tsc --noEmit`) |

---

## MVP Decisions (Simplified for Speed)

| Decision | MVP Choice | Future/Production Choice |
|----------|------------|--------------------------|
| Repo structure | Monorepo (plugin/ + router/) | Possibly split later |
| Token storage (plugin) | Plain text in wp_options | Hashed (wp_hash_password) |
| HTTPS enforcement | Skip | Soft warning banner |
| Rate limiting | Skip | Transient-based per IP |
| Custom DB tables (plugin) | None (wp_options only) | None |
| Connection status | Manual / skip | Router callback |
| Bot intelligence | Fixed menu, keyword matching | AI-powered NLP |
| Number of users | Single phone number | Multi-user registry |
| Phone verification | Skip | Code-based verification flow |
| Admin settings page | Skip (token in logs) | Full WP settings page |
| Router DB | SQLite | PostgreSQL or MySQL |
| Session state | In-memory (Map) | Redis or DB-backed |

---

## Build Order (Recommended)

Phase 1 — Plugin (standalone, testable without router):
1. Scaffold plugin (tasks 2-3)
2. Auth middleware (task 4)
3. Health endpoint (task 5)
4. Product service + endpoints (tasks 6-8)
5. Plugin unit tests (task 9)

Phase 2 — Router (depends on working plugin API):
1. Scaffold router (task 10)
2. DB + config setup (task 11)
3. Plugin HTTP client (task 17)
4. Green API client (task 12)
5. Command handler + actions (tasks 13-16)
6. Router unit tests (task 18)

Phase 3 — Integration:
1. Connect router to live plugin on a WooCommerce site
2. Test full flow via WhatsApp
