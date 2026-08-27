#!/usr/bin/env bash
set -euo pipefail

# Purpose: Apply the main GitHub ruleset from committed JSON. Then set squash-only merge.
# Inputs:  env GH_TOKEN (required in GitHub Actions), GITHUB_REPOSITORY (optional).
# Outputs: stdout log of create or update result.
# Owner:   MonsieurBarti

if [[ "${GITHUB_ACTIONS:-}" == "true" && -z "${GH_TOKEN:-}" ]]; then
  echo "::error::APPLY_GITHUB_PROTECTION_PAT is missing"
  exit 1
fi

if git_root="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  repo_root="${git_root}"
else
  repo_root="${PWD}"
fi

ruleset_file="${repo_root}/.github/rulesets/main.json"

if [[ ! -f "${ruleset_file}" ]]; then
  echo "::error::File not found: ${ruleset_file}"
  exit 1
fi

repo="${GITHUB_REPOSITORY:-MonsieurBarti/backend-mono}"

login="$(gh api user --jq .login)" || {
  echo "::error::Failed to read GitHub login"
  exit 1
}

if [[ "${login}" != "MonsieurBarti" ]]; then
  echo "::error::Apply GitHub protection requires GitHub login MonsieurBarti. Got: ${login}"
  exit 1
fi

ruleset_name="$(jq -r '.name' "${ruleset_file}")"

if [[ -z "${ruleset_name}" || "${ruleset_name}" == "null" ]]; then
  echo "::error::Could not extract .name from ${ruleset_file}"
  exit 1
fi

echo "Syncing ruleset: ${ruleset_name}"

list_response="$(gh api "repos/${repo}/rulesets" --paginate 2>&1)" || {
  echo "::error::Failed to list rulesets: ${list_response}"
  exit 1
}

existing_id="$(echo "${list_response}" | jq -r --arg name "${ruleset_name}" '.[] | select(.name == $name) | .id')"

if [[ -n "${existing_id}" && $(echo "${existing_id}" | wc -l) -gt 1 ]]; then
  echo "::error::Multiple rulesets found with name '${ruleset_name}'"
  exit 1
fi

if [[ -n "${existing_id}" ]]; then
  echo "Found existing ruleset id=${existing_id}. Updating with PUT."
  gh api "repos/${repo}/rulesets/${existing_id}" \
    --method PUT \
    --input "${ruleset_file}" \
    --silent
  echo "Ruleset '${ruleset_name}' updated (id=${existing_id})"
else
  echo "No existing ruleset with name '${ruleset_name}'. Creating with POST."
  new_id="$(
    gh api "repos/${repo}/rulesets" \
      --method POST \
      --input "${ruleset_file}" \
      --jq '.id'
  )"
  echo "Ruleset '${ruleset_name}' created (id=${new_id})"
fi

echo "Setting squash-only merge"
gh api --method PATCH "repos/${repo}" \
  -F allow_squash_merge=true \
  -F allow_merge_commit=false \
  --silent
