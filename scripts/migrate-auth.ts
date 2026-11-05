import '../server/env.js';
import { getMigrations } from 'better-auth/db/migration';
import { createAuth } from '../server/auth.js';
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error('Set DATABASE_URL before migrating.');
const { auth, pool } = createAuth({ databaseUrl: url, secret: process.env.BETTER_AUTH_SECRET || 'migration-only-not-used-for-serving-requests', baseURL: process.env.BETTER_AUTH_URL || 'http://127.0.0.1:5173', allowedEmails: '', sendMail: async () => { throw new Error('Migration does not send email.'); } });
try {
  const migration = await getMigrations(auth.options);
  await migration.runMigrations();
  console.log('Authentication schema migrated.');
} catch { console.error('Auth migration failed. Check database connectivity and permissions.'); process.exitCode = 1; }
finally { await pool.end(); }
