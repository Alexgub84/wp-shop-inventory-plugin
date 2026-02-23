<?php

declare(strict_types=1);

namespace WSI\Tests\Unit;

use Mockery;
use Brain\Monkey\Functions;
use WSI\Api\HealthController;

class HealthControllerTest extends TestCase
{
    private HealthController $controller;

    protected function setUp(): void
    {
        parent::setUp();
        $this->controller = new HealthController();
    }

    public function test_returns_health_data_with_woocommerce(): void
    {
        $request  = new \WP_REST_Request();
        $response = $this->controller->get_health($request);

        $this->assertSame(200, $response->get_status());

        $data = $response->get_data();
        $this->assertSame('ok', $data['status']);
        $this->assertIsBool($data['woocommerce']);
        $this->assertSame(WSI_VERSION, $data['plugin_version']);
        $this->assertSame(PHP_VERSION, $data['php_version']);
    }

    public function test_registers_public_health_route(): void
    {
        Functions\expect('register_rest_route')
            ->once()
            ->with(
                'wsi/v1',
                '/health',
                Mockery::on(function (array $args) {
                    return $args['methods'] === 'GET'
                        && $args['permission_callback'] === '__return_true';
                })
            );

        $this->controller->register_routes();
    }
}
