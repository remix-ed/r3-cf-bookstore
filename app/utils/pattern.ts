import { RoutePattern } from '@remix-run/route-pattern'

/**
 * Helper to create route patterns with clean syntax
 * RoutePattern has built-in .href() method for URL generation
 */
export const pattern = <T extends string>(p: T) => new RoutePattern(p)
