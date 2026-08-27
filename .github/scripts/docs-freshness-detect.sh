#!/usr/bin/env bash
set -euo pipefail

# Purpose: Docs-freshness soft signal impact detection (docs/documentation-factory.md §7 / ADR 012 §6).
#          The script discovers onboarded doc-pack homes from tracked README frontmatter
#          (`profile:` + `code_paths:`). It asks git which files under the code_paths of each pack
#          changed in the pull-request range, minus the runner-owned denylist. It emits the impacted
#          packs when code moved and the pack changelog stayed untouched.
# Usage:   bash .github/scripts/docs-freshness-detect.sh
#            Env (required): GITHUB_OUTPUT       path to the GitHub Actions output file
#                            BASE_REF            diff LHS — pull-request base ref/sha (merge-base)
#                            HEAD_SHA            diff RHS — pull-request head sha
#            Env (optional): REPO_ROOT           git repository root to inspect (default: .)
#                            BASE_WORKTREE       extra tree to scan for pack READMEs (the base
#                                                checkout). Head wins on path collisions.
#                            GITHUB_STEP_SUMMARY path to the step summary (default: /dev/null)
#          Outputs (GITHUB_OUTPUT): impacted<<EOF <compact JSON array> EOF
#            Each element: {"pack_dir","readme","owner","matched":[...]} (repo-relative paths).
#            The array is empty ([]) when nothing fires, and also when the repository has no packs.
# Callers: .github/workflows/ci-docs-freshness.yaml
# Owner:   MonsieurBarti
#
# Soft signal: every signal outcome exits 0. This includes no packs, an unparsable pack, and a
# pack glob that git rejects. Only a missing required environment variable aborts non-zero.
#
# Denylist (runner-owned per ADR 012 — not per-pack, and not in the ADR):
#   A changed file is denylisted (the matcher ignores it) when:
#     - the basename matches *.test.* OR *.spec.* OR *.generated.*
#     - OR the path contains a __snapshots__ path segment
#   The test is on the basename or on one path segment. It carries no `/`-semantics hazard.
#   The script checks changelog touches before the denylist, because clearing always wins.
#
# Matching: one `git diff` per pack. Each code_paths entry becomes a `:(glob)` pathspec.
#   The `:(glob)` magic of git is gitignore-style wildmatch: `*` stops at `/`, and `**` spans
#   directories. Multi-directory pack globs (`apps/api/src/contexts/*/**` versus
#   `apps/api/src/**`) are therefore exact instead of a superset. `--no-renames` is REQUIRED on
#   every diff. With rename detection git reports only the rename destination. That hides a file
#   which moved OUT of the code_paths of a pack. It also hides a changelog which moved out of the
#   pack, and such a move must still clear. There is no `--diff-filter`, because deletions also
#   have a documentation impact.
#
# Clearing: only a changelog change silences a pack. The change is on `$pack_dir/CHANGELOG.md` or
#   on a `$pack_dir/changelog.d/*.md` fragment (add, edit, delete or move-out). Every other pack
#   file leaves the pack impacted. This includes feature sheets, README.md, MAP.md and
#   `changelog.d/.gitkeep`. The dated changelog entry is the evidence that an author revisited the
#   narrative. A prose tweak is not that evidence.

: "${GITHUB_OUTPUT:?GITHUB_OUTPUT must be set}"
: "${BASE_REF:?BASE_REF must be set}"
: "${HEAD_SHA:?HEAD_SHA must be set}"
REPO_ROOT="${REPO_ROOT:-.}"
BASE_WORKTREE="${BASE_WORKTREE:-}"
GITHUB_STEP_SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

# Neutralize untrusted path and reason text before it reaches a ::workflow-command::
# annotation or the markdown table of the step summary. The function strips the C0 controls
# (CR, LF, TAB and the others), it drops '%' so that %0A, %0D and %3A cannot expand inside an
# annotation, and it breaks the '::' delimiter. The matcher still uses the raw path from
# git ls-files.
sanitize_log_text() {
  local s="$1"
  s="${s//$'\n'/}"
  s="${s//$'\r'/}"
  s="${s//$'\t'/}"
  # The remaining C0 controls and DEL go through tr. Bash ${//} has no portable control-char class.
  s="$(printf '%s' "$s" | tr -d '\000-\010\013\014\016-\037\177')"
  s="${s//%/}"
  s="${s//::/: :}"
  printf '%s' "$s"
}

# The function is true when the basename matches a denylist glob, or when the path has a
# __snapshots__ segment.
is_denylisted() {
  local f="$1"
  local base
  base="$(basename "$f")"
  # Path segment test: /__snapshots__/, or the exact segment at either end.
  if [[ "/${f}/" == *"/__snapshots__/"* ]]; then
    return 0
  fi
  case "$base" in
    *.test.* | *.spec.* | *.generated.*) return 0 ;;
  esac
  return 1
}

# Extract the YAML frontmatter body. The body is between the opening --- on line 1 and the
# closing ---. The function prints nothing when the file does not start with ---.
extract_frontmatter() {
  local file="$1"
  awk '
    NR == 1 && /^---[[:space:]]*$/ { in_fm = 1; next }
    in_fm && /^---[[:space:]]*$/ { exit }
    in_fm { print }
  ' "$file"
}

# Parse the scalar `owner:` value from the frontmatter. The function drops a trailing YAML
# comment. The comment starts at the value start or after whitespace, so a # inside the value
# survives. The function then trims, and it strips a matching pair of surrounding quotes. The
# result is empty when the key is absent. A comment-only value reads as absent.
parse_owner() {
  local fm="$1"
  printf '%s\n' "$fm" | awk '
    BEGIN { SQ = sprintf("%c", 39) }
    /^owner:[[:space:]]*/ {
      sub(/^owner:[[:space:]]*/, "")
      sub(/(^|[[:space:]])#.*$/, "")
      sub(/^[[:space:]]+/, "")
      sub(/[[:space:]]+$/, "")
      if (length($0) >= 2) {
        q = substr($0, 1, 1)
        if ((q == "\"" || q == SQ) && substr($0, length($0), 1) == q) {
          $0 = substr($0, 2, length($0) - 2)
        }
      }
      print
      exit
    }
  '
}

# Parse the code_paths list from the frontmatter. The function sets these globals:
#   PARSE_CODE_PATHS_STATUS = missing | empty | ok | malformed
#   PARSE_CODE_PATHS_GLOBS  = array of globs (when the status is ok)
# The function recognises two list forms:
#   block  — `code_paths:` and then `  - <glob>` items
#   inline — `code_paths: [a/**, "b/**", 'c/**']` (`[]` is the explicit "never fires" form)
# Every other value shape is `malformed`, and never `empty`. An unparsed value must produce a
# loud warning instead of a permanently silent pack.
parse_code_paths() {
  local fm="$1"
  PARSE_CODE_PATHS_GLOBS=()
  local result
  result="$(printf '%s\n' "$fm" | awk '
    # Drop a trailing YAML comment, but only when whitespace precedes the #, so that a #
    # inside a glob survives. Then trim and unquote.
    function clean(s) {
      sub(/[[:space:]]+#.*$/, "", s)
      sub(/^[[:space:]]+/, "", s)
      sub(/[[:space:]]+$/, "", s)
      if (length(s) >= 2) {
        q = substr(s, 1, 1)
        if ((q == "\"" || q == SQ) && substr(s, length(s), 1) == q) {
          s = substr(s, 2, length(s) - 2)
        }
      }
      return s
    }
    # A code_paths entry which git cannot honour. Gitignore-style :(glob) has no brace
    # expansion, and a leftover quote means that the YAML value was unbalanced. Both shapes
    # make the pathspec match nothing. Both list forms therefore report malformed instead of
    # leaving a permanently silent pack.
    function unusable(e) {
      return index(e, "{") || index(e, "}") || index(e, "\"") || index(e, SQ)
    }
    BEGIN { SQ = sprintf("%c", 39); found = 0; in_list = 0; count = 0; emitted = 0 }
    # `code_paths:` with nothing after it except an optional comment is a block list header.
    !found && /^code_paths:[[:space:]]*(#.*)?$/ {
      found = 1
      in_list = 1
      next
    }
    !found && /^code_paths:[[:space:]]/ {
      found = 1
      val = $0
      sub(/^code_paths:/, "", val)
      val = clean(val)
      emitted = 1
      if (val !~ /^\[.*\]$/) { print "__MALFORMED__"; exit }
      inner = substr(val, 2, length(val) - 2)
      sub(/^[[:space:]]+/, "", inner)
      sub(/[[:space:]]+$/, "", inner)
      if (length(inner) == 0) { print "__EMPTY__"; exit }
      # Quote-aware split: a comma inside '…' or "…" does not separate two entries.
      # An unbalanced quote is malformed, and never a silently dead pack.
      n = 0
      cur = ""
      q = ""
      for (i = 1; i <= length(inner); i++) {
        c = substr(inner, i, 1)
        if (q != "") {
          cur = cur c
          if (c == q) q = ""
          continue
        }
        if (c == "\"" || c == SQ) { q = c; cur = cur c; continue }
        if (c == ",") {
          n++
          parts[n] = cur
          cur = ""
          continue
        }
        cur = cur c
      }
      if (q != "") { print "__MALFORMED__"; exit }
      n++
      parts[n] = cur
      for (i = 1; i <= n; i++) {
        entry = clean(parts[i])
        if (length(entry) == 0) continue
        if (unusable(entry)) { print "__MALFORMED__"; exit }
        print entry
        count++
      }
      if (count == 0) print "__MALFORMED__"
      exit
    }
    # Block list body.
    in_list && /^[[:space:]]*-/ {
      line = $0
      sub(/^[[:space:]]*-/, "", line)
      line = clean(line)
      if (length(line) > 0) {
        if (unusable(line)) { print "__MALFORMED__"; exit }
        print line
        count++
      }
      next
    }
    # A blank line or a comment-only line does not end the block list.
    in_list && /^[[:space:]]*(#.*)?$/ { next }
    # The next top-level key ends the block list.
    in_list && /^[A-Za-z_][A-Za-z0-9_-]*:/ { in_list = 0; next }
    # Anything else inside the block list is an unrecognised shape.
    in_list { emitted = 1; print "__MALFORMED__"; exit }
    END {
      if (!found) print "__MISSING__"
      # A block list header with no items is a broken pack, and not an intentional [].
      else if (!emitted && count == 0) print "__MALFORMED__"
    }
  ')"

  case "$result" in
    __MISSING__)
      PARSE_CODE_PATHS_STATUS="missing"
      return 0
      ;;
    __EMPTY__)
      PARSE_CODE_PATHS_STATUS="empty"
      return 0
      ;;
  esac
  if [[ "$result" == *"__MALFORMED__"* ]]; then
    PARSE_CODE_PATHS_STATUS="malformed"
    return 0
  fi

  local line
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    PARSE_CODE_PATHS_GLOBS+=("$line")
  done <<< "$result"
  if ((${#PARSE_CODE_PATHS_GLOBS[@]} == 0)); then
    PARSE_CODE_PATHS_STATUS="malformed"
  else
    PARSE_CODE_PATHS_STATUS="ok"
  fi
}

# -----------------------------------------------------------------------------
# Discover the pack homes (registry-free, tracked files only)
# -----------------------------------------------------------------------------
# The scan reads tracked READMEs only. Untracked build output and node_modules therefore cannot
# masquerade as a pack. A candidate is a pack home only when it opens with --- frontmatter which
# contains a `profile:` key. The scan ignores everything else silently, so a document which only
# describes pack frontmatter stays quiet.

pack_readmes=()

collect_pack_readmes() {
  local root="$1"
  local line fm already existing
  while IFS= read -r line || [[ -n "${line:-}" ]]; do
    [[ -z "$line" ]] && continue
    [[ -f "$root/$line" ]] || continue
    fm="$(extract_frontmatter "$root/$line")"
    [[ -n "$fm" ]] || continue
    printf '%s\n' "$fm" | grep -q '^profile:' || continue
    already=0
    for existing in "${pack_readmes[@]+"${pack_readmes[@]}"}"; do
      if [[ "$existing" == "$line" ]]; then
        already=1
        break
      fi
    done
    [[ "$already" -eq 1 ]] && continue
    pack_readmes+=("$line")
  done < <(git -C "$root" ls-files -- '*README.md' 'README.md' 2>/dev/null | sort || true)
}

collect_pack_readmes "$REPO_ROOT"
if [[ -n "$BASE_WORKTREE" && "$BASE_WORKTREE" != "$REPO_ROOT" ]]; then
  collect_pack_readmes "$BASE_WORKTREE"
fi

# -----------------------------------------------------------------------------
# Evaluate each pack
# -----------------------------------------------------------------------------

rows_file="$(mktemp)"
skipped_file="$(mktemp)"
trap 'rm -f "$rows_file" "$skipped_file"' EXIT

# Announce a skipped pack one time, on both channels: the annotation stream and the step summary.
# Every non-silent skip goes through this function, so the run can never drop a pack without a
# signal.
warn_skip() {
  local readme reason
  readme="$(sanitize_log_text "$1")"
  reason="$(sanitize_log_text "$2")"
  echo "::warning::docs-freshness: ${readme} — ${reason}; pack skipped"
  printf '%s\t%s\n' "$readme" "$reason" >> "$skipped_file"
}

for rel_readme in "${pack_readmes[@]+"${pack_readmes[@]}"}"; do
  pack_dir="$(dirname "$rel_readme")"

  if [[ -f "$REPO_ROOT/$rel_readme" ]]; then
    fm="$(extract_frontmatter "$REPO_ROOT/$rel_readme")"
  elif [[ -n "$BASE_WORKTREE" && -f "$BASE_WORKTREE/$rel_readme" ]]; then
    fm="$(extract_frontmatter "$BASE_WORKTREE/$rel_readme")"
  else
    continue
  fi
  owner="$(parse_owner "$fm")"
  parse_code_paths "$fm"

  if [[ "$PARSE_CODE_PATHS_STATUS" == "missing" ]]; then
    warn_skip "$rel_readme" "frontmatter missing code_paths key"
    continue
  fi
  if [[ "$PARSE_CODE_PATHS_STATUS" == "malformed" ]]; then
    warn_skip "$rel_readme" "unsupported code_paths form"
    continue
  fi
  if [[ -z "$owner" ]]; then
    warn_skip "$rel_readme" "frontmatter missing owner"
    continue
  fi
  # An explicit `code_paths: []` never fires. The skip is silent, per the contract.
  if [[ "$PARSE_CODE_PATHS_STATUS" == "empty" ]]; then
    continue
  fi

  # Clearing wins, so the script checks it first: a changelog change silences the pack.
  # `changelog.d/*.md` goes through :(glob), so it matches fragments only. `.gitkeep` and a
  # nested path do not clear. `--no-renames` keeps the clear when a changelog moves OUT of the
  # pack directory.
  if ! changelog_touched="$(git -C "$REPO_ROOT" diff --no-renames --name-only "$BASE_REF" "$HEAD_SHA" -- "$pack_dir/CHANGELOG.md" ":(glob)$pack_dir/changelog.d/*.md" 2>/dev/null)"; then
    warn_skip "$rel_readme" "changelog diff failed for ${BASE_REF}..${HEAD_SHA}"
    continue
  fi
  if [[ -n "$changelog_touched" ]]; then
    continue
  fi

  pathspecs=()
  for glob in "${PARSE_CODE_PATHS_GLOBS[@]}"; do
    pathspecs+=(":(glob)$glob")
  done
  if ! changed="$(git -C "$REPO_ROOT" diff --no-renames --name-only "$BASE_REF" "$HEAD_SHA" -- "${pathspecs[@]}" 2>/dev/null)"; then
    warn_skip "$rel_readme" "code_paths pathspec rejected by git"
    continue
  fi

  matched=()
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    if is_denylisted "$f"; then continue; fi
    matched+=("$f")
  done <<< "$changed"

  if ((${#matched[@]} == 0)); then
    continue
  fi

  # The job never goes red here. Git permits arbitrary bytes in a tracked path, and jq rejects
  # input which it cannot decode. A failed encode skips the pack loudly instead of an abort.
  if ! matched_json="$(printf '%s\n' "${matched[@]}" | jq -R . | jq -s -c .)"; then
    warn_skip "$rel_readme" "matched file list could not be JSON-encoded"
    continue
  fi
  if ! jq -n -c \
    --arg pd "$pack_dir" \
    --arg r "$rel_readme" \
    --arg o "$owner" \
    --argjson m "$matched_json" \
    '{pack_dir:$pd, readme:$r, owner:$o, matched:$m}' >> "$rows_file"; then
    warn_skip "$rel_readme" "impacted row could not be JSON-encoded"
    continue
  fi
done

impacted='[]'
if [[ -s "$rows_file" ]]; then
  # The job never goes red here. The script falls back to the empty signal instead of an abort
  # when jq cannot assemble the rows.
  if ! impacted="$(jq -s -c . "$rows_file")"; then
    echo "::warning::docs-freshness: impacted rows could not be assembled; emitting empty signal"
    impacted='[]'
  fi
fi

{
  echo "impacted<<EOF"
  printf '%s\n' "$impacted"
  echo "EOF"
} >> "$GITHUB_OUTPUT"

# Human summary
if ! impacted_count="$(jq 'length' <<< "$impacted")"; then
  impacted_count=0
fi
{
  if [[ "$impacted_count" -gt 0 ]]; then
    echo "## Docs freshness"
    echo ""
    echo "Code paths changed without a changelog update."
    echo ""
    echo "| Pack | Owner | Matched files |"
    echo "| --- | --- | ---: |"
    jq -r '.[] | "| `\(.pack_dir)` | `\(.owner)` | \(.matched | length) |"' <<< "$impacted"
  else
    echo "No docs-freshness impact."
  fi
  if [[ -s "$skipped_file" ]]; then
    echo ""
    echo "### Skipped packs"
    echo ""
    echo "| Pack README | Reason |"
    echo "| --- | --- |"
    while IFS=$'\t' read -r rdme reason; do
      # shellcheck disable=SC2016 # the backticks are markdown code spans, not command substitution
      printf '| `%s` | %s |\n' "$rdme" "$reason"
    done < "$skipped_file"
  fi
} >> "$GITHUB_STEP_SUMMARY"

exit 0
