<?php

declare(strict_types=1);

namespace WSI\Tests\Unit;

use PHPUnit\Framework\Attributes\DataProvider;
use Mockery;
use Brain\Monkey\Functions;
use WSI\Api\ProductsController;
use WSI\Auth\TokenAuth;
use WSI\Services\ProductService;

class ProductsControllerTest extends TestCase
{
    private ProductsController $controller;
    private Mockery\MockInterface $product_service;
    private Mockery\MockInterface $token_auth;

    protected function setUp(): void
    {
        parent::setUp();

        $this->product_service = Mockery::mock(ProductService::class);
        $this->token_auth      = Mockery::mock(TokenAuth::class);
        $this->controller      = new ProductsController(
            $this->product_service,
            $this->token_auth,
        );
    }

    public function test_list_products_returns_products(): void
    {
        $products = [
            ['id' => 1, 'name' => 'Widget', 'price' => '19.99'],
        ];

        $this->product_service
            ->shouldReceive('list_products')
            ->once()
            ->andReturn($products);

        $request  = new \WP_REST_Request();
        $response = $this->controller->list_products($request);

        $this->assertInstanceOf(\WP_REST_Response::class, $response);
        $this->assertSame(200, $response->get_status());
        $this->assertSame($products, $response->get_data());
    }

    public function test_list_products_returns_empty_array(): void
    {
        $this->product_service
            ->shouldReceive('list_products')
            ->once()
            ->andReturn([]);

        $request  = new \WP_REST_Request();
        $response = $this->controller->list_products($request);

        $this->assertSame(200, $response->get_status());
        $this->assertSame([], $response->get_data());
    }

    public function test_create_product_success(): void
    {
        $created = [
            'id'             => 456,
            'name'           => 'New Widget',
            'sku'            => '',
            'price'          => '29.99',
            'stock_quantity' => 100,
            'status'         => 'publish',
        ];

        $this->product_service
            ->shouldReceive('create_product')
            ->once()
            ->andReturn($created);

        Functions\expect('sanitize_text_field')
            ->andReturnFirstArg();
        Functions\expect('absint')
            ->andReturnUsing(function ($val) { return (int) $val; });

        $request = new \WP_REST_Request();
        $request->set_param('name', 'New Widget');
        $request->set_param('regular_price', '29.99');
        $request->set_param('stock_quantity', 100);

        $response = $this->controller->create_product($request);

        $this->assertInstanceOf(\WP_REST_Response::class, $response);
        $this->assertSame(201, $response->get_status());
        $this->assertSame(456, $response->get_data()['id']);
    }

    /**
     * @dataProvider missingFieldProvider
     */
    public function test_create_product_rejects_missing_fields(
        array $params,
        string $expected_message_fragment,
    ): void {
        $request = new \WP_REST_Request();
        foreach ($params as $key => $value) {
            $request->set_param($key, $value);
        }

        $result = $this->controller->create_product($request);

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('wsi_invalid_product', $result->get_error_code());
        $this->assertSame(400, $result->get_error_data()['status']);
        $this->assertStringContainsString($expected_message_fragment, $result->get_error_message());
    }

    public static function missingFieldProvider(): array
    {
        return [
            'missing name' => [
                ['regular_price' => '10.00', 'stock_quantity' => 5],
                'name is required',
            ],
            'empty name' => [
                ['name' => '', 'regular_price' => '10.00', 'stock_quantity' => 5],
                'name is required',
            ],
            'whitespace name' => [
                ['name' => '   ', 'regular_price' => '10.00', 'stock_quantity' => 5],
                'name is required',
            ],
            'missing price' => [
                ['name' => 'Widget', 'stock_quantity' => 5],
                'price is required',
            ],
            'empty price' => [
                ['name' => 'Widget', 'regular_price' => '', 'stock_quantity' => 5],
                'price is required',
            ],
            'missing stock' => [
                ['name' => 'Widget', 'regular_price' => '10.00'],
                'Stock quantity is required',
            ],
        ];
    }

    public function test_create_product_returns_500_on_service_error(): void
    {
        $this->product_service
            ->shouldReceive('create_product')
            ->once()
            ->andThrow(new \RuntimeException('Save failed'));

        Functions\expect('sanitize_text_field')
            ->andReturnFirstArg();
        Functions\expect('absint')
            ->andReturnUsing(function ($val) { return (int) $val; });

        $request = new \WP_REST_Request();
        $request->set_param('name', 'Widget');
        $request->set_param('regular_price', '10.00');
        $request->set_param('stock_quantity', 5);

        $result = $this->controller->create_product($request);

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('wsi_product_creation_failed', $result->get_error_code());
        $this->assertSame(500, $result->get_error_data()['status']);
    }

    public function test_registers_authenticated_routes(): void
    {
        Functions\expect('register_rest_route')
            ->once()
            ->with(
                'wsi/v1',
                '/products',
                Mockery::on(function (array $routes) {
                    return count($routes) === 2
                        && $routes[0]['methods'] === 'GET'
                        && $routes[1]['methods'] === 'POST';
                })
            );

        $this->controller->register_routes();
    }
}
