import '../server/env.js';
import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!databaseUrl) { console.error('Set DATABASE_URL in .env.local or .env before running migrations. See SETUP.md.'); process.exit(1); }
try {
  const sql = neon(databaseUrl);
  const source = await readFile(new URL('../db/migrations/001_foundation.sql', import.meta.url), 'utf8');
  // This initial migration contains no procedural SQL or semicolons in strings.
  const statements = source.split(';').map(s => s.trim()).filter(Boolean);
  await sql.transaction(statements.map(statement => sql.query(statement)));
  console.log('Foundation migration applied. Re-running this initial migration is safe.');
} catch { console.error('Migration failed. Verify the Neon connection string and database permissions. Credentials are not logged.'); process.exit(1); }
