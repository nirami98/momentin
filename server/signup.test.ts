import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from './app.js';
import type { AppAuth } from './auth.js';

test('non-invited signup is rejected before the auth provider can return generic success', async () => {
  let calls = 0;
  const auth = {
    options: { baseURL: 'http://127.0.0.1:5173' },
    handler: async () => { calls++; return Response.json({ message: 'Missing fields' }, { status: 400 }); },
  } as unknown as AppAuth;
  const app = createApp({ auth, allowedEmails: 'invited@example.test' });
  for (const root of ['/api', '/.netlify/functions/api']) {
    const response = await request(app).post(`${root}/auth/sign-up/email`).send({ email: 'not-invited@example.test' }).expect(403);
    assert.equal(response.body.code, 'INVITE_REQUIRED');
    assert.match(response.body.message, /No account was created/);
  }
  assert.equal(calls, 0);
  await request(app).post('/api/auth/sign-up/email').send({ email: 'INVITED@example.test' }).expect(400);
  assert.equal(calls, 1);
});
