<?php

declare(strict_types=1);

namespace WSI;

defined('ABSPATH') || exit;

class Activator
{
    public static function activate(): void
    {
        if (get_option('wsi_auth_token') === false) {
            $token = wp_generate_password(48, true, true);
            update_option('wsi_auth_token', $token);

            if (defined('WP_CLI') && WP_CLI) {
                \WP_CLI::log('WSI Auth Token: ' . $token);
            } else {
                // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
                error_log('[WSI] Auth token generated. Retrieve with: wp option get wsi_auth_token');
            }
        }

        update_option('wsi_plugin_version', WSI_VERSION);
    }
}
