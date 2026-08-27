# ADR 001 – Architecture Decision Records

## Status

Accepted

## Context

This repository is a backend-only monorepo. Architectural choices will accumulate as bounded contexts, kernel modules, and vendor integrations land. Those choices need a durable, reviewable record of _why_ the code is shaped the way it is.

Without a process, every new decision is a fresh design exercise. Status values drift. Numbering becomes a guess. Reviewers spend time on structure instead of substance. Agents that read this corpus produce inconsistent documents.

The process itself is an architectural decision. It governs how later decisions are recorded, superseded, and discovered. Documenting it only in agent notes would separate the law from the corpus it governs.

This file lands `Accepted` on the init commit. Later ADRs follow the lifecycle in §3.

## Decision

We will record architecturally significant decisions as Architecture Decision Records (ADRs) under `docs/adr/`.

### 1. Format — Nygard's five sections, required order

Every ADR uses the Michael Nygard (2011) template. Five sections, in this order:

```markdown
# ADR NNN – <Title>

## Status

<Proposed | Accepted | Deprecated | Superseded by ADR NNN>

## Context

<The forces at play — technical, organizational, historical. Value-neutral,
factual prose. State what is currently true and why a decision is needed now.>

## Decision

<The response. Active voice, starting with "We will…" or a direct statement.
Break into numbered subsections for multi-part decisions. Include code
examples, tables, and diagrams where they sharpen the rule.>

## Consequences

<All resulting impacts — positive, negative, neutral. Trade-offs accepted.
What becomes easier, what becomes harder, what breaks if the rule is
violated.>

## Alternatives Considered

<What else was on the table and why it was rejected. One paragraph per
alternative. Reject on substance, not preference.>
```

MADR (Decision Drivers / Considered Options) is not adopted. Nygard's `Context` plus `Alternatives Considered` cover the same ground with less ceremony.

Optional sections, in this order if used, after `Alternatives Considered`:

- **Migration guidance** — steps for existing code to comply.
- **Review checklist** — bullet list for PR reviewers.
- **Related references** — links to other ADRs, PRs, and external docs.

The H1 title matches the filename title. The status body is the status word (or `Superseded by ADR NNN`) on its own line.

### 2. Filename, location, and numbering

- **Location**: `docs/adr/` only. Not a repo-root `adr/` directory. Not a per-package `adr/` tree. System-wide decisions live here even when they apply to one app.
- **One file per ADR**: `docs/adr/NNN-topic-name.md`. Three-digit zero-padded prefix, lowercase slug, hyphens as separators, `.md` extension.
- **Slug is a noun phrase describing the subject, not the verdict**: `009-application-env-var-validation.md` is correct; `009-validate-env-at-boot.md` is not. Cross-references stay stable if the verdict later changes.
- **Numbering is monotonic from 001**. The following ADR is always `max(existing) + 1`. Do not leave gaps. If a rename or deletion would open a gap, close it in the same PR.
- **Index**: the `docs/adr/` directory listing is the index. Do not maintain a separate README or table of contents. It would drift.
- **Cross-references**: link by file path (`docs/adr/002-hexagonal-architecture.md`), not by number alone, so rename-safe tooling can follow the link.

### 3. Lifecycle

Four statuses. An ADR sits in exactly one at any time.

| Status                  | Meaning                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| `Proposed`              | Draft under review. Not yet binding. Discussion happens in the PR.                                             |
| `Accepted`              | Merged to `main`. Binding. Immutable except for typo and link fixes.                                           |
| `Deprecated`            | No longer relevant (for example the feature it governed was removed). Kept for history; no successor required. |
| `Superseded by ADR NNN` | Replaced by a newer ADR. The new ADR takes precedence; both files are kept.                                    |

This repository has no `dev` branch. Trunk is `main`.

**Init.** The twelve ADRs that land on the init commit are written `Accepted`. There is no Proposed window for those files.

**Later ADRs.**

- Open the file at `Proposed` in the PR that introduces it.
- Flip the status line to `Accepted` in the same PR before merge, so `main` never carries an ADR at `Proposed`.
- If the ADR supersedes a prior ADR (fully or partially), update that ADR's status line or section block-quote in the same PR.

**Immutability.** Once `Accepted`, the `Context` and `Decision` sections are immutable. Corrections to typos, broken links, and renamed files are allowed. Changing a rule requires a new ADR.

**Supersession.**

- Full: the new ADR replaces the old one. Update the old status to `Superseded by ADR NNN`.
- Partial: name the superseded section in the new ADR's `Context`. Prefix the old ADR's affected section with `> **Superseded by ADR NNN** — see that ADR for the current rule.`

### 4. When to write an ADR

Write an ADR when the decision meets at least one of:

- **Architecturally significant** — affects structure, non-functional requirements (security, performance, availability), cross-cutting dependencies, public interfaces, or the build and deploy pipeline.
- **Establishes a pattern** — the rule will be applied in multiple places and violations must be caught in review.
- **Has non-obvious trade-offs** — the "why" would be asked by every new contributor otherwise.
- **Supersedes or amends a prior decision** — explicit supersession requires an ADR so the chain is preserved.

Do not write an ADR for:

- Formatter or linter configuration. `oxlint` and `oxfmt` are the style sources. Do not treat ESLint or Prettier config as law.
- Turbo task graph and pnpm workspace wiring. Those stay toolchain locks outside this corpus.
- Pull-request size and decomposition conventions. Those stay process locks outside this corpus.
- Single-file implementation choices with no ripple effect.
- Transient decisions (feature-flag rollouts, one-off data backfills).

### 5. No companion rule files

Do not create a parallel rule file that restates an ADR for an editor or agent. OMP loads `AGENTS.md` and `docs/agents/`. Agents that need a decision read the ADR itself from `docs/adr/`.

A short pointer in `AGENTS.md` may name the corpus (`docs/adr/`). It must not become a second copy of any Decision.

### 6. Review

ADRs are proposed via PR like any other change. Review focuses on:

1. **Context is complete and value-neutral** — no hidden advocacy.
2. **Decision is actionable** — a reviewer can detect a violation from the text alone.
3. **Alternatives were considered seriously** — not strawmen.
4. **Consequences name the trade-offs** — including downsides of the chosen path.

## Consequences

Every new ADR looks like the last one. Reviewers spend time on substance, not structure.

`Accepted` ADRs stay historically faithful. A reader looking at an old PR sees the ADR text that was binding then, not a later rewrite.

Rule changes are traceable via `Superseded by ADR NNN`. Silent edits to accepted Decisions are a process violation.

The "when not to write" list is the relief valve. Most day-to-day choices do not need an ADR. Formatter, turbo, pnpm, and PR-size locks stay out of this corpus on purpose so the files here remain architectural.

Agents can rely on filename, status, and the five-section shape without heuristics. There is no companion-rule glob to keep in sync, so the ADR cannot drift from a summary that auto-loads instead of the source.

Friction for small decisions is real. Lean on §4. If a change is not architecturally significant, do not open an ADR.

## Alternatives Considered

**Adopt MADR 4.0.** Rejected. This corpus starts on Nygard. A rewrite carries no new information. MADR's Decision Drivers and Considered Options overlap with Nygard's Context and Alternatives Considered. Dual-template review would outlast any clarity gain.

**Allow editing Accepted ADRs freely.** Rejected. It breaks the decision log as history. A reader of a past PR needs the text that was binding at merge time, not a later revision of the same file.

**Document the process only in `AGENTS.md`.** Rejected. The ADR process is itself an architectural decision. It has the same "why would a future contributor need to know this?" property as every other ADR. Putting it only in agent notes would separate it from the corpus it governs.

**Repo-root `adr/` plus a generated index README.** Rejected. `docs/adr/` sits with the rest of engineering documentation. A hand-maintained index drifts. The directory listing is enough.

**Companion path-glob rule files that auto-load a summary.** Rejected. They duplicate the Decision, go stale, and fight OMP's `AGENTS.md` / `docs/agents/` loading model. Agents read the ADR file.

## Related references

- Michael Nygard, _Documenting Architecture Decisions_ (2011) — source of the five-section format.
- AWS Prescriptive Guidance, _Architecture Decision Records_ — source of the lifecycle rules.
- `adr.github.io` — ADR organization reference; maintains the MADR template this ADR rejects.
- `docs/agents/domain.md` — how agents discover `docs/adr/` before exploring code.
