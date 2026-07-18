---
description: Migrate an application from @aceshooting/lyra-ui 3.x to 4.0.0
---

# Migrate Lyra UI 3.x to 4.0.0

Lyra UI 4.0.0 keeps the npm packages and JavaScript class names stable, but renames the public
namespace used by custom elements, library-specific events, and CSS custom properties.

## Breaking changes

| 3.x | 4.0.0 |
| --- | --- |
| `<lyra-button>` | `<lr-button>` |
| `lyra-change` | `lr-change` |
| `--lyra-color-brand` | `--lr-color-brand` |
| `@aceshooting/lyra-ui` | `@aceshooting/lyra-ui` |
| `LyraButton` | `LyraButton` |

`lyra-ui` and `lyra-flags` remain the package names. Do not rename package imports, repository
paths, `Lyra*` classes, or internal `lyra-element` filenames. The old custom-element tags, events,
and tokens are not aliases in 4.0.0.

## Automated migration

Run this from the application repository after updating the dependency:

```bash
pnpm add @aceshooting/lyra-ui@^4.0.0
rg -l --glob '!node_modules/**' --glob '!dist/**' \
  --glob '*.{html,css,scss,less,ts,tsx,js,jsx,md,mdx}' \
  'lyra-' . | xargs -r perl -0pi -e 's/lyra-/lr-/g'
rg -l --glob '!node_modules/**' --glob '!dist/**' '--lyra-' . \
  | xargs -r perl -0pi -e 's/--lyra-/--lr-/g'
```

Review the diff and restore intentional non-component names such as package imports and paths if
the command touched them. The safer targeted form for an application that only needs markup,
events, and CSS is:

```bash
find src public docs -type f \( -name '*.html' -o -name '*.css' -o -name '*.scss' -o -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \) \
  -print0 | xargs -0r perl -0pi -e 's/<\/?lyra-([a-z0-9-]+)/<$1/g; s/lyra-([a-z0-9-]+)/lr-$1/g; s/--lyra-/--lr-/g'
```

The first command is preferred for normal source trees because it preserves the `lyra-` package
and path names in imports when those are excluded from the replacement review. Never run a blind
repository-wide replacement over lockfiles or dependency directories.

## Checklist

- Update every custom-element opening and closing tag to `lr-*`.
- Update every library-specific event listener, event assertion, and event-map reference to `lr-*`.
- Update `--lyra-*`, `--lyra-theme-*`, and component-specific custom-property overrides to `--lr-*`.
- Keep `@aceshooting/lyra-ui`, `@aceshooting/lyra-flags`, `Lyra*` class imports, and package paths.
- Regenerate generated editor metadata if the application vendors it.
- Run `pnpm build`, `pnpm test`, and the application’s accessibility tests.
- Check RTL layouts, localized strings, shadow-DOM accessible names, and 320px/narrow-pane layouts.
- Search for stale public names:

  ```bash
  rg -n --glob '!node_modules/**' --glob '!dist/**' '<\/?lyra-[a-z]|--lyra-|\blyra-(show|hide|change|select|copy|search|error|request|open|close)\b' .
  ```

## New in 4.0.0

The release also includes `lr-control-group`, the completed `lr-segmented` size scale, and the
updated generated API/editor documentation. Use `lr-control-group` for responsive rows of mixed
form controls and actions; use `lr-button-group` for uniform button groups.
