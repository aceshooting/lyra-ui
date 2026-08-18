---
description: Bump @aceshooting/lyra-ui to latest and report what changed
argument-hint: [path]
allowed-tools: Read, Edit, Grep, Glob, Bash(npm:*), Bash(git:*), Bash(curl:*), Bash(grep:*)
---

Bring the project at `$1` (default to the current working directory if `$1` is empty) onto the
latest published `@aceshooting/lyra-ui`.

## Steps

1. **Check version drift.** Read the target project's installed `@aceshooting/lyra-ui` version from
   its `package.json`/lockfile. Compare against the latest published version
   (`npm view @aceshooting/lyra-ui version`). If behind, bump the dependency and reinstall
   (`npm install`/`pnpm install`/`yarn install` — match whichever the project already uses).

   Before bumping, fetch `https://www.lyra-ui.com/changelog.json` and read every release between
   the project's installed version and `latest`. Treat `kind: "major"` entries as required reading —
   they are the breaking changes.

2. **Read what changed.** After bumping, read `node_modules/@aceshooting/lyra-ui/CHANGELOG.md`
   between the old and new version. Note anything that could affect this project: breaking changes,
   deprecations, or behavior changes to components the project already uses.

3. **Report back.** Summarize the version bumped from and to, the breaking changes (if any) the
   project needs to account for, and anything else notable from the changelog.
