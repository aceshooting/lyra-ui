#!/usr/bin/env bash
# Packages plugins/lyra-ui/skills/lyra-ui/ into ./skills/lyra-ui.skill, after regenerating its
# references/ from packages/lyra-ui/llms*.txt (the published component API docs). See
# The references are generated copies so the archive remains self-contained.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="${ROOT_DIR}/plugins/lyra-ui/skills/lyra-ui"
REFERENCES_DIR="${SKILL_DIR}/references"
OUTPUT_DIR="${ROOT_DIR}/skills"
OUTPUT_PATH="${OUTPUT_DIR}/lyra-ui.skill"
SKILL_MD="${SKILL_DIR}/SKILL.md"

echo "Validating ${SKILL_MD} frontmatter..."
if [[ ! -f "${SKILL_MD}" ]]; then
  echo "Error: ${SKILL_MD} not found." >&2
  exit 1
fi
if ! grep -q "^name:" "${SKILL_MD}"; then
  echo "Error: ${SKILL_MD} is missing a 'name:' frontmatter field." >&2
  exit 1
fi
if ! grep -q "^description:" "${SKILL_MD}"; then
  echo "Error: ${SKILL_MD} is missing a 'description:' frontmatter field." >&2
  exit 1
fi

echo "Regenerating references/ from packages/lyra-ui/llms*.txt..."
mkdir -p "${REFERENCES_DIR}"
cp "${ROOT_DIR}/packages/lyra-ui/llms.txt" "${REFERENCES_DIR}/llms.txt"
cp "${ROOT_DIR}/packages/lyra-ui/llms-full.txt" "${REFERENCES_DIR}/llms-full.txt"

echo "Packaging ${OUTPUT_PATH}..."
mkdir -p "${OUTPUT_DIR}"
rm -f "${OUTPUT_PATH}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT
cp -r "${SKILL_DIR}" "${TMP_DIR}/lyra-ui"
find "${TMP_DIR}" -name '.DS_Store' -delete
# ZIP stores per-entry timestamps and follows filesystem traversal order. Normalize both so
# packaging unchanged inputs does not rewrite the tracked archive with metadata-only changes.
find "${TMP_DIR}/lyra-ui" -exec touch -t 198001010000.00 {} +
(
  cd "${TMP_DIR}/lyra-ui"
  find . -mindepth 1 -print | LC_ALL=C sort | zip -X -q "${OUTPUT_PATH}" -@
)

if [[ -s "${OUTPUT_PATH}" ]]; then
  echo "Created ${OUTPUT_PATH} ($(du -h "${OUTPUT_PATH}" | cut -f1))"
else
  echo "Error: failed to create ${OUTPUT_PATH}" >&2
  exit 1
fi
