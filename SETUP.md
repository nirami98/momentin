# Connect Momentin

The app opens at sign-in/signup. Until account configuration is ready, it shows a setup-required message; it never falls back to editable demo habits. The prototype Owner access link has been removed; use account sign-in. Follow these steps to enable your private, persistent workspace. Do not paste credentials into chat or commit `.env`.

## Neon CLI setup (alternative to copying a connection string)

The workspace has been initialized for project `gentle-mountain-76129959`, branch `production`, in organization `org-still-shape-71693278`. Initialization alone does not verify access or provision services. `neon.ts` declares the PostgreSQL-only setup with authentication disabled; the API continues to run locally or on Netlify.

Sign in through the browser when prompted, then inspect and apply the configuration:

```sh
neon login
neon config plan
neon deploy
```

The CLI pulls connection settings into `.env.local` or `.env`. Both are ignored by Git. The local API and migration command load `.env.local` first, then `.env`, with existing process variables taking priority. Keep Neon-managed database values in the file the CLI writes; avoid conflicting values in both files. Migrations prefer `DATABASE_URL_UNPOOLED` when provided, while application queries use `DATABASE_URL` through the Neon HTTP driver.

Still configure the owner key, owner ID, and time zone described below; Neon does not generate those app-specific settings. Do not overwrite a CLI-created environment file with the example file. No Netlify deployment is performed by `neon deploy`.

## 1. Create a separate Neon project

1. Sign in at [Neon](https://console.neon.tech).
2. Create a new project named `momentin` on the Free plan. Keep Interview-Master separate.
3. Choose a region close to the eventual API hosting region. Use a development branch/database for this first setup.
4. In the Connect dialog, copy the PostgreSQL connection string for that database, retaining its TLS parameters. Use the pooled connection if offered. The app uses Neon's HTTP serverless driver.

Create your local environment file:

```sh
cp .env.example .env
openssl rand -hex 32
```

Paste the generated random value into `OWNER_ACCESS_TOKEN` in `.env`. Paste the Neon connection string into `DATABASE_URL`. Retain `OWNER_ID` and `OWNER_TIME_ZONE=Asia/Kolkata` unless you need a different initial time zone. These variables belong only on the server, never in a `VITE_` variable. Keep this time zone fixed while testing; schedule/time-zone versioning is a later feature.

The owner key is retained only for legacy API access to prototype records. It is not an account password, and the account UI no longer exposes an owner-key login. Configure Phase 1 accounts below before testing through the UI.

## 2. Create tables and run

```sh
npm ci
npm run db:migrate
npm run dev
```

Complete the Phase 1 account setup below, then open **http://127.0.0.1:5173** and sign in. Create a habit, log partial progress, mark it complete, and undo it. Reload and confirm the saved value is still there.

The SQL migration is additive and can be re-run. It creates `habits` and `check_ins`; it does not touch other projects or populate sample records. Database failures are deliberately returned as generic messages without connection-string contents. If migration fails, check the selected Neon branch, connection details, and permissions.

`GET /api/health` confirms the API runs; it does **not** confirm a database connection. Successfully opening the connected workspace verifies a database query against the migrated tables.

## 3. Connect Netlify

1. Create a Git repository for this workspace and push it to a repository you control. Check that `.env` is ignored; commit `.env.example` and `package-lock.json` instead.
2. In Netlify, import that repository. Use the Free plan. The root `netlify.toml` defines:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
   - Node version: 22
3. Add `DATABASE_URL`, `OWNER_ACCESS_TOKEN`, `OWNER_ID`, and `OWNER_TIME_ZONE` as Netlify environment variables available to Functions. Keep the same owner ID as local testing. You do not need `PORT` on Netlify.
   Mark only `DATABASE_URL` and `OWNER_ACCESS_TOKEN` as secret values. `OWNER_ID` and `OWNER_TIME_ZONE` are ordinary configuration, not credentials. If all four were imported as secrets, the repository's `SECRETS_SCAN_OMIT_KEYS` setting excludes only those two non-secret keys from value scanning. Credential scanning remains enabled. Keep these variables in the Production deploy context; use separate credentials/data for previews later.
4. Deploy and open the assigned HTTPS URL. Complete the account environment settings below and sign in.
5. Open that same URL on your phone using mobile data. Sign in with the same account and verify that the same habit and progress appear. Your laptop can be off.

The sign-in screen is reachable at the URL. Legacy owner records require the key on every API call; there is no open registration. This is application-level protection, not a Netlify-wide private-site setting. Do not share the key. Rotating `OWNER_ACCESS_TOKEN` and redeploying revokes the old key. Do not use a different `OWNER_ID` unless you intend to address a different workspace.

Use the Git build workflow so the backend function is deployed as well. Uploading only `dist` would deploy the UI without the API. Use a separate Neon branch and secrets for future previews that should not write to your main test data. Review actual free-plan allowances in both dashboards; no paid services are required by this foundation.

## 4. Connection acceptance checks

- Without an owner key, `/api/habits` returns 401 (503 if the server has not been configured).
- An incorrect key does not load or change records.
- A correct key opens an empty or previously saved workspace.
- Creating and completing a habit survives reload and appears on both devices.
- Partial progress remains partial; completing then undoing updates the same daily record.
- The API rejects a check-in with yesterday's or tomorrow's date.
- After midnight in `OWNER_TIME_ZONE`, Refresh opens the new day. Previous check-ins remain in PostgreSQL.
- `/api/health` and `/.netlify/functions/api/health` respond after deployment.

## 5. Services for the next milestone

Only Neon and Netlify are needed for the current connected foundation. Do not create extra secrets yet.

| Service | When and why |
| --- | --- |
| Authentication provider | Next milestone: verify email/password, username login, Google linking, recovery, and session support before choosing the integration. Neon managed auth is a candidate, not implemented here. |
| Google OAuth | After authentication is selected: configure its exact callback URL in Google Cloud; localhost and Netlify will need the supported redirect configuration. |
| Transactional email | Verification/recovery: use a local test inbox first, then configure the chosen provider's supported sender. |
| Private object storage | Photo milestone: validate Neon storage or another provider's private-access and deletion capabilities before connecting uploads. No photo uploads exist yet. |

We can build real accounts once the foundation's Neon connection works. Do not reuse Interview-Master's database or authentication secrets. Tell the developer which steps are complete and any redacted error messages; credentials can remain in your environment.

References: [Neon serverless driver](https://neon.com/docs/serverless/serverless-driver), [Express on Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/express/).

## Phase 1 account setup (November 2, 2026)

Accounts use **Better Auth hosted in the existing API**, with tables in Neon. This
supports username/password as well as email/password; Neon managed Auth stays off.
The bright pastel update works immediately. Account forms become available only
when the required server configuration is present. The owner key remains usable.

### 1. Configure email and test access

Choose an SMTP service you can use within its free allowance. Add these keys to
`.env.local` and Netlify → Environment variables (server/Functions scope):

| Key | Value |
| --- | --- |
| `BETTER_AUTH_SECRET` | A **new** value from `openssl rand -hex 32`; keep stable across deploys. |
| `BETTER_AUTH_URL` | Locally `http://127.0.0.1:5173`; Netlify `https://momentin.netlify.app`. No trailing path. |
| `AUTH_ALLOWED_EMAILS` | Your email and any test-account emails, comma separated. Empty permits nobody. |
| `SMTP_HOST` | Your email provider's SMTP hostname. |
| `SMTP_PORT` | Usually `587` (STARTTLS) or `465` (TLS), as supplied by the provider. |
| `SMTP_USER` / `SMTP_PASSWORD` | Credentials supplied by that provider. |
| `SMTP_FROM` | An approved sender, e.g. `Momentin <verified-sender@example.com>`. |

Keep `DATABASE_URL` and the existing owner settings. Never put credentials in
`VITE_` variables or commit `.env.local`. Do not reuse the owner key as the auth
secret. Missing email settings keep account sign-in disabled rather than silently
skipping verification. The allowlist is checked both at account creation and when
accessing app data. Non-invited signup is rejected explicitly before calling Better Auth; no account
or email is created. Duplicate-account responses remain generic to avoid revealing
account existence.

### 2. Apply schemas

Test against a separate Neon branch first, then run against the intended database:

```bash
npm run db:migrate
npm run db:migrate:auth
npm run dev
```

The first command adds `profiles` and preserves the existing habit/check-in tables.
The second uses the installed Better Auth migration API to create/update its
prefixed `auth_*` tables. Neither command imports demo data or reassigns owner
habits. Auth migrations must be run before enabling the new settings on Netlify.
Do not run database migrations automatically during a frontend build.

### 3. Optional Google login

Create a **Web application** OAuth client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
Set the authorized redirect URIs to:

- `http://127.0.0.1:5173/api/auth/callback/google` for local testing.
- `https://momentin.netlify.app/api/auth/callback/google` for the hosted app.

Configure the consent screen and add your testers if the OAuth app is in testing
mode. Put the resulting `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the local
and Netlify server environment. Google login is displayed only when both are set.
Google callback/account linking requires a real browser test with your OAuth app;
it has not been verified with live Google credentials.

### 4. End-to-end walkthrough

1. Open **Sign in → Create an account** using an allowlisted email, unique username,
   and a password of at least 12 characters. Confirm age 13+.
2. Follow the verification email and sign in using email or username.
3. Complete onboarding: display name, time zone, week start, units, appearance,
   palette and reduced-motion preference. Time zone is fixed after onboarding to
   prevent reopening locked days; controlled prospective changes remain future work.
4. Create a habit, record progress, reload, and verify you remain signed in.
5. Sign in on a second device and check habits and preferences.
6. In a separate browser profile, register another allowlisted account and verify
   it cannot see or update the first account's habits.
7. Sign out and verify access ends. Exercise **Forgot password** and follow the
   emailed link; resetting the password invalidates previous sessions.

New accounts start with their own empty workspace. Existing habits still belong to
the legacy owner ID and are retained in the database. An explicit owner
record migration is a separate step; accounts must never claim existing habits
just by choosing an email or username.

For automated integration checks, set `AUTH_TEST_DATABASE_URL` to an **isolated,
disposable branch**, set `AUTH_TEST_CONFIRM_DISPOSABLE=yes`, and run:

```bash
npx tsx scripts/verify-accounts.ts
```

This uses real PostgreSQL and the real auth handler, captures mail in memory
without sending it, tests two-user isolation and removes its own test records.
It does not prove delivery through your SMTP service or Google OAuth.

### Current limits

This is a Phase 1 increment, not Phase 1 completion. Active-session management UI,
avatar/private uploads, account deletion/export, sound controls, and Google-user
username setup remain pending. Week-start and unit preferences are saved now;
calendar/unit-based views will consume them in later planning work.

### Inspect account registration in Neon

In the SQL editor for the same branch/database used by the app, run:

```sql
SELECT id, email, username, "emailVerified", "createdAt"
FROM public.auth_user
WHERE lower(email) = lower('nirjadesai98@gmail.com');
```

No rows means no account exists for that email in this database. A row with
`emailVerified = false` means registration exists but verification is pending.
Do not select password hashes, session tokens or verification tokens. Sender email
and allowed registration emails are separate settings. Restart the dev server
after changing `.env.local`; Netlify needs its own allowlist update and redeploy.

### Signup troubleshooting

Signup returns a definite outcome in a fixed top-right toast. Duplicate emails
and usernames are rejected; usernames are normalized and protected by a unique
database index. If account creation succeeds but SMTP fails, the message says
that the account was created and provides a resend action.

To inspect your account in Neon's SQL editor without exposing password hashes:

```sql
SELECT email, username, "emailVerified", "createdAt"
FROM public.auth_user
WHERE lower(email) = 'nirjadesai98@gmail.com';
```

An SMTP connection timeout happens before delivery; check network/VPN/firewall
access to Brevo. Ports 587 and 2525 use STARTTLS, and 465 uses implicit TLS.
Changing SMTP_PORT requires restarting the local API (or redeploying Netlify).
SMTP acceptance does not by itself prove inbox delivery: check Brevo
transactional logs and the recipient inbox afterward.

### Brevo HTTPS transport (when SMTP is blocked)

Keep the VPN enabled if required. Set a server-only `BREVO_API_KEY` in
`.env.local` to select Brevo's HTTPS email API instead of SMTP.
Create a standard API key in Brevo **Settings → SMTP & API → API Keys & MCP**;
the SMTP password cannot be used here. Keep `SMTP_FROM` as your verified sender.
The existing SMTP settings can remain; the API key takes precedence.
Restart `npm run dev` after changing environment variables. For the hosted app,
add the same key as a secret in Netlify's Functions environment and redeploy.

The transport checks Brevo's message ID before reporting acceptance. It does not
automatically retry or switch transports after an uncertain timeout, to avoid
duplicate emails. Provider acceptance is not a guarantee of inbox delivery.


## November 5 release: public accounts and planning

1. Run `npm run db:migrate` to apply all five application migrations, then
   `npm run db:migrate:auth` if authentication tables have not been initialized.
   Restart `npm run dev` after changing server environment variables.
2. Registration defaults to public. Set `AUTH_REGISTRATION_MODE=public` in
   Netlify as well. Existing `AUTH_ALLOWED_EMAILS` values are ignored in public
   mode. Email verification and age confirmation are still required.
3. Set `ADMIN_EMAILS=nirjadesai98@gmail.com,littlesparkstudio.apps@gmail.com`.
   This is authorization configuration, not a password; matching verified accounts
   receive the Moderation tab.
4. Keep the existing database and email settings. Use either the configured SMTP
   credentials or `BREVO_API_KEY` for HTTPS delivery. Google additionally needs
   `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Downloaded
   `client_secret_*.json` files are ignored by Git.
5. Locally, `BETTER_AUTH_URL=http://127.0.0.1:5173`. On Netlify set
   `BETTER_AUTH_URL=https://momentin.netlify.app`. Google authorized callbacks:
   - `http://127.0.0.1:5173/api/auth/callback/google`
   - `https://momentin.netlify.app/api/auth/callback/google`
6. Google Auth platform's audience/testing setting controls which Google accounts
   can authorize the client. That is separate from Momentin's public email signup.
7. Run `npm test`, `npm run build`, and `npm run test:browser`. Push only when
   ready to deploy. Never commit local secrets or downloaded OAuth credentials.

### Phase 1 and 2 acceptance walkthrough

- Register a new email outside the old test list, verify it, sign in, complete
  onboarding and create a habit. Google users must choose a unique username.
- Create daily, weekday, weekly-target and interval habits. Log partial work,
  complete/undo it, record a fallback, and schedule a pause or target change.
- Open History in week/month view. Add an annotation to a past day; changing that
  day's numeric progress must fail. Goal configuration edits start tomorrow.
- Create a recurring task with subtasks and a deadline. Check each occurrence
  separately; completion/undo is locked after the actual completion day.
- Create goals using milestones and linked activity counts. Link one activity to
  two goals. Completed milestone history must remain unchanged after midnight.
- Create a public template containing habits, tasks, goals and private images.
  Preview it before publishing. Adopt it with a second account. Confirm there is
  no original progress and all copied IDs/links belong to the second account.
- Update/unpublish/delete the source template. Personal copies and their copied
  images remain independent. Old template image versions remain creator-private.
- Bookmark/rate/report a public template. An ordinary member cannot use moderation;
  either configured admin can dismiss reports or remove public availability.
- Configure in-app reminders and quiet hours; reminders appear in the open app.
- Upload an avatar, change appearance, revoke another session, download the JSON
  export and images, and test deletion only with a disposable account.
- Repeat sign-in and persistence checks on Netlify from laptop and mobile data.

### Local day-boundary testing

The standalone local API accepts `DEV_CLOCK_ISO`; Netlify ignores it. Restart
between simulated times, and use disposable local test accounts:

```bash
DEV_CLOCK_ISO=2026-11-05T18:29:00Z npm run dev
```

For Asia/Kolkata this is 23:59 on November 5. Advance to
`2026-11-05T18:31:00Z` for the next local day. Never set this variable in Netlify.
The integration scripts inject their own clock and simulate a full week.

### Storage and export limits

Private images: 25 MB per account, 2 MB per PNG/JPEG/WebP. Published template
image snapshots: a separate 25 MB, including historical versions, with up to three
images per template version. This uses the existing Neon database and does not
require a paid bucket. Copies consume the recipient's private allowance.
Exports contain image metadata and authenticated download links to avoid
serverless response-size limits; download originals before deleting the account.
