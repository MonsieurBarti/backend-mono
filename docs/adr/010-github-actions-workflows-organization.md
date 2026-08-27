# ADR 010 – GitHub Actions Workflows Organization

## Status

Accepted

## Context

Pull requests to `main` need a small, named set of required checks. The repository is public, backend-only, and has no deploy pipeline in this skeleton. A sprawl of reusable workflows, runner-resolver indirection, or org-owned action wrappers would hide the jobs that the ruleset actually requires.

Required-check context is the GitHub Actions job `name:` field alone. A workflow filename, a parent workflow title, or a `workflow / job` prefix does not match. The ruleset and the YAML must agree on those strings.

Docs freshness is an idle required check on init: zero packs stay green. Ruleset apply is code, not the Settings UI, and `GITHUB_TOKEN` cannot upsert rulesets.

## Decision

We will keep three entry workflows, zero reusable `_*.yaml` files, and seven required checks whose contexts are job names. Law may still name `cd-`, `cron-`, `manual-`, and `release-` prefixes for later work. Those files do not exist on init.

### 1. File naming and extension

All workflow files use `.yaml`. `.yml` is forbidden under `.github/`.

Every workflow filename begins with a prefix that encodes role:

| Prefix     | Role                                                   | Triggers (when a file of that prefix exists)   |
| ---------- | ------------------------------------------------------ | ---------------------------------------------- |
| `ci-`      | Validation without mutating user-facing infrastructure | `pull_request` and `workflow_dispatch` on init |
| `cd-`      | Build and deploy to an environment                     | Later, when a deploy exists                    |
| `cron-`    | Scheduled                                              | Later                                          |
| `manual-`  | Manual only                                            | Later                                          |
| `release-` | Release or post-merge release work                     | Later                                          |

There is no `_*.yaml` reusable on init. A reusable, if one is ever added, would be `workflow_call` only and would still use the `_` prefix. This skeleton does not add one.

CI versus CD: CI does not mutate infrastructure that users or services reach. CD does. This skeleton has no CD file.

Every entry workflow declares `workflow_dispatch` in addition to its primary trigger, so a failed run can be retried by hand.

### 2. Init entry workflows

Three files. Jobs always run. There is no job-level `if:`. There is no aggregate gate job. There is no `merge_group` trigger.

`.github/workflows/ci-validate-code.yaml`

- Top-level `name:`: `CI · Validate code`
- Triggers: `pull_request`, `workflow_dispatch`
- Jobs in this order: `Lint`, `Format`, `Typecheck`, `Unit tests`, `Integration tests`, `E2E tests`

`.github/workflows/ci-docs-freshness.yaml`

- Top-level `name:`: `CI · Docs freshness`
- Triggers: `pull_request`, `workflow_dispatch`
- One job: `Docs freshness gate`
- Zero packs stay green. See `docs/adr/012-documentation-factory.md`.

`.github/workflows/ci-apply-github-protection.yaml`

- Top-level `name:`: `CI · Apply GitHub protection`
- Triggers: `push` to `main` on `.github/rulesets/**` and `.github/scripts/apply-github-protection.sh`, plus `workflow_dispatch`
- One job: `Apply GitHub protection`
- Not a pull-request required check. A pull request never applies unmerged JSON, because apply runs only after merge to `main` or by dispatch.

No `cd-`, `cron-`, `release-`, or `manual-` files on init. No merge queue. No wrapper-action repository. No local `.github/actions/` composites.

Scripts on init: `.github/scripts/apply-github-protection.sh`, plus docs-freshness detect and gate only. There is no docs-freshness signal script, sticky comment, or labeler.

### 3. Top-level `name:` format

Entry workflows use `Category · Action` with a middle dot: `CI · Validate code`. The category is readable in the Actions sidebar. The middle dot does not collide with Markdown `:` in comments.

Job `name:` values are human labels. They are the required-check contexts. Job ids (the YAML keys) stay verb-object and belong to one taxonomy category from §6.

### 4. Runners

Every job sets `runs-on: ubuntu-24.04` literally. There is no `_resolve-runners.yaml`. There is no self-hosted runner. There is no third-party runner marketplace label.

### 5. Third-party actions

This repository pins official `actions/checkout` and `actions/setup-node` by full commit SHA. Workflows do not pin those actions by tag. Workflows do not call an org wrapper repository.

Node is `24.20.0`. pnpm is `11.24.0` via Corepack.

There is no Vercel Turbo remote cache on init.

### 6. Job taxonomy

Every job belongs to exactly one category.

| Category   | Definition                                                | Init jobs                                      |
| ---------- | --------------------------------------------------------- | ---------------------------------------------- |
| `lint`     | Static analysis. No side effect on the system under test. | `Lint`, `Format`, `Typecheck`                  |
| `test`     | Test execution.                                           | `Unit tests`, `Integration tests`, `E2E tests` |
| `validate` | Dynamic verification without persistence.                 | `Docs freshness gate`                          |
| `deploy`   | Mutates protection state for the repository.              | `Apply GitHub protection`                      |

Rules:

1. One category per job. A job that both tests and deploys splits.
2. Job name is verb-object. No `and`, `&`, `+`, `-and-`, or `-plus-` in the YAML key.
3. A job mixing two categories is forbidden.

`Lint`, `Format`, and `Typecheck` are `lint`: oxlint, oxfmt check, and turbo typecheck do not execute application SQL or HTTP. `Docs freshness gate` is `validate`: it computes path impact and fails or passes without writing a changelog. `Apply GitHub protection` is `deploy` of repository ruleset state, not of an application environment.

### 7. Validate jobs

`ci-validate-code.yaml` jobs:

| Job `name:`         | Category | What it runs                                                                                                                            |
| ------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `Lint`              | lint     | oxlint                                                                                                                                  |
| `Format`            | lint     | oxfmt check                                                                                                                             |
| `Typecheck`         | lint     | turbo typecheck                                                                                                                         |
| `Unit tests`        | test     | Vitest unit. No Postgres.                                                                                                               |
| `Integration tests` | test     | Vitest integration. Service `postgres:18.6`, database `backend_mono_test`, Drizzle migrations once.                                     |
| `E2E tests`         | test     | Vitest e2e. Health `GET` on init. No Postgres. The name stays `E2E tests` so the first bounded context does not force a ruleset rename. |

Test law is `docs/adr/006-testing-hexagonal-modules.md`. This ADR names the CI jobs. It does not restate the spec matrix.

### 8. Required checks

`.github/rulesets/main.json` `required_status_checks` contexts, in this order:

1. `Lint`
2. `Format`
3. `Typecheck`
4. `Unit tests`
5. `Integration tests`
6. `E2E tests`
7. `Docs freshness gate`

Each context is the job `name:` alone. Include `integration_id: 15368` (GitHub Actions). Keep `strict_required_status_checks_policy: true` and `do_not_enforce_on_create: true`.

`Apply GitHub protection` is not in that list.

### 9. Docs freshness job

Detect plus gate only. No sticky comment. No label. No `pull-requests: write`.

Top-level `permissions: contents: read`. The job does not elevate.

Zero packs: the detector emits `[]` and the job stays green. Pack impact rules live in `docs/adr/012-documentation-factory.md`.

### 10. Concurrency

`CI · Validate code` and `CI · Docs freshness`:

- group: `${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}`
- `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`

`CI · Apply GitHub protection`:

- group: `ci-apply-github-protection`
- `cancel-in-progress: false`

A superseded pull-request run may cancel. An apply run must not cancel mid-flight.

### 11. Timeouts

Every job with `steps:` declares `timeout-minutes`. No job relies on GitHub's 360-minute default.

| Job `name:`               | `timeout-minutes` |
| ------------------------- | ----------------- |
| `Lint`                    | 10                |
| `Format`                  | 10                |
| `Typecheck`               | 10                |
| `Unit tests`              | 15                |
| `Integration tests`       | 20                |
| `E2E tests`               | 10                |
| `Docs freshness gate`     | 10                |
| `Apply GitHub protection` | 5                 |

### 12. Permissions

All three workflows declare top-level `permissions: contents: read`. Write scopes, if any, elevate per job, never as `write-all`.

Validate: no job elevation.

Docs freshness: no job elevation.

Apply: `GITHUB_TOKEN` stays read-only. Ruleset upsert uses a PAT secret as `GH_TOKEN`.

User-controlled values (`github.event.*` and friends) pass through `env:`. They never interpolate into a `run:` script body.

### 13. Apply credentials

`GITHUB_TOKEN` cannot upsert rulesets. There is no GitHub App.

The repository holds one fine-grained PAT secret. Identity is MonsieurBarti. Scope is this repository only, with Administration write and contents read.

The apply workflow sets `GH_TOKEN` from that secret. `.github/scripts/apply-github-protection.sh` aborts if `gh api user` is not `MonsieurBarti`.

A missing secret fails the workflow. It does not skip. The first apply after init is a local `gh` invocation. The secret is added after init.

### 14. Four-line headers

Every workflow file begins with:

```yaml
# Purpose: <one sentence>.
# Triggers: <list of triggers>.
# Callers:  n/a
# Owner:    MonsieurBarti
```

Entry workflows set `Callers: n/a`. Owner is `MonsieurBarti` with no `@`. There is no CODEOWNERS file. Team slugs stay fog.

### 15. Scripts

Scripts live under `.github/scripts/`. Each script starts with `set -euo pipefail`.

Apply is `.github/scripts/apply-github-protection.sh`. Docs freshness is detect plus gate only.

### 16. Skip on init

These gates do not ship on init:

- conventional pull-request title
- coverage gate
- merge queue
- remote cache
- SWC build as a required check
- actionlint, Checkov, or bats as required checks
- an Actions history cleanup cron

Law may add `cd-`, `cron-`, `manual-`, or `release-` files later. Adding them is a new decision about those files, not a silent exception to §1.

### 17. Forbidden patterns

| Pattern                                                  | Why                   |
| -------------------------------------------------------- | --------------------- |
| `.yml` under `.github/`                                  | §1. One extension.    |
| `_*.yaml` reusable on this skeleton                      | §2. Zero reusables.   |
| Literal runner other than `ubuntu-24.04`                 | §4.                   |
| `actions/checkout` or `actions/setup-node` pinned by tag | §5. SHA only.         |
| `${{ github.event.* }}` inside `run:`                    | §12. Pass via `env:`. |
| Job with `steps:` and no `timeout-minutes`               | §11.                  |
| Entry workflow without `concurrency:`                    | §10.                  |
| Workflow without top-level `permissions:`                | §12.                  |
| `pull-requests: write` on docs freshness                 | §9.                   |
| GitHub App token for apply                               | §13.                  |
| Required-check context other than the job `name:`        | §8.                   |
| Job YAML key containing `and` / `&` / `+`                | §6.                   |

This ADR is law. It does not contain workflow YAML bodies. Implementers write the three files against these names.

## Consequences

Positive:

- Seven required strings are reviewable from the ruleset and from job `name:` fields without reading a reusable call graph.
- Validate, docs, and apply stay separate. A docs-only change still runs the idle freshness gate. A ruleset change applies only after merge to `main`.
- `ubuntu-24.04` plus SHA-pinned official actions keeps supply-chain review inside this repository.
- Docs freshness cannot comment on or label a pull request, so a green gate cannot hide behind a bypass label.
- The `E2E tests` name survives the first bounded context without a ruleset edit.

Negative:

- SHA pins live in this repository. Bumping `actions/checkout` or `actions/setup-node` is a pull request here, not a wrapper-repo bump.
- A PAT with Administration write is a secret to rotate. The apply script's `gh api user` check is the guardrail, not a substitute for rotation.
- No reusable means duplicated checkout and Corepack steps across the three workflows. Duplication is cheaper than an unused `_` call graph.
- Skipping coverage, title lint, and merge queue on init leaves those policies unset until a later ADR or ruleset change.

Trade-offs:

- Cancel-in-progress on pull requests saves minutes and can hide a flake that only appeared on the cancelled run. Apply never cancels, so two dispatches queue.
- `do_not_enforce_on_create: true` lets the init commit exist before checks have ever reported. After that, `strict_required_status_checks_policy: true` demands the seven names.

## Alternatives Considered

**Reusable `_*.yaml` workflows for lint and test.** Rejected: the skeleton has three entry files and seven job names. A reusable would add a `workflow / job` reporting shape that does not match the required context, which is the job `name:` alone.

**A `_resolve-runners.yaml` indirection.** Rejected: every job runs on GitHub-hosted `ubuntu-24.04`. A resolver file is a second failure domain for one literal.

**Org-owned composite wrappers around `actions/checkout` and `actions/setup-node`.** Rejected: this repository is the only consumer today. SHA pins in-tree are the inventory.

**GitHub App for ruleset apply.** Rejected: identity must be MonsieurBarti. A fine-grained PAT plus `gh api user` abort is the locked credential model. `GITHUB_TOKEN` cannot upsert rulesets.

**Sticky comment and `docs-freshness` label.** Rejected: detect plus gate is enough. `pull-requests: write` would let a comment or label look like a bypass. There is no label bypass; see `docs/adr/012-documentation-factory.md`.

**Merge queue, conventional title, coverage, or remote cache on init.** Rejected: they are not required to freeze `main`. Adding them later is a separate change to workflows and to the ruleset.

**Browser or third-party e2e runner as the `E2E tests` job.** Rejected: `docs/adr/006-testing-hexagonal-modules.md` already runs health `GET` on Vitest. The job name stays `E2E tests` so the ruleset does not churn when a bounded-context HTTP harness lands.
