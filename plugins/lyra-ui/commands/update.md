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

   **npm is the authority on what is published; the feed only carries the notes.** The site is
   built and deployed from a separate repository, so its `latest` can sit behind npm's for as long
   as that deploy lags. You already hold both numbers — compare them. If they disagree the feed is
   stale, and three things follow: bump to npm's version, never the feed's; never conclude the
   project is already current because the feed says so; and say plainly in your report that the
   feed was behind, naming both versions.

   A stale feed is also missing the release notes the paragraph above just told you to read, so the
   pre-bump read has a fallback: `node_modules/@aceshooting/lyra-ui/CHANGELOG.md` ships inside the
   installed package and documents every published release, including ones absent from the feed
   entirely. When the feed is behind, read the notes there — before bumping from the currently
   installed copy, and again from the new one in step 2 — instead of treating the feed's silence as
   "nothing changed". Consumers have twice skipped a released bug fix by trusting a stale `latest`.

2. **Read what changed.** After bumping, read `node_modules/@aceshooting/lyra-ui/CHANGELOG.md`
   between the old and new version. Note anything that could affect this project: breaking changes,
   deprecations, or behavior changes to components the project already uses.

3. **Report back.** Summarize the version bumped from and to, the breaking changes (if any) the
   project needs to account for, and anything else notable from the changelog.
