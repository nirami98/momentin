import { betterAuth, APIError } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { recordAccountCreated, trackMail } from './auth-results.js';
import { username } from 'better-auth/plugins';
import { Pool } from 'pg';
import nodemailer from 'nodemailer';
import { sendBrevoMail } from './brevo-mail.js';

export function registrationEmails() {
  return process.env.AUTH_REGISTRATION_MODE === 'invite' ? (process.env.AUTH_ALLOWED_EMAILS?.trim() || '__no_invites__') : '';
}
export function allowedEmail(email: string, list = registrationEmails()) {
  if (!list.trim()) return true;
  return list.split(',').map(value => value.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());
}
export function isAdmin(email: string) {
  return (process.env.ADMIN_EMAILS ?? 'nirjadesai98@gmail.com,littlesparkstudio.apps@gmail.com').split(',').map(value => value.trim().toLowerCase()).includes(email.toLowerCase());
}
export function createAuth(options: { databaseUrl: string; secret: string; baseURL: string; allowedEmails: string; sendMail: (to: string, subject: string, text: string) => Promise<void>; google?: { clientId: string; clientSecret: string } }) {
  const pool = new Pool({ connectionString: options.databaseUrl, max: 3, idleTimeoutMillis: 10000, connectionTimeoutMillis: 10000, allowExitOnIdle: true });
  const auth = betterAuth({
    appName: 'Momentin', baseURL: options.baseURL, secret: options.secret,
    database: pool,
    trustedOrigins: [new URL(options.baseURL).origin],
    advanced: { database: { generateId: 'uuid' } },
    user: { modelName: 'auth_user', deleteUser: { enabled: true, beforeDelete: async user => {
      const db = await pool.connect();
      try {
        await db.query('BEGIN');
        await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [user.id]);
        for (const [table, column] of [['template_reports','reporter_id'],['template_feedback','owner_id'],['routine_templates','creator_id'],['private_files','owner_id'],['planning_records','owner_id'],['habits','owner_id'],['profiles','owner_id']]) {
          await db.query('DELETE FROM ' + table + ' WHERE ' + column + '=$1', [user.id]);
        }
        await db.query('COMMIT');
      } catch (error) { await db.query('ROLLBACK'); throw error; }
      finally { db.release(); }
    } } },
    account: { modelName: 'auth_account', accountLinking: { enabled: true, trustedProviders: ['google'] } },
    session: { modelName: 'auth_session', expiresIn: 60 * 60 * 24 * 7, cookieCache: { enabled: false } },
    verification: { modelName: 'auth_verification' },
    rateLimit: { enabled: true, storage: 'database', modelName: 'auth_rate_limit', window: 60, max: 30 },
    emailAndPassword: {
      enabled: true, minPasswordLength: 12, requireEmailVerification: true, revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => options.sendMail(user.email, 'Reset your Momentin password', `Reset your password: ${url}\nIf you did not request this, ignore this email.`),
    },
    emailVerification: { sendOnSignUp: true, sendOnSignIn: true, autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => trackMail(() => options.sendMail(user.email, 'Verify your Momentin email', `Verify your email: ${url}`)),
    },
    socialProviders: options.google ? { google: options.google } : {},
    hooks: { before: createAuthMiddleware(async ctx => {
      if (ctx.path !== '/sign-up/email' && ctx.path !== '/send-verification-email') return;
      if (typeof ctx.body?.email !== 'string') return;
      const email = ctx.body.email.trim().toLowerCase();
      ctx.body.email = email;
      if (!allowedEmail(email, options.allowedEmails)) throw new APIError('FORBIDDEN', { code: 'INVITE_REQUIRED', message: 'This email is not invited to Momentin yet.' });
      const existing = await ctx.context.internalAdapter.findUserByEmail(email);
      if (ctx.path === '/sign-up/email') {
        if (existing) throw new APIError('CONFLICT', { code: 'EMAIL_ALREADY_EXISTS', message: 'An account already exists with this email. Please sign in.' });
        if (ctx.body.ageConfirmed !== true) throw new APIError('BAD_REQUEST', { code: 'AGE_CONFIRMATION_REQUIRED', message: 'You must confirm that you are at least 13 years old.' });
        if (typeof ctx.body.username !== 'string' || !ctx.body.username.trim()) throw new APIError('BAD_REQUEST', { code: 'USERNAME_REQUIRED', message: 'Choose a unique username to create your account.' });
      } else {
        if (!existing) throw new APIError('NOT_FOUND', { code: 'ACCOUNT_NOT_FOUND', message: 'No account exists with this email. Please create an account first.' });
        if (existing.user.emailVerified) throw new APIError('CONFLICT', { code: 'EMAIL_ALREADY_VERIFIED', message: 'Your email is already verified. Please sign in.' });
      }
    }) },
    plugins: [username({ minUsernameLength: 3, maxUsernameLength: 30 })],
    databaseHooks: { user: { create: { before: async user => {
      if (!allowedEmail(user.email, options.allowedEmails)) throw new APIError('FORBIDDEN', { message: 'Momentin is currently available to invited testers only.' });
    }, after: async user => { recordAccountCreated(user.id); } } } },
    logger: { disabled: true },
  });
  return { auth, pool };
}
export type AppAuth = ReturnType<typeof createAuth>['auth'];
let cached: ReturnType<typeof createAuth> | undefined;
export function getAuth(): AppAuth | undefined {
  if (cached) return cached.auth;
  const { DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, BREVO_API_KEY } = process.env;
  if (!DATABASE_URL || !BETTER_AUTH_SECRET || BETTER_AUTH_SECRET.length < 32 || !BETTER_AUTH_URL || !SMTP_FROM || (!BREVO_API_KEY && (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD))) return undefined;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const mailer = BREVO_API_KEY ? undefined : nodemailer.createTransport({ connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000, host: SMTP_HOST, port, secure: port === 465, requireTLS: port !== 465, auth: { user: SMTP_USER, pass: SMTP_PASSWORD } });
  cached = createAuth({ databaseUrl: DATABASE_URL, secret: BETTER_AUTH_SECRET, baseURL: BETTER_AUTH_URL, allowedEmails: registrationEmails(),
    sendMail: async (to, subject, text) => {
      try {
        if (BREVO_API_KEY) { await sendBrevoMail(BREVO_API_KEY, SMTP_FROM, to, subject, text); return; }
        const result = await mailer!.sendMail({ from: SMTP_FROM, to, subject, text });
        if (!result.accepted.some(address => String(address).toLowerCase() === to.toLowerCase())) throw new Error('Recipient not accepted');
      } catch (error) {
        const failure = error as { code?: string; responseCode?: number; command?: string };
        // Never log credentials, mail content or verification links.
        console.error('Email delivery failed', { code: failure.code ?? 'EMAIL_TRANSPORT_FAILED', smtpStatus: failure.responseCode, command: failure.command });
        throw new APIError('SERVICE_UNAVAILABLE', { code: 'EMAIL_SEND_FAILED', message: 'The email service could not send this message. Please try again shortly.' });
      }
    },
    google: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } : undefined,
  });
  return cached.auth;
}
