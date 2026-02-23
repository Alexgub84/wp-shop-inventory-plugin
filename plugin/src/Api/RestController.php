<?php

declare(strict_types=1);

namespace WSI\Api;

defined('ABSPATH') || exit;

class RestController
{
    public function __construct(
        private HealthController $health,
        private ProductsController $products,
    ) {
    }

    public function register_routes(): void
    {
        $this->health->register_routes();
        $this->products->register_routes();
    }
}
