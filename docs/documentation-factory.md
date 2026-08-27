# Documentation factory playbook

This file is the executor runbook for the documentation factory.

`docs/adr/012-documentation-factory.md` is the law. When this playbook and that ADR disagree, the ADR wins. Fix the playbook.

Humans are the first audience. Agents read the same artefacts.

## 1. Purpose

The factory holds living narrative. Narrative answers two questions. How does this journey work? What does this module own?

An ADR does not answer those questions. An ADR records one hard decision. A glossary does not answer them either. A glossary defines terms.

The factory ships empty. `docs/MAP.md` is the single hub. No pack exists yet. The freshness gate stays green until an author onboards the first pack.

## 2. Three systems

| System                                                        | Role                                                 | Must not become                       |
| ------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------- |
| Glossaries (`CONTEXT.md`, root `CONTEXT-MAP.md` when present) | Ubiquitous language only                             | A navigation hub or a pack narrative  |
| ADRs (`docs/adr/`)                                            | Hard decisions that are hard to reverse              | A living pack runbook                 |
| Factory packs                                                 | Navigable living narrative for flows and hex modules | A glossary dump or an ADR replacement |

A pack links out to a glossary and to an ADR. A pack never absorbs them.

No `CONTEXT.md` and no `CONTEXT-MAP.md` exist on init. The first bounded context can add a local glossary beside its code. That glossary never lives under a pack `docs/` tree.

## 3. Artefact model

| Profile      | Use                                        | Pack home                                              | Navigation MAP                                |
| ------------ | ------------------------------------------ | ------------------------------------------------------ | --------------------------------------------- |
| `flow`       | Transverse journeys                        | `docs/contexts/<flow>/README.md`                       | `docs/contexts/<flow>/MAP.md`                 |
| `hex-module` | Hexagonal modules inside a bounded context | `apps/api/src/contexts/<bc>/docs/<doc-slug>/README.md` | `apps/api/src/contexts/<bc>/docs/MAP.md` only |

Rules per artefact:

- **MAP** is navigation only. It holds the spine, the module index, and the boundaries. It holds no long narrative.
- **README** is the pack home. It holds the purpose, the indexes, the pack-wide invariants, and the ownership pointer.
- **`features/<slug>.md`** holds one deep topic, or one topic that a reader can skip.
- **`CHANGELOG.md`** and **`changelog.d/`** belong to every pack. On onboard, an author edits `CHANGELOG.md` directly. Fragment compile is a later ticket.

## 4. Paths and naming

Hex module pack:

```text
apps/api/src/contexts/<bc>/docs/<doc-slug>/
  README.md
  features/
  CHANGELOG.md
  changelog.d/
```

Bounded-context router: `apps/api/src/contexts/<bc>/docs/MAP.md` only.

Flow pack:

```text
docs/contexts/<flow>/{MAP.md, README.md, features/, CHANGELOG.md, changelog.d/}
```

Naming and registration rules:

- The root hub `docs/MAP.md` lists onboarded flow MAP files and onboarded bounded-context MAP files only.
- A module pack registers on the bounded-context MAP only. It never registers on the root hub.
- A MAP file carries no `code_paths`.
- `doc_slug` is required in the frontmatter when the pack name is not the code directory name. Omit `doc_slug` when the two names are equal.
- Slugs are lower case. Words in a slug use a hyphen.
- Health, kernel, and Hive get no pack. Health stays `apps/api/src/presentation/health/`. Kernel stays `apps/api/src/shared`. Hive is communication law in `docs/adr/003-bc-hive-communication.md`.
- Hex layout is `docs/adr/002-hexagonal-architecture.md`. A pack does not restate that architecture.

## 5. Required sections

A pack without its required headings is not onboarded. Bodies can stay thin during write-up. The heading text is stable. Do not rename a heading.

Flow `README.md`:

| Heading                     | Content rule                                                  |
| --------------------------- | ------------------------------------------------------------- |
| `Purpose`                   | What the journey delivers, and for whom.                      |
| `Actors`                    | The humans and the systems that act in the journey.           |
| `How to read this pack`     | The path from this README to the MAP and to `features/`.      |
| `Spine`                     | A link to `MAP.md`. Do not duplicate the phase table here.    |
| `Code map`                  | Entry points in code, with repo-root paths.                   |
| `Feature index`             | One row per `features/<slug>.md`.                             |
| `Related glossaries / ADRs` | Outward links only.                                           |
| `Ownership`                 | The `owner` value, and who answers a question about the pack. |

Flow `MAP.md`:

| Heading                  | Content rule                                              |
| ------------------------ | --------------------------------------------------------- |
| `Canonical spine phases` | The happy path, in order. One row per phase.              |
| `Branch index`           | Alternate and failure paths that leave the spine.         |
| `Alternate views`        | Other useful entry orders, such as per actor or per team. |

Hex-module `README.md`:

| Heading                             | Content rule                                                                            |
| ----------------------------------- | --------------------------------------------------------------------------------------- |
| `Purpose`                           | What the module owns, and what it refuses to own.                                       |
| `Ubiquitous language`               | The module terms, or a link to the local glossary `CONTEXT.md`. Do not copy a glossary. |
| `Public edge and isolation honesty` | The real entry points. Name each leak, and do not hide one.                             |
| `Domain core`                       | Aggregates, entities, and value objects.                                                |
| `Command / query catalog`           | One row per command and per query, with the handler path.                               |
| `Pipeline and projection`           | Write path, read model, and each projection.                                            |
| `Collaborators`                     | The modules and the external systems that this module calls.                            |
| `Ops / observability`               | Signals, alerts, and runbook pointers.                                                  |
| `Feature index`                     | One row per `features/<slug>.md`.                                                       |
| `Related ADRs`                      | Outward links only.                                                                     |
| `Ownership`                         | The `owner` value, and who answers a question about the pack.                           |

Bounded-context `MAP.md`:

| Heading                     | Content rule                                               |
| --------------------------- | ---------------------------------------------------------- |
| `BC purpose`                | What the bounded context owns.                             |
| `Module index`              | One row per onboarded module pack. Onboarded targets only. |
| `BC boundaries / non-goals` | What sits outside this bounded context.                    |
| `Related glossaries / ADRs` | Outward links only.                                        |

`CHANGELOG.md`:

| Heading              | Content rule                                                   |
| -------------------- | -------------------------------------------------------------- |
| `Tombstones`         | Removed behaviour, and where the reader goes instead.          |
| `Recent corrections` | A statement that was wrong, and the correct statement.         |
| `Decisions`          | A pack-level decision, with a link to the ADR when one exists. |

Rows are newest first in every section. An author edits `CHANGELOG.md` directly on onboard.

A fragment is optional today. When an author uses one, the path is `changelog.d/<yyyy-mm-dd>-<ticket-or-pr>-<short-slug>.md`. The fragment frontmatter holds `section:`.

| `section:` value | Target `CHANGELOG.md` heading | Cells per row |
| ---------------- | ----------------------------- | ------------- |
| `tombstones`     | `Tombstones`                  | 4             |
| `corrections`    | `Recent corrections`          | 4             |
| `decisions`      | `Decisions`                   | 3             |

The first cell of every row is the When date, in `yyyy-mm-dd` form.

Feature sheet `features/<slug>.md`:

The frontmatter holds one key, `status`. The value is `canonical` or `draft`. No other key and no other value are valid.

| Heading         | Content rule                                                   |
| --------------- | -------------------------------------------------------------- |
| Title (`H1`)    | The topic, in the pack vocabulary.                             |
| `Summary`       | The answer in a few sentences.                                 |
| `Detail`        | The full explanation.                                          |
| `Code anchors`  | Repo-root paths that a reader opens to verify the sheet.       |
| `Last-verified` | The date of the last check against code, in `yyyy-mm-dd` form. |

## 6. Frontmatter

Every pack home carries frontmatter:

```yaml
---
profile: hex-module # or flow
doc_slug: example-slug # required when the pack name is not the code directory name; omit when the two are equal
owner: monsieurbarti/<team>
code_paths:
  - apps/api/src/contexts/<bc>/<module>/**
---
```

- `profile` is `hex-module` or `flow`.
- `owner` is required at onboard. The format is `monsieurbarti/<team>`, with no `@`.
- `code_paths` is a required key. The value is a list of globs from the repository root.
- `code_paths` can be `[]` for a flow until an inventory exists. An empty list never fires the gate.
- There is no inference of `code_paths` from `doc_slug` or from folder adjacency. State the globs.
- A MAP file has no `code_paths`.

## 7. Freshness

The gate couples paths to changelog rows. `docs/adr/012-documentation-factory.md` §6 is the law for this section.

- Impact is a touch under `code_paths`, minus the runner denylist, while that pack changelog stays untouched.
- The runner denylist holds tests (`*.test.*`, `*.spec.*`), snapshots (`__snapshots__`), and generated files (`*.generated.*`).
- Only `<pack>/CHANGELOG.md` or `<pack>/changelog.d/*.md` clears an impact. A feature sheet, a README, a MAP, and `changelog.d/.gitkeep` do not clear it.
- There is no label. There is no sticky comment. There is no bypass.
- The required check context is the job name alone: `Docs freshness gate`.
- With zero packs, the detector emits `[]` and the job stays green. The vehicle ships idle on init.
- The detector script is `.github/scripts/docs-freshness-detect.sh`. The gate script is `.github/scripts/docs-freshness-gate.sh`. The workflow is `.github/workflows/ci-docs-freshness.yaml`.
- Membership in this soft-CI gate follows from a non-empty `code_paths`. There is no second registry file.
- Automation checks path coupling only. A human still checks that the narrative matches the code.

## 8. Onboard checklist

A pack is onboarded when every item holds:

1. **Tree.** The directories and the files exist on the locked path for the profile. See §4.
2. **Frontmatter.** `profile`, `owner`, and `code_paths` are present. `doc_slug` is present when the pack name is not the code directory name. See §6.
3. **Headings.** Every required heading exists. Bodies can stay thin. See §5.
4. **Registration.** A flow or a bounded context appears on the root hub `docs/MAP.md`. A module appears on the bounded-context MAP only.

Two extra steps keep the tree stable:

- Persist an empty `features/` directory and an empty `changelog.d/` directory with a `.gitkeep` file.
- Do not add a repository ownership-routing file. ADR 012 §7 holds that open while team slugs stay fog.

After a hex pack exists, a code-local README under `apps/api/src/contexts/**` becomes a thin pointer into the pack or into the bounded-context MAP.

## 9. Non-goals

- A fake pack, so that the gate has work to do.
- A transverse article tree under `docs/` that replaces packs.
- A business glossary on init.
- A pack for health, for kernel, or for Hive.
- A bot that compiles changelog fragments.
- A CI check that proves the narrative matches the code.
- A repository ownership-routing file while team slugs stay fog.

## Appendix A. Skeletons

Copy a block, then replace each placeholder.

Flow pack home:

```yaml
---
profile: flow
owner: monsieurbarti/<team>
code_paths: []
---
```

```text
# <Flow name>

## Purpose
## Actors
## How to read this pack
## Spine
## Code map
## Feature index
## Related glossaries / ADRs
## Ownership
```

Flow MAP:

```text
# <Flow name> — MAP

## Canonical spine phases
## Branch index
## Alternate views
```

Hex-module pack home:

```yaml
---
profile: hex-module
doc_slug: <doc-slug>
owner: monsieurbarti/<team>
code_paths:
  - apps/api/src/contexts/<bc>/<module>/**
---
```

```text
# <Module name>

## Purpose
## Ubiquitous language
## Public edge and isolation honesty
## Domain core
## Command / query catalog
## Pipeline and projection
## Collaborators
## Ops / observability
## Feature index
## Related ADRs
## Ownership
```

Bounded-context MAP:

```text
# <Bounded context> — MAP

## BC purpose
## Module index
## BC boundaries / non-goals
## Related glossaries / ADRs
```

Pack changelog:

```text
# Changelog — <pack name>

## Tombstones
## Recent corrections
## Decisions
```

Feature sheet:

```yaml
---
status: draft # or canonical
---
```

```text
# <Topic>

## Summary
## Detail
## Code anchors
## Last-verified
```
