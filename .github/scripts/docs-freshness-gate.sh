#!/usr/bin/env bash
set -euo pipefail

# Purpose: Docs-freshness merge gate (docs/documentation-factory.md §7 / ADR 012 §6). The script
#          reads the impacted-packs array that docs-freshness-detect.sh produced. An impacted
#          pack fails the check. The only clear is a changelog update (CHANGELOG.md or
#          changelog.d/*.md) in detect.sh. There is no label bypass. The failure text points
#          the author to the playbook and to ADR 012. Detect.sh owns the denylist and the
#          changelog clear. This script only decides pass or fail.
# Usage:   bash .github/scripts/docs-freshness-gate.sh
#          Env (required): IMPACTED_FILE       path to the JSON array written by detect
#                                              [{"pack_dir","readme","owner","matched":[...]}, ...]
#          Env (optional): GITHUB_STEP_SUMMARY path to the step summary (default: /dev/null)
# Callers: .github/workflows/ci-docs-freshness.yaml
# Owner:   MonsieurBarti
#
# Exit 0: empty impacted array.
# Exit 1: one or more impacted packs — one ::error:: naming every pack, its owner and the
#         changelog update that clears the gate. Also exit 1 on a missing/malformed
#         IMPACTED_FILE: a gate that cannot compute its verdict must fail closed, never
#         wave the PR through.

if [ -z "${IMPACTED_FILE:-}" ]; then
  echo "::error::docs-freshness gate: IMPACTED_FILE is not set - the gate cannot compute a verdict and fails closed"
  exit 1
fi
GITHUB_STEP_SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"

# Neutralize untrusted pack/owner text before it reaches a ::workflow-command::
# annotation or the markdown table of the step summary. The function strips the C0 controls
# (CR, LF, TAB and the others), it drops '%' so that %0A, %0D and %3A cannot expand inside an
# annotation, and it breaks the '::' delimiter. Same rules as docs-freshness-detect.sh
# (these scripts are standalone by design — the workflow runs each one directly, there is no
# shared lib to source).
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

# --- load impacted JSON -------------------------------------------------------
if [ ! -f "$IMPACTED_FILE" ]; then
  echo "::error::docs-freshness gate: impacted file '$(sanitize_log_text "$IMPACTED_FILE")' not found - the gate cannot compute a verdict and fails closed"
  exit 1
fi

if ! impacted_json=$(cat "$IMPACTED_FILE"); then
  echo "::error::docs-freshness gate: impacted file '$(sanitize_log_text "$IMPACTED_FILE")' is unreadable - the gate cannot compute a verdict and fails closed"
  exit 1
fi

if ! printf '%s' "$impacted_json" | jq -e 'type == "array"' >/dev/null 2>&1; then
  echo "::error::docs-freshness gate: impacted file '$(sanitize_log_text "$IMPACTED_FILE")' is not a JSON array - the gate cannot compute a verdict and fails closed"
  exit 1
fi

impacted_count=$(printf '%s' "$impacted_json" | jq 'length')

if [ "$impacted_count" -eq 0 ]; then
  echo "No doc pack owns code paths changed by this PR without a changelog update - docs-freshness gate passes."
  echo "Docs freshness: no impacted doc pack." >> "$GITHUB_STEP_SUMMARY"
  exit 0
fi

# --- blocked ------------------------------------------------------------------
pack_list=""
while IFS=$'\t' read -r pack_dir owner; do
  [ -n "$pack_dir" ] || continue
  pack_list+="${pack_list:+, }$(sanitize_log_text "$pack_dir") (owner $(sanitize_log_text "$owner"))"
done < <(printf '%s' "$impacted_json" | jq -r '.[] | [.pack_dir, .owner] | @tsv')

echo "::error::docs-freshness gate: ${pack_list} own code paths changed by this PR without a changelog update. A changelog update is mandatory - add a CHANGELOG.md or changelog.d/*.md change in the pack. See docs/documentation-factory.md and docs/adr/012-documentation-factory.md. There is no bypass label."

{
  echo "## Docs freshness gate — blocked"
  echo ""
  echo "Code paths changed without a changelog update."
  echo ""
  echo "| Pack | Owner | Matched files |"
  echo "| --- | --- | ---: |"
  while IFS=$'\t' read -r pack_dir owner matched_count; do
    [ -n "$pack_dir" ] || continue
    # shellcheck disable=SC2016 # backticks are markdown code spans, not command substitution
    printf '| `%s` | `%s` | %s |\n' \
      "$(sanitize_log_text "$pack_dir")" "$(sanitize_log_text "$owner")" "$matched_count"
  done < <(printf '%s' "$impacted_json" | jq -r '.[] | [.pack_dir, .owner, (.matched | length)] | @tsv')
  echo ""
  echo "- **A changelog update is mandatory.** Add a \`CHANGELOG.md\` or \`changelog.d/*.md\` change in the pack. That change clears this gate. See \`docs/documentation-factory.md\` and \`docs/adr/012-documentation-factory.md\`."
  echo "- There is no bypass label."
} >> "$GITHUB_STEP_SUMMARY"

exit 1
