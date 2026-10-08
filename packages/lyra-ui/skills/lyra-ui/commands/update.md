---
description: Bump @aceshooting/lyra-ui to latest and report what changed
argument-hint: [path]
allowed-tools: Read, Edit, Grep, Glob, Bash(npm:*), Bash(npx:*), Bash(git:*), Bash(curl:*), Bash(grep:*)
---

Bring the project at `$1` (default: the current working directory) onto the latest published
`@aceshooting/lyra-ui`.

1. **Check drift.** Read the installed version from `package.json` and the lockfile and compare it
   with `npm view @aceshooting/lyra-ui version`. Also check the companions the project uses
   (`@aceshooting/lyra-translations`, `@aceshooting/lyra-ide`, `@aceshooting/lyra-flags`,
   `@aceshooting/lyra-docs`): bump them to the same version as lyra-ui (translations and ide are
   versioned together with it).
2. **Read the notes before bumping.** Fetch `https://www.lyra-ui.com/changelog.json` and read every
   release between the installed version and `latest`; `kind: "major"` entries are breaking and
   required reading. npm is the authority on what is published and the feed only carries notes: if
   the feed's `latest` trails npm's, bump to npm's version, never conclude the project is current
   from the feed, and say in the report that the feed was behind (naming both versions). When the
   feed is stale or incomplete, read the target's `packages/lyra-ui/CHANGELOG.md` at the Git tag
   `lyra-ui@<version>`; the packaged changelog holds only its own major, so follow its archive link
   to `docs/changelog/v<major>.md` for every earlier major crossed.
3. **Bump and install** with the package manager the project already uses.
4. **Confirm and refresh.** Re-read `node_modules/@aceshooting/lyra-ui/CHANGELOG.md` (and archive
   links) against the pre-bump review. Where the project ran `npx lyra-ui init-agents`, run it again
   (symlinked skills already follow the new version; it refreshes the marked instruction block and
   any `--copy` install). When the changelog names a Lyra rename profile, run the installed release's
   `npx lyra-ui-migrate --origin=<lyra-v21|lyra-v22|lyra-v25> --check <path>` and review its warnings.
5. **Report** the versions bumped from and to, the breaking changes and deprecations that affect
   this project (check components it actually uses), and anything else notable.
