# WooCommerce Shop Inventory Plugin

WordPress/WooCommerce plugin that exposes shop inventory data as a secured REST API.

## What This Does

- Exposes WooCommerce product data via authenticated REST endpoints
- Authenticates requests using a Bearer token
- Provides admin settings page for token management
- Has zero knowledge of WhatsApp -- it's a pure data API

## Stack

- PHP 8.1+
- WordPress 6.x + WooCommerce 8.x+
- PSR-4 autoloading via Composer (namespace: `WSI\`)
- PHPUnit + Brain Monkey + Mockery (testing)

## Quick Start

```bash
composer install
```

## API Endpoints

All under `/wp-json/wsi/v1/`:

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /health | No | Plugin status + WooCommerce check |
| GET | /products | Yes | List published products |
| GET | /products/{id} | Yes | Single product details |
| POST | /products | Yes | Create new product |

## Testing

```bash
composer test:unit          # Unit tests (fast, no WordPress)
composer test:integration   # Integration tests (needs WP test DB)
composer test:run           # Lint + all tests
```

## Documentation

Full documentation in the root `docs/` folder:

- [Full Project Spec](../docs/full-project-spec.md)
- [Architecture](../docs/architecture.md)
- [MVP Spec](../docs/mvp-spec.md)
- [Testing Strategy](../docs/testing-strategy.md)
