# Momentin

A responsive habit-planning foundation built with React, TypeScript, Express, and Neon PostgreSQL. Netlify hosts the frontend and the API function.

## Start locally

Requires Node 22.12+ and npm.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. Signed-out visitors start at sign-in/signup. A valid session and completed onboarding open Today; habit actions require authentication. Signup results appear in dismissible top-right toasts.

For persistent PostgreSQL records, follow [SETUP.md](SETUP.md). New accounts start with an empty private workspace. Old browser-demo records are not loaded or imported.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | React development server and Express API |
| `npm run build` | Type-check and build frontend |
| `npm test` | API authorization, day locking, validation, and time-zone tests |
| `npm run db:migrate` | Apply initial schema to the configured Neon database |
| `npm run preview` | Preview built frontend only; does not start API |

## Structure

- `src/`: responsive authentication screens and private-workspace client.
- `server/`: protected Express API and parameterized Neon queries.
- `shared/`: common types and local-date calculation.
- `db/migrations/`: initial PostgreSQL schema.
- `netlify/functions/api.ts`: serverless Express adapter.
- `netlify.toml`: deployment, function routing, and SPA fallback.

## Implemented workspace

Accounts, scheduled habits, tasks, linked goals, history, calendars, streaks,
freezes, reminders, community templates and admin moderation are available.
Open **Plan & history** from the sidebar. **Your account** includes avatars,
private images, sessions, username management, export and deletion.

Registration is public by default. Email verification and onboarding remain
required. Set `AUTH_REGISTRATION_MODE=invite` only if you intentionally want to
restrict registration with `AUTH_ALLOWED_EMAILS`.

See [the product plan](MOMENTIN_PRODUCT_PLAN.md#13-implementation-status--november-5-2026)
for scope and remaining live acceptance checks, and [SETUP.md](SETUP.md) before
deployment. Google browser consent and hosted cross-device checks are manual.

Run `npm test`, `npm run build` and `npm run test:browser`.
Real database checks: `scripts/verify-planning.ts` and
`scripts/verify-accounts.ts` require `AUTH_TEST_DATABASE_URL` and
`AUTH_TEST_CONFIRM_DISPOSABLE=yes` pointing to an isolated branch; never use the
working database for these scripts. Captured test emails are not sent.
