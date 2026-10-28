# Momentin

A responsive habit-planning foundation built with React, TypeScript, Express, and Neon PostgreSQL. Netlify hosts the frontend and the API function.

## Start locally

Requires Node 22.12+ and npm.

```sh
npm ci
npm run dev
```

Open **http://localhost:5173**. The browser demo needs no credentials. Add daily habits, record partial progress, complete/undo, and switch appearance. Demo data stays in this browser; the demo keeps today's values only and resets progress at local midnight. It is not historical storage or a synchronized account.

For persistent PostgreSQL records, follow [SETUP.md](SETUP.md). The connected workspace starts empty and never imports demo data automatically.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | React development server and Express API |
| `npm run build` | Type-check and build frontend |
| `npm test` | API authorization, day locking, validation, and time-zone tests |
| `npm run db:migrate` | Apply initial schema to the configured Neon database |
| `npm run preview` | Preview built frontend only; does not start API |

## Structure

- `src/`: responsive UI, demo storage, and connected-workspace client.
- `server/`: protected Express API and parameterized Neon queries.
- `shared/`: common types and local-date calculation.
- `db/migrations/`: initial PostgreSQL schema.
- `netlify/functions/api.ts`: serverless Express adapter.
- `netlify.toml`: deployment, function routing, and SPA fallback.

## Milestone boundary

This is a foundation, not a complete Phase 1 or Phase 2 release. The private API uses one temporary owner key, not end-user authentication. All owner queries are scoped on the server, and check-in writes are restricted to the current date in the configured owner time zone. The schema keeps prior-day check-ins, but history UI is not built. Targets cannot yet be edited; habits are daily only.

Still to build: email/Google/username login, verification and recovery, onboarding, user/session tables, versioned schedules, history and annotations, goals/tasks/templates, streak/freeze/XP calculations, attachments, and social features. No fabricated streaks or awards are shown. The owner ID will be retained when real authentication is introduced so records can be associated with the actual account.

Tests use an injected store; they do not prove live Neon connectivity or database constraints. Run the connection walkthrough in SETUP.md after provisioning Neon. No cloud resources are created by installation or build.
