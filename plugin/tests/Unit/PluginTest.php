<?php

declare(strict_types=1);

namespace WSI\Tests\Unit;

use Mockery;
use Brain\Monkey\Functions;
use WSI\Plugin;

class PluginTest extends TestCase
{

    public function test_init_registers_rest_api_init_hook(): void
    {
        Functions\expect('add_action')
            ->once()
            ->with('rest_api_init', Mockery::type('array'));

        $plugin = new Plugin();
        $plugin->init();
    }
}
