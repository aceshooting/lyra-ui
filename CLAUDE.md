# CLAUDE.md

**This file is intentionally a pointer, not a copy.** The contributor contract for agents working on
this repository lives in one authoritative place:

@AGENTS.md

Claude Code resolves that `@`-import and loads `AGENTS.md` into context, so Claude Code, Codex, and
every other agent read byte-identical guidance.

## Why

`CLAUDE.md` and `AGENTS.md` were previously two near-duplicate copies of the same ~360-line
contract. They drifted, and the drift was invisible because each file looked complete on its own. By
2026-08-13 they disagreed on 83 lines — `CLAUDE.md` still described `src/lyra.ts` as carrying
side-effect imports (it has none; `all.ts` owns registration since 8.0.0), still called
`plugins/lyra-ui/` a Claude-only plugin (it ships Codex manifests and `.agents/` discovery links
too), and pinned the wrong `packageManager`. Neither file was wholly right, which is the failure
mode a single source of truth removes.

Add or change guidance in `AGENTS.md`. Do not restore prose here — content in this file is invisible
to every non-Claude agent, which is precisely how the drift started.
