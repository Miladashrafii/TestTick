# TestTick

**Modern test case management for QA teams** — a contemporary reimagining of classic [TestLink](https://testlink.org/) workflows, with a clean UI, Persian (فارسی) RTL support, CI integration, and collaboration features that match today’s tooling.

Repository: [github.com/Miladashrafii/TestTick](https://github.com/Miladashrafii/TestTick)

| | |
|---|---|
| **English guide** | [docs/USER_GUIDE_EN.md](./docs/USER_GUIDE_EN.md) |
| **راهنمای فارسی** | [docs/USER_GUIDE_FA.md](./docs/USER_GUIDE_FA.md) |
| **Feature map** | [docs/FEATURE_PROPOSALS.md](./docs/FEATURE_PROPOSALS.md) |

---

## Why TestTick?

TestLink is a proven open-source TMS, but its UX and integration story feel dated. TestTick keeps the **same mental model** QA teams already know — projects, suites, cases, plans, builds, executions, requirements — and rebuilds it as a modern web app:

- Fast, readable UI (light by default, optional dark mode)
- First-class **English + Persian** with correct **LTR / RTL**
- Keyboard-first execution for high-volume manual testing
- API + JUnit ingest so automation results land next to manual runs
- Review workflow, activity/mentions, presence, exploratory sessions, and more

If you know TestLink, you already understand TestTick. If you don’t, the concepts below are enough to get productive in minutes.

---

## Concepts (in one minute)

```text
Project
 ├── Test Specification (suites → cases)
 ├── Requirements (linked to cases)
 ├── Test Plans
 │    ├── Builds & platforms
 │    └── Assigned cases → Executions (Pass / Fail / Blocked / Skipped)
 ├── Activity, exploratory sessions, saved views
 └── Settings (API keys, custom fields, import/export)
```

| Term | What it means |
|------|----------------|
| **Project** | One product/system under test; owns all specs and plans |
| **Prefix** | Short code used in case IDs (`TTS-0001`) |
| **Suite / Case** | Hierarchical specification; a case has steps + expected results |
| **Plan** | A release or regression package of selected cases |
| **Build** | Concrete version under test (`1.0.0-rc1`) |
| **Execution** | One recorded result for a case on a build |
| **Requirement** | Spec/requirement document with coverage links |

---

## Features

### Core TMS (TestLink-style)

- **Projects** with membership and roles  
- **Test specification** — nested suites, rich cases (summary, preconditions, steps, expected results, importance, manual/automated)  
- **Test plans** — builds, platforms, milestones, case assignment & assignees  
- **Execution** — Pass / Fail / Blocked / Skipped with notes  
- **Requirements** — doc IDs and case coverage  
- **Reports** — status mix, importance mix, coverage snapshot  
- **Users & roles** — Administrator, Leader, Senior tester, Tester, Test designer, Guest  

### Modern extras

| Area | What you get |
|------|----------------|
| **AI drafting** | Generate case fields from a short prompt (OpenAI if `OPENAI_API_KEY` is set; otherwise a local heuristic) |
| **CI sync** | `POST` JUnit XML → map by `automationKey` → store as CI executions |
| **Insights** | Pass-rate by build, **flaky** detection, **regressions** since last green |
| **Issues** | Deep-link / store GitHub, Jira, Linear, or custom issue URLs from failures |
| **Review** | Draft → In review → Approved / Rejected for cases and plans |
| **Collaboration** | Activity feed, `@email` mentions, live presence avatars |
| **Saved views** | Named, shareable filters on the specification |
| **Exploratory** | Time-boxed sessions with charter + notes |
| **Data-driven** | Parameter datasets on a case |
| **Import / export** | CSV, JSON, Excel (XLSX), TestLink-style XML |
| **Public API** | REST `/api/v1/...` + GraphQL `/api/graphql` with project API keys |
| **UX** | Keyboard execution (`j/k`, `p/f/b/s`), dark mode toggle, custom fields UI |
| **i18n** | `en` + `fa` with proper directionality |

---

## Tech stack

| Layer | Choice |
|-------|--------|
| App | Next.js 16 (App Router), React 19, TypeScript |
| UI | Tailwind CSS 4, Radix primitives, Lucide icons |
| Data | Prisma 6 + SQLite by default (`file:./dev.db`) |
| Auth | Auth.js (NextAuth v5) credentials |
| i18n | `next-intl` (`/en/...`, `/fa/...`) |
| APIs | REST routes + GraphQL Yoga |
| Import | `xlsx`, `fast-xml-parser` |

SQLite keeps local setup trivial. The Prisma schema can later point at PostgreSQL for production.

---

## Quick start

### Prerequisites

- **Node.js 20+**
- **npm**

### Install & run

```bash
git clone https://github.com/Miladashrafii/TestTick.git
cd TestTick
cp .env.example .env
npm install
npm run db:setup    # prisma db push + demo seed
npm run dev
```

Then open:

| Locale | URL |
|--------|-----|
| English | http://localhost:3000/en/login |
| فارسی | http://localhost:3000/fa/login |

### Demo users (created by seed)

| Role | Email | Password |
|------|-------|----------|
| Administrator | `admin@testtick.app` | `admin123` |
| Tester | `tester@testtick.app` | `tester123` |
| Designer | `designer@testtick.app` | `designer123` |

After seeding, the terminal also prints a **sample API key once** (only the hash is stored). Re-run `npm run db:seed` if you need a new demo key.

### npm scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript `tsc --noEmit` |
| `npm run db:push` | Sync Prisma schema to the database |
| `npm run db:seed` | Load demo data |
| `npm run db:generate` | Regenerate Prisma Client |
| `npm run db:setup` | `db:push` + `db:seed` |

---

## Configuration

Copy `.env.example` to `.env` and adjust:

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | Default: `file:./dev.db` |
| `AUTH_SECRET` | Yes | Long random secret for Auth.js |
| `AUTH_URL` | Yes | Public app URL, e.g. `http://localhost:3000` |
| `OPENAI_API_KEY` | No | Enables OpenAI-backed AI case drafting |
| `OPENAI_MODEL` | No | Defaults to `gpt-4o-mini` |
| `GITHUB_ISSUES_BASE_URL` | No | e.g. `https://github.com/org/repo` for “new issue” links |

Never commit `.env`. `.env.example` is safe to share.

---

## Everyday workflow (short)

1. **Projects** — create a project with a unique prefix.  
2. **Test Specification** — build suites and cases (optionally AI-draft, custom fields, datasets).  
3. **Review** — submit → approve/reject before locking quality of the spec.  
4. **Test Plans** — pick cases, add builds/platforms, assign testers.  
5. **Execution** — run the board; use keyboard shortcuts for speed.  
6. **Requirements & Reports** — keep coverage and flaky/regression visibility.  
7. **Settings** — API keys, import/export, custom field definitions.  
8. **Activity / Explore** — discuss with mentions; run exploratory charters.

For a full walkthrough (screens, shortcuts, API curl examples), use the bilingual user guides linked at the top.

### Execution shortcuts

| Key | Action |
|-----|--------|
| `j` / `k` | Next / previous case |
| `p` | Pass |
| `f` | Fail |
| `b` | Block |
| `s` | Skip |
| `n` | Focus notes |
| `Enter` | Save |

---

## APIs (overview)

Base URL (local): `http://localhost:3000`

**Auth:** browser session cookie **or** `Authorization: Bearer <project-api-key>` (create keys under project **Settings**).

### REST examples

```http
GET  /api/v1/projects
GET  /api/v1/projects/{projectId}
GET  /api/v1/projects/{projectId}/cases
POST /api/v1/projects/{projectId}/cases
GET  /api/v1/projects/{projectId}/plans
GET  /api/v1/projects/{projectId}/executions
GET  /api/v1/projects/{projectId}/analytics/flaky
POST /api/v1/projects/{projectId}/ci/junit?planId=...&buildName=ci-42
```

JUnit body: raw XML (`Content-Type: application/xml`). Cases match via `automationKey` / automation mappings.

### GraphQL

```http
POST /api/graphql
```

Schema lives in `src/lib/graphql/schema.ts`.

---

## Project layout (high level)

```text
TestTick/
├── docs/                 # User guides (EN/FA) + feature map
├── messages/             # next-intl catalogs (en.json, fa.json)
├── prisma/               # schema.prisma + seed.ts
├── src/
│   ├── app/
│   │   ├── [locale]/    # UI routes (login, dashboard, project pages)
│   │   └── api/          # Auth, REST v1, GraphQL, presence, export
│   ├── components/       # UI + feature panels
│   ├── i18n/             # Locale routing
│   └── lib/              # Auth, Prisma, actions, CI, analytics, import-export
└── README.md
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Cannot log in | Run `npm run db:seed` and use a demo account |
| Schema / missing table errors | `npm run db:setup` |
| AI drafts feel generic | Set `OPENAI_API_KEY` in `.env` and restart `npm run dev` |
| CI results don’t attach to cases | Set matching `automationKey` on automated cases |
| API returns 401 | Create/revoke keys in project Settings; send `Bearer` correctly |
| UI direction wrong | Use `/fa/...` for RTL or `/en/...` for LTR |

---

## مستندات فارسی (خلاصه)

**TestTick** یک ابزار مدیریت کیس تست مدرن است که ایده‌های TestLink را با رابط امروزی، پشتیبانی کامل فارسی/RTL، اجرای کیبوردی، اتصال CI، گزارش flaky، ورک‌فلو بازبینی، API و همکاری تیمی پیاده می‌کند.

### شروع سریع

```bash
git clone https://github.com/Miladashrafii/TestTick.git
cd TestTick
cp .env.example .env
npm install
npm run db:setup
npm run dev
```

ورود فارسی: http://localhost:3000/fa/login  
حساب ادمین دمو: `admin@testtick.app` / `admin123`

### گردش‌کار کوتاه

1. پروژه بساز (با پیشوند شناسه کیس)  
2. سوییت و کیس بنویس (در صورت نیاز با AI)  
3. بازبینی و تأیید کن  
4. پلن و بیلد بساز و کیس‌ها را تخصیص بده  
5. در **اجرا** نتیجه ثبت کن (`p/f/b/s`)  
6. گزارش، نیازمندی، فعالیت و تنظیمات (API / ایمپورت) را استفاده کن  

**راهنمای کامل فارسی:** [docs/USER_GUIDE_FA.md](./docs/USER_GUIDE_FA.md)

---

## Contributing / roadmap

This repo is the product codebase for TestTick. Improvements welcome via issues and pull requests on GitHub.

Implemented modern capabilities are listed in [docs/FEATURE_PROPOSALS.md](./docs/FEATURE_PROPOSALS.md).

---

## License

See the repository for license terms. Demo credentials are for local development only — change secrets before any shared or production deployment.
