<?php

declare(strict_types=1);

namespace WSI\Tests\Unit;

use Mockery;
use Brain\Monkey\Functions;
use WSI\Activator;

class ActivatorTest extends TestCase
{

    public function test_generates_token_when_none_exists(): void
    {
        Functions\expect('get_option')
            ->once()
            ->with('wsi_auth_token')
            ->andReturn(false);

        Functions\expect('wp_generate_password')
            ->once()
            ->with(48, true, true)
            ->andReturn('generated-token-abc');

        Functions\expect('update_option')
            ->once()
            ->with('wsi_auth_token', 'generated-token-abc');

        Functions\expect('update_option')
            ->once()
            ->with('wsi_plugin_version', Mockery::type('string'));

        Activator::activate();
    }

    public function test_does_not_overwrite_existing_token(): void
    {
        Functions\expect('get_option')
            ->once()
            ->with('wsi_auth_token')
            ->andReturn('existing-token');

        Functions\expect('wp_generate_password')->never();

        Functions\expect('update_option')
            ->once()
            ->with('wsi_plugin_version', Mockery::type('string'));

        Activator::activate();
    }

    public function test_stores_plugin_version(): void
    {
        Functions\expect('get_option')
            ->with('wsi_auth_token')
            ->andReturn('existing-token');

        Functions\expect('update_option')
            ->once()
            ->with('wsi_plugin_version', WSI_VERSION);

        Activator::activate();
    }
}
