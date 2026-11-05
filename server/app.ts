import express from 'express';
import { filesRouter } from './files.js';
import { planOn, scheduled } from '../shared/planning.js';
import { planningRouter, readPlanning } from './planning.js';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { authResponse } from './auth-results.js';
import { fromNodeHeaders } from 'better-auth/node';
import { getAuth, allowedEmail, registrationEmails, isAdmin, type AppAuth } from './auth.js';
import { createProfiles, type Profiles } from './profiles.js';
import { profileSchema } from '../shared/profile.js';
import { localDate } from '../shared/models.js';
import { createStore, type Store } from './store.js';

const habitSchema = z.object({ title: z.string().trim().min(1).max(100), category: z.string().trim().min(1).max(30), target: z.number().positive().max(100000), unit: z.string().trim().min(1).max(20) }).strict();
const logSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), value: z.number().min(0).max(100000) }).strict();
type Config = { auth?: AppAuth; allowedEmails?: string; profiles?: Profiles; token?: string; owner?: string; timeZone?: string; databaseUrl?: string; store?: Store; now?: () => Date };
export function createApp(config: Config = {}) {
  const app = express();
  app.disable('x-powered-by');
  // serverless-http supplies a buffered body on an already-complete request.
  // Express 5's JSON parser skips that stream, so decode it explicitly.
  app.use((req, res, next) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0 || !req.is('application/json')) { next(); return; }
    if (req.body.length > (req.path.includes('/planning') ? 256 : 16) * 1024) { res.status(400).json({ error: 'Invalid request body.' }); return; }
    try {
      const body = JSON.parse(req.body.toString('utf8'));
      if (body === null || typeof body !== 'object') throw new Error('Invalid JSON body');
      req.body = body;
      next();
    } catch { res.status(400).json({ error: 'Invalid request body.' }); }
  });
  app.use(['/api/files','/.netlify/functions/api/files'], express.raw({ type: 'application/octet-stream', limit: '2mb' }));
  app.use(['/api/planning','/.netlify/functions/api/planning'], express.json({ limit: '256kb' }));
  app.use(express.json({ limit: '16kb' }));
  app.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  const router = express.Router();
  router.get('/health', (_req, res) => res.json({ status: 'ok', service: 'momentin-api' }));
  const auth = config.auth ?? getAuth();
  router.get('/account-config', (_req, res) => res.json({ enabled: Boolean(auth), google: Boolean(auth?.options.socialProviders?.google) }));
  router.all('/auth/*path', async (req, res) => {
    if (!auth) { res.status(503).json({ error: 'Account sign-in is not configured yet. Please check the server settings.' }); return; }
    const base = String(auth.options.baseURL);
    const path = req.originalUrl.replace(/^\/\.netlify\/functions\/api/, '/api');
    // Reject non-invited registrations explicitly before Better Auth's generic
    // duplicate-account response can conceal a database-hook rejection.
    if (req.method === 'POST' && path.split('?')[0] === '/api/auth/sign-up/email'
        && typeof req.body?.email === 'string'
        && !allowedEmail(req.body.email.trim(), config.allowedEmails ?? registrationEmails())) {
      res.status(403).json({ code: 'INVITE_REQUIRED', message: 'This email is not invited to Momentin yet. Use an invited email or ask the owner to add it. No account was created and no verification email was sent.' });
      return;
    }
    const headers = fromNodeHeaders(req.headers);
    headers.delete('content-length');
    const result = await authResponse(request => auth.handler(request), new Request(new URL(path, base), {
      method: req.method, headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body ?? {}),
    }));
    result.headers.forEach((value, key) => { if (key !== 'set-cookie') res.setHeader(key, value); });
    const cookies = result.headers.getSetCookie();
    if (cookies.length) res.setHeader('set-cookie', cookies);
    res.status(result.status).send(await result.text());
  });
  router.use(async (req, res, next) => {
    if (auth && !req.headers.authorization) {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (session) {
        if (!session.user.emailVerified || !allowedEmail(session.user.email, config.allowedEmails ?? registrationEmails())) {
          res.status(403).json({ error: 'Verify your email before opening your workspace.' }); return;
        }
        if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin !== new URL(String(auth.options.baseURL)).origin) {
          res.status(403).json({ error: 'Request origin is not allowed.' }); return;
        }
        res.locals.user = session.user;
        next(); return;
      }
      res.status(401).json({ error: 'Sign in to continue.' }); return;
    }
    const expected = config.token ?? process.env.OWNER_ACCESS_TOKEN;
    if (!expected || expected.length < 32) { res.status(503).json({ error: 'Owner access is not configured. Follow SETUP.md.' }); return; }
    const given = req.headers.authorization?.replace(/^Bearer /, '') ?? '';
    const a = Buffer.from(given), b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) { res.status(401).json({ error: 'Owner key is incorrect.' }); return; }
    next();
  });
  router.use(async (_req, res, next) => {
    const owner = res.locals.user?.id ?? config.owner ?? process.env.OWNER_ID;
    let timeZone = config.timeZone ?? process.env.OWNER_TIME_ZONE ?? 'Asia/Kolkata';
    const url = config.databaseUrl ?? process.env.DATABASE_URL;
    if (!z.uuid().safeParse(owner).success || (!config.store && !url)) { res.status(503).json({ error: 'Database or owner configuration is missing. Follow SETUP.md.' }); return; }
    if (res.locals.user) {
      res.locals.profiles = config.profiles ?? createProfiles(url!);
      res.locals.profile = await (res.locals.profiles as Profiles).get(owner);
      timeZone = res.locals.profile?.timeZone ?? timeZone;
    }
    res.locals.owner = owner;
    res.locals.timeZone = timeZone;
    res.locals.date = localDate(config.now?.() ?? new Date(), timeZone);
    res.locals.store = config.store ?? createStore(url!);
    next();
  });
  router.get('/me', (_req, res) => {
    if (!res.locals.user) { res.status(403).json({ error: 'Sign in with an account to use profiles.' }); return; }
    res.json({ user: res.locals.user, profile: res.locals.profile });
  });
  router.put('/me', async (req, res) => {
    if (!res.locals.user) { res.status(403).json({ error: 'Sign in with an account to use profiles.' }); return; }
    if (!res.locals.user.username) { res.status(409).json({ error: 'Choose a unique username before saving your profile.' }); return; }
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Check your profile fields, time zone and age confirmation.' }); return; }
    // Time zone is fixed after onboarding so changing it cannot reopen a locked day.
    if (res.locals.profile && parsed.data.timeZone !== res.locals.profile.timeZone) {
      res.status(409).json({ error: 'Time zone changes are not available yet; this protects locked daily records.' }); return;
    }
    await (res.locals.profiles as Profiles).save(res.locals.owner, parsed.data);
    res.json({ profile: parsed.data });
  });
  router.use((_req, res, next) => {
    if (res.locals.user && !res.locals.profile) { res.status(409).json({ error: 'Complete your account setup before recording habits.' }); return; }
    next();
  });
  router.use('/files', filesRouter(() => config.databaseUrl ?? process.env.DATABASE_URL));
  router.use('/planning', planningRouter(() => config.databaseUrl ?? process.env.DATABASE_URL));
  router.get('/habits', async (_req, res) => {
    const { owner, date, timeZone, store } = res.locals;
    if (res.locals.user && !config.store) {
      const s = await readPlanning((config.databaseUrl ?? process.env.DATABASE_URL)!, owner, date, timeZone, res.locals.profile.weekStart);
      const priorities = { high: 0, normal: 1, low: 2 };
      const habits = s.habits.filter(h => scheduled(h, date)).map(h => ({ id: h.id, ...planOn(h,date)!, value: s.entries.find(e => e.habitId === h.id && e.date === date && !e.fallback)?.value ?? 0 })).sort((a,b) => priorities[a.priority]-priorities[b.priority]);
      res.json({ date, timeZone, habits }); return;
    }
    res.json({ date, timeZone, habits: await (store as Store).list(owner, date) });
  });
  router.post('/habits', async (req, res) => {
    const parsed = habitSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Enter a title, category, positive target, and unit within the allowed limits.' }); return; }
    res.status(201).json(await (res.locals.store as Store).create(res.locals.owner, parsed.data));
  });
  router.put('/habits/:id/check-in', async (req, res) => {
    if (res.locals.user && !config.store) { res.status(409).json({ error: 'Refresh the app to record progress using the current schedule.' }); return; }
    const parsed = logSchema.safeParse(req.body);
    if (!parsed.success || !z.uuid().safeParse(req.params.id).success) { res.status(400).json({ error: 'Invalid check-in.' }); return; }
    if (parsed.data.date !== res.locals.date) { res.status(409).json({ error: 'This day is locked or has not started. Refresh Today before recording progress.' }); return; }
    const found = await (res.locals.store as Store).log(res.locals.owner, req.params.id as string, res.locals.date, parsed.data.value);
    if (!found) { res.status(404).json({ error: 'Habit not found.' }); return; }
    res.json({ saved: true });
  });
  // Support both the public rewrite and direct Netlify Function invocation.
  app.use(['/api', '/.netlify/functions/api'], router);
  app.use((_req, res) => res.status(404).json({ error: 'Route not found.' }));
  app.use((error: { type?: string; status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const badBody = error.type === 'entity.parse.failed' || error.type === 'entity.too.large';
    res.status(badBody ? 400 : 503).json(_req.path.includes('/auth/') ? { code: badBody ? 'INVALID_REQUEST' : 'SERVICE_UNAVAILABLE', message: badBody ? 'Invalid request body.' : 'The service is unavailable. Please try again shortly.', error: badBody ? 'Invalid request body.' : 'The service is unavailable. Please try again shortly.' } : { error: badBody ? 'Invalid request body.' : 'The service is unavailable. Please try again shortly.' });
  });
  return app;
}
