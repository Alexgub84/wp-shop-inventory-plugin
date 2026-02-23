<?php

declare(strict_types=1);

namespace WSI;

defined('ABSPATH') || exit;

use WSI\Api\HealthController;
use WSI\Api\ProductsController;
use WSI\Api\RestController;
use WSI\Auth\TokenAuth;
use WSI\Services\ProductService;

class Plugin
{
    private RestController $rest_controller;

    public function __construct()
    {
        $token_auth      = new TokenAuth();
        $product_service  = new ProductService();
        $health           = new HealthController();
        $products         = new ProductsController($product_service, $token_auth);
        $this->rest_controller = new RestController($health, $products);
    }

    public function init(): void
    {
        add_action('rest_api_init', [$this->rest_controller, 'register_routes']);
    }
}
