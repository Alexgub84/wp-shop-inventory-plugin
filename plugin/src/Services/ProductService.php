<?php

declare(strict_types=1);

namespace WSI\Services;

defined('ABSPATH') || exit;

class ProductService
{
    private \Closure $product_factory;

    public function __construct(?\Closure $product_factory = null)
    {
        $this->product_factory = $product_factory ?? static fn() => new \WC_Product_Simple();
    }

    public function list_products(): array
    {
        $products = wc_get_products([
            'status' => 'publish',
            'limit'  => -1,
        ]);

        return array_map([$this, 'format_product'], $products);
    }

    public function create_product(array $data): array
    {
        $product = ($this->product_factory)();
        $product->set_name($data['name']);
        $product->set_regular_price($data['regular_price']);
        $product->set_manage_stock(true);
        $product->set_stock_quantity((int) $data['stock_quantity']);
        $product->set_status('publish');

        if (!empty($data['description'])) {
            $product->set_description($data['description']);
        }

        if (!empty($data['sku'])) {
            $product->set_sku($data['sku']);
        }

        $id = $product->save();

        if (!$id) {
            throw new \RuntimeException(
                __('Failed to save product.', 'wp-shop-inventory')
            );
        }

        return [
            'id'             => $product->get_id(),
            'name'           => $product->get_name(),
            'sku'            => $product->get_sku(),
            'price'          => $product->get_price(),
            'stock_quantity' => $product->get_stock_quantity(),
            'status'         => $product->get_status(),
        ];
    }

    private function format_product(\WC_Product $product): array
    {
        $terms = wp_get_post_terms(
            $product->get_id(),
            'product_cat',
            ['fields' => 'names']
        );

        return [
            'id'             => $product->get_id(),
            'name'           => $product->get_name(),
            'sku'            => $product->get_sku(),
            'price'          => $product->get_price(),
            'regular_price'  => $product->get_regular_price(),
            'sale_price'     => $product->get_sale_price(),
            'stock_quantity' => $product->get_stock_quantity(),
            'stock_status'   => $product->get_stock_status(),
            'status'         => $product->get_status(),
            'categories'     => is_wp_error($terms) ? [] : $terms,
        ];
    }
}
