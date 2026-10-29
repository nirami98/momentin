import { useEffect, useState, type FormEvent } from 'react';
import { localDate, type Habit, type Snapshot } from '../shared/models';

const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const demoKey = 'momentin.demo.v1';
const starter = (): Habit[] => [
  { id: crypto.randomUUID(), title: 'Make room for reading', category: 'Personal growth', target: 20, unit: 'minutes', value: 0 },
  { id: crypto.randomUUID(), title: 'Move a little, feel better', category: 'Wellbeing', target: 30, unit: 'minutes', value: 0 },
  { id: crypto.randomUUID(), title: 'Practice something new', category: 'Learning', target: 1, unit: 'session', value: 0 },
];
function readDemo(): Snapshot {
  const date = localDate(new Date(), zone);
  try {
    const saved = JSON.parse(localStorage.getItem(demoKey) ?? 'null');
    if (saved && Array.isArray(saved.habits) && saved.habits.every((h: Habit) => typeof h.id === 'string' && typeof h.title === 'string' && typeof h.category === 'string' && typeof h.unit === 'string' && Number.isFinite(h.target) && h.target > 0 && Number.isFinite(h.value) && h.value >= 0)) {
      return { date, timeZone: zone, habits: saved.habits.map((h: Habit) => ({ ...h, value: saved.date === date ? h.value : 0 })) };
    }
  } catch { /* A fresh demo also works when browser storage is unavailable. */ }
  return { date, timeZone: zone, habits: starter() };
}
export function App() {
  const [data, setData] = useState<Snapshot>(readDemo);
  const [token, setToken] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [page, setPage] = useState<'today' | 'setup'>('today');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('momentin.theme') ?? 'light'; } catch { return 'light'; } });
  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem('momentin.theme', theme); } catch { /* Optional preference. */ } }, [theme]);
  useEffect(() => {
    if (!token) { try { localStorage.setItem(demoKey, JSON.stringify(data)); } catch { setError('Browser storage is unavailable. Demo changes will be lost when you close this page.'); } }
  }, [data, token]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!token && data.date !== localDate(new Date(), zone)) { setData(readDemo()); setNotice('A new day has started. Today’s demo progress has reset.'); }
    }, 15000);
    return () => clearInterval(timer);
  }, [data.date, token]);
  async function request<T>(path: string, options: RequestInit = {}, access = token): Promise<T> {
    const response = await fetch(`/api${path}`, { ...options, signal: AbortSignal.timeout(20000), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access}` } });
    let result;
    try { result = await response.json(); } catch { throw new Error('The API could not be reached. Start npm run dev or check the Netlify deployment.'); }
    if (!response.ok) throw new Error(result.error ?? 'Could not save. Please try again.');
    return result as T;
  }
  async function connect(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { const next = await request<Snapshot>('/habits', {}, keyInput.trim()); setToken(keyInput.trim()); setKeyInput(''); setData(next); setPage('today'); setNotice('Connected to your private workspace. Demo records were not imported.'); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function refresh() {
    setBusy(true); setError('');
    try { if (token) setData(await request<Snapshot>('/habits')); else setData(readDemo()); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function saveValue(habit: Habit, value: number) {
    if (!Number.isFinite(value) || value < 0 || value > 100000) { setError('Progress must be between 0 and 100,000.'); return; }
    if (!token && data.date !== localDate(new Date(), zone)) { setData(readDemo()); setError('A new day has started. Record progress again for today.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      if (token) await request(`/habits/${habit.id}/check-in`, { method: 'PUT', body: JSON.stringify({ date: data.date, value }) });
      setData(current => ({ ...current, habits: current.habits.map(h => h.id === habit.id ? { ...h, value } : h) }));
      setNotice(value >= habit.target ? `${habit.title} completed. Nicely done.` : 'Progress saved. Every bit of effort is worth recording.');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function addHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const fields = new FormData(form);
    const input = { title: String(fields.get('title')).trim(), category: String(fields.get('category')), target: Number(fields.get('target')), unit: String(fields.get('unit')).trim() };
    if (!input.title || !input.unit || input.target <= 0 || input.target > 100000) { setError('Enter a habit name, unit, and positive target.'); return; }
    setBusy(true); setError('');
    try { const habit = token ? await request<Habit>('/habits', { method: 'POST', body: JSON.stringify(input) }) : { ...input, id: crypto.randomUUID(), value: 0 };
      setData(current => ({ ...current, habits: [...current.habits, habit] })); setAdding(false); setNotice('Your new daily habit is ready.');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const completed = data.habits.filter(h => h.value >= h.target).length;
  const percent = data.habits.length ? Math.round(completed / data.habits.length * 100) : 0;
  const displayDate = new Date(`${data.date}T12:00:00`).toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' });
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); setPage('today'); }}><span className="brand-icon">m<span>·</span></span>momentin</a>
      <div className="workspace-label">YOUR LITTLE CORNER</div>
      <nav aria-label="Main navigation">
        <button className={page === 'today' ? 'nav active' : 'nav'} onClick={() => setPage('today')}><span>◷</span> Today <span className="nav-dot" /></button>
        <button className={page === 'setup' ? 'nav active' : 'nav'} onClick={() => setPage('setup')}><span>⚙</span> Workspace setup</button>
      </nav>
      <div className="coming"><p>ROOM TO GROW</p><span>Goals & milestones</span><span>Your journal</span><span>Community templates</span><small>Coming in later milestones</small></div>
      <div className="sidebar-bottom"><div className="tiny-plant" aria-hidden="true">✳</div><p>Small steps.<br/><strong>Your own pace.</strong></p><button className="theme-button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? '☾ Dark appearance' : '☀ Light appearance'}</button></div>
    </aside>
    <main>
      <header className="topbar"><span>Your day, with intention</span><div><span className={`mode ${token ? 'connected' : ''}`}>{token ? 'Private workspace' : 'Browser demo'}</span><span className="avatar" aria-label="Your workspace">M</span></div></header>
      <div className="content">
        {error && (page !== 'setup' || token) && <div className="message error" role="alert">{error}<button aria-label="Dismiss error" onClick={() => setError('')}>×</button></div>}
        {notice && <div className="message" role="status">{notice}</div>}
        {page === 'today' ? <>
          <div className="page-heading"><div><p className="eyebrow">{displayDate}</p><h1>A little progress,<br/><em>just for you.</em></h1><p className="subtitle">Make space for what matters. One small action at a time.</p></div><button className="primary" onClick={() => setAdding(!adding)} aria-expanded={adding}>+ Add a habit</button></div>
          {!token && <div className="demo-banner"><span>✧</span><p><strong>A space to try things out.</strong> Demo habits are saved in this browser. Connect your workspace to sync across devices.</p><button onClick={() => setPage('setup')}>Connect →</button></div>}
          <section className="overview" aria-label="Today overview">
            <div className="overview-copy"><span className="eyebrow">TODAY’S LITTLE WINS</span><h2>{completed ? 'Look at you, showing up.' : 'A fresh page. A small beginning.'}</h2><p>{completed ? `${completed} of ${data.habits.length} habits complete. Keep going at your own pace.` : 'You don’t have to do everything at once. Pick one habit to begin.'}</p><div className="legend"><span /> Full targets count. Partial effort matters, too.</div></div>
            <div className="progress-ring" style={{ background: `conic-gradient(var(--accent) ${percent}%, var(--ring) 0)` }}><div><strong>{percent}<small>%</small></strong><span>of today’s habits</span></div></div>
          </section>
          {adding && <form className="add-form panel" onSubmit={addHabit}><h2>Make a little commitment</h2><label>Habit name<input autoFocus name="title" placeholder="e.g. Read a few pages" required maxLength={100}/></label><div className="form-row"><label>Target<input name="target" type="number" min="0.01" max="100000" step="any" defaultValue="1" required/></label><label>Unit<input name="unit" defaultValue="session" maxLength={20} required/></label><label>Category<select name="category"><option>Personal growth</option><option>Learning</option><option>Wellbeing</option><option>Creative time</option></select></label></div><p className="muted">This first version supports daily habits. Targets stay fixed after creation.</p><div className="actions"><button className="primary" disabled={busy}>Create habit</button><button type="button" className="secondary" onClick={() => setAdding(false)}>Cancel</button></div></form>}
          <div className="daily-layout"><section><div className="section-heading"><div><h2>Your daily rhythm <span className="count">{data.habits.length}</span></h2><p>A few intentions for the day ahead.</p></div><button className="text-button" disabled={busy} onClick={refresh}>↻ Refresh</button></div>
            <div className="habit-list">{data.habits.map((h, i) => <HabitCard key={h.id} habit={h} index={i} busy={busy} save={saveValue}/>)}{data.habits.length === 0 && <div className="panel empty"><h3>Your first habit starts here.</h3><p>Add something small you’d like to make time for.</p><button className="primary" onClick={() => setAdding(true)}>+ Create your first habit</button></div>}</div>
          </section><aside className="reflection"><span className="eyebrow">A GENTLE REMINDER</span><div className="flower" aria-hidden="true">✳</div><h2>Progress has<br/>its own rhythm.</h2><p>Some days are bigger than others. Today, give yourself permission to start small.</p><div className="reflection-bottom">ONE DAY AT A TIME <span>↗</span></div></aside></div>
          <footer><span>Made for your real life, not a perfect routine.</span><span>{data.timeZone} · Daily view</span></footer>
        </> : <>
          <div className="page-heading"><div><p className="eyebrow">A HOME FOR YOUR PROGRESS</p><h1>Your workspace,<br/><em>connected.</em></h1><p className="subtitle">Start here when your private backend is ready.</p></div></div>
          <div className="setup-grid"><section className="panel"><h2>{token ? 'You’re connected' : 'Open your private workspace'}</h2><p className="muted">This foundation uses a temporary owner key. Full account sign-in will arrive in the next milestone. Your key stays in memory and is cleared on refresh.</p>{token ? <button className="secondary" onClick={() => { setToken(''); setData(readDemo()); setNotice('Disconnected. You are back in the browser demo.'); }}>Disconnect</button> : <form onSubmit={connect}>{error && <div className="message error" role="alert">{error}</div>}<label>Owner access key<input type="password" value={keyInput} onChange={e => setKeyInput(e.target.value)} autoComplete="off" required minLength={32} placeholder="Enter your private owner key"/></label><button className="primary" disabled={busy}>{busy ? 'Connecting…' : 'Connect workspace →'}</button></form>}</section><section className="panel"><h2>Before you connect</h2><ol className="setup-steps"><li>Create a separate Momentin database in Neon.</li><li>Configure the server environment and owner key.</li><li>Run the foundation database migration.</li><li>Start locally or deploy through Netlify.</li></ol><p className="muted">Follow <code>SETUP.md</code> in the project for exact commands and settings. Demo records are separate and are never automatically uploaded.</p></section></div>
          <section className="panel milestone"><span className="eyebrow">FOUNDATION · 0.1</span><h2>What’s ready, what’s next</h2><p>Ready: daily habits, numeric check-ins, same-day undo, browser demo, owner-protected API, and saved appearance.</p><p className="muted">Next: real accounts, onboarding, schedule versions, history and annotations. Streaks, XP, freezes, uploads, and social features are not active yet.</p></section>
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
