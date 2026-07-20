---
description: Bump @aceshooting/lyra-ui to latest, sweep for Web Awesome/hand-rolled UI, migrate, and file gaps upstream
argument-hint: [path]
allowed-tools: Read, Edit, Grep, Glob, Bash(npm:*), Bash(git:*), Bash(curl:*), Bash(grep:*)
---

Bring the project at `$1` (default to the current working directory if `$1` is empty) onto the
latest published `@aceshooting/lyra-ui`, and move it as close as possible to **zero remaining Web
Awesome (`<wa-*>`) usage and zero hand-rolled UI that duplicates something lyra-ui already
provides**. Every `wa-*` tag is a removal candidate, not just an opportunistic swap. lyra-ui only
becomes a real replacement if gaps get reported, so this command also surfaces gaps it finds and,
with the user's explicit approval, files feature requests for them. Filing is never automatic.

## Steps

1. **Check version drift.** Read the target project's installed `@aceshooting/lyra-ui` version from
   its `package.json`/lockfile. Compare against the latest published version
   (`npm view @aceshooting/lyra-ui version`). If behind, bump the dependency and reinstall
   (`npm install`/`pnpm install`/`yarn install` — match whichever the project already uses).

2. **Read what changed.** After bumping, read `node_modules/@aceshooting/lyra-ui/CHANGELOG.md`
   between the old and new version. Note anything that: resolves a gap this project has previously
   worked around, or ships a component/prop that could replace a hand-rolled widget already in this
   project.

3. **Sweep for Web Awesome and hand-rolled UI.** Grep the whole project for `<wa-*>` tags and for
   hand-rolled widgets that duplicate something a UI component library would normally provide
   (custom pickers, custom charts, custom tables, custom dialogs, etc.). Every `<wa-*>` hit belongs
   on this list — the goal is full removal, not a partial pass.

4. **Verify against the real installed source, not memory or doc prose.** For each item on that
   list, check whether an existing (or newly-shipped) lyra-ui component now covers it. Verify
   against the *actual installed* contract in `node_modules/@aceshooting/lyra-ui/`:
   `llms/index.md` and `llms/components/<tag>.md`, `custom-elements.json`, the component's
   `.d.ts`, and its `dist`/`src` source
   when needed — not doc prose or what an older version used to do. A gap that has already shipped,
   or a design detail (a `data-*` hook, a `part=` attribute) that only shows up in the real source,
   is easy to miss from memory alone.

5. **Migrate what's adoptable.** Swap the component in, delete the replaced hand-rolled CSS/JS/
   dependency, and update the project's own migration-notes doc if it keeps one (e.g.
   `docs/lyra-ui-migration.md`).

6. **List genuine gaps, then ask before filing.** For anything that's still a real gap after step
   4's verification, list it — even a missing variant or a missing CSS part is worth listing.
   Under-listing is what quietly keeps a project on Web Awesome or hand-rolled code forever.

   **Filing is not automatic: list the gaps you found, and ask the user before submitting any of
   them.** Only POST the ones the user explicitly agrees to; anything they decline stays a
   listed-but-unfiled gap in your report, not a submission.

   Once the user has agreed, file each approved gap by POSTing it to
   `https://www.lyra-ui.com/api/v1/feature-requests` with `title`, `description`, `searched_for`
   (the terms you tried) and `settled_for` (what you used instead) — see the `lyra-ui` skill's
   "When no component fits, file it" section for the exact payload, the optional `name`/`email`
   fields, and the privacy rules. Read the `matches` in each response before reporting a gap to the
   user: it frequently names an existing component that already covers the need.

7. **Report back.** Summarize: what migrated in this project (grouped by component), what's still
   blocked on a Web Awesome or hand-rolled fallback and why, and — for each gap — whether it was
   filed (with the returned feature-request `id`) or listed but not filed because the user declined
   or hasn't yet responded, along with the lyra-ui version each item was verified against.
