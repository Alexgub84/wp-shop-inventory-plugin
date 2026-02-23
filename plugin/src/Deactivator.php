<?php

declare(strict_types=1);

namespace WSI;

defined('ABSPATH') || exit;

class Deactivator
{
    public static function deactivate(): void
    {
        // MVP: no transients to clean up.
    }
}
