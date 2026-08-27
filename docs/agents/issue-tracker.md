# Issue tracker: Linear

Issues for this repo live in Linear. Use the Linear MCP server (`barti-mono-linear`, `https://mcp.linear.app/mcp`) for all operations.

**Workspace:** set this (Linear workspace slug). Auth is a workspace API key in `.env` as `LINEAR_API_KEY` (see `.env.example`). Do not use `barti-linear`; that OAuth session is a different workspace.

## Hierarchy

Work is structured like Linear's native graph. Do not flatten it.

1. **Initiative** — multi-project outcome.
2. **Project** — belongs to an initiative.
3. **Milestone** — belongs to a project.
4. **Issue** — belongs to a project; optional milestone.
5. **Sub-issue** — an issue with `parentId` set to the parent issue.

## Conventions

- **Create an issue**: `save_issue` with `team`, `title`, `description`. Set `project`, `milestone`, and `parentId` when the parent exists.
- **Read an issue**: `get_issue` with the issue ID (e.g. `TEAM-123`).
- **List issues**: `list_issues` with filters (`team`, `project`, `parentId`, `state`, `label`).
- **Comment**: `save_comment` with `issueId` and `body`.
- **Change status**: `save_issue` with `id` and `state`.
- **Apply labels**: `save_issue` with `id` and labels.
- **Create initiative / project / milestone**: `save_initiative`, `save_project`, `save_milestone`.

## URL format

`https://linear.app/<workspace>/issue/<TEAM_PREFIX>-<NUMBER>`

## Statuses (typical workflow)

Triage → Backlog → Todo → In Progress → In Review → Done

Also: Canceled, Duplicate.

## When a skill says "publish to the issue tracker"

Create a Linear issue via `save_issue`. Place it under the right project and parent. Do not create a root issue when a parent is known.

## When a skill says "fetch the relevant ticket"

Call `get_issue` with the ticket ID.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a Linear issue; **tickets** are child issues.

- **Map**: `save_issue` with `team`, `title`, `description` (Destination / Notes / Decisions so far / Not yet specified / Out of scope), labels `["wayfinder:map"]`.
- **Child ticket**: same tool with `parentId` set to the map identifier and one type label: `wayfinder:research` | `wayfinder:grilling` | `wayfinder:prototype` | `wayfinder:task`.
- **Blocking**: native Linear relations — `blockedBy: ["TEAM-142", …]` and/or `blocks: […]` (append-only). Frontier = open children with no open blockers and no assignee.
- **Claim**: `save_issue` with `id`, `assignee: "me"`, `state: "In Progress"` — do this **before** work.
- **Resolve**: `save_comment` with the answer; then `save_issue` with `state: "Done"`; append one gist line to the map's **Decisions so far**.
