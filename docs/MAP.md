# Documentation hub

This file is the single documentation hub. Humans and agents use this same hub. There is no second agent-only hub.

The hub is navigation. It lists the MAP file of every onboarded flow and of every onboarded bounded context.

## Onboarded flows and bounded contexts

None.

No flow and no bounded context is onboarded yet. This repository ships the factory empty on purpose.

A row appears here only after a pack is onboarded. An area that has no pack yet gets no row. There are no stub rows and there is no placeholder table.

## How to use this hub

1. Pick a MAP file in the list above.
2. Open the pack `README.md` that the MAP names.
3. Drill into `features/` for a deep topic, or for a topic that you can skip.

A MAP answers "where do I go". A README answers "what does this pack own". A feature sheet answers one narrow question.

## Rules and law

- Playbook: [`./documentation-factory.md`](./documentation-factory.md) — paths, required headings, frontmatter, onboard checklist, freshness.
- Law: [`./adr/012-documentation-factory.md`](./adr/012-documentation-factory.md) — why the factory ships empty, and what it must never become.

Read the playbook before you create a pack. The ADR wins when the playbook disagrees with it.

## What this hub is not

This hub is not a glossary. A glossary holds ubiquitous language only. Glossary files are `CONTEXT.md` beside code, and a root `CONTEXT-MAP.md` when one exists. Neither file is present on init, because this repository has no product language yet.

This hub is not an ADR index. Hard decisions live in `docs/adr/`.

This hub is not a curated topic-to-pack shortcut list. It lists onboarded MAP files, and nothing else.
