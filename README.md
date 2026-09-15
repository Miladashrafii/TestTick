# TestTick

Modern test case management — a fresh take on classic TestLink workflows.

## What's included (TestLink-parity core)

- **Projects** with prefixes and membership roles
- **Test Specification** — hierarchical suites and cases (steps, expected results, importance, manual/automated)
- **Test Plans** — builds, platforms, milestones, case assignment
- **Execution** — Pass / Fail / Blocked / Skipped with notes
- **Requirements** — doc IDs and coverage links
- **Reports** — status breakdown, importance mix, coverage snapshot
- **Users & roles** — Administrator, Leader, Senior tester, Tester, Test designer, Guest
- **i18n** — English + **Persian (فارسی)** with proper **RTL/LTR**

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- Prisma + SQLite (easy local start; swap to Postgres later)
- Auth.js (credentials)
- next-intl

## Quick start

```bash
npm install
npm run db:setup
npm run dev
```

Open [http://localhost:3000/en/login](http://localhost:3000/en/login)

| User | Email | Password |
|------|-------|----------|
| Admin | `admin@testtick.app` | `admin123` |
| Tester | `tester@testtick.app` | `tester123` |
| Designer | `designer@testtick.app` | `designer123` |

Persian UI: [http://localhost:3000/fa/login](http://localhost:3000/fa/login)

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run db:push` | Sync Prisma schema |
| `npm run db:seed` | Seed demo data |
| `npm run db:setup` | Push + seed |

## Roadmap ideas (need your OK)

See proposed modern features in chat / `docs/FEATURE_PROPOSALS.md` before implementation.
