# TestTick User Guide (English)

Complete walkthrough for installing, configuring, and using TestTick day to day.

Persian guide: [USER_GUIDE_FA.md](./USER_GUIDE_FA.md)

---

## 1. What is TestTick?

TestTick is a modern **test case management system** (TMS) inspired by classic TestLink workflows, with a current UI and extras such as AI drafting, CI result ingest, flaky insights, API keys, and Persian RTL.

Core concepts:

| Concept | Meaning |
|--------|---------|
| **Project** | A product or system under test (owns suites, plans, requirements) |
| **Suite / Case** | Specification tree: suites contain test cases |
| **Plan** | A release/regression package of selected cases + builds/platforms |
| **Build** | A version under test (e.g. `1.0.0-rc1`) |
| **Execution** | Recording Pass / Fail / Blocked / Skipped for a case on a build |
| **Requirement** | A requirement doc linked to covering cases |

---

## 2. Install & run

### Requirements

- Node.js 20+ recommended
- npm

### Steps

```bash
git clone https://github.com/Miladashrafii/TestTick.git
cd TestTick
cp .env.example .env
npm install
npm run db:setup
npm run dev
```

Open:

- English: http://localhost:3000/en/login  
- Persian: http://localhost:3000/fa/login  

### Demo accounts (after seed)

| Role | Email | Password |
|------|-------|----------|
| Administrator | `admin@testtick.app` | `admin123` |
| Tester | `tester@testtick.app` | `tester123` |
| Designer | `designer@testtick.app` | `designer123` |

Seed also prints a **sample API key** once (hashed in DB). Re-run `npm run db:seed` if you need a fresh demo key.

### Useful scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build & serve |
| `npm run db:push` | Apply Prisma schema |
| `npm run db:seed` | Load demo data |
| `npm run db:setup` | Push + seed |

---

## 3. Environment variables

Copy `.env.example` → `.env`:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Default SQLite: `file:./dev.db` |
| `AUTH_SECRET` | Yes | Long random string for Auth.js |
| `AUTH_URL` | Yes | App URL, e.g. `http://localhost:3000` |
| `OPENAI_API_KEY` | No | Enables OpenAI-backed case drafting |
| `OPENAI_MODEL` | No | Default `gpt-4o-mini` |
| `GITHUB_ISSUES_BASE_URL` | No | e.g. `https://github.com/org/repo` for “new issue” deep links |

Without `OPENAI_API_KEY`, AI draft still works using a local heuristic generator.

---

## 4. Language, RTL, and theme

- Use the **EN / FA** switcher in the header.
- Persian (`/fa/...`) is **RTL**; English is **LTR**.
- Dark mode is **opt-in** via the theme toggle (default is light).

---

## 5. Typical QA workflow

### Step A — Create or open a project

1. Go to **Projects**.
2. Create a project with a **name** and short **prefix** (used in case IDs like `TTS-0001`).
3. Open the project to see overview cards and navigation.

### Step B — Write the test specification

1. Open **Test Specification** (`Suites`).
2. Create suites, then cases with:
   - Title, summary, preconditions  
   - Steps & expected results  
   - Importance (High / Medium / Low)  
   - Execution type (Manual / Automated)  
3. Optional:
   - **AI draft**: describe the scenario → generate fields → edit → save  
   - **Saved views**: store filters (search, importance, review status)  
   - **Custom fields**: defined in Settings, edited on the case  
   - **Datasets**: data-driven parameter rows on the case detail page  

### Step C — Review & approve

On a case or plan:

1. **Submit for review**  
2. Reviewer **Approves** or **Rejects**  
3. Status flows: `Draft` → `In review` → `Approved` / `Rejected`

### Step D — Build a test plan

1. Open **Test Plans** → create a plan.  
2. Add a **build** (and platforms if needed).  
3. Assign cases from the specification to the plan.

### Step E — Execute tests

1. Open **Execution**.  
2. Select plan / build (and platform when available).  
3. Record results: Pass / Fail / Block / Skip + notes.  

**Keyboard shortcuts** (execution board):

| Key | Action |
|-----|--------|
| `j` / `k` | Next / previous case |
| `p` | Pass |
| `f` | Fail |
| `b` | Block |
| `s` | Skip |
| `n` | Focus notes |
| `Enter` | Save result |

### Step F — Requirements & coverage

1. Open **Requirements**.  
2. Add docs (`REQ-…`).  
3. Link covering cases (coverage appears in reports).

### Step G — Reports & flaky insights

Open **Reports** to see:

- Results by status  
- Cases by importance  
- Requirement coverage  
- Pass-rate by build  
- **Flaky** cases (mixed pass/fail history)  
- **Regressions** (was green, now red)

---

## 6. Collaboration features

### Activity & mentions

- Project **Activity** page lists comments and status changes.  
- On a case, post comments; mention teammates with `@email` (project members).

### Presence

When others are in the same project, their avatars appear in the header (heartbeat-based).

### Exploratory testing

1. Open **Explore**.  
2. Start a session with a **charter** and duration.  
3. Take notes while the timer runs; end the session when done.

### Issue links

From a failed execution or case:

- Paste / create links to **GitHub**, **Jira**, **Linear**, or a custom URL.  
- Optional “open new GitHub issue” deep link uses `GITHUB_ISSUES_BASE_URL`.

---

## 7. Project settings

Path: **Settings** inside a project.

### API keys

1. Create a key (plaintext shown **once**).  
2. Use as `Authorization: Bearer <key>` for REST / CI / GraphQL.  
3. Revoke unused keys.

### Custom fields

Define fields (string, number, select, boolean) that apply to test cases, then fill values on case pages.

### Import / export

Export or import cases as:

- CSV  
- JSON  
- Excel (XLSX)  
- TestLink-style XML  

Use this to migrate from older tools or share specs with other teams.

---

## 8. API usage

Base URL (local): `http://localhost:3000`

### Auth

- Browser session (cookie), or  
- `Authorization: Bearer <api-key>`

### REST (examples)

```http
GET  /api/v1/projects
GET  /api/v1/projects/{projectId}
GET  /api/v1/projects/{projectId}/cases
POST /api/v1/projects/{projectId}/cases
GET  /api/v1/projects/{projectId}/plans
GET  /api/v1/projects/{projectId}/executions
GET  /api/v1/projects/{projectId}/analytics/flaky
```

### CI — JUnit ingest

Map automated tests with `automationKey` on cases (or automation mappings), then:

```bash
curl -X POST "http://localhost:3000/api/v1/projects/{projectId}/ci/junit?planId=PLAN_ID&buildName=ci-42" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/xml" \
  --data-binary @results.xml
```

Results are stored as executions with source `ci`.

### GraphQL

Endpoint: `POST /api/graphql`  
Use the same Bearer API key for authenticated operations. Explore the schema in `src/lib/graphql/schema.ts`.

---

## 9. Roles (overview)

| Role | Typical access |
|------|----------------|
| Administrator | Full control, users |
| Leader | Project leadership, plans, assignments |
| Senior tester / Tester | Execute and comment |
| Test designer | Suites & cases |
| Guest | Read-oriented access |

Exact checks live in `src/lib/authz.ts`.

---

## 10. Troubleshooting

| Problem | What to try |
|---------|-------------|
| Login fails | Re-seed: `npm run db:seed` |
| Empty DB / schema errors | `npm run db:setup` |
| AI draft “weak” | Set `OPENAI_API_KEY` in `.env` |
| CI not mapping cases | Set matching `automationKey` on cases |
| API 401 | Check Bearer key; create a new key in Settings |
| Wrong language direction | Use `/en/...` vs `/fa/...` |

---

## 11. Further reading

- [FEATURE_PROPOSALS.md](./FEATURE_PROPOSALS.md) — implemented modern features list  
- Root [README.md](../README.md) — quick start  
- Repository: https://github.com/Miladashrafii/TestTick  
