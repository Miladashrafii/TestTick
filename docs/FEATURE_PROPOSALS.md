# TestTick — modern features

All proposed features below are **implemented** in the current codebase.

## High impact

1. **AI-assisted test case drafting** — `src/lib/ai/draft-case.ts` + UI on suites (uses OpenAI when `OPENAI_API_KEY` is set, otherwise heuristic draft).
2. **CI / automation sync** — `POST /api/v1/projects/[projectId]/ci/junit` with Bearer API key; maps automation keys to cases.
3. **Live dashboards & flaky detection** — reports/insights + `src/lib/analytics/flaky.ts` + `/api/v1/.../analytics/flaky`.
4. **Issue tracker deep-link** — link/create GitHub/Jira/Linear/custom URLs from failed executions and cases.
5. **Review / approval workflow** — Draft → In review → Approved / Rejected on cases and plans.

## Collaboration

6. **@mentions & activity feed** — project Activity page + case comments.
7. **Real-time co-presence** — heartbeat `/api/presence` + avatars in shell.
8. **Shared filters & saved views** — save/load filters on test specification.

## Quality & scale

9. **Exploratory sessions** — `/projects/[id]/exploratory` with charter, timer, notes.
10. **Data-driven cases** — parameter datasets on case detail.
11. **Import/export** — CSV / JSON / Excel / TestLink-style XML (settings + API).
12. **REST + GraphQL API** — `/api/v1/...` and `/api/graphql` with project API keys.

## UX polish

13. **Keyboard-first execution** — j/k, p/f/b/s, notes, Enter save.
14. **Dark mode toggle** — opt-in (`light` default).
15. **Custom fields UI** — define in project settings; edit on cases.
