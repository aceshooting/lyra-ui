#!/usr/bin/env bash
# PreToolUse hook (Bash matcher): blocks `git reset` and `git stash` in any form.
#
# Why: this repo is routinely worked on by multiple concurrent Claude Code sessions sharing one
# checkout with no worktree isolation. A `git reset --hard` from one session has already destroyed
# another session's uncommitted work mid-task (see docs/superpowers memory,
# lyra-ui-graph-dimming-markdown-core-2026-07-18). `git stash` is safer in principle (recoverable via
# `git stash pop`/`git stash list`) but still yanks uncommitted changes out from under a sibling
# session without warning, so it is blocked too, per explicit instruction.
#
# Deliberately does NOT block `git restore --staged <path>` (safe, scoped unstaging) or any other git
# subcommand -- only `reset`/`stash` as the actual git subcommand, not as a substring elsewhere in the
# command line (e.g. a commit message mentioning "reset", or a file named reset.ts).

set -euo pipefail

cmd=$(jq -r '.tool_input.command // empty')

pattern='(^|[;&|]|\bthen\b)[[:space:]]*\bgit\b([[:space:]]+-C[[:space:]]+[^[:space:]]+|[[:space:]]+-c[[:space:]]+[^[:space:]]+|[[:space:]]+--[^[:space:]]+|[[:space:]]+-[^[:space:]]+)*[[:space:]]+\b(reset|stash)\b'

if printf '%s' "$cmd" | grep -qE "$pattern"; then
  jq -n \
    --arg reason "git reset and git stash are blocked by project policy in this repo -- it is shared by concurrent Claude Code sessions with no worktree isolation, and a prior git reset --hard already destroyed another session's uncommitted work mid-task. Ask the user before running either command; use git restore --staged <path> to unstage safely instead." \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $reason}}'
fi
