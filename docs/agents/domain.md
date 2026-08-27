# Domain docs

How an engineering skill consumes the domain documentation of this repository.

Three systems stay distinct. Read the right one for the question you hold.

| System                                                        | Answers                            | Location                                                        |
| ------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------- |
| Glossaries (`CONTEXT.md`, root `CONTEXT-MAP.md` when present) | What does this term mean?          | Beside the code of a bounded context, or at the repository root |
| ADRs (`docs/adr/`)                                            | Why is it built this way?          | `docs/adr/`                                                     |
| Factory packs                                                 | How does this flow or module work? | Reached from the hub `docs/MAP.md`                              |

A glossary is language only. It is not a navigation hub and it is not a narrative. A pack links out to a glossary and to an ADR. A pack never absorbs them. `docs/documentation-factory.md` holds the pack rules.

## Before you explore, read these

- **Living narrative**: `docs/MAP.md`. This is the factory hub. It lists the MAP file of every onboarded flow and bounded context. No flow and no bounded context is onboarded yet, so the list is empty on init.
- **ADRs**: `docs/adr/`. Read each ADR that touches the area you are about to change.
- **Glossaries**: `CONTEXT.md` beside the code of a bounded context, or `CONTEXT-MAP.md` at the repository root when one exists. These files hold language only.

Neither glossary file is present on init. **Proceed silently.** Do not flag the absence. Do not propose to create a glossary upfront. The `/domain-modeling` skill creates one lazily, when a real term or a real decision gets resolved.

## File structure

This sketch shows the shape after the first bounded context arrives. It is not the shape on disk today.

```
/
├── docs/MAP.md
├── docs/adr/
├── docs/documentation-factory.md
└── apps/api/src/contexts/<bc>/CONTEXT.md   ← when authored, never under pack docs/
```

A pack for a hexagonal module lives at `apps/api/src/contexts/<bc>/docs/<doc-slug>/`, and its router is `apps/api/src/contexts/<bc>/docs/MAP.md`. A glossary never lives inside that pack tree.

## Use the vocabulary of the glossary

When your output names a domain concept, use the term as the glossary defines it. This applies to an issue title, a refactor proposal, a hypothesis, and a test name. Do not drift to a synonym that the glossary avoids.

When the concept is absent from the glossary, treat that as a signal. Either you invent language that the project does not use, and you reconsider, or the gap is real, and you note it for `/domain-modeling`.

When no glossary exists yet, use the vocabulary of the code and of the ADRs.

## Flag ADR conflicts

When your output contradicts an ADR, state the conflict. Do not override the ADR in silence.

> _Contradicts ADR 002 (hexagonal architecture), and here is why it is worth a reopen…_

## What this file is not

This file teaches the split between a glossary, an ADR, and a pack. It is not a curated topic-to-pack shortcut list. It never lists a pack that is not onboarded.
