# End-to-End Tests

System-level tests that spin up both the WordPress plugin and the router service, then test the full flow.

## What This Tests

- Full message flow: simulated WhatsApp message -> router -> plugin -> WooCommerce -> response
- Phone verification flow end-to-end
- Authentication between router and plugin
- Product CRUD through the full stack

## How It Works

Docker Compose boots:
1. MySQL database
2. WordPress + WooCommerce with the plugin installed
3. The router service
4. Test runner that simulates WhatsApp messages

## Running

```bash
docker compose up -d
npm test
docker compose down
```

## Prerequisites

- Docker and Docker Compose installed
- No other services running on ports 3307, 8080, 3000
