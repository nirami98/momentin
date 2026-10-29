import test from 'node:test';
import assert from 'node:assert/strict';
import serverless from 'serverless-http';
import { createApp } from './app.js';
import type { Habit } from '../shared/models.js';

test('Netlify adapter creates, lists, and updates a habit with JSON and base64 bodies', async () => {
  const habits: Habit[] = [];
  const id = '00000000-0000-4000-8000-000000000002';
  const handler = serverless(createApp({
    token: 'x'.repeat(40), owner: '00000000-0000-4000-8000-000000000001',
    now: () => new Date('2026-10-29T10:00:00Z'), timeZone: 'Asia/Kolkata',
    store: {
      async list() { return habits; },
      async create(_owner, input) { const habit = { ...input, id, value: 0 }; habits.push(habit); return habit; },
      async log(_owner, habitId, _date, value) { const habit = habits.find(h => h.id === habitId); if (!habit) return false; habit.value = value; return true; },
    },
  }));
  async function invoke(method: string, path: string, body = '', encoded = false) {
    return await handler({ httpMethod: method, path, headers: { 'content-type': 'application/json', authorization: `Bearer ${'x'.repeat(40)}` }, body: encoded ? Buffer.from(body).toString('base64') : body, isBase64Encoded: encoded, requestContext: {} }, {}) as { statusCode: number; body: string };
  }
  const created = await invoke('POST', '/api/habits', JSON.stringify({ title: 'Netlify test', category: 'Learning', target: 1, unit: 'session' }));
  assert.equal(created.statusCode, 201);
  const updated = await invoke('PUT', `/.netlify/functions/api/habits/${id}/check-in`, JSON.stringify({ date: '2026-10-29', value: 1 }), true);
  assert.equal(updated.statusCode, 200);
  const listed = await invoke('GET', '/api/habits');
  assert.equal(listed.statusCode, 200);
  assert.equal(JSON.parse(listed.body).habits[0].value, 1);
  assert.equal((await invoke('POST', '/api/habits', '{invalid')).statusCode, 400);
  assert.equal((await invoke('POST', '/api/habits', JSON.stringify({ title: 'x'.repeat(17000) }))).statusCode, 400);
  assert.equal(habits.length, 1);
});
