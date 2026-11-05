import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { createAuth, type AppAuth } from './auth.js';
import { createApp } from './app.js';

test('real auth flow reports created accounts, duplicate emails/usernames and email failures accurately', async () => {
  let failMail = false;
  const sent: string[] = [];
  const origin = 'http://127.0.0.1:5173';
  const allowedEmails = 'first@example.test,second@example.test,third@example.test';
  const configured = createAuth({ databaseUrl: 'postgres://unused:unused@localhost/unused', secret: 'test-only-secret-at-least-thirty-two-characters', baseURL: origin, allowedEmails,
    sendMail: async to => { if (failMail) throw new Error('Simulated SMTP rejection'); sent.push(to); } });
  const auth = betterAuth({ ...configured.auth.options, database: memoryAdapter({ auth_user: [], auth_account: [], auth_session: [], auth_verification: [] }), rateLimit: { enabled: false } }) as unknown as AppAuth;
  const app = createApp({ auth, allowedEmails });
  const signup = (email: string, username: string) => request(app).post('/api/auth/sign-up/email').set('Origin', origin).send({ name: 'Tester', email, username, ageConfirmed:true, password: 'test-password-12345', callbackURL: origin });
  try {
    const created = await signup('first@example.test', 'tester').expect(201);
    assert.equal(created.body.code, 'ACCOUNT_CREATED');
    assert.deepEqual(sent, ['first@example.test']);
    const duplicate = await signup('FIRST@example.test', 'newtester').expect(409);
    assert.equal(duplicate.body.code, 'EMAIL_ALREADY_EXISTS');
    const username = await signup('second@example.test', 'TESTER');
    assert.equal(username.status, 400);
    assert.match(username.body.message, /username.*taken|username.*exists/i);
    failMail = true;
    const failedMail = await signup('third@example.test', 'thirdtester').expect(502);
    assert.equal(failedMail.body.code, 'ACCOUNT_CREATED_EMAIL_FAILED');
    await signup('third@example.test', 'thirdtester').expect(409);
    const resend = () => request(app).post('/api/auth/send-verification-email').set('Origin', origin).send({ email: 'third@example.test', callbackURL: origin });
    assert.equal((await resend().expect(502)).body.code, 'EMAIL_SEND_FAILED');
    failMail = false;
    await resend().expect(200);
    assert.deepEqual(sent, ['first@example.test', 'third@example.test']);
  } finally { await configured.pool.end(); }
});

test('public registration accepts a new email while admin rights remain separate', async () => {
  const { allowedEmail, isAdmin } = await import('./auth.js');
  assert.equal(allowedEmail('new-person@example.test', ''), true);
  assert.equal(isAdmin('new-person@example.test'), false);
  const configured = createAuth({ databaseUrl: 'postgres://unused:unused@localhost/unused', secret: 'test-only-secret-at-least-thirty-two-characters', baseURL: 'http://127.0.0.1:5173', allowedEmails: '', sendMail: async () => {} });
  const auth = betterAuth({ ...configured.auth.options, database: memoryAdapter({ auth_user: [], auth_account: [], auth_session: [], auth_verification: [] }), rateLimit: { enabled: false } }) as unknown as AppAuth;
  try {
    await request(createApp({ auth, allowedEmails: '' })).post('/api/auth/sign-up/email').set('Origin', 'http://127.0.0.1:5173').send({ name: 'New tester', ageConfirmed:true, username: 'newtester', email: 'new-person@example.test', password: 'test-password-12345' }).expect(201);
  } finally { await configured.pool.end(); }
});
