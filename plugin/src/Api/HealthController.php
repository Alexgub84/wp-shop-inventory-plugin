<?php

declare(strict_types=1);

namespace WSI\Api;

defined('ABSPATH') || exit;

class HealthController
{
    public function register_routes(): void
    {
        register_rest_route('wsi/v1', '/health', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_health'],
            'permission_callback' => '__return_true',
        ]);
    }

    public function get_health(\WP_REST_Request $request): \WP_REST_Response
    {
        return new \WP_REST_Response([
            'status'         => 'ok',
            'woocommerce'    => class_exists('WooCommerce'),
            'plugin_version' => defined('WSI_VERSION') ? WSI_VERSION : 'unknown',
            'php_version'    => PHP_VERSION,
        ], 200);
    }
}
