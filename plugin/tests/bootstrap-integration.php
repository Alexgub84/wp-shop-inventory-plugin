<?php

$_tests_dir = getenv('WP_TESTS_DIR') ?: '/tmp/wordpress-tests-lib';
$_core_dir  = getenv('WP_CORE_DIR') ?: '/tmp/wordpress';
$_wc_dir    = getenv('WC_DIR') ?: '/tmp/woocommerce';

if (!file_exists($_tests_dir . '/includes/functions.php')) {
    echo "WordPress test suite not found at {$_tests_dir}.\n";
    echo "Run: bash bin/install-wp-tests.sh wordpress_test root root 127.0.0.1:3307\n";
    exit(1);
}

if (!file_exists($_wc_dir . '/woocommerce.php')) {
    echo "WooCommerce not found at {$_wc_dir}.\n";
    echo "Run: bash bin/install-wp-tests.sh wordpress_test root root 127.0.0.1:3307\n";
    exit(1);
}

define('WP_TESTS_CONFIG_FILE_PATH', $_core_dir . '/wp-tests-config.php');
putenv("WP_CORE_DIR={$_core_dir}");

require_once $_tests_dir . '/includes/functions.php';

tests_add_filter('muplugins_loaded', function () use ($_wc_dir) {
    require_once $_wc_dir . '/woocommerce.php';
    require_once dirname(__DIR__) . '/wp-shop-inventory.php';
});

tests_add_filter('setup_theme', function () {
    define('WC_INSTALLING', true);
    \WC_Install::install();
});

require $_tests_dir . '/includes/bootstrap.php';
