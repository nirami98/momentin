export type Habit = { id: string; title: string; category: string; target: number; unit: string; value: number };
export type Snapshot = { date: string; timeZone: string; habits: Habit[] };
export function localDate(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
