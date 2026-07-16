import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins/email-otp';
import type { BetterAuthOptions } from 'better-auth';
import type { AppDb } from '@kloyya/db';
import { account, session, user, verification } from '@kloyya/db/schema';
import { provisionTenantForUser } from '../users/provision.js';
import type { EmailSender } from '../email/sender.js';
import {
  OTP_EXPIRY_SECONDS,
  passwordResetCodeEmail,
  verificationCodeEmail,
} from '../email/templates.js';

/**
 * Better Auth configuration, as a factory over the database.
 *
 * Taking `db` as a parameter (rather than importing the singleton) is what makes
 * auth testable: the server passes the real postgres-js client, tests pass an
 * in-memory PGLite one. We import the *tables* from `@kloyya/db/schema` — the
 * side-effect-free subpath — so building options never touches the runtime
 * client (which would demand DATABASE_URL).
 *
 * `generateId: false` defers id creation to Postgres, so identities get real
 * UUIDs from the tables' `defaultRandom()` — consistent with the rest of the
 * schema. The four models map to the tables we defined to Better Auth's exact
 * field shapes, so no column renaming is needed.
 */
export interface AuthDeps {
  /** Signs sessions and tokens. Must be stable across restarts. */
  secret: string;
  /** The API's own base URL, for callback/verification links. */
  baseURL: string;
  /** Origins allowed to drive the auth flows (the web app). */
  trustedOrigins?: string[];
  /** Where verification and reset codes go. Tests pass a recorder. */
  email: EmailSender;
}

export function buildAuthOptions(db: AppDb, deps: AuthDeps): BetterAuthOptions {
  return {
    secret: deps.secret,
    baseURL: deps.baseURL,
    ...(deps.trustedOrigins ? { trustedOrigins: deps.trustedOrigins } : {}),
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      // Deliberately false. With it true, Better Auth withholds the session at
      // sign-up — but the frontend's flow needs one to reach the verify-email
      // screen at all (its mock returns a session with isEmailVerified:false).
      // The UI gates on that flag; enforcing verification server-side belongs on
      // the protected routes, as its own guard, not by breaking sign-up.
      requireEmailVerification: false,
    },
    plugins: [
      emailOTP({
        // The verify-email screen is a six-box code input, not a link — the
        // frontend was built for OTP, so the backend sends OTP.
        otpLength: 6,
        expiresIn: OTP_EXPIRY_SECONDS,
        // The code should already be waiting when the verify screen appears.
        sendVerificationOnSignUp: true,
        async sendVerificationOTP({ email, otp, type }) {
          const message =
            type === 'forget-password'
              ? passwordResetCodeEmail({ code: otp })
              : verificationCodeEmail({ code: otp });
          await deps.email.send({ ...message, to: email });
        },
      }),
    ],
    // Let Postgres mint ids (UUID defaults), not the application layer.
    advanced: { database: { generateId: false } },
    databaseHooks: {
      user: {
        create: {
          // Better Auth creates the identity; we turn it into a tenant. Runs
          // after the `user` row exists, so the id is the Postgres-minted UUID.
          after: async (created) => {
            await provisionTenantForUser(db, { id: created.id, name: created.name });
          },
        },
      },
    },
  };
}
