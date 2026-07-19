---
description: Bump @aceshooting/lyra-ui to latest, sweep for Web Awesome/hand-rolled UI, migrate, and file gaps upstream
argument-hint: [path]
allowed-tools: Read, Edit, Grep, Glob, Bash(npm:*), Bash(git:*), Bash(gh:*), Bash(grep:*)
---

Bring the project at `$1` (default to the current working directory if `$1` is empty) onto the
latest published `@aceshooting/lyra-ui`, and move it as close as possible to **zero remaining Web
Awesome (`<wa-*>`) usage and zero hand-rolled UI that duplicates something lyra-ui already
provides**. Every `wa-*` tag is a removal candidate, not just an opportunistic swap. lyra-ui only
becomes a real replacement if gaps get reported, so this command also files feature requests for
anything it finds that isn't covered yet.

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

6. **File genuine gaps liberally.** For anything that's still a real gap after step 4's
   verification, file it upstream — report liberally, even a missing variant or a missing CSS part
   is worth reporting. Under-reporting is what quietly keeps a project on Web Awesome or hand-rolled
   code forever.

   First check whether the lyra-ui source repo is available locally: try
   `git -C /mnt/a805817a-3f74-4a91-a611-b695b20df84e/git/solarserver/lyra-ui rev-parse --git-dir`
   (this maintainer's known local path).

   - **If the lyra-ui source repo is present locally** at that path: write one feature-request file
     per audit batch to
     `docs/superpowers/feature_requests/<today's date>-<project-name>-<short-slug>.md` in that
     repo (never append to an existing file). Use this structure, one `##` section per gap:

     ```markdown
     # lyra-ui gap — <project name>, verified against <lyra-ui version>

     **Consuming project:** <one-line project description>.

     <one paragraph of audit-batch context: what triggered this sweep, what version range was
     checked, anything already known to be filed elsewhere>

     ## 1. `<lr-component-or-native-tag>`: <short description>

     **Motivating consumer code:** <file path> — <what it does, in enough detail that someone
     without this project checked out understands the use case>.

     **Current limitation:** <verified against the real installed source — cite the exact file and
     what it does/doesn't support — not against doc prose or assumption>.

     **Proposed API:** <a concrete shape: new attribute/slot/event/part, or a new component>.

     **Acceptance check:** <what would have to be true for this consumer to actually adopt it>.
     ```

     (Repeat the `## N.` block per distinct gap found in this audit batch.) Filing this document
     does not itself change any lyra-ui source — implementation is a separate, later task run from
     the lyra-ui repo (its `features` skill).

   - **Otherwise** (the general case — an external consumer with no local lyra-ui checkout): open a
     GitHub issue per gap on `aceshooting/lyra-ui` using the same four-section structure above as
     the issue body, via:
     `gh issue create --repo aceshooting/lyra-ui --title "<short title>" --body "<the four-section body>"`.
     If `gh` isn't authenticated (`gh auth status` fails), print the fully-composed issue body
     instead and tell the user to file it by hand at
     https://github.com/aceshooting/lyra-ui/issues/new.

7. **Report back.** Summarize: what migrated in this project (grouped by component), what's still
   blocked on a Web Awesome or hand-rolled fallback and why, and what was filed upstream (with the
   filed file paths or issue URLs), along with the lyra-ui version each filed item was verified
   against.
