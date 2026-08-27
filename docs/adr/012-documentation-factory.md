# ADR 012 – Documentation Factory

## Status

Accepted

## Context

This repository needs a place for living narrative that is not an ADR and not a glossary. ADRs in `docs/adr/` record hard decisions. Glossaries record ubiquitous language. Neither is a map of flows or hexagonal modules.

The skeleton has no product bounded context and no flow. Shipping a fake pack, a knowledge-base tree, or a business `CONTEXT.md` would invent product language the code does not have.

Agents and humans still need one hub, a playbook, and a freshness vehicle that stays green when nothing is onboarded. Hexagonal packs, when a bounded context exists, must travel with that bounded context.

## Decision

We will keep three documentation systems distinct. We will ship an empty hub and an idle freshness gate on init. We will not ship packs, glossaries, or a knowledge-base tree on init.

### 1. Three systems stay distinct

| System                                                        | Role                                                 | Must not become                     |
| ------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------- |
| Glossaries (`CONTEXT.md`, root `CONTEXT-MAP.md` when present) | Ubiquitous language only                             | Navigation hub or feature narrative |
| ADRs (`docs/adr/`)                                            | Hard, hard-to-reverse decisions                      | Living pack runbooks                |
| Factory packs                                                 | Navigable living narrative for flows and hex modules | Glossary dump or ADR substitute     |

Packs link out to glossaries and ADRs. They never absorb them.

There is no `CONTEXT.md` and no `CONTEXT-MAP.md` on init. The first bounded context may add a local glossary beside its code. That glossary never lives under pack `docs/`.

### 2. Two pack profiles

| Profile      | Use                                        | Pack home                                              | Navigation MAP                                          |
| ------------ | ------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------- |
| `flow`       | Transverse journeys                        | `docs/contexts/<flow>/README.md`                       | Co-located `docs/contexts/<flow>/MAP.md`                |
| `hex-module` | Hexagonal modules inside a bounded context | `apps/api/src/contexts/<bc>/docs/<doc-slug>/README.md` | BC router `apps/api/src/contexts/<bc>/docs/MAP.md` only |

- MAP is navigation only: spine, module index, boundaries. No long narrative.
- README is the pack home: purpose, indexes, pack-wide invariants, ownership pointer.
- Deep or skippable topics live under `features/<slug>.md`.
- Each pack has `CHANGELOG.md` and `changelog.d/`. On onboard, authors may edit `CHANGELOG.md` directly. Fragment compile is later, outside this skeleton.

Required section titles and frontmatter field shapes live in `docs/documentation-factory.md`. Missing required headings means the pack is not onboarded.

### 3. Init artifacts

A later ticket ships these against this law. This ADR names them.

Ship on init:

- `docs/MAP.md` — empty hub. Onboarded flows and bounded contexts: none. No stub rows. How-to-use plus links to the playbook and to this ADR.
- `docs/documentation-factory.md` — thin playbook: paths, headings, frontmatter, onboard. No product names invented here.
- `docs/adr/012-documentation-factory.md` — this file.
- `docs/agents/domain.md` — teaches the glossary-versus-navigation split and points at `docs/MAP.md`.
- Idle freshness vehicle: detector scripts plus the workflow job. Job name `Docs freshness gate`.

Do not ship on init:

- Any pack
- Any `docs/contexts/` directory
- Any bounded-context `docs/` tree
- `CONTEXT.md`, `CONTEXT-MAP.md`
- A changelog-compile bot or nightly cron
- A knowledge-base tree

`docs/agents/**` stays agent convention docs. It is not a factory pack.

### 4. Paths when a bounded context or flow exists

Hex module:

```text
apps/api/src/contexts/<bc>/docs/<doc-slug>/
  README.md
  features/
  CHANGELOG.md
  changelog.d/
```

Hex bounded-context router: `apps/api/src/contexts/<bc>/docs/MAP.md` only. No `code_paths` on MAP files.

Flow:

```text
docs/contexts/<flow>/{MAP.md, README.md, features/, CHANGELOG.md, changelog.d/}
```

The root hub lists onboarded flow and bounded-context MAP files only. Module packs register on the bounded-context MAP only.

`doc_slug` is required in frontmatter when the pack name is not the code directory name.

Health, kernel, and Hive get no pack. Health stays `apps/api/src/presentation/health/`. Kernel stays `apps/api/src/shared`. Hive is communication law in `docs/adr/003-bc-hive-communication.md`, not a documented product module.

Hex layout is `docs/adr/002-hexagonal-architecture.md`. Packs do not restate that architecture.

### 5. Single hub

Humans and agents share `docs/MAP.md`.

- Not a second agent-only hub.
- Not `CONTEXT-MAP.md` as a feature funnel.
- `docs/agents/domain.md` teaches the split. It is not a curated topic-to-pack shortcut list.
- After a hex pack exists, code-local READMEs under `apps/api/src/contexts/**` become thin pointers into the pack or the bounded-context MAP.
- The root hub never lists not-yet-onboarded areas as stub rows.

### 6. Freshness

Pack homes declare explicit repo-root globs in `code_paths`. The key is required. There is no inference from `doc_slug` or folder adjacency.

MAP files have no `code_paths`.

Impact = a touch under `code_paths` minus the runner denylist (tests, snapshots, generated), while that pack's changelog is untouched.

Clear only by `<pack>/CHANGELOG.md` or `<pack>/changelog.d/*.md`. Feature sheets, README, MAP, and `changelog.d/.gitkeep` do not clear.

There is no label bypass. There is no sticky comment. The required check context is the job name alone: `Docs freshness gate`. `docs/adr/010-github-actions-workflows-organization.md` names the workflow. It does not re-decide whether the gate exists.

Zero packs: the detector emits `[]` and the job stays green. That is why the vehicle ships idle on init.

Pack onboard may edit `CHANGELOG.md` directly. Fragment compile is later.

Automation is path coupling only. Semantic "docs match code" stays human.

### 7. Ownership

Pack-home `owner` is required at onboard. Format is `monsieurbarti/<team>` with no `@`.

Actual team slugs stay fog. There is no CODEOWNERS file yet. CODEOWNERS lines wait on that fog.

### 8. Onboarded

A pack is onboarded when all of the following hold:

1. The tree exists on the locked path for its profile.
2. Pack-home frontmatter is complete: `profile`, `owner`, `code_paths`; `doc_slug` when the name is not the code directory.
3. Required headings exist. Bodies may be thin during write-up.
4. Registration: flow or bounded context on the root hub; module on the bounded-context MAP only.

Root and bounded-context MAP rows list only onboarded targets. There are no stub rows. There is no fake pack.

Soft-CI membership is automatic from non-empty `code_paths`. There is no second registry file.

### 9. Explicit non-goals for this skeleton

- Fake pack
- Knowledge-base tree
- Business glossary on init
- Health, kernel, or Hive packs
- Changelog-compile bot
- Semantic "docs match code" CI
- CODEOWNERS team slugs while they remain fog

## Consequences

Positive:

- Glossary, ADR, and narrative stay separable when the first bounded context arrives.
- An empty `docs/MAP.md` plus an idle `Docs freshness gate` give CI a stable required context without inventing product docs.
- Hex packs will sit beside `apps/api/src/contexts/<bc>/`, so extract moves code and narrative together.
- Freshness has one green path: a changelog touch. Inaction is not cheaper than a row.
- Health, kernel, and Hive cannot be "onboarded" as packs, so the factory cannot colonize infrastructure.

Negative:

- Two future indexes (`CONTEXT-MAP.md` versus `docs/MAP.md`) can be confused. The empty-hub period has no glossary file, which removes the confusion only until the first glossary exists.
- Hex packs add a `docs/` tree beside code. Reviewers must learn MAP versus README versus features.
- `owner: monsieurbarti/<team>` is required at onboard while team slugs are still fog, so the first pack author must pick a placeholder team string and change it when slugs exist.
- Changelog-compile is not in this skeleton. Authors edit `CHANGELOG.md` by hand until a later decision adds fragments-as-the-only-write-path.

Trade-offs:

- Shipping the detector idle (`[]` → green) keeps the required check stable. It also means a missing detector is indistinguishable from "no packs" until a pack is onboarded and the gate has work to do.
- Path coupling is mechanical. A changelog row can clear the gate without proving the feature sheet is complete. Completeness stays a human review.

## Alternatives Considered

**Onboard a fake pack so the freshness gate has something to fail.** Rejected: a fake pack is a stub row with invented `code_paths`. It would teach the wrong hub shape and would fail PRs that touch unrelated kernel files.

**A knowledge-base tree under `docs/` as the factory.** Rejected: a transverse KB is not shaped for hex isolation or for packs that travel with a bounded context. Packs may link out later. They do not colonize a KB on init.

**Ship `CONTEXT.md` / `CONTEXT-MAP.md` on init as the hub.** Rejected: glossaries are language only, and this skeleton has no business language. Overloading them as navigation collapses both jobs. `docs/MAP.md` is the hub.

**Packs for health, kernel, or Hive.** Rejected: health is `apps/api/src/presentation/health/`. Kernel is `apps/api/src/shared`. Hive is an ADR. None is a product module with a journey or an aggregate catalog.

**Changelog-compile bot and nightly cron on init.** Rejected: there are zero packs. A bot PR against an empty changelog is noise. Direct `CHANGELOG.md` edits on onboard are enough.

**Semantic "docs match code" CI.** Rejected: the gate is path coupling plus changelog-touched clearing. Proving narrative completeness is a human review, not a linter.

**Infer `code_paths` from folder adjacency or `doc_slug`.** Rejected: a silent wrong path set is worse than an explicit list. Empty `code_paths` on a flow MAP-adjacent pack is honest: the gate never fires.

**Label bypass or sticky comment.** Rejected: the only clear is a changelog touch. `docs/adr/010-github-actions-workflows-organization.md` already forbids `pull-requests: write` on the freshness job.
