import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { localDate } from '../shared/models.js';
import { createStore, type Store } from './store.js';

const habitSchema = z.object({ title: z.string().trim().min(1).max(100), category: z.string().trim().min(1).max(30), target: z.number().positive().max(100000), unit: z.string().trim().min(1).max(20) }).strict();
const logSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), value: z.number().min(0).max(100000) }).strict();
type Config = { token?: string; owner?: string; timeZone?: string; databaseUrl?: string; store?: Store; now?: () => Date };
export function createApp(config: Config = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  const router = express.Router();
  router.get('/health', (_req, res) => res.json({ status: 'ok', service: 'momentin-api' }));
  router.use((req, res, next) => {
    const expected = config.token ?? process.env.OWNER_ACCESS_TOKEN;
    if (!expected || expected.length < 32) { res.status(503).json({ error: 'Owner access is not configured. Follow SETUP.md.' }); return; }
    const given = req.headers.authorization?.replace(/^Bearer /, '') ?? '';
    const a = Buffer.from(given), b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) { res.status(401).json({ error: 'Owner key is incorrect.' }); return; }
    next();
  });
  router.use((_req, res, next) => {
    const owner = config.owner ?? process.env.OWNER_ID;
    const timeZone = config.timeZone ?? process.env.OWNER_TIME_ZONE ?? 'Asia/Kolkata';
    const url = config.databaseUrl ?? process.env.DATABASE_URL;
    if (!z.uuid().safeParse(owner).success || (!config.store && !url)) { res.status(503).json({ error: 'Database or owner configuration is missing. Follow SETUP.md.' }); return; }
    res.locals.owner = owner;
    res.locals.timeZone = timeZone;
    res.locals.date = localDate(config.now?.() ?? new Date(), timeZone);
    res.locals.store = config.store ?? createStore(url!);
    next();
  });
  router.get('/habits', async (_req, res) => {
    const { owner, date, timeZone, store } = res.locals;
    res.json({ date, timeZone, habits: await (store as Store).list(owner, date) });
  });
  router.post('/habits', async (req, res) => {
    const parsed = habitSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Enter a title, category, positive target, and unit within the allowed limits.' }); return; }
    res.status(201).json(await (res.locals.store as Store).create(res.locals.owner, parsed.data));
  });
  router.put('/habits/:id/check-in', async (req, res) => {
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
    res.status(badBody ? 400 : 503).json({ error: badBody ? 'Invalid request body.' : 'The service is unavailable. Check the database connection and migrations, then retry.' });
  });
  return app;
}
