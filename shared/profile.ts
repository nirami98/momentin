import { z } from 'zod';
export const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  bio: z.string().trim().max(300),
  interests: z.string().trim().max(200),
  timeZone: z.string().refine(value => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; } }, 'Choose a valid time zone.'),
  weekStart: z.enum(['monday', 'sunday']),
  units: z.enum(['metric', 'imperial']),
  theme: z.enum(['light', 'dark', 'system']),
  palette: z.enum(['mint', 'lavender', 'peach', 'rose', 'sky']),
  reducedMotion: z.boolean(),
  sound: z.boolean().default(false),
  avatarFileId: z.uuid().nullable().default(null),
  ageConfirmed: z.literal(true),
}).strict();
export type Profile = z.infer<typeof profileSchema>;
