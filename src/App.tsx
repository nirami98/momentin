import { useEffect, useState, type FormEvent } from 'react';
import { playCompletionSound } from './sound';
import { useNotifications } from './Toast';
import { TodayPlanning } from './TodayPlanning';
import { Planning } from './Planning';
import { Account, type AccountData } from './Account';
import { authClient } from './auth-client';
import type { Profile } from '../shared/profile';
import { localDate, type Habit, type Snapshot } from '../shared/models';

const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const emptySnapshot = (): Snapshot => ({ date: localDate(new Date(), zone), timeZone: zone, habits: [] });
export function App() {
  const [data, setData] = useState<Snapshot>(emptySnapshot);
  const [page, setPage] = useState<'today' | 'account' | 'planning'>('account');
  const [account, setAccount] = useState<AccountData | null>(null);
  const [accountConfig, setAccountConfig] = useState({ enabled: false, google: false });
  const [restoring, setRestoring] = useState(true);
  const connected = Boolean(account);
  const workspaceReady = Boolean(account?.profile);
  const [palette, setPalette] = useState(() => { try { return localStorage.getItem('momentin.palette') ?? 'mint'; } catch { return 'mint'; } });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [themeSaving, setThemeSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const { setError, setNotice } = useNotifications();
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('momentin.theme') ?? 'light'; } catch { return 'light'; } });
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => { document.documentElement.dataset.theme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme; };
    apply(); media.addEventListener('change', apply);
    try { localStorage.setItem('momentin.theme', theme); } catch { /* Optional preference. */ }
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  useEffect(() => { document.documentElement.dataset.palette = palette; try { localStorage.setItem('momentin.palette', palette); } catch { /* Optional preference. */ } }, [palette]);
  useEffect(() => {
    void (async () => {
      try { const response = await fetch('/api/account-config', { signal: AbortSignal.timeout(20000) }); if (!response.ok) throw new Error('Account service unavailable'); const config = await response.json(); setAccountConfig(config); if (config.enabled) await loadAccount(); }
      catch { setError('Could not check account connection. Refresh to try again.'); }
      finally { setRestoring(false); }
    })();
  }, []);
  async function loadAccount() {
    const response = await fetch('/api/me', { signal: AbortSignal.timeout(20000) });
    if (response.status === 401) { clearWorkspace(); return; }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Could not restore your account.');
    const next = result as AccountData;
    const snapshot = next.profile ? await request<Snapshot>('/habits', {}) : { date: localDate(new Date(), zone), timeZone: zone, habits: [] };
    setAccount(next); setData(snapshot);
    if (next.profile) { applyProfile(next.profile); if (!location.search.includes('account=reset')) setPage('today'); }
    else { setData({ date: localDate(new Date(), zone), timeZone: zone, habits: [] }); setPage('account'); }
  }
  function applyProfile(profile: Profile) {
    setTheme(profile.theme); setPalette(profile.palette);
    document.documentElement.dataset.reducedMotion = String(profile.reducedMotion);
  }
  async function saveProfile(profile: Profile) {
    await request('/me', { method: 'PUT', body: JSON.stringify(profile) });
    await loadAccount();
  }
  async function toggleTheme() {
    const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    const previousTheme = theme;
    setTheme(nextTheme);
    if (!account?.profile) return;
    setThemeSaving(true);
    try {
      const profile = { ...account.profile, theme: nextTheme } as Profile;
      await request('/me', { method: 'PUT', body: JSON.stringify(profile) });
      setAccount(current => current ? { ...current, profile } : current);
    } catch {
      setTheme(previousTheme);
      setError('Could not save your color mode. Please try again.');
    } finally { setThemeSaving(false); }
  }
  function clearWorkspace() {
    setAccount(null); setData(emptySnapshot()); setAdding(false); setNotice(''); setPage('account');
    document.documentElement.dataset.reducedMotion = 'false';
  }
  async function signOut() {
    const result = await authClient.signOut();
    if (result.error) throw new Error(result.error.message);
    clearWorkspace(); setNotice('You have signed out.');
    document.documentElement.dataset.reducedMotion = 'false';
  }
  async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`/api${path}`, { ...options, signal: AbortSignal.timeout(20000), headers: { 'Content-Type': 'application/json' } });
    let result;
    try { result = await response.json(); } catch { throw new Error('The API could not be reached. Start npm run dev or check the Netlify deployment.'); }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) clearWorkspace();
      throw new Error(result.error ?? 'Could not save. Please try again.');
    }
    return result as T;
  }
  async function refresh() {
    setBusy(true); setError('');
    try { if (!workspaceReady) { clearWorkspace(); return; } setData(await request<Snapshot>('/habits')); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function saveValue(habit: Habit, value: number) {
    if (!Number.isFinite(value) || value < 0 || value > 100000) { setError('Progress must be between 0 and 100,000.'); return; }
    if (!workspaceReady) { clearWorkspace(); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      await request(`/planning/habits/${habit.id}/check-in`, { method: 'PUT', body: JSON.stringify({ date: data.date, value }) });
      setData(current => ({ ...current, habits: current.habits.map(h => h.id === habit.id ? { ...h, value } : h) }));
      if (value >= habit.target) playCompletionSound(Boolean(account?.profile?.sound));
      setNotice(value >= habit.target ? `${habit.title} completed. Nicely done.` : 'Progress saved. Every bit of effort is worth recording.');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function addHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceReady) { clearWorkspace(); return; }
    const fields = new FormData(event.currentTarget);
    const input = { title: String(fields.get('title')).trim(), category: String(fields.get('category')), target: Number(fields.get('target')), unit: String(fields.get('unit')).trim() };
    if (!input.title || !input.unit || input.target <= 0 || input.target > 100000) { setError('Enter a habit name, unit, and positive target.'); return; }
    setBusy(true); setError('');
    try { const habit = await request<Habit>('/habits', { method: 'POST', body: JSON.stringify(input) });
      setData(current => ({ ...current, habits: [...current.habits, habit] })); setAdding(false); setNotice('Your new daily habit is ready.');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const completed = data.habits.filter(h => h.value >= h.target).length;
  const percent = data.habits.length ? Math.round(completed / data.habits.length * 100) : 0;
  const displayDate = new Date(`${data.date}T12:00:00`).toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' });
  // Keep workspace navigation and habit controls out of the signed-out experience.
  if (restoring || !workspaceReady) return <div className="auth-shell">
    <header className="auth-header"><a className="brand" href="/" onClick={event => { event.preventDefault(); setPage('account'); }}><img className="brand-logo" src="/momentin.svg" alt="" width="40" height="40"/>momentin</a></header>
    <main className="auth-content">
      {restoring ? <div className="panel" role="status">Checking your session…</div> : <>
        <Account account={account} enabled={accountConfig.enabled} google={accountConfig.google} reload={loadAccount} save={saveProfile} signOut={signOut}/>
      </>}
    </main>
  </div>;
  return <div className={sidebarCollapsed ? "app-shell sidebar-collapsed" : "app-shell"}>
    <aside className="sidebar" aria-label="Workspace sidebar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); setPage(workspaceReady ? 'today' : 'account'); }}><img className="brand-logo" src="/momentin.svg" alt="" width="40" height="40"/>momentin</a>
      <button className="sidebar-toggle secondary" aria-expanded={!sidebarCollapsed} aria-controls="workspace-navigation" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>{sidebarCollapsed ? "☰" : "‹ Collapse"}</button><div className="workspace-label">YOUR LITTLE CORNER</div>
      <nav id="workspace-navigation" aria-label="Main navigation">
        <button aria-label="Your account" title="Your account" className={page === 'account' ? 'nav active' : 'nav'} onClick={() => setPage('account')}><span aria-hidden="true">☺</span><span className="nav-label">Your account</span></button>
        {workspaceReady && <button aria-label="Today" title="Today" className={page === 'today' ? 'nav active' : 'nav'} onClick={() => { setPage('today'); void refresh(); }}><span aria-hidden="true">◷</span><span className="nav-label">Today</span> <span className="nav-dot" /></button>}
      <button className={page === 'planning' ? 'nav active' : 'nav'} aria-label="Plan and history" title="Plan and history" onClick={() => setPage('planning')}><span aria-hidden="true">▦</span><span className="nav-label">Plan & history</span></button></nav>
      <div className="coming"><p>YOUR PLANNER</p><span>Habits, tasks & goals</span><span>History & templates</span><small>Open Plan & history to explore</small></div>
      <div className="sidebar-bottom"><div className="tiny-plant" aria-hidden="true">✳</div><p>Small steps.<br/><strong>Your own pace.</strong></p></div>
    </aside>
    <main>
      <header className="topbar"><span>Your day, with intention</span><div><button className="secondary color-mode-toggle" disabled={themeSaving} onClick={toggleTheme} aria-label="Toggle light and dark mode" title="Switch between light and dark backgrounds"><span aria-hidden="true">☀ / ☾</span><span>Light / dark</span></button><span className={`mode ${connected ? 'connected' : ''}`}>{account ? 'Your workspace' : 'Sign in required'}</span><span className="avatar" aria-label="Your workspace">{account?.profile?.avatarFileId?<img src={'/api/files/'+account.profile.avatarFileId} alt="Your avatar"/>:account?.profile?.displayName.slice(0,1).toUpperCase()??'M'}</span></div></header>
      <div className="content">
        {restoring ? <div className="panel" role="status">Opening your workspace…</div> : page === 'planning' ? <Planning sound={Boolean(account?.profile?.sound)} weekStart={account?.profile?.weekStart} timeZone={data.timeZone}/> : page === 'account' ? <Account account={account} enabled={accountConfig.enabled} google={accountConfig.google} reload={loadAccount} save={saveProfile} signOut={signOut}/> : <>
          <div className="page-heading"><div><p className="eyebrow">{displayDate}</p><h1>A little progress,<br/><em>just for you.</em></h1><p className="subtitle">Make space for what matters. One small action at a time.</p></div><button className="primary" onClick={() => setAdding(!adding)} aria-expanded={adding}>+ Add a habit</button></div>

          <section className="overview" aria-label="Today overview">
            <div className="overview-copy"><span className="eyebrow">TODAY’S LITTLE WINS</span><h2>{completed ? 'Look at you, showing up.' : 'A fresh page. A small beginning.'}</h2><p>{completed ? `${completed} of ${data.habits.length} habits complete. Keep going at your own pace.` : 'You don’t have to do everything at once. Pick one habit to begin.'}</p><div className="legend"><span /> Full targets count. Partial effort matters, too.</div></div>
            <div className="progress-ring" style={{ background: `conic-gradient(var(--accent) ${percent}%, var(--ring) 0)` }}><div><strong>{percent}<small>%</small></strong><span>of today’s habits</span></div></div>
          </section>
          {adding && <form className="add-form panel" onSubmit={addHabit}><h2>Make a little commitment</h2><label>Habit name<input autoFocus name="title" placeholder="e.g. Read a few pages" required maxLength={100}/></label><div className="form-row"><label>Daily goal<input name="target" type="number" min="0.01" max="100000" step="any" defaultValue="1" required/><small>How much you want to complete each day. For 20 pages, enter 20.</small></label><label>Measure in<input name="unit" placeholder="e.g. pages, minutes, glasses" list="habit-units" maxLength={20} required/><small>What you count. Use “times” for a simple once-a-day habit.</small></label><label>Category<select name="category"><option>Personal growth</option><option>Learning</option><option>Wellbeing</option><option>Creative time</option></select></label></div><datalist id="habit-units">{["times", "pages", "minutes", "glasses", "steps", "km", "miles", "sessions"].map(unit => <option key={unit} value={unit}/>)}</datalist><p className="muted">Example: “Read” + daily goal 20 + measure in pages = read 20 pages each day. You can save partial progress. The daily goal stays fixed after creation.</p><div className="actions"><button className="primary" disabled={busy}>Create habit</button><button type="button" className="secondary" onClick={() => setAdding(false)}>Cancel</button></div></form>}
          <TodayPlanning key={data.date + data.habits.map(h=>h.value).join(',')} timeZone={data.timeZone} open={()=>setPage('planning')}/>
          <div className="daily-layout"><section><div className="section-heading"><div><h2>Your daily rhythm <span className="count">{data.habits.length}</span></h2><p>A few intentions for the day ahead.</p></div><button className="text-button" disabled={busy} onClick={refresh}>↻ Refresh</button></div>
            <div className="habit-list">{data.habits.map((h, i) => <HabitCard key={h.id} habit={h} index={i} busy={busy} save={saveValue}/>)}{data.habits.length === 0 && <div className="panel empty"><h3>Your first habit starts here.</h3><p>Add something small you’d like to make time for.</p><button className="primary" onClick={() => setAdding(true)}>+ Create your first habit</button></div>}</div>
          </section><aside className="reflection"><span className="eyebrow">A GENTLE REMINDER</span><div className="flower" aria-hidden="true">✳</div><h2>Progress has<br/>its own rhythm.</h2><p>Some days are bigger than others. Today, give yourself permission to start small.</p><div className="reflection-bottom">ONE DAY AT A TIME <span>↗</span></div></aside></div>
          <footer><span>Made for your real life, not a perfect routine.</span><span>{data.timeZone} · Daily view</span></footer>
        </>}
      </div>
    </main>
  </div>;
}
function HabitCard({ habit: h, index, busy, save }: { habit: Habit; index: number; busy: boolean; save: (habit: Habit, value: number) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(h.value));
  useEffect(() => setValue(String(h.value)), [h.value]);
  const done = h.value >= h.target;
  return <article className={`habit-card ${done ? 'done' : ''}`}><div className={`habit-symbol color-${index % 4}`} aria-hidden="true">{['◇', '✳', '⌁', '◒'][index % 4]}</div><div className="habit-body"><span className="category">{h.category}</span><h3>{h.title}</h3><p>{h.value} / {h.target} {h.unit}<span>·</span>{done ? 'Complete' : h.value > 0 ? 'In progress' : 'A little time for you'}</p>{editing && <form className="inline-form" onSubmit={async e => { e.preventDefault(); if (value.trim()) await save(h, Number(value)); }}><label>Progress<input aria-label={`Progress for ${h.title}`} type="number" min="0" max="100000" step="any" required value={value} onChange={e => setValue(e.target.value)}/></label><button className="secondary" disabled={busy}>Save</button><button type="button" className="text-button" onClick={() => setEditing(false)}>Close</button></form>}<button className="text-button log-button" onClick={() => setEditing(!editing)} aria-expanded={editing}>{editing ? 'Hide entry' : 'Log progress'}</button></div><button className="complete-button" aria-label={done ? `Undo ${h.title}` : `Complete ${h.title}`} aria-pressed={done} disabled={busy} onClick={() => save(h, done ? 0 : h.target)}>{done ? '✓' : '+'}</button></article>;
}
