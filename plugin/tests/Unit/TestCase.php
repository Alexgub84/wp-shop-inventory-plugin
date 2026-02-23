<?php

declare(strict_types=1);

namespace WSI\Tests\Unit;

use PHPUnit\Framework\TestCase as PHPUnitTestCase;
use Mockery;
use Brain\Monkey;
use Brain\Monkey\Functions;

abstract class TestCase extends PHPUnitTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Monkey\setUp();
        Functions\stubTranslationFunctions();
        Functions\stubEscapeFunctions();
    }

    protected function tearDown(): void
    {
        $container = Mockery::getContainer();
        if ($container !== null) {
            $this->addToAssertionCount($container->mockery_getExpectationCount());
        }
        Monkey\tearDown();
        Mockery::close();
        parent::tearDown();
    }
}
