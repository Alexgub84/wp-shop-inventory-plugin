# WooCommerce Shop Inventory Plugin — Full Project Specification

> **Purpose:** A monorepo containing a WordPress/WooCommerce plugin (secured REST API for inventory data) and a Node.js router (WhatsApp bot that consumes the API). Together they enable shop owners to manage inventory via WhatsApp.

---

## Product Vision

- **MVP:** Single shop, single phone number. Plugin exposes list + create product endpoints. Router provides a menu-driven WhatsApp bot (no AI). Both projects in one repo.
- **Growth:** Plugin distributed to many WordPress/WooCommerce sites. Router becomes a multi-tenant service with phone verification, shop registry, and AI-powered conversation.
- **Premium:** Freemium model — basic features free, advanced features behind a paid tier (gated by the router, not the plugin).

---

## System Architecture

Two projects in a single monorepo:

- **Plugin (`plugin/`):** WordPress plugin that exposes WooCommerce data as a secured REST API. Has zero knowledge of WhatsApp, Green API, or message formatting.
- **Router (`router/`):** Node.js service that handles WhatsApp/Green API communication, command parsing, and message formatting. Calls the plugin API to get/modify data.

```
WhatsApp User <--> Green API <--> Router (Node.js) <--> Plugin (WordPress) <--> WooCommerce DB
```

See [architecture.md](architecture.md) for full system diagrams, message flows, and component responsibilities.

---

## Implementation Status

> Last updated: 2026-02-19

### Plugin

| Feature | Status | Notes |
|---------|--------|-------|
| Plugin scaffold (bootstrap, autoloader, composer) | Not started | |
| Auth token generation + storage | Not started | Plain text for MVP |
| Token auth middleware (Bearer validation) | Not started | |
| Health endpoint (GET /health) | Not started | Public |
| Products list endpoint (GET /products) | Not started | MVP |
| Create product endpoint (POST /products) | Not started | MVP |
| Single product endpoint (GET /products/{id}) | Not started | Post-MVP |
| Update product endpoint (PATCH /products/{id}) | Not started | Post-MVP |
| Low stock endpoint (GET /products/low-stock) | Not started | Future premium |
| Recent orders endpoint (GET /orders/recent) | Not started | Future premium |
| Register callback endpoint (POST /register-callback) | Not started | Post-MVP |
| Admin settings page | Not started | Post-MVP |
| Unit tests | Not started | |
| Integration tests | Not started | |

### Router

| Feature | Status | Notes |
|---------|--------|-------|
| Scaffold (package.json, tsconfig, vitest, dotenv) | Done | TypeScript + Fastify + Vitest |
| Core modules (config, logger, errors) | Done | Zod validation, Pino logging |
| SQLite DB setup (single-row config) | Done | MVP |
| Green API client (send message, mock sender) | Done | |
| Webhook handler (parse payload, route to commands) | Done | Zod schema validation |
| Plugin HTTP client (native fetch + Bearer) | Done | Injectable fetch for testing |
| Session manager (in-memory with expiry) | Done | |
| Formatter (data → WhatsApp text) | Done | Pure functions |
| Command handler (menu-based, no AI) | Done | MVP |
| List products action | Done | MVP |
| Add product action (multi-step) | Done | MVP |
| Server (Fastify) + App (DI wiring) | Done | Factory-function DI pattern |
| Unit tests (70 tests) | Done | Fake services via mocks/ |
| E2E tests (8 tests) | Done | Fastify inject |
| AI-powered conversation | Not started | Post-MVP |
| Multi-user phone registry | Not started | Post-MVP |
| Phone verification flow | Not started | Post-MVP |

---

## Core Entities

### Auth Token (Plugin)

- Generated on plugin activation via `wp_generate_password(48, true, true)`
- MVP: stored as plain text in `wp_options` (`wsi_auth_token`)
- Production: stored as hash in `wp_options` (`wsi_auth_token_hash`)
- Used by router to authenticate API requests

### Product (WooCommerce native)

- Accessed via `wc_get_products()` / `wc_get_product()`
- Fields exposed: `id`, `name`, `price`, `regular_price`, `sale_price`, `stock_quantity`, `stock_status`, `sku`, `status`, `description`, `short_description`, `categories`

### Plugin Settings (wp_options)

- `wsi_auth_token` — plain text Bearer token (MVP)
- `wsi_plugin_version` — for upgrade path

### Router Config (SQLite)

- `phone_number` — shop owner's WhatsApp number
- `shop_url` — WordPress site URL
- `auth_token` — Bearer token for plugin API

---

## Plugin API Endpoints

Base: `/wp-json/wsi/v1/`

### Public (no auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Plugin version, WooCommerce status, PHP version |

### Authenticated (Bearer token required)

| Method | Endpoint | Description | Phase |
|--------|----------|-------------|-------|
| GET | `/products` | List published products | MVP |
| POST | `/products` | Create new product | MVP |
| GET | `/products/{id}` | Single product details | Post-MVP |
| PATCH | `/products/{id}` | Update product fields | Post-MVP |
| GET | `/products/low-stock` | Products below threshold | Future premium |
| GET | `/orders/recent` | Recent orders summary | Future premium |
| POST | `/register-callback` | Router confirms registration | Post-MVP |

### Response Format

Success: JSON object or array with product data.
Error: `WP_Error` with appropriate HTTP status code.

```json
// GET /products
[
  {
    "id": 123,
    "name": "Widget",
    "sku": "WDG-001",
    "price": "19.99",
    "stock_quantity": 50,
    "stock_status": "instock",
    "status": "publish"
  }
]

// Error
{
  "code": "wsi_unauthorized",
  "message": "Invalid or missing authentication token.",
  "data": { "status": 401 }
}
```

### Status Codes

`200` OK, `201` Created, `400` Invalid input, `401` Unauthorized, `404` Not found, `500` Internal error.

---

## Stack

### Plugin

| Layer | Technology |
|-------|------------|
| Platform | WordPress 6.x + WooCommerce 8.x+ |
| Language | PHP 8.1+ |
| Autoloading | PSR-4 via Composer |
| Namespace | `WSI\` |
| Testing (unit) | PHPUnit + Brain Monkey + Mockery |
| Testing (integration) | PHPUnit + WordPress test suite (`WP_UnitTestCase`) |
| Linting | PHP CodeSniffer (WordPress standards) |
| Dependency versions | Pinned exactly (no `^` or `~`) |

### Router

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

## Monorepo File Structure

```
wp-shop-inventory-plugin/
├── plugin/                               # WordPress plugin
│   ├── wp-shop-inventory.php             # Bootstrap: plugin header, load autoloader, init
│   ├── uninstall.php                     # Cleanup wp_options on uninstall
│   ├── composer.json                     # Autoload (PSR-4), dev deps
│   ├── phpunit.xml                       # PHPUnit configuration
│   ├── .gitignore
│   ├── src/                              # PSR-4 root: WSI\ namespace
│   │   ├── Plugin.php                    # Main class: hooks, init, dependency wiring
│   │   ├── Activator.php                # On activation: generate token, store in options
│   │   ├── Deactivator.php              # On deactivation: cleanup transients
│   │   ├── Api/
│   │   │   ├── RestController.php        # Base: registers all routes on rest_api_init
│   │   │   ├── ProductsController.php    # GET/POST /products endpoints
│   │   │   └── HealthController.php      # GET /health endpoint
│   │   ├── Auth/
│   │   │   └── TokenAuth.php            # permission_callback: validate Bearer token
│   │   └── Services/
│   │       └── ProductService.php        # Wraps wc_get_products(), product creation
│   └── tests/
│       ├── bootstrap.php                 # Test bootstrap (Brain Monkey setup)
│       ├── Unit/
│       └── Integration/
│
├── router/                               # Node.js router service
│   ├── package.json
│   ├── .env.example
│   ├── src/
│   │   ├── index.js                      # Express server, webhook listener
│   │   ├── config.js                     # Load/validate env vars
│   │   ├── greenApi.js                   # Green API client
│   │   ├── commands.js                   # Command parser and router
│   │   ├── actions/
│   │   │   ├── listProducts.js           # Fetch + format products
│   │   │   └── addProduct.js             # Multi-step product creation
│   │   ├── pluginClient.js              # HTTP client for plugin API
│   │   ├── formatter.js                  # Data → WhatsApp message formatting
│   │   ├── db.js                         # SQLite setup and queries
│   │   └── session.js                    # In-memory conversation state
│   └── tests/
│       └── unit/
│
├── docs/                                 # Shared project documentation
│   ├── full-project-spec.md
│   ├── mvp-spec.md
│   ├── architecture.md
│   ├── workflow-rules.md
│   ├── testing-strategy.md
│   └── dev-lessons.md
├── .cursor/
│   └── rules/
│       ├── workflow.mdc
│       └── testing.mdc
└── .gitignore
```

### Plugin Namespace Mapping

```
WSI\                    → plugin/src/
WSI\Admin\              → plugin/src/Admin/
WSI\Api\                → plugin/src/Api/
WSI\Auth\               → plugin/src/Auth/
WSI\Services\           → plugin/src/Services/
```

---

## Security Requirements (Plugin)

- Every PHP file: `defined('ABSPATH') || exit;`
- REST input: sanitized via `sanitize_text_field()`, `absint()`, etc.
- Admin output: escaped via `esc_html()`, `esc_attr()`, `esc_url()`
- Admin forms: nonce protection via `wp_nonce_field()` / `wp_verify_nonce()`
- REST routes: `permission_callback` on every endpoint
- Database: `$wpdb->prepare()` for any direct queries
- Token: generated securely, stored as hash (production), never logged
- All options/hooks prefixed with `wsi_`
- Admin pages gated behind `manage_woocommerce` capability
- All user-facing strings wrapped in `__('text', 'wp-shop-inventory')`

---

## Testing Requirements

### Plugin
- Unit tests for every class (TokenAuth, ProductsController, ProductService, HealthController)
- Integration tests for REST API request/response cycle
- Tests required BEFORE marking any feature as done
- Coverage: happy path, validation errors, auth failures, edge cases

### Router
- Unit tests for command parser, formatter, plugin client
- Mock axios for plugin API calls in tests
- Mock Green API in tests

See [testing-strategy.md](testing-strategy.md) for full patterns and examples.

---

## Roadmap (Post-MVP)

1. GET /products/{id} — single product details
2. PATCH /products/{id} — update existing products
3. Admin settings page (token display, connection status, HTTPS warning)
4. AI-powered conversation (replace menu with NLP)
5. Multi-user phone registry + phone verification
6. Router registration callback (plugin knows it's connected)
7. Low stock alerts (hook WooCommerce stock change → notify router)
8. GET /products/low-stock — low stock query endpoint
9. GET /orders/recent — order summary endpoint
10. Weekly/daily inventory reports (router-driven)
11. Premium/free tier gating
12. Multiple phones per shop (router manages roles)
