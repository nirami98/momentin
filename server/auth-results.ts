import { AsyncLocalStorage } from 'node:async_hooks';
type Outcome = { createdUserId?: string; mail?: 'accepted' | 'failed' };
const outcomes = new AsyncLocalStorage<Outcome>();
export function recordAccountCreated(id: string) { const state = outcomes.getStore(); if (state) state.createdUserId = id; }
export async function trackMail(send: () => Promise<void>) {
  const state = outcomes.getStore();
  try { await send(); if (state) state.mail = 'accepted'; }
  catch (error) { if (state) state.mail = 'failed'; throw error; }
}
export async function authResponse(handler: (request: Request) => Promise<Response>, request: Request): Promise<Response> {
  return outcomes.run({}, async () => {
    const state = outcomes.getStore()!;
    const response = await handler(request);
    const path = new URL(request.url).pathname;
    const signup = path === '/api/auth/sign-up/email';
    const resend = path === '/api/auth/send-verification-email';
    if (state.mail === 'failed') {
      return Response.json({ code: signup && state.createdUserId ? 'ACCOUNT_CREATED_EMAIL_FAILED' : 'EMAIL_SEND_FAILED',
        message: signup && state.createdUserId
          ? 'Account created, but the verification email could not be sent. Please use Resend verification email.'
          : 'Verification email could not be sent. Please try again shortly.' }, { status: 502 });
    }
    if (signup && response.ok) {
      if (!state.createdUserId) return Response.json({ code: 'EMAIL_ALREADY_EXISTS', message: 'An account already exists with this email. Please sign in.' }, { status: 409 });
      if (state.mail !== 'accepted') return Response.json({ code: 'ACCOUNT_CREATED_EMAIL_FAILED', message: 'Account created, but the verification email could not be sent. Please use Resend verification email.' }, { status: 502 });
      return Response.json({ ...(await response.json()), code: 'ACCOUNT_CREATED', message: 'Account created. Check your email to verify your account.' }, { status: 201, headers: response.headers });
    }
    if (resend && response.ok && state.mail !== 'accepted') return Response.json({ code: 'VERIFICATION_NOT_SENT', message: 'No verification email was sent. Check your email address or sign in if it is already verified.' }, { status: 409 });
    return response;
  });
}
