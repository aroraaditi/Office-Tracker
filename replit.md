# Office Tracker

A responsive, mobile-first web application for tracking office attendance and planning upcoming office days.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/office-tracker run dev` — run the frontend (port 21374)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + Framer Motion + Wouter
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — Single source of truth for all API contracts
- `lib/db/src/schema/attendance.ts` — Attendance table schema
- `artifacts/api-server/src/routes/attendance.ts` — All attendance + summary API routes
- `artifacts/office-tracker/src/pages/dashboard.tsx` — Quarterly dashboard view
- `artifacts/office-tracker/src/pages/calendar.tsx` — Monthly calendar view
- `artifacts/office-tracker/src/components/day-modal.tsx` — Day logging modal/bottom sheet
- `artifacts/office-tracker/src/lib/states.ts` — Day state config and colors

## Architecture decisions

- All dates stored as `YYYY-MM-DD` text strings for portability and simplicity
- Day states are mutually exclusive: present, company_leave, personal_leave, planned, remote
- "Remote" is the default/empty state — deleting a record resets to remote
- Quarterly summary computed server-side to avoid large data transfers
- `upsert` endpoint handles both create and update to simplify client logic

## Product

- Dashboard: year overview with quarterly cards showing attendance rate, progress bar, days in office, planned/leave breakdown. One-tap check-in for today.
- Calendar: interactive monthly grid with color-coded day states, prev/next navigation, day detail modal with state selector + note field.
- Navigation: bottom nav bar on mobile, sidebar on desktop.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After schema changes, run `pnpm run typecheck:libs` before running the API server typecheck
- After OpenAPI spec changes, run codegen before touching routes or frontend hooks
- The `/attendance/checkin` route must be registered BEFORE `/attendance/:date` in Express to avoid routing conflicts

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
