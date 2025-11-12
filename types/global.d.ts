/**
 * Global Type Declarations
 *
 * This file provides additional type declarations that aren't auto-generated.
 * Unlike worker-configuration.d.ts and worker-runtime.d.ts, this file won't
 * be overwritten by `wrangler types`.
 */

// Node.js test runner types (for test files)
declare module 'node:test' {
  export function describe(name: string, fn: () => void): void
  export function it(name: string, fn: () => void | Promise<void>): void
  export function test(name: string, fn: () => void | Promise<void>): void
}

declare module 'node:assert/strict' {
  export function equal<T>(actual: T, expected: T, message?: string): void
  export function notEqual<T>(actual: T, expected: T, message?: string): void
  export function deepEqual<T>(actual: T, expected: T, message?: string): void
  export function ok(value: unknown, message?: string): void
  export function throws(fn: () => void, message?: string): void
  export default { equal, notEqual, deepEqual, ok, throws }
}
