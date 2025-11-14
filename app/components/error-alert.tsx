/**
 * Error Alert Component
 *
 * Displays error messages in a consistent alert box format.
 * Supports single messages, multiple errors, or custom content.
 *
 * @example
 * // Simple error message
 * <ErrorAlert message="Invalid email or password" />
 *
 * @example
 * // With title
 * <ErrorAlert title="Login Failed" message="Invalid credentials" />
 *
 * @example
 * // Validation errors
 * <ErrorAlert title="Validation Failed" errors={validation.errors} />
 *
 * @example
 * // Custom content
 * <ErrorAlert>
 *   <p>Something went wrong!</p>
 *   <a href="/help">Get Help</a>
 * </ErrorAlert>
 */

import type { ValidationError } from '~/app/utils/validation'

export interface ErrorAlertProps {
  /** Optional title/heading for the error */
  title?: string
  /** Simple error message */
  message?: string
  /** Array of validation errors */
  errors?: ValidationError[]
  /** Custom error content */
  children?: any
  /** Additional CSS class names */
  className?: string
}

export function ErrorAlert({
  title,
  message,
  errors,
  children,
  className = '',
}: ErrorAlertProps) {
  return (
    <div class={`alert alert-error ${className}`.trim()} role="alert">
      {title && <h3 style="margin-top: 0;">{title}</h3>}

      {message && <div>{message}</div>}

      {errors && errors.length > 0 && (
        <div>
          {errors.map((error) => (
            <div>
              <strong>{error.field}:</strong> {error.message}
            </div>
          ))}
        </div>
      )}

      {children}
    </div>
  )
}
