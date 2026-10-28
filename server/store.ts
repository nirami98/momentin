import { neon } from '@neondatabase/serverless';
import type { Habit } from '../shared/models.js';

export interface Store {
  list(owner: string, date: string): Promise<Habit[]>;
  create(owner: string, habit: Omit<Habit, 'id' | 'value'>): Promise<Habit>;
  log(owner: string, id: string, date: string, value: number): Promise<boolean>;
}
export function createStore(url: string): Store {
  const sql = neon(url);
  return {
    async list(owner, date) {
      return await sql`SELECT h.id, h.title, h.category, h.target::float8 AS target, h.unit,
        COALESCE(c.value, 0)::float8 AS value FROM habits h LEFT JOIN check_ins c
        ON c.habit_id = h.id AND c.local_date = ${date}::date AND c.owner_id = h.owner_id
        WHERE h.owner_id = ${owner}::uuid ORDER BY h.created_at, h.id` as Habit[];
    },
    async create(owner, habit) {
      const rows = await sql`INSERT INTO habits (owner_id, title, category, target, unit)
        VALUES (${owner}::uuid, ${habit.title}, ${habit.category}, ${habit.target}, ${habit.unit})
        RETURNING id, title, category, target::float8 AS target, unit, 0 AS value`;
      return rows[0] as Habit;
    },
    async log(owner, id, date, value) {
      const rows = await sql`INSERT INTO check_ins (owner_id, habit_id, local_date, value)
        SELECT owner_id, id, ${date}::date, ${value} FROM habits
        WHERE id = ${id}::uuid AND owner_id = ${owner}::uuid
        ON CONFLICT (habit_id, local_date) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
        RETURNING habit_id`;
      return rows.length === 1;
    },
  };
}
