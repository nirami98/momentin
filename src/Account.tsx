import { useState, type FormEvent } from 'react';
import { AccountSecurity } from './AccountSecurity';
import { useNotifications } from './Toast';
import { authClient } from './auth-client';
import type { Profile } from '../shared/profile';
export type AccountData = { user: { id: string; email: string; name: string; username?: string | null }; profile: Profile | null };
export function Account({ account, enabled, google, reload, save, signOut }: {
  account: AccountData | null; enabled: boolean; google: boolean; reload: () => Promise<void>;
  save: (profile: Profile) => Promise<void>; signOut: () => Promise<void>;
}) {
  const resetToken = new URLSearchParams(location.search).get('token');
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot' | 'reset'>(resetToken ? 'reset' : 'signin');
  const [busy, setBusy] = useState(false);
  const { setError, setNotice: setMessage } = useNotifications();
  const [verificationEmail, setVerificationEmail] = useState('');
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fields = new FormData(event.currentTarget);
    const value = (name: string) => String(fields.get(name) ?? '').trim();
    const password = String(fields.get('password') ?? '');
    await run(async () => {
      let result;
      if (mode === 'signup') {
        if (fields.get('age') !== 'on') throw new Error('You must be at least 13 to create an account.');
        result = await authClient.signUp.email({ name: value('name'), email: value('email'), username: value('username'), password, ...{ageConfirmed:true}, callbackURL: location.origin });
      } else if (mode === 'forgot') result = await authClient.requestPasswordReset({ email: value('email'), redirectTo: `${location.origin}/?account=reset` });
      else if (mode === 'reset') result = await authClient.resetPassword({ newPassword: password, token: resetToken ?? '' });
      else result = value('identifier').includes('@') ? await authClient.signIn.email({ email: value('identifier'), password }) : await authClient.signIn.username({ username: value('identifier'), password });
      if (result.error) {
        if (mode === 'signup' && ['ACCOUNT_CREATED_EMAIL_FAILED', 'EMAIL_ALREADY_EXISTS'].includes(result.error.code ?? '')) setVerificationEmail(value('email'));
        const message = mode === 'signup' && result.error.status >= 500 && result.error.code !== 'ACCOUNT_CREATED_EMAIL_FAILED'
          ? 'Account creation failed. Please try again shortly.'
          : result.error.code === 'USERNAME_IS_ALREADY_TAKEN' ? 'This username is already taken. Please choose another.'
          : result.error.message ?? (mode === 'signup' ? 'Account creation failed. Please try again.' : 'Unable to complete your request.');
        throw new Error(message);
      }
      if (mode === 'signup') { setVerificationEmail(value('email')); setMessage('Account created. Check your email to verify your account.'); }
      else if (mode === 'forgot') setMessage('If this email has an account, a reset link is on its way.');
      else if (mode === 'reset') { history.replaceState(null, '', '/'); setMode('signin'); setMessage('Password updated. Sign in with your new password.'); }
      else await reload();
    });
  }
  const p = account?.profile;
  return <>
    <div className="page-heading"><div><p className="eyebrow">YOUR SPACE TO GROW</p><h1>{account ? 'Make it yours.' : 'Welcome to'}{!account && <><br/><em>momentin.</em></>}</h1><p className="subtitle">{account ? 'Your preferences follow you across devices.' : 'A fresh start, and a little momentum every day.'}</p></div></div>
    {!account ? <section className="panel account-panel">
      {!enabled ? <><h2>Accounts are being connected</h2><p>Account sign-in needs its server settings before it can be used. Please try again once setup is complete. </p></> : <>
      <h2>{{ signin: 'Sign in to your workspace', signup: 'Create your account', forgot: 'Reset your password', reset: 'Choose a new password' }[mode]}</h2>
      <p className="muted">Build your routine, one day at a time.</p>
      {(mode === 'signin' || mode === 'signup') && google && <button className="secondary google-button" disabled={busy} onClick={() => run(async () => { const result = await authClient.signIn.social({ provider: 'google', callbackURL: location.origin }); if (result.error) throw new Error(result.error.message); })}>Continue with Google</button>}
      <form key={mode} onSubmit={submit}>
        {mode === 'signup' && <><label>Display name<input name="name" required maxLength={80} autoComplete="name"/></label><label>Username<input name="username" required minLength={3} maxLength={30} pattern="[A-Za-z0-9_.]+" autoComplete="username"/></label></>}
        {(mode === 'signup' || mode === 'forgot') && <label>Email<input name="email" type="email" required autoComplete="email"/></label>}
        {mode === 'signin' && <label>Email or username<input name="identifier" required autoComplete="username"/></label>}
        {mode !== 'forgot' && <label>Password<input name="password" type="password" required minLength={mode === 'signin' ? 1 : 12} maxLength={128} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}/>{mode !== 'signin' && <small>Use at least 12 characters.</small>}</label>}
        {mode === 'signup' && <label className="check-label"><input name="age" type="checkbox" required/>I am at least 13 years old.</label>}
        <button className="primary" disabled={busy}>{busy ? 'Please wait…' : { signin: 'Sign in →', signup: 'Create account', forgot: 'Send reset link', reset: 'Save new password' }[mode]}</button>
      </form>
    {verificationEmail && !account && <button className="secondary resend-button" disabled={busy} onClick={() => run(async () => {
      const result = await authClient.sendVerificationEmail({ email: verificationEmail, callbackURL: location.origin });
      if (result.error) throw new Error(result.error.message ?? 'Verification email could not be sent. Please try again.');
      setMessage('Verification email sent. Check your inbox and spam folder.');
    })}>Resend verification email</button>}
      <div className="account-links">{mode !== 'signin' && <button className="text-button" onClick={() => setMode('signin')}>Back to sign in</button>}{mode === 'signin' && <><button className="text-button" onClick={() => setMode('signup')}>Create an account</button><button className="text-button" onClick={() => setMode('forgot')}>Forgot password?</button></>}</div>
      </>}
    </section> : <form className="panel account-panel" key={account.user.id} onSubmit={event => {
      event.preventDefault(); const fields = new FormData(event.currentTarget);
      const value = (name: string) => String(fields.get(name) ?? '');
      void run(async () => { if (!account.user.username) { const result = await authClient.updateUser({username:value('profileUsername')}); if(result.error) throw new Error(result.error.message); } await save({ displayName: value('displayName'), bio: value('bio'), interests: value('interests'), timeZone: p?.timeZone ?? value('timeZone'), weekStart: value('weekStart') as Profile['weekStart'], units: value('units') as Profile['units'], theme: value('theme') as Profile['theme'], palette: value('palette') as Profile['palette'], reducedMotion: fields.get('reducedMotion') === 'on', sound: fields.get('sound') === 'on', avatarFileId: p?.avatarFileId ?? null, ageConfirmed: true }); setMessage('Your preferences are saved.'); });
    }}>
      <h2>{p ? 'Your profile & preferences' : 'Let’s set up your day'}</h2><p className="muted">Signed in as {account.user.email}</p>{!p && <p className="muted">Your account has its own private workspace.</p>}
      {!account.user.username && <label>Choose your unique username<input name="profileUsername" required minLength={3} maxLength={30} pattern="[A-Za-z0-9_.]+" autoComplete="username"/></label>}
      <label>Display name<input name="displayName" defaultValue={p?.displayName ?? account.user.name} required maxLength={80}/></label>
      <label>A little about you<input name="bio" defaultValue={p?.bio ?? ''} maxLength={300}/></label>
      <label>Interests<input name="interests" defaultValue={p?.interests ?? ''} placeholder="Reading, movement, learning…" maxLength={200}/></label>
      <label>Time zone<input name="timeZone" defaultValue={p?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone} required readOnly={Boolean(p)} list="timezones"/><datalist id="timezones">{Intl.supportedValuesOf('timeZone').map(zone => <option key={zone} value={zone}/>)}</datalist><small>{p ? 'Fixed after setup to protect your daily history.' : 'This determines when each day ends and progress locks.'}</small></label>
      <div className="form-row"><label>Week starts on<select name="weekStart" defaultValue={p?.weekStart ?? 'monday'}><option value="monday">Monday</option><option value="sunday">Sunday</option></select></label><label>Measurement system<select name="units" defaultValue={p?.units ?? 'metric'}><option value="metric">Metric — km, kg, litres</option><option value="imperial">Imperial — miles, pounds, gallons</option></select><small>Your preferred measurement system. Habit units are chosen separately; existing values are not converted.</small></label></div>
      <div className="form-row"><label>Color mode<select key={p?.theme} name="theme" defaultValue={p?.theme ?? 'system'}><option value="system">Follow device settings</option><option value="light">Light — bright backgrounds</option><option value="dark">Dark — dark backgrounds</option></select></label><label>Pastel palette<select name="palette" defaultValue={p?.palette ?? 'mint'}><option value="mint">Fresh mint</option><option value="lavender">Bright lavender</option><option value="peach">Sunny peach</option><option value="rose">Rose bloom</option><option value="sky">Clear sky</option></select></label></div>
      <label className="check-label"><input type="checkbox" name="reducedMotion" defaultChecked={p?.reducedMotion}/>Reduce animations</label><p className="field-help">Turns off interface transitions and animations for a calmer experience. Your device’s reduced-motion setting is also respected.</p>
      <label className="check-label"><input type="checkbox" name="sound" defaultChecked={p?.sound}/>Play a short sound when a habit is completed</label>
      {!p && <label className="check-label"><input type="checkbox" required/>I confirm I am at least 13 years old.</label>}
      <div className="actions"><button className="primary" disabled={busy}>{busy ? 'Saving…' : p ? 'Save preferences' : 'Start my workspace →'}</button><button type="button" className="secondary" disabled={busy} onClick={() => run(signOut)}>Sign out</button></div>
    </form>}
    {account && <AccountSecurity account={account} save={save} signOut={signOut} google={google}/>}
  </>;
}
