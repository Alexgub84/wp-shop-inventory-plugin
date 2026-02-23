<?php

defined('WP_UNINSTALL_PLUGIN') || exit;

delete_option('wsi_auth_token');
delete_option('wsi_plugin_version');
