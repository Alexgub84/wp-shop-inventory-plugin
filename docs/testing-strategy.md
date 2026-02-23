# Testing Strategy

Three levels: unit, integration, E2E. Each has its own dependency strategy.

---

## Test Commands

| Script | Purpose |
| --- | --- |
| `composer test` | Run all tests |
| `composer test:unit` | Unit tests only (fast, no WordPress) |
| `composer test:integration` | Integration tests (needs WP test DB) |
| `composer lint` | PHP CodeSniffer with WordPress standards |
| `composer test:run` | Lint + all tests (CI and pre-commit) |

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

Full request/response with real WordPress and WooCommerce. Validates REST API, database operations, and business logic.

### Tools

- PHPUnit + WordPress test suite (`WP_UnitTestCase`)
- WooCommerce test helpers for creating products
- Real MySQL database (local or Docker)

### Pattern

```php
namespace WSI\Tests\Integration;

use WP_UnitTestCase;
use WP_REST_Request;

class ProductsApiTest extends WP_UnitTestCase {
    private string $valid_token = 'test-token-12345';
    
    public function setUp(): void {
        parent::setUp();
        update_option('wsi_auth_token_hash', wp_hash_password($this->valid_token));
    }
    
    public function test_list_products_returns_published_products(): void {
        $product = new \WC_Product_Simple();
        $product->set_name('Test Widget');
        $product->set_regular_price('19.99');
        $product->set_stock_quantity(50);
        $product->set_status('publish');
        $product->save();
        
        $request = new WP_REST_Request('GET', '/wsi/v1/products');
        $request->set_header('Authorization', 'Bearer ' . $this->valid_token);
        
        $response = rest_do_request($request);
        
        $this->assertEquals(200, $response->get_status());
        $data = $response->get_data();
        $this->assertCount(1, $data);
        $this->assertEquals('Test Widget', $data[0]['name']);
    }
    
    public function test_rejects_request_without_token(): void {
        $request = new WP_REST_Request('GET', '/wsi/v1/products');
        $response = rest_do_request($request);
        $this->assertEquals(401, $response->get_status());
    }
}
```

### Rules

- Use `WP_UnitTestCase` as base class (provides WP test DB, auto-cleanup)
- Create test products via WooCommerce classes (`WC_Product_Simple`)
- Use `rest_do_request()` for REST API testing (no real HTTP)
- Each test method is isolated (WP_UnitTestCase rolls back DB changes)
- Set up auth tokens in `setUp()` for authenticated tests

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

## E2E Tests (Future -- Docker)

Docker Compose with WordPress + MySQL + WooCommerce + the plugin. Real HTTP requests.

```yaml
services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: test
      MYSQL_DATABASE: wordpress_test
    ports:
      - "3307:3306"
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 2s
      timeout: 5s
      retries: 10

  wordpress:
    image: wordpress:latest
    environment:
      WORDPRESS_DB_HOST: mysql
      WORDPRESS_DB_NAME: wordpress_test
      WORDPRESS_DB_USER: root
      WORDPRESS_DB_PASSWORD: test
    ports:
      - "8080:80"
    depends_on:
      mysql:
        condition: service_healthy
    volumes:
      - .:/var/www/html/wp-content/plugins/wp-shop-inventory
```

### E2E Rules

- Use different ports from dev (3307 for MySQL, 8080 for WordPress)
- No persistent volumes -- ephemeral
- Tear down existing containers before starting
- Use real HTTP calls (`curl` or `fetch`)
- 180s timeout on setup to accommodate builds

---

## Test Coverage Requirements

Each module must test:
- Happy path (valid inputs, expected responses)
- Auth failures (missing token, wrong token, malformed token)
- Validation errors (missing fields, invalid types)
- Edge cases (empty product list, WooCommerce not active)
- Error type verification (`WP_Error` with correct code and status)

## Combine Similar Tests

Use data providers to combine tests that follow the same pattern:

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
