#!/usr/bin/env bash

set -e

DB_NAME=${1-wordpress_test}
DB_USER=${2-root}
DB_PASS=${3-root}
DB_HOST=${4-127.0.0.1:3307}
WP_VERSION=${5-latest}
WC_VERSION=${6-latest}

WP_TESTS_DIR=${WP_TESTS_DIR-/tmp/wordpress-tests-lib}
WP_CORE_DIR=${WP_CORE_DIR-/tmp/wordpress}
WC_DIR=${WC_DIR-/tmp/woocommerce}

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [ "$WP_VERSION" == "latest" ]; then
    WP_VERSION=$(curl -fsSL https://api.wordpress.org/core/version-check/1.7/ | grep -o '"version":"[^"]*"' | head -1 | sed 's/"version":"//;s/"//')
    if [ -z "$WP_VERSION" ]; then
        echo "ERROR: Could not detect latest WordPress version."
        exit 1
    fi
fi

echo "Configuration:"
echo "  WordPress:    $WP_VERSION"
echo "  WooCommerce:  $WC_VERSION"
echo "  DB:           $DB_NAME @ $DB_HOST"
echo ""

install_wp() {
    if [ -d "$WP_CORE_DIR" ] && [ -f "$WP_CORE_DIR/wp-load.php" ]; then
        echo "  WordPress core already installed, skipping."
        return
    fi

    mkdir -p "$WP_CORE_DIR"

    curl -fsSL "https://wordpress.org/wordpress-$WP_VERSION.tar.gz" \
        | tar --strip-components=1 -zxf - -C "$WP_CORE_DIR"
}

install_test_suite() {
    if [ -d "$WP_TESTS_DIR" ] && [ -f "$WP_TESTS_DIR/includes/functions.php" ]; then
        echo "  WP test suite already installed, skipping."
        return
    fi

    rm -rf "$WP_TESTS_DIR"
    mkdir -p "$WP_TESTS_DIR"

    local TARBALL_URL="https://github.com/WordPress/wordpress-develop/archive/refs/heads/trunk.tar.gz"
    local EXTRACTED="/tmp/wordpress-develop-trunk"

    rm -rf "$EXTRACTED"
    curl -fsSL "$TARBALL_URL" | tar -zxf - -C /tmp
    cp -R "$EXTRACTED/tests/phpunit/includes" "$WP_TESTS_DIR/includes"
    cp -R "$EXTRACTED/tests/phpunit/data" "$WP_TESTS_DIR/data"
    rm -rf "$EXTRACTED"
}

install_woocommerce() {
    if [ -d "$WC_DIR" ] && [ -f "$WC_DIR/woocommerce.php" ]; then
        echo "  WooCommerce already installed, skipping."
        return
    fi

    rm -rf "$WC_DIR"

    if [ "$WC_VERSION" == "latest" ]; then
        local ARCHIVE_URL="https://downloads.wordpress.org/plugin/woocommerce.latest-stable.zip"
    else
        local ARCHIVE_URL="https://downloads.wordpress.org/plugin/woocommerce.${WC_VERSION}.zip"
    fi

    curl -fsSL "$ARCHIVE_URL" -o /tmp/woocommerce.zip
    unzip -q -o /tmp/woocommerce.zip -d /tmp
    rm -f /tmp/woocommerce.zip
}

configure_wp_tests() {
    local CONFIG_FILE="$WP_CORE_DIR/wp-tests-config.php"

    cat > "$CONFIG_FILE" <<WPCONFIG
<?php
define( 'ABSPATH', '$WP_CORE_DIR/' );
define( 'DB_NAME', '$DB_NAME' );
define( 'DB_USER', '$DB_USER' );
define( 'DB_PASSWORD', '$DB_PASS' );
define( 'DB_HOST', '$DB_HOST' );
define( 'DB_CHARSET', 'utf8' );
define( 'DB_COLLATE', '' );

\$table_prefix = 'wptests_';

define( 'WP_TESTS_DOMAIN', 'example.org' );
define( 'WP_TESTS_EMAIL', 'admin@example.org' );
define( 'WP_TESTS_TITLE', 'Test Blog' );
define( 'WP_PHP_BINARY', 'php' );
define( 'WPLANG', '' );
WPCONFIG
}

create_db() {
    local DB_HOST_ONLY
    local DB_PORT
    DB_HOST_ONLY=$(echo "$DB_HOST" | cut -d: -f1)
    DB_PORT=$(echo "$DB_HOST" | grep -o ':[0-9]*$' | tr -d ':')
    DB_PORT=${DB_PORT:-3306}

    local CONTAINER
    CONTAINER=$(docker compose -f "$SCRIPT_DIR/docker-compose.test.yml" ps -q mysql 2>/dev/null || true)

    if [ -n "$CONTAINER" ]; then
        docker exec "$CONTAINER" \
            mysql -u"$DB_USER" -p"$DB_PASS" -e "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\`;" 2>/dev/null
    else
        echo "  WARNING: MySQL container not found. Make sure to run:"
        echo "    docker compose -f docker-compose.test.yml up -d"
        echo "  Then re-run this script."
        exit 1
    fi
}

echo "1/5  Installing WordPress core ($WP_VERSION)..."
install_wp

echo "2/5  Installing WordPress test suite..."
install_test_suite

echo "3/5  Installing WooCommerce ($WC_VERSION)..."
install_woocommerce

echo "4/5  Writing wp-tests-config.php..."
configure_wp_tests

echo "5/5  Creating database $DB_NAME..."
create_db

echo ""
echo "Done. Integration test environment ready."
echo "  WP core:      $WP_CORE_DIR"
echo "  WP tests:     $WP_TESTS_DIR"
echo "  WooCommerce:  $WC_DIR"
echo "  Database:     $DB_NAME @ $DB_HOST"
