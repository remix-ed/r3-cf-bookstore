/**
 * Validation Errors Component
 *
 * Specifically designed for displaying validation errors from Valibot schemas.
 * This component provides a consistent way to show field-level validation errors.
 *
 * @example
 * // Basic usage
 * <ValidationErrors errors={validation.errors} />
 *
 * @example
 * // With custom title
 * <ValidationErrors
 *   errors={validation.errors}
 *   title="Please fix the following errors:"
 * />
 */

import type { ValidationError } from '~/app/utils/validation'

export interface ValidationErrorsProps {
  /** Array of validation errors from Valibot */
  errors: ValidationError[]
  /** Optional heading text */
  title?: string
  /** Additional CSS class names */
  className?: string
}

export function ValidationErrors({
  errors,
  title,
  className = '',
}: ValidationErrorsProps) {
  if (!errors || errors.length === 0) {
    return null
  }

  return (
    <div class={`alert alert-error ${className}`.trim()} role="alert" aria-live="polite">
      {title && <h3 style="margin-top: 0;">{title}</h3>}
      <div>
        {errors.map((error) => (
          <div key={error.field} style="margin-bottom: 0.5rem;">
            <strong>{error.field}:</strong> {error.message}
          </div>
        ))}
      </div>
    </div>
  )
}
