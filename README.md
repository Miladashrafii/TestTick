# TestTick

Modern test case management — a fresh take on classic TestLink workflows.

## User guides

- **English:** [docs/USER_GUIDE_EN.md](./docs/USER_GUIDE_EN.md)
- **فارسی:** [docs/USER_GUIDE_FA.md](./docs/USER_GUIDE_FA.md)
- Feature list: [docs/FEATURE_PROPOSALS.md](./docs/FEATURE_PROPOSALS.md)

## What's included

### Core (TestLink-style)

- **Projects** with prefixes and membership roles
- **Test Specification** — hierarchical suites and cases
- **Test Plans** — builds, platforms, milestones, case assignment
- **Execution** — Pass / Fail / Blocked / Skipped (keyboard-friendly)
- **Requirements** — coverage links
- **Reports** — status, importance, coverage, flaky & regressions
- **Users & roles** — Administrator → Guest
- **i18n** — English + Persian with RTL/LTR

### Modern extras

- AI-assisted case drafting (OpenAI optional)
- CI JUnit ingest via API key
- Review/approval workflow
- Activity feed, @mentions, presence
- Saved views, exploratory sessions, data-driven datasets
- Import/export (CSV, JSON, Excel, TestLink XML)
- REST + GraphQL APIs
- Dark mode (opt-in), custom fields

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- Prisma + SQLite (swap to Postgres later)
- Auth.js (credentials)
- next-intl

## Quick start

```bash
git clone https://github.com/Miladashrafii/TestTick.git
cd TestTick
cp .env.example .env
npm install
npm run db:setup
npm run dev
```

- English UI: [http://localhost:3000/en/login](http://localhost:3000/en/login)
- Persian UI: [http://localhost:3000/fa/login](http://localhost:3000/fa/login)

| User | Email | Password |
|------|-------|----------|
| Admin | `admin@testtick.app` | `admin123` |
| Tester | `tester@testtick.app` | `tester123` |
| Designer | `designer@testtick.app` | `designer123` |

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run db:push` | Sync Prisma schema |
| `npm run db:seed` | Seed demo data |
| `npm run db:setup` | Push + seed |

## License

See repository for license details.
