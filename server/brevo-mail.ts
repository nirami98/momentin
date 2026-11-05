/** HTTPS delivery for environments where SMTP ports are unreachable. */
export async function sendBrevoMail(
  key: string, from: string, to: string, subject: string, text: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const match = from.trim().match(/^(.*?)\s*<([^<>]+)>$/);
  const sender = match
    ? { name: match[1].trim().replace(/^"|"$/g, ''), email: match[2].trim() }
    : { email: from.trim() };
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(sender.email)) {
    throw Object.assign(new Error('Invalid email sender configuration'), { code: 'INVALID_SENDER' });
  }
  // A timeout has an uncertain delivery outcome: do not automatically retry or
  // fall back to SMTP, which could send the same verification message twice.
  const response = await fetcher('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender, to: [{ email: to }], subject, textContent: text,
      htmlContent: '<p>' + text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>') + '</p>',
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    // Do not put provider response bodies (which may contain private data) in logs.
    throw Object.assign(new Error('Brevo rejected the email request'), {
      code: 'BREVO_API_REJECTED', responseCode: response.status,
    });
  }
  const body = await response.json() as { messageId?: string };
  if (typeof body.messageId !== 'string' || !body.messageId) {
    throw Object.assign(new Error('Brevo did not confirm email acceptance'), { code: 'BREVO_ACCEPTANCE_UNKNOWN' });
  }
}
