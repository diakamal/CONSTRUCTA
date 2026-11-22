# CONSTRUCTA

Attendance, daily tasks and photo documentation for construction sites.

CONSTRUCTA helps site managers see who is on site, what work was done each day, and photo proof of progress, all in one place.

| Path | What |
|---|---|
| `apps/mobile` | Worker app: Expo / React Native (iOS, Android, web) |
| `apps/web` | Manager dashboard (Next.js), plus the temporary **mock API** under `app/api/` |
| `packages/shared` | Shared types, geofence math, he/ar/th/en strings, mock store + demo seed |
| `supabase/` | Postgres schema, RLS, RPCs, seed, for when a database is connected |

## Run the demo (no database needed)

Requires Node 20+.

```powershell
npm install
npm run dev:web        # dashboard + mock API → http://localhost:3000
npm run dev:mobile     # worker app (Expo). Press "w" for browser, or scan the QR with Expo Go
```

Demo logins (test data only, from `packages/shared/src/mock/seed.ts`):

| Who | How |
|---|---|
| Manager (web) | `manager@constructa.test` / `Test1234!` |
| Worker Ahmad (Arabic, plumbing team) | phone `+972500000001`, code `123456` |
| Worker Somchai (Thai) | phone `+972500000002`, code `123456` |
| Invited, not yet signed in (David) | phone `+972500000003`, code `123456` |

- The demo site is in Tel Aviv. To check in from elsewhere, turn on **Settings → Demo mode: I'm on site** in the worker app. The server still runs the real radius check.
- Mock data lives in `apps/web/.mock-data/` (git-ignored). **Reset demo** in the dashboard header restores it.
- On a physical phone the app calls `http://<your PC's IP>:3000` automatically. Override with `EXPO_PUBLIC_API_URL`.

## Checks

```powershell
npm test               # business rules (geofence, permissions, photo-required, audit) + locale keys
npm run typecheck
```

## Mock vs. Supabase

Every mock rule in `packages/shared/src/mock/store.ts` mirrors a function in `supabase/migrations/*_rpc.sql`, and both use the same error codes. Switching to Supabase means:

1. `npx supabase start` + `npx supabase db reset` (needs Docker), or a cloud project.
2. Replace the calls in `apps/web/lib/api.ts` and `apps/mobile/src/lib/api.ts` with `supabase.rpc(...)` / Storage uploads. The clients already exist in `apps/*/lib/supabase*`.

## Key rules

- Check-in is validated **on the server** against the project radius. Location is sampled only at check-in and check-out, and is never tracked continuously.
- A task is done only with an uploaded photo, and closes immediately with no manager approval. Retrying is safe.
- Attendance corrections are managers only, require a reason, and are written to an audit log.
- Marking a task done and attaching a photo is not a professional quality sign-off and does not replace safety supervision. Training videos do not replace required training or certification.
