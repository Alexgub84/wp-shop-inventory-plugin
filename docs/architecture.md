# WooCommerce Shop Inventory — Full Architecture Plan

## System Architecture

Monorepo with two projects:

- **Plugin (`plugin/`):** WordPress plugin that exposes WooCommerce data as a secured REST API. Has zero knowledge of WhatsApp, Green API, or message formatting.
- **Router (`router/`):** Node.js service that handles all WhatsApp/Green API communication, command parsing, and message formatting. Calls the plugin REST API.

```
WhatsApp User <--> Green API <--> Router (Node.js) <--> Plugin (WordPress) <--> WooCommerce DB
```

### Component Responsibilities

**Plugin — "Data API"**

- Exposes WooCommerce data via secured REST API endpoints
- Authenticates requests using a Bearer token
- Has ZERO knowledge of WhatsApp, Green API, message formatting, or users
- MVP endpoints: GET /products, POST /products, GET /health

**Router — "WhatsApp Bot"**

- Connects to Green API (incoming webhooks + outgoing messages)
- Parses user commands via fixed menu (no AI in MVP)
- Calls plugin REST APIs to get/modify shop data
- Formats data for WhatsApp messages
- Manages conversation state for multi-step flows (add product)
- MVP: single phone number, single shop, SQLite config

---

## Message Flow

### Incoming — List Products

1. Shop owner sends `1` via WhatsApp
2. Green API forwards webhook to Router
3. Router reads config from SQLite (shop URL + token)
4. Router calls `GET /wsi/v1/products` on the plugin with Bearer token
5. Plugin validates token, queries WooCommerce
6. Plugin responds with JSON product array
7. Router formats data for WhatsApp (numbered list with prices and stock)
8. Router sends formatted message via Green API
9. Shop owner receives product list

### Incoming — Add Product (Multi-Step)

1. Shop owner sends `2` via WhatsApp
2. Router creates an in-memory session for this phone number
3. Router asks "What is the product name?" → sends via Green API
4. Shop owner replies "Blue Widget"
5. Router stores name in session, asks "What is the price?"
6. Shop owner replies "29.99"
7. Router stores price in session, asks "How many in stock?"
8. Shop owner replies "50"
9. Router calls `POST /wsi/v1/products` with `{ name, regular_price, stock_quantity }`
10. Plugin validates input, creates WooCommerce product, responds with product data
11. Router formats confirmation, sends via Green API
12. Router clears session

### Session Timeout

- If no response for 5 minutes, session is cleared
- Router sends "Session expired. Send 'menu' to start over."

---

## Registration Flow (MVP — Manual)

No automated registration in MVP. Manual setup:

1. Shop owner installs and activates the plugin on their WordPress site
2. Plugin generates a unique auth token, outputs it to the activation log
3. Shop owner copies the token and their site URL
4. Shop owner (or developer) sets `.env` on the router:
   - `PHONE_NUMBER`, `SHOP_URL`, `AUTH_TOKEN`
5. Router starts, inserts config into SQLite
6. Router calls `GET /health` on the plugin to verify connectivity
7. System is ready

### Registration Flow (Future — Automated)

1. Plugin generates token, displays in admin settings page
2. Shop owner registers via WhatsApp bot or web UI: provides phone, shop URL, token
3. Router calls `GET /health` to verify plugin is reachable
4. Router stores mapping in DB: phone → shop URL + hashed token
5. Router calls `POST /wsi/v1/register-callback` to confirm
6. Plugin settings page shows "Connected"

---

## Plugin REST API Endpoints

All under `/wp-json/wsi/v1/`. Authentication via `Authorization: Bearer {token}` header.

### Public (no auth)

- `GET /health` — plugin version, WooCommerce status, PHP version

### Authenticated (token required)

**MVP:**
- `GET /products` — list published products (name, price, stock, SKU, ID)
- `POST /products` — create a new product (name, price, stock, description)

**Post-MVP:**
- `GET /products/{id}` — single product full details
- `PATCH /products/{id}` — update product fields (price, stock, status)
- `GET /products/low-stock?threshold=5` — products below stock level (future premium)
- `GET /orders/recent?limit=10` — recent orders summary (future premium)
- `POST /register-callback` — called by router to confirm registration

---

## Router Architecture (MVP)

### Entry Point (`index.js`)

- Express server on configurable port
- Single webhook endpoint: `POST /webhook` — receives Green API messages
- On startup: load config from SQLite, verify plugin connectivity via GET /health

### Command Flow

```
Webhook POST → Extract message text + sender phone
            → Check if active session exists for phone
            → If yes: route to session handler (multi-step flow)
            → If no: parse command from message text
            → Route to action handler
            → Action calls plugin API if needed
            → Format response
            → Send via Green API
```

### Session Management

In-memory `Map<phoneNumber, SessionState>`:

```
SessionState {
  action: "addProduct",
  step: 2,
  data: { name: "Blue Widget", price: "29.99" },
  updatedAt: timestamp
}
```

Cleanup: sweep every 60 seconds, remove sessions older than 5 minutes.

---

## Monorepo File Structure

```
wp-shop-inventory-plugin/
├── plugin/                           # WordPress plugin (PHP)
│   ├── wp-shop-inventory.php
│   ├── uninstall.php
│   ├── composer.json
│   ├── phpunit.xml
│   ├── src/
│   │   ├── Plugin.php
│   │   ├── Activator.php
│   │   ├── Deactivator.php
│   │   ├── Api/
│   │   │   ├── RestController.php
│   │   │   ├── ProductsController.php
│   │   │   └── HealthController.php
│   │   ├── Auth/
│   │   │   └── TokenAuth.php
│   │   └── Services/
│   │       └── ProductService.php
│   └── tests/
│       ├── bootstrap.php
│       ├── Unit/
│       └── Integration/
│
├── router/                           # Node.js router (TypeScript)
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── .env.example
│   ├── src/
│   │   ├── index.ts                  # Entry point
│   │   ├── app.ts                    # DI wiring
│   │   ├── config.ts                 # Zod-validated config
│   │   ├── logger.ts                 # Pino + noop logger
│   │   ├── errors.ts                 # Custom error classes
│   │   ├── server.ts                 # Fastify routes
│   │   ├── formatter.ts              # Pure formatting functions
│   │   ├── db.ts                     # SQLite config table
│   │   ├── greenapi/
│   │   │   └── sender.ts            # GreenApiSender (real + mock)
│   │   ├── webhook/
│   │   │   ├── handler.ts           # Webhook processing
│   │   │   └── types.ts             # Zod payload schema
│   │   ├── plugin/
│   │   │   ├── client.ts            # PluginClient (fetch + Bearer)
│   │   │   └── types.ts             # Plugin API types
│   │   ├── commands/
│   │   │   ├── handler.ts           # Command router
│   │   │   ├── listProducts.ts
│   │   │   └── addProduct.ts
│   │   └── session/
│   │       ├── manager.ts           # In-memory session Map
│   │       └── types.ts
│   └── tests/
│       ├── mocks/                    # Fake services for testing
│       ├── unit/
│       └── e2e/
│
├── docs/
└── .cursor/
```

### Plugin Namespace Mapping

```
WSI\                    → plugin/src/
WSI\Api\                → plugin/src/Api/
WSI\Auth\               → plugin/src/Auth/
WSI\Services\           → plugin/src/Services/
```

---

## Decisions and Considerations

### Decision 1: Monorepo vs separate repos

**Options:**

- **A) Monorepo (chosen for MVP):** Both projects in one repo. Simpler to manage during early development. Shared docs. Single PR for cross-cutting changes.
- **B) Separate repos:** Plugin and router each have their own repo. Better for distribution (plugin packaged separately). Better for different deployment cycles.

**Decision:** Option A for MVP. The plugin will need to be extractable to its own repo later for distribution to WordPress sites. Keep the `plugin/` directory self-contained (its own composer.json, its own tests) so extraction is trivial.

---

### Decision 2: Auth token storage — plain text vs hashed

**Options:**

- **A) Store hash only (most secure):** Use `wp_hash_password()`. Token displayed ONCE. Router sends token, plugin hashes and compares.
- **B) Store plain text (simplest):** Token visible in DB to anyone with DB access.

**Decision:** Option B for MVP (speed). Switch to Option A for production. The MVP is a dev environment with a single shop.

---

### Decision 3: Bot intelligence — AI vs fixed menu

**Options:**

- **A) AI-powered NLP:** Use OpenAI or similar to parse natural language commands. Flexible but adds cost, latency, and complexity.
- **B) Fixed menu with keyword matching (chosen for MVP):** User picks from a numbered menu. Router matches exact keywords. Zero external dependencies.

**Decision:** Option B for MVP. No AI, no NLP. Simple numbered menu. Can add AI layer later without changing the plugin at all (only the router changes).

---

### Decision 4: Router database — SQLite vs PostgreSQL vs config file

**Options:**

- **A) SQLite (chosen for MVP):** File-based, zero setup, works locally. Single-row config table.
- **B) PostgreSQL/MySQL:** Production-grade but overkill for single-row config.
- **C) Plain .env file only:** Simplest, but no runtime updates possible.

**Decision:** Option A. SQLite gives us a real DB interface that scales to multi-user later without changing the query layer. For MVP it's just one row.

---

### Decision 5: HTTPS enforcement

**Options:**

- **A) Hard block:** Plugin refuses to serve authenticated endpoints over HTTP.
- **B) Soft warning:** Plugin works over HTTP but shows admin warning.
- **C) Ignore for MVP.**

**Decision:** Option C for MVP. Most WooCommerce shops already use HTTPS. Add soft warning post-MVP.

---

### Decision 6: Rate limiting

**Options:**

- **A) Transient-based rate limiter per IP.**
- **B) Skip for MVP.**

**Decision:** Option B. Token requirement blocks casual abuse. Only the router calls the API.

---

## Security Checklist (WordPress Best Practices)

These MUST be implemented in every plugin file and endpoint:

- [ ] **Direct access prevention:** Every PHP file starts with `defined('ABSPATH') || exit;`
- [ ] **Input sanitization:** All REST input through `sanitize_text_field()`, `absint()`, etc.
- [ ] **Output escaping:** All admin HTML through `esc_html()`, `esc_attr()`, `esc_url()`
- [ ] **Nonces on admin forms:** Settings page uses `wp_nonce_field()` / `wp_verify_nonce()`
- [ ] **Permission callbacks:** Every `register_rest_route()` has a `permission_callback`
- [ ] **Prepared SQL:** Any direct `$wpdb` calls use `$wpdb->prepare()`
- [ ] **WP_Error responses:** All API errors return `WP_Error` objects with proper HTTP status codes
- [ ] **No hardcoded secrets:** Token generated via `wp_generate_password(48, true, true)`
- [ ] **Prefix everything:** All options use `wsi_` prefix, all hooks use `wsi_` prefix
- [ ] **i18n ready:** All user-facing strings wrapped in `__('text', 'wp-shop-inventory')`
- [ ] **Capability checks:** Admin pages gated behind `manage_woocommerce` capability

---

## Data Stored

### Plugin — wp_options (no custom tables)

- `wsi_auth_token` — plain text auth token (MVP) / `wsi_auth_token_hash` (production)
- `wsi_plugin_version` — for upgrade migrations

### Router — SQLite

**Table: `config`** (single row for MVP)

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Always 1 |
| phone_number | TEXT NOT NULL | Shop owner's WhatsApp number |
| shop_url | TEXT NOT NULL | WordPress site URL |
| auth_token | TEXT NOT NULL | Bearer token for plugin API |
| created_at | TEXT NOT NULL | ISO timestamp |

**Future tables (post-MVP):**

- `shops`: shop_id, shop_url, auth_token_hash, registered_at, is_active
- `users`: phone_number, shop_id, role, verified_at, is_active
- `verification_codes`: phone_number, code, expires_at, used

---

## Future Premium Features (architecture supports, not in MVP)

- AI-powered natural language commands
- Multi-user phone registry with roles
- Phone verification flow
- Low stock alerts (plugin hooks WooCommerce stock change → notifies router)
- Weekly/daily inventory reports
- Edit products via WhatsApp (PATCH)
- Order notifications
- Analytics delivered via WhatsApp
