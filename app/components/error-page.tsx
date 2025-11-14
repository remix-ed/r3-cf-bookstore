/**
 * Error Page Component
 *
 * Generic error page for displaying HTTP errors (404, 403, 500, etc.).
 * Automatically wraps content in appropriate layout based on user context.
 *
 * @example
 * // 404 Not Found (authenticated user)
 * <ErrorPage
 *   statusCode={404}
 *   title="Book Not Found"
 *   message="The book you're looking for doesn't exist."
 *   user={user}
 *   actions={[
 *     { label: 'Browse Books', href: routes.books.index.href() }
 *   ]}
 * />
 *
 * @example
 * // 403 Forbidden (unauthenticated)
 * <ErrorPage
 *   statusCode={403}
 *   title="Access Denied"
 *   message="You don't have permission to access this resource."
 *   user={null}
 *   actions={[
 *     { label: 'Go Home', href: routes.home.href() },
 *     { label: 'Login', href: routes.auth.login.index.href() }
 *   ]}
 * />
 */

import { Layout, Document } from '~/app/layout'
import type { User } from '~/app/models/users'

export interface ErrorPageAction {
  label: string
  href: string
  variant?: 'primary' | 'secondary' | 'danger'
}

export interface ErrorPageProps {
  /** HTTP status code (404, 403, 500, etc.) */
  statusCode: number
  /** Error title */
  title: string
  /** Optional detailed error message */
  message?: string
  /** User context (null for unauthenticated users) */
  user?: User | null
  /** Action buttons to display */
  actions?: ErrorPageAction[]
  /** Custom content to display instead of default message */
  children?: any
}

/**
 * Get button class based on variant
 */
function getButtonClass(variant?: 'primary' | 'secondary' | 'danger'): string {
  switch (variant) {
    case 'secondary':
      return 'btn btn-secondary'
    case 'danger':
      return 'btn btn-danger'
    case 'primary':
    default:
      return 'btn'
  }
}

/**
 * Error Page Component
 */
export function ErrorPage({
  statusCode,
  title,
  message,
  user,
  actions = [],
  children,
}: ErrorPageProps) {
  const content = (
    <div class="card">
      <h1>{title}</h1>

      {message && <p style="margin-top: 1rem; color: #666;">{message}</p>}

      {children}

      {actions.length > 0 && (
        <div style="margin-top: 1.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
          {actions.map((action) => (
            <a
              href={action.href}
              class={getButtonClass(action.variant)}
              key={action.href}
            >
              {action.label}
            </a>
          ))}
        </div>
      )}
    </div>
  )

  // If user is provided (authenticated or explicitly null), use Layout
  // Otherwise use Document for minimal layout
  if (user !== undefined) {
    return <Layout user={user}>{content}</Layout>
  }

  return <Document>{content}</Document>
}
