import { neon } from '@neondatabase/serverless';
import type { Profile } from '../shared/profile.js';
export interface Profiles {
  get(owner: string): Promise<Profile | null>;
  save(owner: string, profile: Profile): Promise<void>;
}
export function createProfiles(url: string): Profiles {
  const sql = neon(url);
  return {
    async get(owner) { const rows = await sql`SELECT preferences FROM profiles WHERE owner_id = ${owner}::uuid`; return rows[0]?.preferences ?? null; },
    async save(owner, profile) { await sql`INSERT INTO profiles (owner_id, preferences) VALUES (${owner}::uuid, ${JSON.stringify(profile)}::jsonb) ON CONFLICT (owner_id) DO UPDATE SET preferences = EXCLUDED.preferences, updated_at = now()`; },
  };
}
