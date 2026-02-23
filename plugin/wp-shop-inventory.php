<?php
/**
 * Plugin Name: WooCommerce Shop Inventory
 * Plugin URI:  https://github.com/your-org/wp-shop-inventory-plugin
 * Description: Exposes WooCommerce inventory data as a secured REST API.
 * Version:     0.1.0
 * Requires at least: 6.0
 * Requires PHP: 8.1
 * Author:      WSI
 * Text Domain: wp-shop-inventory
 * Domain Path: /languages
 * WC requires at least: 8.0
 * License:     GPL-2.0-or-later
 */

defined('ABSPATH') || exit;

define('WSI_VERSION', '0.1.0');
define('WSI_PLUGIN_FILE', __FILE__);
define('WSI_PLUGIN_DIR', plugin_dir_path(__FILE__));

require_once WSI_PLUGIN_DIR . 'vendor/autoload.php';

register_activation_hook(__FILE__, [WSI\Activator::class, 'activate']);
register_deactivation_hook(__FILE__, [WSI\Deactivator::class, 'deactivate']);

add_action('plugins_loaded', function () {
    $plugin = new WSI\Plugin();
    $plugin->init();
});
