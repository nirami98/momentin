import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from './app.js';
import { localDate, type Habit } from '../shared/models.js';
import type { Store } from './store.js';

const owner = '00000000-0000-4000-8000-000000000001';
const id = '00000000-0000-4000-8000-000000000002';
const token = 'test-only-owner-key-with-at-least-32-characters';
function fixture() {
  const values = new Map<string, number>();
  const habit: Habit = { id, title: 'Read', category: 'Learning', target: 20, unit: 'minutes', value: 0 };
  const store: Store = {
    async list(user, date) { assert.equal(user, owner); return [{ ...habit, value: values.get(date) ?? 0 }]; },
    async create(user, input) { assert.equal(user, owner); return { ...input, id, value: 0 }; },
    async log(user, habitId, date, value) { assert.equal(user, owner); if (habitId !== id) return false; values.set(date, value); return true; },
  };
  return { values, app: createApp({ token, owner, timeZone: 'Asia/Kolkata', store, now: () => new Date('2026-10-28T19:00:00Z') }) };
}
test('health is public; all data routes require owner authorization', async () => {
  const { app, values } = fixture();
  await request(app).get('/api/health').expect(200);
  await request(app).get('/api/habits').expect(401);
  await request(app).put(`/api/habits/${id}/check-in`).send({ date: '2026-10-29', value: 20 }).expect(401);
  await request(app).get('/.netlify/functions/api/habits').expect(401);
  assert.equal(values.size, 0);
});
test('server local date controls locking, not UTC date or client date', async () => {
  const { app, values } = fixture();
  const today = await request(app).get('/api/habits').auth(token, { type: 'bearer' }).expect(200);
  assert.equal(today.body.date, '2026-10-29');
  for (const date of ['2026-10-28', '2026-10-30']) {
    await request(app).put(`/api/habits/${id}/check-in`).auth(token, { type: 'bearer' }).send({ date, value: 20 }).expect(409);
  }
  assert.equal(values.size, 0);
});
test('same-day writes support partial effort, retry, and undo without extra records', async () => {
  const { app, values } = fixture();
  for (const value of [10, 20, 20, 0]) {
    await request(app).put(`/api/habits/${id}/check-in`).auth(token, { type: 'bearer' }).send({ date: '2026-10-29', value }).expect(200);
    assert.equal(values.get('2026-10-29'), value);
    assert.equal(values.size, 1);
  }
});
test('invalid values, injected ownership, and missing habits are rejected', async () => {
  const { app } = fixture();
  for (const value of [-1, 100001, '20']) await request(app).put(`/api/habits/${id}/check-in`).auth(token, { type: 'bearer' }).send({ date: '2026-10-29', value }).expect(400);
  await request(app).post('/api/habits').auth(token, { type: 'bearer' }).send({ title: 'Read', category: 'Learning', target: 1, unit: 'page', owner_id: id }).expect(400);
  await request(app).post('/api/habits').auth(token, { type: 'bearer' }).send({ title: ' ', category: 'Learning', target: 1, unit: 'page' }).expect(400);
  await request(app).put(`/api/habits/${owner}/check-in`).auth(token, { type: 'bearer' }).send({ date: '2026-10-29', value: 1 }).expect(404);
});
test('malformed JSON does not expose internal errors', async () => {
  const { app } = fixture();
  const response = await request(app).post('/api/habits').set('Content-Type', 'application/json').send('{broken').expect(400);
  assert.deepEqual(response.body, { error: 'Invalid request body.' });
});
test('missing configuration fails closed', async () => {
  await request(createApp({ token: '' })).get('/api/habits').expect(503);
});
test('local dates work across midnight and daylight-saving transitions', () => {
  assert.equal(localDate(new Date('2026-10-28T18:29:59Z'), 'Asia/Kolkata'), '2026-10-28');
  assert.equal(localDate(new Date('2026-10-28T18:30:00Z'), 'Asia/Kolkata'), '2026-10-29');
  assert.equal(localDate(new Date('2026-11-01T06:30:00Z'), 'America/New_York'), '2026-11-01');
});
