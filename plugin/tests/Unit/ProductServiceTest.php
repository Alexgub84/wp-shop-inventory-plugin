<?php

declare(strict_types=1);

namespace WSI\Tests\Unit;

use Mockery;
use Brain\Monkey\Functions;
use WSI\Services\ProductService;

class ProductServiceTest extends TestCase
{
    public function test_list_products_returns_formatted_array(): void
    {
        $mock_product = $this->create_product_mock(
            id: 1,
            name: 'Widget',
            sku: 'WDG-001',
            price: '19.99',
            regular_price: '19.99',
            sale_price: '',
            stock_quantity: 50,
            stock_status: 'instock',
            status: 'publish',
        );

        Functions\expect('wc_get_products')
            ->once()
            ->with(['status' => 'publish', 'limit' => -1])
            ->andReturn([$mock_product]);

        Functions\expect('wp_get_post_terms')
            ->once()
            ->with(1, 'product_cat', ['fields' => 'names'])
            ->andReturn(['Electronics']);

        Functions\expect('is_wp_error')
            ->andReturn(false);

        $service = new ProductService();
        $result  = $service->list_products();

        $this->assertCount(1, $result);
        $this->assertSame(1, $result[0]['id']);
        $this->assertSame('Widget', $result[0]['name']);
        $this->assertSame('WDG-001', $result[0]['sku']);
        $this->assertSame('19.99', $result[0]['price']);
        $this->assertSame('19.99', $result[0]['regular_price']);
        $this->assertSame('', $result[0]['sale_price']);
        $this->assertSame(50, $result[0]['stock_quantity']);
        $this->assertSame('instock', $result[0]['stock_status']);
        $this->assertSame('publish', $result[0]['status']);
        $this->assertSame(['Electronics'], $result[0]['categories']);
    }

    public function test_list_products_returns_empty_array(): void
    {
        Functions\expect('wc_get_products')
            ->once()
            ->andReturn([]);

        $service = new ProductService();
        $result  = $service->list_products();

        $this->assertSame([], $result);
    }

    public function test_create_product_returns_formatted_data(): void
    {
        $mock_product = $this->create_writable_product_mock(
            save_return: 456,
            id: 456,
            name: 'New Widget',
            sku: '',
            price: '29.99',
            stock_quantity: 100,
            status: 'publish',
        );

        $mock_product->shouldReceive('set_name')->once()->with('New Widget');
        $mock_product->shouldReceive('set_regular_price')->once()->with('29.99');
        $mock_product->shouldReceive('set_manage_stock')->once()->with(true);
        $mock_product->shouldReceive('set_stock_quantity')->once()->with(100);
        $mock_product->shouldReceive('set_status')->once()->with('publish');
        $mock_product->shouldReceive('set_description')->never();
        $mock_product->shouldReceive('set_sku')->never();

        $service = new ProductService(fn() => $mock_product);
        $result  = $service->create_product([
            'name'           => 'New Widget',
            'regular_price'  => '29.99',
            'stock_quantity' => 100,
        ]);

        $this->assertSame(456, $result['id']);
        $this->assertSame('New Widget', $result['name']);
        $this->assertSame('29.99', $result['price']);
        $this->assertSame(100, $result['stock_quantity']);
        $this->assertSame('publish', $result['status']);
    }

    public function test_create_product_with_optional_fields(): void
    {
        $mock_product = $this->create_writable_product_mock(
            save_return: 789,
            id: 789,
            name: 'Widget',
            sku: 'NW-001',
            price: '10.00',
            stock_quantity: 5,
            status: 'publish',
        );

        $mock_product->shouldReceive('set_name')->once();
        $mock_product->shouldReceive('set_regular_price')->once();
        $mock_product->shouldReceive('set_manage_stock')->once();
        $mock_product->shouldReceive('set_stock_quantity')->once();
        $mock_product->shouldReceive('set_status')->once();
        $mock_product->shouldReceive('set_description')->once()->with('A fine widget');
        $mock_product->shouldReceive('set_sku')->once()->with('NW-001');

        $service = new ProductService(fn() => $mock_product);
        $result  = $service->create_product([
            'name'           => 'Widget',
            'regular_price'  => '10.00',
            'stock_quantity' => 5,
            'description'    => 'A fine widget',
            'sku'            => 'NW-001',
        ]);

        $this->assertSame('NW-001', $result['sku']);
    }

    public function test_create_product_throws_on_save_failure(): void
    {
        $mock_product = Mockery::mock('WC_Product_Simple');
        $mock_product->shouldReceive('set_name');
        $mock_product->shouldReceive('set_regular_price');
        $mock_product->shouldReceive('set_manage_stock');
        $mock_product->shouldReceive('set_stock_quantity');
        $mock_product->shouldReceive('set_status');
        $mock_product->shouldReceive('save')->once()->andReturn(0);

        $service = new ProductService(fn() => $mock_product);

        $this->expectException(\RuntimeException::class);

        $service->create_product([
            'name'           => 'Bad Widget',
            'regular_price'  => '10.00',
            'stock_quantity' => 1,
        ]);
    }

    private function create_product_mock(
        int $id,
        string $name,
        string $sku,
        string $price,
        string $regular_price,
        string $sale_price,
        int $stock_quantity,
        string $stock_status,
        string $status,
    ): Mockery\MockInterface {
        $mock = Mockery::mock('WC_Product');
        $mock->shouldReceive('get_id')->andReturn($id);
        $mock->shouldReceive('get_name')->andReturn($name);
        $mock->shouldReceive('get_sku')->andReturn($sku);
        $mock->shouldReceive('get_price')->andReturn($price);
        $mock->shouldReceive('get_regular_price')->andReturn($regular_price);
        $mock->shouldReceive('get_sale_price')->andReturn($sale_price);
        $mock->shouldReceive('get_stock_quantity')->andReturn($stock_quantity);
        $mock->shouldReceive('get_stock_status')->andReturn($stock_status);
        $mock->shouldReceive('get_status')->andReturn($status);
        return $mock;
    }

    private function create_writable_product_mock(
        int $save_return,
        int $id,
        string $name,
        string $sku,
        string $price,
        int $stock_quantity,
        string $status,
    ): Mockery\MockInterface {
        $mock = Mockery::mock('WC_Product_Simple');
        $mock->shouldReceive('save')->once()->andReturn($save_return);
        $mock->shouldReceive('get_id')->andReturn($id);
        $mock->shouldReceive('get_name')->andReturn($name);
        $mock->shouldReceive('get_sku')->andReturn($sku);
        $mock->shouldReceive('get_price')->andReturn($price);
        $mock->shouldReceive('get_stock_quantity')->andReturn($stock_quantity);
        $mock->shouldReceive('get_status')->andReturn($status);
        return $mock;
    }
}
