<?php

declare(strict_types=1);

namespace WSI\Auth;

defined('ABSPATH') || exit;

class TokenAuth
{
    public function check_permission(\WP_REST_Request $request): bool|\WP_Error
    {
        $header = $request->get_header('authorization');

        if (empty($header)) {
            return $this->unauthorized();
        }

        if (!str_starts_with($header, 'Bearer ')) {
            return $this->unauthorized();
        }

        $token = substr($header, 7);

        if (empty($token)) {
            return $this->unauthorized();
        }

        $stored_token = get_option('wsi_auth_token');

        if ($stored_token === false || !hash_equals($stored_token, $token)) {
            return $this->unauthorized();
        }

        return true;
    }

    private function unauthorized(): \WP_Error
    {
        return new \WP_Error(
            'wsi_unauthorized',
            __('Invalid or missing authentication token.', 'wp-shop-inventory'),
            ['status' => 401]
        );
    }
}
