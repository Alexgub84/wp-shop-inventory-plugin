<?php

declare(strict_types=1);

namespace WSI\Tests\Integration;

use WP_REST_Request;
use WP_REST_Server;

class ProductsApiTest extends \WP_UnitTestCase
{
    private string $token = 'test-integration-token-12345';

    public function setUp(): void
    {
        parent::setUp();

        global $wp_rest_server;
        $wp_rest_server = new WP_REST_Server();
        do_action('rest_api_init');

        update_option('wsi_auth_token', $this->token);
    }

    public function tearDown(): void
    {
        global $wp_rest_server;
        $wp_rest_server = null;
        parent::tearDown();
    }

    public function test_list_products_returns_seeded_products(): void
    {
        $this->seed_product('Widget A', 'SKU-A', 'First widget');
        $this->seed_product('Widget B', 'SKU-B', 'Second widget');

        $response = rest_do_request($this->authenticated_request('GET', '/wsi/v1/products'));

        $this->assertSame(200, $response->get_status());

        $data = $response->get_data();
        $this->assertCount(2, $data);

        $names = array_column($data, 'name');
        $this->assertContains('Widget A', $names);
        $this->assertContains('Widget B', $names);

        $skus = array_column($data, 'sku');
        $this->assertContains('SKU-A', $skus);
        $this->assertContains('SKU-B', $skus);
    }

    public function test_list_products_empty_when_no_products(): void
    {
        $response = rest_do_request($this->authenticated_request('GET', '/wsi/v1/products'));

        $this->assertSame(200, $response->get_status());
        $this->assertSame([], $response->get_data());
    }

    public function test_create_product_returns_201_with_data(): void
    {
        $request = $this->authenticated_request('POST', '/wsi/v1/products');
        $request->set_body_params([
            'name'           => 'New Widget',
            'regular_price'  => '29.99',
            'stock_quantity' => 10,
            'sku'            => 'NW-001',
            'description'    => 'A brand new widget',
        ]);

        $response = rest_do_request($request);

        $this->assertSame(201, $response->get_status());

        $data = $response->get_data();
        $this->assertSame('New Widget', $data['name']);
        $this->assertSame('NW-001', $data['sku']);
        $this->assertSame(10, $data['stock_quantity']);
        $this->assertSame('publish', $data['status']);
        $this->assertArrayHasKey('id', $data);
        $this->assertGreaterThan(0, $data['id']);
    }

    public function test_created_product_appears_in_list(): void
    {
        $create = $this->authenticated_request('POST', '/wsi/v1/products');
        $create->set_body_params([
            'name'           => 'Listed Widget',
            'regular_price'  => '15.00',
            'stock_quantity' => 5,
            'sku'            => 'LW-001',
            'description'    => 'Should appear in list',
        ]);

        $create_response = rest_do_request($create);
        $this->assertSame(201, $create_response->get_status());

        $list_response = rest_do_request($this->authenticated_request('GET', '/wsi/v1/products'));
        $this->assertSame(200, $list_response->get_status());

        $products = $list_response->get_data();
        $this->assertCount(1, $products);
        $this->assertSame('Listed Widget', $products[0]['name']);
        $this->assertSame('LW-001', $products[0]['sku']);
    }

    public function test_create_product_rejects_missing_name(): void
    {
        $request = $this->authenticated_request('POST', '/wsi/v1/products');
        $request->set_body_params([
            'regular_price'  => '10.00',
            'stock_quantity' => 1,
        ]);

        $response = rest_do_request($request);

        $this->assertSame(400, $response->get_status());
    }

    public function test_unauthenticated_request_returns_401(): void
    {
        $request = new WP_REST_Request('GET', '/wsi/v1/products');

        $response = rest_do_request($request);

        $this->assertSame(401, $response->get_status());
    }

    private function seed_product(string $name, string $sku, string $description): int
    {
        $product = new \WC_Product_Simple();
        $product->set_name($name);
        $product->set_sku($sku);
        $product->set_description($description);
        $product->set_regular_price('19.99');
        $product->set_manage_stock(true);
        $product->set_stock_quantity(50);
        $product->set_status('publish');

        return $product->save();
    }

    private function authenticated_request(string $method, string $route): WP_REST_Request
    {
        $request = new WP_REST_Request($method, $route);
        $request->set_header('Authorization', 'Bearer ' . $this->token);

        return $request;
    }
}
