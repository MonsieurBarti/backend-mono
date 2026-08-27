## Agent skills

### Issue tracker

Issues live in Linear (Initiatives → Projects → Milestones → Issues → Sub-issues) via MCP `barti-mono-linear`. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical roles map 1:1 to Linear labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Three systems stay distinct. Glossaries (`CONTEXT.md`) are language only. ADRs live in `docs/adr/`. The factory hub is `docs/MAP.md`. See `docs/agents/domain.md`.

### Git pristine

Keep the main checkout git pristine: on `main`, with a clean working tree and no extra local commits. Work in a worktree at `~/Projects/barti-mono-<ticket>`.

### MonsieurBarti identity

`gh api user` must be `MonsieurBarti`.

### GitHub mutation

Pierre authorizes every GitHub mutation. Wait for Pierre before any `gh` write, push, or PR.

### Local backend test

Local test, Compose, integration, e2e, or full database: read `.omp/skills/local-backend-test/SKILL.md`.
