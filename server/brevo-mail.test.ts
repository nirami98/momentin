import test from 'node:test';
import assert from 'node:assert/strict';
import { sendBrevoMail } from './brevo-mail.js';

test('Brevo HTTPS sends the configured sender and requires provider acceptance', async () => {
  const fake: typeof fetch = async (url, options) => {
    assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
    assert.equal(new Headers(options?.headers).get('api-key'), 'test-key');
    const body = JSON.parse(String(options?.body));
    assert.deepEqual(body.sender, { name: 'Momentin', email: 'sender@example.test' });
    assert.deepEqual(body.to, [{ email: 'recipient@example.test' }]);
    assert.equal(body.textContent, 'Verify: https://example.test/?token=test&x=1');
    assert.match(body.htmlContent, /&amp;x=1/);
    return Response.json({ messageId: '<test@example.test>' }, { status: 201 });
  };
  await sendBrevoMail('test-key', 'Momentin <sender@example.test>', 'recipient@example.test', 'Verify', 'Verify: https://example.test/?token=test&x=1', fake);
});
test('Brevo rejection, missing confirmation and timeout never report success or retry', async () => {
  for (const result of ['reject', 'missing', 'timeout']) {
    let calls = 0;
    const fake: typeof fetch = async () => {
      calls++;
      if (result === 'timeout') throw new DOMException('Timed out', 'TimeoutError');
      return Response.json(result === 'reject' ? { message: 'sensitive provider details' } : {}, { status: result === 'reject' ? 401 : 201 });
    };
    await assert.rejects(sendBrevoMail('test-key', 'sender@example.test', 'recipient@example.test', 'Verify', 'Private link', fake), error => {
      assert.ok(error instanceof Error);
      assert.doesNotMatch(error.message, /sensitive|Private link|test-key/);
      return true;
    });
    assert.equal(calls, 1);
  }
});
