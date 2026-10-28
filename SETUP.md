# Connect Momentin

The foundation runs immediately in browser-demo mode. Follow these steps to enable your private, persistent workspace. Do not paste credentials into chat or commit `.env`.

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

The owner key grants access to the one private development workspace. Enter it in the app's Workspace setup screen; it stays in memory and must be entered again after a page reload. This temporary gate is for your own testing. Full authentication will replace it before inviting users.

## 2. Create tables and run

```sh
npm ci
npm run db:migrate
npm run dev
```

Open **http://localhost:5173**, choose **Workspace setup**, and enter the owner key. Connected mode starts empty. Create a habit, log partial progress, mark it complete, and undo it. Reload, reconnect, and confirm the saved value is still there.

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
4. Deploy and open the assigned HTTPS URL. Connect with the owner key through Workspace setup.
5. Open that same URL on your phone using mobile data. Reconnect with the key and verify that the same habit and progress appear. Your laptop can be off.

The public shell/demo is reachable at the URL. Private records require the key on every API call; there is no open registration. This is application-level protection, not a Netlify-wide private-site setting. Do not share the key. Rotating `OWNER_ACCESS_TOKEN` and redeploying revokes the old key. Do not use a different `OWNER_ID` unless you intend to address a different workspace.

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
