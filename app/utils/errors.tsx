/**
 * Error Handling Utilities
 *
 * Centralized utilities for rendering consistent error responses across the application.
 * Provides standardized functions for common HTTP error scenarios.
 */

import type { AppContext } from '~/app/context.server'
import type { User } from '~/app/models/users'
import type { ValidationResult } from '~/app/utils/validation'
import { render } from '~/app/utils/render'
import { Layout, Document } from '~/app/layout'
import { ValidationErrors } from '~/app/components/validation-errors'
import { ErrorAlert } from '~/app/components/error-alert'
import { ErrorPage, type ErrorPageAction } from '~/app/components/error-page'

// =============================================================================
// Type Definitions
// =============================================================================

export interface ValidationErrorOptions {
  /** User context (for layout) */
  user?: User | null
  /** Title for the error alert */
  title?: string
  /** URL to navigate back to */
  backUrl?: string
  /** Label for the back button */
  backLabel?: string
  /** Use Document instead of Layout */
  useDocument?: boolean
}

export interface NotFoundOptions {
  /** User context (for layout) */
  user?: User | null
  /** Custom title (default: "Not Found") */
  title?: string
  /** Custom message */
  message?: string
  /** Action buttons */
  actions?: ErrorPageAction[]
}

export interface ForbiddenOptions {
  /** User context (for layout) */
  user?: User | null
  /** Custom message */
  message?: string
  /** Action buttons */
  actions?: ErrorPageAction[]
}

export interface UnauthorizedOptions {
  /** Custom message */
  message?: string
  /** URL to redirect to (for login) */
  redirectTo?: string
  /** Action buttons */
  actions?: ErrorPageAction[]
}

// =============================================================================
// Validation Error Rendering
// =============================================================================

/**
 * Render a validation error response
 *
 * Returns a 400 Bad Request response with validation errors displayed
 * in a consistent format.
 *
 * @example
 * const validation = validateForm(formData, LoginSchema)
 * if (!validation.success) {
 *   return renderValidationError(context, validation, {
 *     user: null,
 *     title: 'Login Failed',
 *     backUrl: routes.auth.login.index.href(),
 *     backLabel: 'Back to Login',
 *     useDocument: true
 *   })
 * }
 */
export function renderValidationError(
  context: AppContext,
  validation: ValidationResult<any>,
  options: ValidationErrorOptions = {}
): Response {
  const {
    user,
    title = 'Validation Errors',
    backUrl,
    backLabel = 'Go Back',
    useDocument = false,
  } = options

  const cardStyle = useDocument ? 'max-width: 500px; margin: 2rem auto;' : undefined

  const content = (
    <div class="card" style={cardStyle}>
      <ValidationErrors errors={validation.success ? [] : validation.errors} title={title} />

      {backUrl && (
        <p style="margin-top: 1rem;">
          <a href={backUrl} class="btn">
            {backLabel}
          </a>
        </p>
      )}
    </div>
  )

  const page = useDocument || user === null || user === undefined
    ? <Document>{content}</Document>
    : <Layout user={user}>{content}</Layout>

  return render(page, context, { status: 400 })
}

// =============================================================================
// HTTP Error Pages
// =============================================================================

/**
 * Render a 404 Not Found response
 *
 * @example
 * const book = await getBookById(context, id)
 * if (!book) {
 *   return renderNotFound(context, {
 *     user,
 *     title: 'Book Not Found',
 *     message: 'The book you are looking for does not exist.',
 *     actions: [
 *       { label: 'Browse Books', href: routes.books.index.href() }
 *     ]
 *   })
 * }
 */
export function renderNotFound(
  context: AppContext,
  options: NotFoundOptions = {}
): Response {
  const {
    user,
    title = 'Not Found',
    message = 'The resource you are looking for does not exist.',
    actions = [],
  } = options

  return render(
    <ErrorPage
      statusCode={404}
      title={title}
      message={message}
      user={user}
      actions={actions}
    />,
    context,
    { status: 404 }
  )
}

/**
 * Render a 403 Forbidden response
 *
 * @example
 * if (!user || user.role !== 'admin') {
 *   return renderForbidden(context, {
 *     user,
 *     message: 'You must be an administrator to access this page.',
 *     actions: [
 *       { label: 'Go Home', href: routes.home.href() }
 *     ]
 *   })
 * }
 */
export function renderForbidden(
  context: AppContext,
  options: ForbiddenOptions = {}
): Response {
  const {
    user,
    message = 'You do not have permission to access this resource.',
    actions = [],
  } = options

  return render(
    <ErrorPage
      statusCode={403}
      title="Forbidden"
      message={message}
      user={user}
      actions={actions}
    />,
    context,
    { status: 403 }
  )
}

/**
 * Render a 401 Unauthorized response
 *
 * Used for authentication failures. Typically renders in a Document
 * (no Layout) since the user is not authenticated.
 *
 * @example
 * const user = await authenticateUser(context, email, password)
 * if (!user) {
 *   return renderUnauthorized(context, {
 *     message: 'Invalid email or password. Please try again.',
 *     actions: [
 *       { label: 'Back to Login', href: routes.auth.login.index.href() }
 *     ]
 *   })
 * }
 */
export function renderUnauthorized(
  context: AppContext,
  options: UnauthorizedOptions = {}
): Response {
  const {
    message = 'Authentication required.',
    actions = [],
  } = options

  const content = (
    <div class="card" style="max-width: 500px; margin: 2rem auto;">
      <ErrorAlert message={message} />

      {actions.length > 0 && (
        <div style="margin-top: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
          {actions.map((action) => (
            <a href={action.href} class="btn" key={action.href}>
              {action.label}
            </a>
          ))}
        </div>
      )}
    </div>
  )

  return render(<Document>{content}</Document>, context, { status: 401 })
}

/**
 * Render a generic error message response
 *
 * Used for custom error scenarios that don't fit standard HTTP error codes.
 *
 * @example
 * if (cart.items.length === 0) {
 *   return renderError(context, {
 *     user,
 *     title: 'Empty Cart',
 *     message: 'Your cart is empty. Add some books before checking out.',
 *     statusCode: 400,
 *     actions: [
 *       { label: 'Browse Books', href: routes.books.index.href() }
 *     ]
 *   })
 * }
 */
export function renderError(
  context: AppContext,
  options: {
    user?: User | null
    title: string
    message?: string
    statusCode?: number
    actions?: ErrorPageAction[]
  }
): Response {
  const { user, title, message, statusCode = 400, actions = [] } = options

  return render(
    <ErrorPage
      statusCode={statusCode}
      title={title}
      message={message}
      user={user}
      actions={actions}
    />,
    context,
    { status: statusCode }
  )
}
