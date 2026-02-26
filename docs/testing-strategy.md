# Testing Strategy

Three levels: unit, integration, E2E. Each has its own dependency strategy.

---

## Test Commands

| Script | Purpose |
| --- | --- |
| `make test` | Monorepo-wide: runs plugin + router unit/integration tests |
| `make test-plugin` | Plugin tests only (unit + integration) |
| `make test-router` | Router tests only (lint + unit + e2e with mocks) |
| `make test-e2e` | Full-stack E2E: Docker Compose boots everything, vitest runs |
| `composer test:unit` | Plugin unit tests only (fast, no WordPress) |
| `composer test:integration` | Plugin integration tests (needs Docker MySQL + WP test suite) |
| `composer test:run` | Plugin unit + integration tests sequentially |
| `cd e2e && bash run.sh` | Full E2E: start Docker, wait, test, tear down |

---

## Unit Tests (`tests/Unit/`)

Test error handling, branching logic, and edge cases. Fast, no WordPress loaded.

### Tools

- PHPUnit for test runner
- Brain Monkey for mocking WordPress functions (`get_option`, `sanitize_text_field`, etc.)
- Mockery for mocking classes (services, controllers)

### Bootstrap (`tests/bootstrap.php`)

```php
<?php
require_once dirname(__DIR__) . '/vendor/autoload.php';
require_once __DIR__ . '/Stubs/wordpress.php';
```

Stubs file provides class stubs (WP_Error, WP_REST_Request, WP_REST_Response). Brain Monkey handles function mocking — do NOT define WP functions in stubs.

### Pattern

```php
namespace WSI\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Mockery;
use Brain\Monkey;
use Brain\Monkey\Functions;

class TokenAuthTest extends TestCase {
    protected function setUp(): void {
        parent::setUp();
        Monkey\setUp();
    }
    
    protected function tearDown(): void {
        Monkey\tearDown();
        Mockery::close();
        parent::tearDown();
    }
    
    public function test_rejects_missing_token(): void {
        Functions\expect('get_option')
            ->with('wsi_auth_token_hash')
            ->andReturn('$P$BhashedValue');
        
        $auth = new \WSI\Auth\TokenAuth();
        $result = $auth->validate(null);
        
        $this->assertInstanceOf(\WP_Error::class, $result);
    }
    
    public function test_accepts_valid_token(): void {
        Functions\expect('get_option')
            ->with('wsi_auth_token_hash')
            ->andReturn('$P$BhashedValue');
        Functions\expect('wp_check_password')
            ->with('my-secret-token', '$P$BhashedValue')
            ->andReturn(true);
        
        $auth = new \WSI\Auth\TokenAuth();
        $result = $auth->validate('my-secret-token');
        
        $this->assertTrue($result);
    }
}
```

### Rules

- Use Brain Monkey to mock ALL WordPress functions (they don't exist in unit test context)
- Use Mockery for class-level mocks (ProductService, etc.)
- Inject mocks via constructor (dependency injection pattern)
- Clear mocks in `tearDown()` via `Monkey\tearDown()` and `Mockery::close()`
- Test: happy path, validation errors, auth failures, edge cases, error types

---

## Integration Tests (`tests/Integration/`)

Full request/response with real WordPress and WooCommerce. Validates REST API, database operations, and business logic end-to-end.

### Infrastructure

Integration tests require a running MySQL instance and the WordPress test suite:

- **Docker MySQL:** `plugin/docker-compose.test.yml` runs MySQL 8.0 on port 3307 with `tmpfs` for speed
- **Install script:** `plugin/bin/install-wp-tests.sh` downloads WordPress core, WP test suite (from trunk), and WooCommerce to `/tmp/`
- **Bootstrap:** `plugin/tests/bootstrap-integration.php` loads the real WP test suite, activates WooCommerce and the plugin, and runs `WC_Install::install()`
- **PHPUnit config:** `plugin/phpunit-integration.xml` uses the integration bootstrap (separate from unit test config)

### Setup (one-time after Docker is running)

```bash
cd plugin
docker compose -f docker-compose.test.yml up -d
bash bin/install-wp-tests.sh wordpress_test root root 127.0.0.1:3307
```

### Tools

- PHPUnit 9.6 + Yoast PHPUnit Polyfills
- WordPress test suite (`WP_UnitTestCase`) from trunk branch
- WooCommerce loaded as a real plugin
- Docker MySQL 8.0

### Pattern

```php
namespace WSI\Tests\Integration;

use WP_REST_Request;
use WP_REST_Server;

class ProductsApiTest extends \WP_UnitTestCase {
    private string $token = 'test-integration-token-12345';

    public function setUp(): void {
        parent::setUp();

        global $wp_rest_server;
        $wp_rest_server = new WP_REST_Server();
        do_action('rest_api_init');

        update_option('wsi_auth_token', $this->token);
    }

    public function tearDown(): void {
        global $wp_rest_server;
        $wp_rest_server = null;
        parent::tearDown();
    }

    public function test_list_products_returns_seeded_products(): void {
        $product = new \WC_Product_Simple();
        $product->set_name('Test Widget');
        $product->set_sku('WDG-001');
        $product->set_description('A test widget');
        $product->set_regular_price('19.99');
        $product->set_manage_stock(true);
        $product->set_stock_quantity(50);
        $product->set_status('publish');
        $product->save();

        $request = new WP_REST_Request('GET', '/wsi/v1/products');
        $request->set_header('Authorization', 'Bearer ' . $this->token);

        $response = rest_do_request($request);

        $this->assertSame(200, $response->get_status());
        $data = $response->get_data();
        $this->assertCount(1, $data);
        $this->assertSame('Test Widget', $data[0]['name']);
    }
}
```

### Rules

- Use `WP_UnitTestCase` as base class (provides WP test DB, auto-cleanup via transaction rollback)
- Reset the REST server in `setUp()` via `global $wp_rest_server` to ensure fresh route registration
- Auth uses `wsi_auth_token` (plain text, MVP) — set via `update_option()` in `setUp()`
- Create test products via WooCommerce classes (`WC_Product_Simple`)
- Use `rest_do_request()` for REST API testing (no real HTTP, dispatches internally)
- Each test method is isolated (WP_UnitTestCase rolls back DB changes)

---

## Mocks (`tests/Mocks/`)

Reusable mock factories for external dependencies.

```php
namespace WSI\Tests\Mocks;

class WooCommerceMock {
    public static function createProducts(int $count = 3): array {
        $products = [];
        for ($i = 1; $i <= $count; $i++) {
            $products[] = [
                'id' => $i,
                'name' => "Test Product {$i}",
                'sku' => "TST-{$i}",
                'price' => (string)($i * 10),
                'stock_quantity' => $i * 5,
                'stock_status' => 'instock',
                'status' => 'publish',
            ];
        }
        return $products;
    }
}
```

---

## E2E Tests (`e2e/`)

Full-stack tests that boot the entire system (MySQL + WordPress/WooCommerce + plugin + router) via Docker Compose. Tests run on the host using vitest and make real HTTP requests.

### Infrastructure

Docker Compose (`e2e/docker-compose.yml`) runs four services:

1. **mysql** — MySQL 8.0 with tmpfs for speed
2. **wordpress** — WordPress 6 + PHP 8.2, plugin mounted as a bind volume
3. **wp-setup** — One-shot WP-CLI container: installs WP core, WooCommerce, activates the plugin, sets a known auth token
4. **router** — Built from `router/Dockerfile`, configured with `MOCK_MODE=true` (no real Green API)

### Running

```bash
# From repo root
make test-e2e

# Or directly
cd e2e && bash run.sh
```

The `run.sh` script handles: install deps, start Docker, wait for readiness (up to 180s), run vitest, tear down.

### What's tested

- Plugin health endpoint (WooCommerce active, plugin version)
- Router health endpoint
- Plugin auth (rejects missing/wrong tokens, accepts valid token)
- Full webhook flow: menu command → router processes and responds
- Full webhook flow: list products through router → plugin → WooCommerce
- Full webhook flow: add product via multi-step conversation → verify product created in WooCommerce
- Cancel mid-flow and resume
- Unregistered phone number handling
- Invalid payload rejection

### E2E Rules

- Ports: 3000 (router), 8080 (WordPress). No persistent volumes — ephemeral
- Tear down existing containers before starting
- Real HTTP calls via native `fetch`
- 180s timeout on setup to accommodate Docker builds
- Auth token: `test-e2e-token-12345` (set by wp-setup, used by router and tests)
- Router runs with `MOCK_MODE=true` — no Green API calls, messages are logged only

---

## Test Coverage Requirements

Each module must test:
- Happy path (valid inputs, expected responses)
- Auth failures (missing token, wrong token, malformed token)
- Validation errors (missing fields, invalid types)
- Edge cases (empty product list, WooCommerce not active)
- Error type verification (`WP_Error` with correct code and status)

## Combine Similar Tests

Use `@dataProvider` annotations (PHPUnit 9 style) to combine tests that follow the same pattern. Do NOT use `#[DataProvider]` attributes (PHPUnit 10+ only).

```php
/**
 * @dataProvider invalidTokenProvider
 */
public function test_rejects_invalid_tokens(string $header_value): void {
    $request = new WP_REST_Request('GET', '/wsi/v1/products');
    $request->set_header('Authorization', $header_value);
    $response = rest_do_request($request);
    $this->assertEquals(401, $response->get_status());
}

public static function invalidTokenProvider(): array {
    return [
        'empty bearer' => ['Bearer '],
        'wrong token' => ['Bearer wrong-token'],
        'no bearer prefix' => ['my-token'],
        'basic auth instead' => ['Basic dXNlcjpwYXNz'],
    ];
}
```

## Avoid Redundant Tests

Do not write a separate test if its assertions are already covered by another test. Keep tests separate when they have meaningfully different setup or logic.
