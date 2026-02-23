export class ConfigError extends Error {
  readonly name = 'ConfigError'

  constructor(message: string, public readonly field?: string) {
    super(message)
  }
}

export class GreenApiError extends Error {
  readonly name = 'GreenApiError'

  constructor(
    message: string,
    public readonly statusCode?: number,
    options?: ErrorOptions
  ) {
    super(message, options)
  }
}

export class WebhookError extends Error {
  readonly name = 'WebhookError'

  constructor(message: string, public readonly field?: string) {
    super(message)
  }
}

export type PluginApiErrorCode =
  | 'network_error'
  | 'unauthorized'
  | 'bad_request'
  | 'not_found'
  | 'server_error'
  | 'unknown'

export class PluginApiError extends Error {
  readonly name = 'PluginApiError'

  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly errorCode: PluginApiErrorCode = 'unknown',
    options?: ErrorOptions
  ) {
    super(message, options)
  }
}
