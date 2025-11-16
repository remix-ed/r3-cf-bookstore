export function getMode(): string {
  return process.env.NODE_ENV || 'production'
}

export function isDevelopment(): boolean {
  return getMode() === 'development'
}

export function isProduction(): boolean {
  return getMode() === 'production'
}

export function isTesting(): boolean {
  return getMode() === 'test'
}
