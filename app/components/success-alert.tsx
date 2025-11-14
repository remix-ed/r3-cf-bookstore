/**
 * Success Alert Component
 *
 * Displays success messages in a consistent alert box format.
 * Used for confirmations, successful operations, and positive feedback.
 *
 * @example
 * // Simple success message
 * <SuccessAlert message="Order placed successfully!" />
 *
 * @example
 * // With title
 * <SuccessAlert title="Success!" message="Your account has been created." />
 *
 * @example
 * // Custom content
 * <SuccessAlert>
 *   <p>Password reset link sent to your email.</p>
 *   <p>Please check your inbox.</p>
 * </SuccessAlert>
 */

export interface SuccessAlertProps {
  /** Optional title/heading for the success message */
  title?: string
  /** Simple success message */
  message?: string
  /** Custom success content */
  children?: any
  /** Additional CSS class names */
  className?: string
}

export function SuccessAlert({
  title,
  message,
  children,
  className = '',
}: SuccessAlertProps) {
  return (
    <div class={`alert alert-success ${className}`.trim()} role="alert" aria-live="polite">
      {title && <h3 style="margin-top: 0;">{title}</h3>}

      {message && <div>{message}</div>}

      {children}
    </div>
  )
}
