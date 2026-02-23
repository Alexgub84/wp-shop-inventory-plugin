<?php

declare(strict_types=1);

namespace WSI\Api;

defined('ABSPATH') || exit;

use WSI\Auth\TokenAuth;
use WSI\Services\ProductService;

class ProductsController
{
    public function __construct(
        private ProductService $product_service,
        private TokenAuth $token_auth,
    ) {
    }

    public function register_routes(): void
    {
        register_rest_route('wsi/v1', '/products', [
            [
                'methods'             => 'GET',
                'callback'            => [$this, 'list_products'],
                'permission_callback' => [$this->token_auth, 'check_permission'],
            ],
            [
                'methods'             => 'POST',
                'callback'            => [$this, 'create_product'],
                'permission_callback' => [$this->token_auth, 'check_permission'],
                'args'                => $this->get_create_args(),
            ],
        ]);
    }

    public function list_products(\WP_REST_Request $request): \WP_REST_Response
    {
        $products = $this->product_service->list_products();

        return new \WP_REST_Response($products, 200);
    }

    public function create_product(\WP_REST_Request $request): \WP_REST_Response|\WP_Error
    {
        $name = $request->get_param('name');
        if (empty($name) || trim($name) === '') {
            return new \WP_Error(
                'wsi_invalid_product',
                __('Product name is required.', 'wp-shop-inventory'),
                ['status' => 400]
            );
        }

        $regular_price = $request->get_param('regular_price');
        if ($regular_price === null || $regular_price === '') {
            return new \WP_Error(
                'wsi_invalid_product',
                __('Product price is required.', 'wp-shop-inventory'),
                ['status' => 400]
            );
        }

        $stock_quantity = $request->get_param('stock_quantity');
        if ($stock_quantity === null) {
            return new \WP_Error(
                'wsi_invalid_product',
                __('Stock quantity is required.', 'wp-shop-inventory'),
                ['status' => 400]
            );
        }

        $data = [
            'name'           => sanitize_text_field($name),
            'regular_price'  => sanitize_text_field((string) $regular_price),
            'stock_quantity' => absint($stock_quantity),
        ];

        $description = $request->get_param('description');
        if (!empty($description)) {
            $data['description'] = sanitize_textarea_field($description);
        }

        $sku = $request->get_param('sku');
        if (!empty($sku)) {
            $data['sku'] = sanitize_text_field($sku);
        }

        try {
            $product = $this->product_service->create_product($data);
            return new \WP_REST_Response($product, 201);
        } catch (\Exception $e) {
            return new \WP_Error(
                'wsi_product_creation_failed',
                $e->getMessage(),
                ['status' => 500]
            );
        }
    }

    private function get_create_args(): array
    {
        return [
            'name' => [
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
            ],
            'regular_price' => [
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
            ],
            'stock_quantity' => [
                'type'              => 'integer',
                'sanitize_callback' => 'absint',
            ],
            'description' => [
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_textarea_field',
            ],
            'sku' => [
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
            ],
        ];
    }
}
