<?php

declare(strict_types=1);

namespace WSI\Tests\Unit;

use PHPUnit\Framework\Attributes\DataProvider;
use Brain\Monkey\Functions;
use WSI\Auth\TokenAuth;

class TokenAuthTest extends TestCase
{
    private TokenAuth $auth;

    protected function setUp(): void
    {
        parent::setUp();
        $this->auth = new TokenAuth();
    }

    public function test_accepts_valid_token(): void
    {
        $token = 'my-secret-token-12345';

        Functions\expect('get_option')
            ->once()
            ->with('wsi_auth_token')
            ->andReturn($token);

        $request = new \WP_REST_Request();
        $request->set_header('Authorization', 'Bearer ' . $token);

        $result = $this->auth->check_permission($request);

        $this->assertTrue($result);
    }

    #[DataProvider('rejectedTokenProvider')]
    public function test_rejects_invalid_auth(
        ?string $header_value,
        bool $should_call_get_option
    ): void {
        if ($should_call_get_option) {
            Functions\expect('get_option')
                ->with('wsi_auth_token')
                ->andReturn('stored-token');
        }

        $request = new \WP_REST_Request();
        if ($header_value !== null) {
            $request->set_header('Authorization', $header_value);
        }

        $result = $this->auth->check_permission($request);

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('wsi_unauthorized', $result->get_error_code());
        $this->assertSame(401, $result->get_error_data()['status']);
    }

    public static function rejectedTokenProvider(): array
    {
        return [
            'missing header'       => [null, false],
            'empty header'         => ['', false],
            'no bearer prefix'     => ['my-token', false],
            'basic auth'           => ['Basic dXNlcjpwYXNz', false],
            'empty bearer value'   => ['Bearer ', false],
            'wrong token'          => ['Bearer wrong-token', true],
        ];
    }

    public function test_rejects_when_no_stored_token(): void
    {
        Functions\expect('get_option')
            ->once()
            ->with('wsi_auth_token')
            ->andReturn(false);

        $request = new \WP_REST_Request();
        $request->set_header('Authorization', 'Bearer some-token');

        $result = $this->auth->check_permission($request);

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('wsi_unauthorized', $result->get_error_code());
    }
}
