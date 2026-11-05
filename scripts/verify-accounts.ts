// Explicit disposable database only. Never pass your production URL.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import request from 'supertest';
import serverless from 'serverless-http';
import { getMigrations } from 'better-auth/db/migration';
import { createAuth } from '../server/auth.js';
import { createApp } from '../server/app.js';
const databaseUrl = process.env.AUTH_TEST_DATABASE_URL;
if (!databaseUrl || process.env.AUTH_TEST_CONFIRM_DISPOSABLE !== 'yes') throw new Error('Set AUTH_TEST_DATABASE_URL and AUTH_TEST_CONFIRM_DISPOSABLE=yes for an isolated test branch.');
const suffix = randomUUID().slice(0, 8);
const emails = [`one-${suffix}@example.test`, `two-${suffix}@example.test`];
const letters: { to: string; text: string }[] = [];
const origin = 'http://127.0.0.1:5173';
const { auth, pool } = createAuth({ databaseUrl, secret: randomUUID() + randomUUID(), baseURL: origin, allowedEmails: emails.join(','), sendMail: async (to, _subject, text) => { letters.push({ to, text }); } });
try {
  for (const file of ['001_foundation.sql', '002_profiles.sql', '003_planning.sql', '004_files.sql', '005_template_image_versions.sql']) await pool.query(await readFile(new URL(`../db/migrations/${file}`, import.meta.url), 'utf8'));
  await (await getMigrations(auth.options)).runMigrations();
  const app = createApp({ auth, databaseUrl, allowedEmails: emails.join(',') });
  const handler = serverless(app);
  const password = 'Only-for-isolated-tests-123!';
  await request(app).post('/api/auth/sign-up/email').set('Origin', origin).send({ email: 'not-invited@example.test', name: 'No', username: `no_${suffix}`, password }).expect(403);
  // The app reports invite rejection before the generic library response. Verify no record/mail.
  assert.equal((await pool.query('SELECT id FROM auth_user WHERE email = $1', ['not-invited@example.test'])).rowCount, 0);
  assert.equal(letters.length, 0);
  const cookies: string[] = [];
  for (let i = 0; i < 2; i++) {
    const payload = { ageConfirmed:true, email: emails[i], name: `Tester ${i}`, username: `tester_${i}_${suffix}`, password, callbackURL: origin };
    const response = await handler({ httpMethod: 'POST', path: '/api/auth/sign-up/email', headers: { host: '127.0.0.1:5173', origin, 'content-type': 'application/json' }, body: JSON.stringify(payload), isBase64Encoded: false, requestContext: {} }, {} as never) as { statusCode: number };
    assert.equal(response.statusCode, 201);
    await request(app).post('/api/auth/sign-in/email').set('Origin', origin).send({ email: emails[i], password }).expect(403);
    const letter = letters.find(item => item.to === emails[i]); assert.ok(letter);
    const verifyURL = new URL(letter.text.split('Verify your email: ')[1]);
    await request(app).get(verifyURL.pathname + verifyURL.search).expect(302);
    const login = await request(app).post('/api/auth/sign-in/username').set('Origin', origin).send({ username: payload.username, password }).expect(200);
    const cookie = login.headers['set-cookie']; assert.ok(cookie);
    cookies.push((cookie as unknown as string[]).map(value => value.split(';')[0]).join('; '));
    await request(app).get('/api/me').set('Cookie', cookies[i]).expect(200);
    await request(app).get('/api/habits').set('Cookie', cookies[i]).expect(409);
    const profile = { displayName: payload.name, bio: '', interests: 'Reading', timeZone: 'Asia/Kolkata', weekStart: 'monday', units: 'metric', theme: 'system', palette: 'lavender', reducedMotion: true, ageConfirmed: true };
    await request(app).put('/api/me').set('Cookie', cookies[i]).send(profile).expect(403);
    await request(app).put('/api/me').set('Origin', origin).set('Cookie', cookies[i]).send(profile).expect(200);
    const restored: request.Response = await request(createApp({ auth, databaseUrl, allowedEmails: emails.join(',') })).get('/api/me').set('Cookie', cookies[i]).expect(200);
    assert.equal(restored.body.profile.palette, 'lavender');
    await request(app).put('/api/me').set('Origin', origin).set('Cookie', cookies[i]).send({ ...profile, timeZone: 'UTC' }).expect(409);
  }
  const created = await request(app).post('/api/habits').set('Origin', origin).set('Cookie', cookies[0]).send({ title: 'Account isolation test', category: 'Learning', target: 1, unit: 'session' }).expect(201);
  const second = await request(app).get('/api/habits').set('Cookie', cookies[1]).expect(200);
  assert.equal(second.body.habits.length, 0);
  await request(app).put(`/api/planning/habits/${created.body.id}/check-in`).set('Origin', origin).set('Cookie', cookies[1]).send({ date: second.body.date, value: 1 }).expect(404);
  await request(app).put(`/api/planning/habits/${created.body.id}/check-in`).set('Origin', origin).set('Cookie', cookies[0]).send({ date: second.body.date, value: 1 }).expect(200);
  await request(app).post('/api/auth/request-password-reset').set('Origin', origin).send({ email: emails[0], redirectTo: `${origin}/?account=reset` }).expect(200);
  const reset = letters.find(item => item.to === emails[0] && item.text.startsWith('Reset your password: ')); assert.ok(reset);
  const resetURL = new URL(reset.text.split('\n')[0].replace('Reset your password: ', ''));
  const redirect = await request(app).get(resetURL.pathname + resetURL.search).expect(302);
  const resetToken = new URL(redirect.headers.location).searchParams.get('token'); assert.ok(resetToken);
  await request(app).post('/api/auth/reset-password').set('Origin', origin).send({ token: resetToken, newPassword: password + 'new' }).expect(200);
  await request(app).get('/api/me').set('Cookie', cookies[0]).expect(401);
  await request(app).post('/api/auth/sign-in/email').set('Origin', origin).send({ email: emails[0], password: password + 'new' }).expect(200);
  await request(app).post('/api/auth/sign-out').set('Origin', origin).set('Cookie', cookies[1]).send({}).expect(200);
  await request(app).get('/api/me').set('Cookie', cookies[1]).expect(401);
  console.log('PASS: invite restriction, Netlify signup, email verification, username/email login, restored sessions, persisted onboarding, origin checks, locked time zone, two-user habit isolation, check-in, password reset/session revocation, logout.');
} finally {
  // Only remove records created by this test run; never copied owner data.
  const users = await pool.query('SELECT id FROM auth_user WHERE email = ANY($1)', [emails]);
  for (const user of users.rows) {
    await pool.query('DELETE FROM habits WHERE owner_id = $1', [user.id]);
    await pool.query('DELETE FROM profiles WHERE owner_id = $1', [user.id]);
  }
  await pool.query('DELETE FROM auth_user WHERE email = ANY($1)', [emails]);
  await pool.end();
}
