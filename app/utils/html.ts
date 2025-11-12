/**
 * HTML Escaping Utility
 *
 * Provides functions to safely escape user-generated content for display in HTML.
 * This prevents XSS (Cross-Site Scripting) attacks by converting special HTML
 * characters into their entity equivalents.
 */

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
}

const HTML_ENTITIES_REGEX = /[&<>"'\/]/g

/**
 * Escapes HTML special characters to prevent XSS attacks.
 *
 * Converts the following characters to their HTML entity equivalents:
 * - & → &amp;
 * - < → &lt;
 * - > → &gt;
 * - " → &quot;
 * - ' → &#x27;
 * - / → &#x2F;
 *
 * @param str - The string to escape
 * @returns The escaped string safe for HTML output
 *
 * @example
 * ```ts
 * escapeHtml('<script>alert("XSS")</script>')
 * // Returns: &lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;
 * ```
 */
export function escapeHtml(str: string | null | undefined): string {
  if (str == null) return ''
  return String(str).replace(HTML_ENTITIES_REGEX, (char) => HTML_ENTITIES[char] || char)
}

/**
 * Unescapes HTML entities back to their original characters.
 * Use with caution - only unescape content you trust!
 *
 * @param str - The string with HTML entities to unescape
 * @returns The unescaped string
 */
export function unescapeHtml(str: string | null | undefined): string {
  if (str == null) return ''

  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
}
