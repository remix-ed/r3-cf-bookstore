import type { RouteHandlers } from '@remix-run/fetch-router'
import { redirect } from '@remix-run/fetch-router/response-helpers'

import { routes } from '~/app/routes'
import { getSession, setSessionCookie, login, logout } from '~/app/utils/session'
import {
  authenticateUser,
  createUser,
  getUserByEmail,
  createPasswordResetToken,
  resetPassword,
  LoginSchema,
  InsertUserSchema,
  ResetPasswordSchema,
} from '~/app/models/users'
import { Document } from '~/app/layout'
import { loadAuth } from '~/app/middleware/auth'
import { render } from '~/app/utils/render'
import { validateForm, v } from '~/app/utils/validation'
import { renderValidationError, renderUnauthorized } from '~/app/utils/errors'
import { ErrorAlert } from '~/app/components/error-alert'
import { SuccessAlert } from '~/app/components/success-alert'

export default {
  middleware: [loadAuth],
  handlers: {
    login: {
      index({ storage: context }) {
        return render(
          <Document>
            <div class="card" style="max-width: 500px; margin: 2rem auto;">
              <h1>Login</h1>
              <form method="POST" action={routes.auth.login.action.href()}>
                <div class="form-group">
                  <label for="email">Email</label>
                  <input type="email" id="email" name="email" required autoComplete="email" />
                </div>

                <div class="form-group">
                  <label for="password">Password</label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    required
                    autoComplete="current-password"
                  />
                </div>

                <button type="submit" class="btn">
                  Login
                </button>
              </form>

              <p style="margin-top: 1.5rem;">
                Don't have an account? <a href={routes.auth.register.index.href()}>Register here</a>
              </p>
              <p>
                <a href={routes.auth.forgotPassword.index.href()}>Forgot password?</a>
              </p>

              <div style="margin-top: 2rem; padding: 1rem; background: #f8f9fa; border-radius: 4px;">
                <p style="font-size: 0.9rem;">
                  <strong>Demo Accounts:</strong>
                </p>
                <p style="font-size: 0.9rem;">Admin: admin@bookstore.com / admin123</p>
                <p style="font-size: 0.9rem;">Customer: customer@example.com / password123</p>
              </div>
            </div>
          </Document>, context,
        )
      },

      async action({ request, formData, storage: context }) {
        // Validate login credentials
        const validation = validateForm(formData, LoginSchema)

        if (!validation.success) {
          return renderValidationError(context, validation, {
            title: 'Login Failed',
            backUrl: routes.auth.login.index.href(),
            backLabel: 'Back to Login',
            useDocument: true,
          })
        }

        let user = await authenticateUser(context, validation.data.email, validation.data.password)

        if (!user) {
          return renderUnauthorized(context, {
            message: 'Invalid email or password. Please try again.',
            actions: [
              { label: 'Back to Login', href: routes.auth.login.index.href() },
            ],
          })
        }

        let session = await getSession(context, request)
        await login(context, session.sessionId, user)

        let headers = new Headers()
        setSessionCookie(headers, session.sessionId)

        return redirect(routes.account.index.href(), { headers })
      },
    },

    register: {
      index({ storage: context }) {
        return render(
          <Document>
            <div class="card" style="max-width: 500px; margin: 2rem auto;">
              <h1>Register</h1>
              <form method="POST" action={routes.auth.register.action.href()}>
                <div class="form-group">
                  <label for="name">Name</label>
                  <input type="text" id="name" name="name" required autoComplete="name" />
                </div>

                <div class="form-group">
                  <label for="email">Email</label>
                  <input type="email" id="email" name="email" required autoComplete="email" />
                </div>

                <div class="form-group">
                  <label for="password">Password</label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    required
                    autoComplete="new-password"
                  />
                </div>

                <button type="submit" class="btn">
                  Register
                </button>
              </form>

              <p style="margin-top: 1.5rem;">
                Already have an account? <a href={routes.auth.login.index.href()}>Login here</a>
              </p>
            </div>
          </Document>, context,
        )
      },

      async action({ request, formData, storage: context }) {
        // Validate registration data
        const validation = validateForm(formData, InsertUserSchema)

        if (!validation.success) {
          return renderValidationError(context, validation, {
            title: 'Registration Failed',
            backUrl: routes.auth.register.index.href(),
            backLabel: 'Back to Register',
            useDocument: true,
          })
        }

        // Check if user already exists
        if (await getUserByEmail(context, validation.data.email)) {
          return render(
            <Document>
              <div class="card" style="max-width: 500px; margin: 2rem auto;">
                <ErrorAlert message="An account with this email already exists." />
                <p style="margin-top: 1rem;">
                  <a href={routes.auth.register.index.href()} class="btn">
                    Back to Register
                  </a>
                  <a
                    href={routes.auth.login.index.href()}
                    class="btn btn-secondary"
                    style="margin-left: 0.5rem;"
                  >
                    Login
                  </a>
                </p>
              </div>
            </Document>, context,
            { status: 400 },
          )
        }

        let user = await createUser(
          context,
          validation.data.email,
          validation.data.password,
          validation.data.name,
          validation.data.role,
        )

        let session = await getSession(context, request)
        await login(context, session.sessionId, user)

        let headers = new Headers()
        setSessionCookie(headers, session.sessionId)

        return redirect(routes.account.index.href(), { headers })
      },
    },

    async logout({ request, storage: context }) {
      let session = await getSession(context, request)
      await logout(context, session.sessionId)

      return redirect(routes.home.href())
    },

    forgotPassword: {
      index({ storage: context }) {
        return render(
          <Document>
            <div class="card" style="max-width: 500px; margin: 2rem auto;">
              <h1>Forgot Password</h1>
              <p>Enter your email address and we'll send you a link to reset your password.</p>

              <form method="POST" action={routes.auth.forgotPassword.action.href()}>
                <div class="form-group">
                  <label for="email">Email</label>
                  <input type="email" id="email" name="email" required autoComplete="email" />
                </div>

                <button type="submit" class="btn">
                  Send Reset Link
                </button>
              </form>

              <p style="margin-top: 1.5rem;">
                <a href={routes.auth.login.index.href()}>Back to Login</a>
              </p>
            </div>
          </Document>, context,
        )
      },

      async action({ request, formData, storage: context }) {
        // Validate email (inline schema for simple validation)
        const EmailSchema = v.object({
          email: v.pipe(v.string(), v.email()),
        })

        const validation = validateForm(formData, EmailSchema)

        if (!validation.success) {
          return renderValidationError(context, validation, {
            title: 'Invalid Email',
            backUrl: routes.auth.forgotPassword.index.href(),
            backLabel: 'Try Again',
            useDocument: true,
          })
        }

        let token = await createPasswordResetToken(context, validation.data.email)

        return render(
          <Document>
            <div class="card" style="max-width: 500px; margin: 2rem auto;">
              <SuccessAlert message="Password reset link sent! Check your email." />

              {token ? (
                <div style="margin-top: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 4px;">
                  <p style="font-size: 0.9rem;">
                    <strong>Demo Mode:</strong> Click the link below to reset your password
                  </p>
                  <p style="margin-top: 0.5rem;">
                    <a
                      href={routes.auth.resetPassword.index.href({ token })}
                      class="btn btn-secondary"
                    >
                      Reset Password
                    </a>
                  </p>
                </div>
              ) : null}

              <p style="margin-top: 1.5rem;">
                <a href={routes.auth.login.index.href()} class="btn">
                  Back to Login
                </a>
              </p>
            </div>
          </Document>, context,
        )
      },
    },

    resetPassword: {
      index({ params, storage: context }) {
        let token = params.token

        return render(
          <Document>
            <div class="card" style="max-width: 500px; margin: 2rem auto;">
              <h1>Reset Password</h1>
              <p>Enter your new password below.</p>

              <form method="POST" action={routes.auth.resetPassword.action.href({ token })}>
                <div class="form-group">
                  <label for="password">New Password</label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    required
                    autoComplete="new-password"
                  />
                </div>

                <div class="form-group">
                  <label for="confirmPassword">Confirm Password</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    required
                    autoComplete="new-password"
                  />
                </div>

                <button type="submit" class="btn">
                  Reset Password
                </button>
              </form>
            </div>
          </Document>, context,
        )
      },

      async action({ request, formData, params, storage: context }) {
        // Validate password reset data (with token and password)
        const ResetPasswordWithConfirmSchema = v.object({
          password: v.pipe(v.string(), v.minLength(8), v.maxLength(100)),
          confirmPassword: v.pipe(v.string(), v.minLength(8), v.maxLength(100)),
        })

        const validation = validateForm(formData, ResetPasswordWithConfirmSchema)

        if (!validation.success) {
          return renderValidationError(context, validation, {
            title: 'Invalid Password',
            backUrl: routes.auth.resetPassword.index.href({ token: params.token }),
            backLabel: 'Try Again',
            useDocument: true,
          })
        }

        if (validation.data.password !== validation.data.confirmPassword) {
          return render(
            <Document>
              <div class="card" style="max-width: 500px; margin: 2rem auto;">
                <ErrorAlert message="Passwords do not match." />
                <p style="margin-top: 1rem;">
                  <a
                    href={routes.auth.resetPassword.index.href({ token: params.token })}
                    class="btn"
                  >
                    Try Again
                  </a>
                </p>
              </div>
            </Document>, context,
            { status: 400 },
          )
        }

        let success = await resetPassword(context, params.token, validation.data.password)

        if (!success) {
          return render(
            <Document>
              <div class="card" style="max-width: 500px; margin: 2rem auto;">
                <ErrorAlert message="Invalid or expired reset token." />
                <p style="margin-top: 1rem;">
                  <a href={routes.auth.forgotPassword.index.href()} class="btn">
                    Request New Link
                  </a>
                </p>
              </div>
            </Document>, context,
            { status: 400 },
          )
        }

        return render(
          <Document>
            <div class="card" style="max-width: 500px; margin: 2rem auto;">
              <SuccessAlert message="Password reset successfully! You can now login with your new password." />
              <p style="margin-top: 1rem;">
                <a href={routes.auth.login.index.href()} class="btn">
                  Login
                </a>
              </p>
            </div>
          </Document>, context,
        )
      },
    },
  },
} satisfies RouteHandlers<typeof routes.auth>
