#!/usr/bin/env node
// Codemod: rewrites `wa-*` (Web Awesome) / `sl-*` (Shoelace) custom-element tag usages and
// `@shoelace-style/shoelace` / `@awesome.me/webawesome` import specifiers to their documented
// `lyra-*` / `@aceshooting/lyra-ui` equivalents in a target directory (or glob) of source files.
//
// The rename table is NOT hand-duplicated here -- it is parsed at run time from this package's
// own README.md ("## Migrating from Web Awesome or Shoelace" section: the Shoelace table, and the
// `| Component | Mirrors | Notes |` tables in "## Components"), so it always matches whatever the
// README currently documents as mirrored. A `wa-*`/`sl-*` tag is only ever rewritten when the
// README's Mirrors column names it explicitly for that row; components marked `-- (extra)` (no
// Web Awesome equivalent) are never touched, and a row where the Component/Mirrors cell counts
// don't line up 1:1 by name (e.g. the typed `<lyra-*-chart>` subclasses, which all conceptually
// relate to `wa-chart` but have no individual `wa-*-chart` tag of their own) is left alone rather
// than guessed at.
//
// This is a deliberately simple, regex-based text rewriter -- not an AST/HTML parser -- per the
// scope of the tool. To avoid false positives on a `wa-`/`sl-` substring that is not actually a
// tag usage (prose in a comment, part of a longer identifier, an unrelated class name), a rewrite
// only fires on one of three anchored shapes:
//   - `<wa-name` / `<sl-name`     (tag open)
//   - `</wa-name` / `</sl-name`   (tag close)
//   - `'wa-name'` / `"wa-name"` / `` `wa-name` ``  (a quoted string whose ENTIRE content is the
//     tag name -- the element-registration-style usage, e.g. `customElements.get('wa-button')`
//     or a literal in a tag-name array/map)
// A quoted string is only rewritten when its exact content is a known key in the derived map, so
// an unrelated quoted string that happens to start with `wa-`/`sl-` (a CSS class value, a longer
// package name like `@shoelace-style/shoelace-icons`) is left untouched. This is a text-level
// heuristic, not full parsing: a quoted string that is coincidentally exactly a mapped tag name
// but is not actually being used as a tag/registration argument (e.g. `class="wa-tag"`, if
// `wa-tag` happens to be mapped) would still be rewritten -- a known, accepted limitation of a
// regex-only tool. Review a dry run's output before trusting it blindly on unfamiliar code.
//
// Usage (from packages/lyra-ui/):
//   node scripts/migrate-wa.mjs [--dry-run] [--ext=html,ts,tsx,...] <path-or-glob> [<path-or-glob> ...]
//   pnpm run migrate-wa -- [--dry-run] <path-or-glob> [...]
//
// Examples:
//   node scripts/migrate-wa.mjs --dry-run ../../my-app/src
//   node scripts/migrate-wa.mjs 'src/**/*.html' src/legacy-page.ts
//
// Import specifiers: a bare package import (`import '@shoelace-style/shoelace'`, `from
// "@awesome.me/webawesome"`, a dynamic `import(...)`, `require(...)`) is rewritten to
// `@aceshooting/lyra-ui`. A deep subpath import (e.g.
// `@shoelace-style/shoelace/dist/components/button/button.js`) is left unchanged and reported as
// a warning instead of guessed at -- lyra-ui's own subpath layout
// (`@aceshooting/lyra-ui/components/<family>/<file>.js`) does not mirror Shoelace's or Web
// Awesome's, so there is no safe mechanical rewrite for it; pick the matching
// `@aceshooting/lyra-ui/components/...` entry point by hand (see this package's README "Usage"
// section).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, '..');

const DEFAULT_EXTENSIONS = new Set(['html', 'htm', 'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'vue', 'svelte', 'mdx', 'md']);
const IGNORE_DIR_NAMES = new Set(['node_modules', 'dist', 'build', 'coverage', '.turbo', '.cache']);

// The actual published npm package names for Shoelace and Web Awesome. These aren't derivable
// from the README (which discusses migration in prose, not by import specifier), so they're
// listed explicitly here.
const PACKAGE_SPECIFIER_MAP = new Map([
  ['@shoelace-style/shoelace', '@aceshooting/lyra-ui'],
  ['@awesome.me/webawesome', '@aceshooting/lyra-ui'],
]);

/**
 * Extracts `wa-name`/`sl-name` -> `lyra-name` tag mappings from this package's README.md.
 *
 * Scans line by line, tracking which migration table (if any) is currently open:
 *   - "| Shoelace | Lyra | Migration note |" starts the Shoelace table.
 *   - "| Component | Mirrors | Notes |" starts a Web Awesome mirror table (this header recurs
 *     once per component-family subsection in "## Components").
 *   - Any line that doesn't start with `|` closes whichever table was open.
 * Every `|`-delimited line seen while a table is open is parsed as a row of that table's shape;
 * this includes the divider row (`|---|---|---|`) and the header row itself, both of which
 * naturally produce zero tag matches and are harmless no-ops.
 */
function buildMirrorMap(readmeText) {
  const map = new Map();
  const conflicts = [];
  let mode = null;

  for (const rawLine of readmeText.split('\n')) {
    const line = rawLine.trim();
    if (/^\|\s*Component\s*\|\s*Mirrors\s*\|\s*Notes\s*\|$/.test(line)) {
      mode = 'wa';
      continue;
    }
    if (/^\|\s*Shoelace\s*\|\s*Lyra\s*\|\s*Migration note\s*\|$/.test(line)) {
      mode = 'sl';
      continue;
    }
    if (!line.startsWith('|')) {
      mode = null;
      continue;
    }
    if (!mode) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;
    if (mode === 'wa') parseWaTableRow(cells[0], cells[1], map, conflicts);
    else parseSlTableRow(cells[0], cells[1], map, conflicts);
  }

  return { map, conflicts };
}

function setMapping(map, conflicts, from, to) {
  if (map.has(from) && map.get(from) !== to) {
    conflicts.push(`${from}: already mapped to ${map.get(from)}, also saw ${to}`);
    return;
  }
  map.set(from, to);
}

// A "Component" cell lists one or more `<lyra-x>` tags (companion tags joined with ` + `, or
// interchangeable typed variants joined with `, `) plus, occasionally, a non-tag entry like
// `toast()` or `confirm()` which the `<lyra-x>` extraction simply ignores. A "Mirrors" cell lists
// zero or more backticked `wa-x` tokens (or `-- (extra)` / similar prose, which yields zero
// tokens), optionally including a `wa-prefix-*` wildcard (see the format-* row).
//
// Matching is by NAME, not by position: a component tag `lyra-X` is mapped from `wa-X` only if
// `wa-X` literally appears in the Mirrors cell (or is covered by a `wa-prefix-*` wildcard whose
// prefix `X` starts with). This deliberately leaves a component unmapped when the README doesn't
// literally document a `wa-*` counterpart for it, rather than guessing from row position/order
// (which breaks down for rows like the typed chart-subclass family or `lyra-option`, where
// per-tag correspondence isn't 1:1 with the Mirrors cell).
function parseWaTableRow(componentCell, mirrorCell, map, conflicts) {
  const componentSuffixes = [...componentCell.matchAll(/<lyra-([a-z0-9-]+)>/g)].map((m) => m[1]);
  const mirrorTokens = [...mirrorCell.matchAll(/`(wa-[a-z0-9-]+\*?)`/g)].map((m) => m[1]);
  if (mirrorTokens.length === 0 || componentSuffixes.length === 0) return;

  for (const suffix of componentSuffixes) {
    const expected = `wa-${suffix}`;
    if (mirrorTokens.includes(expected)) {
      setMapping(map, conflicts, expected, `lyra-${suffix}`);
      continue;
    }
    const wildcardMatch = mirrorTokens.find((token) => token.endsWith('*') && expected.startsWith(token.slice(0, -1)));
    if (wildcardMatch) setMapping(map, conflicts, expected, `lyra-${suffix}`);
  }
}

// The Shoelace table uses `<sl-x>` / `<lyra-x>` on both sides; every row in it is a clean 1:1
// correspondence by suffix (verified against the current README), so this only maps a tag whose
// suffix is present on both sides of the row.
function parseSlTableRow(slCell, lyraCell, map, conflicts) {
  const slSuffixes = [...slCell.matchAll(/<sl-([a-z0-9-]+)>/g)].map((m) => m[1]);
  const lyraSuffixes = new Set([...lyraCell.matchAll(/<lyra-([a-z0-9-]+)>/g)].map((m) => m[1]));
  for (const suffix of slSuffixes) {
    if (lyraSuffixes.has(suffix)) setMapping(map, conflicts, `sl-${suffix}`, `lyra-${suffix}`);
  }
}

// Anchored tag-usage patterns: `<wa-x` / `</wa-x` (tag open/close), or a quoted string whose
// entire content is `wa-x` (registration-style usage). Same for `sl-x`. Deliberately does NOT
// match a bare `wa-x`/`sl-x` substring with no `<`, `</`, or exact-quote anchor -- that's the
// false-positive class (comments, prose, unrelated identifiers) this tool is asked to avoid.
const TOKEN_RE =
  /(?<bracket><\/?)(?<btag>wa|sl)-(?<bname>[a-z][a-z0-9-]*)|(?<quote>['"`])(?<qtag>wa|sl)-(?<qname>[a-z][a-z0-9-]*)\k<quote>/g;

// A quoted import/require specifier that is exactly one of the known source packages, or that
// package plus a `/`-led subpath. The alternation on the package name itself (rather than a
// generic `@scope/name` capture) guards against a same-prefixed-but-different package like
// `@shoelace-style/shoelace-icons` matching by accident.
const IMPORT_RE = /(['"`])(@shoelace-style\/shoelace|@awesome\.me\/webawesome)((?:\/[^'"`]*)?)\1/g;

function rewriteFile(original, tagMap) {
  const tagCounts = new Map(); // wa-x/sl-x -> { to, count }

  let content = original.replace(TOKEN_RE, (match, _b, _bt, _bn, _q, _qt, _qn, _offset, _str, groups) => {
    const isTag = groups.bracket !== undefined;
    const prefix = isTag ? groups.btag : groups.qtag;
    const name = isTag ? groups.bname : groups.qname;
    const key = `${prefix}-${name}`;
    const mapped = tagMap.get(key);
    if (!mapped) return match;
    const entry = tagCounts.get(key) ?? { to: mapped, count: 0 };
    entry.count += 1;
    tagCounts.set(key, entry);
    return isTag ? `${groups.bracket}${mapped}` : `${groups.quote}${mapped}${groups.quote}`;
  });

  const importChanges = [];
  const importWarnings = [];
  content = content.replace(IMPORT_RE, (match, quote, pkg, subpath) => {
    const target = PACKAGE_SPECIFIER_MAP.get(pkg);
    if (!target) return match;
    if (subpath) {
      importWarnings.push(`${pkg}${subpath}`);
      return match;
    }
    importChanges.push(`${pkg} -> ${target}`);
    return `${quote}${target}${quote}`;
  });

  return { content, tagCounts, importChanges, importWarnings };
}

function parseArgs(argv) {
  const opts = { dryRun: false, help: false, extensions: DEFAULT_EXTENSIONS, targets: [] };
  for (const arg of argv) {
    // A bare `--` is the conventional "end of flags" separator; `pnpm run migrate-wa -- <args>`
    // forwards it literally (unlike npm, which strips it), so ignore it rather than treating it
    // as a stray positional target.
    if (arg === '--') {
      continue;
    } else if (arg === '--dry-run' || arg === '-n') {
      opts.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg.startsWith('--ext=')) {
      opts.extensions = new Set(
        arg
          .slice('--ext='.length)
          .split(',')
          .map((e) => e.trim().replace(/^\./, '').toLowerCase())
          .filter(Boolean),
      );
    } else {
      opts.targets.push(arg);
    }
  }
  return opts;
}

function printUsage() {
  console.log(`Usage: node scripts/migrate-wa.mjs [--dry-run] [--ext=html,ts,tsx,...] <path-or-glob> [<path-or-glob> ...]

Rewrites wa-*/sl-* custom-element tag usages and Shoelace/Web Awesome import specifiers to their
lyra-ui equivalents, per this package's README migration tables.

  --dry-run       report what would change without writing any file
  --ext=a,b,c     extensions to scan when a target is a directory (default: ${[...DEFAULT_EXTENSIONS].join(',')})
  -h, --help      show this message

A target may be a file, a directory (scanned recursively), or a simple glob using *, ?, and **.`);
}

function walkDir(dir, filter) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_DIR_NAMES.has(entry.name)) continue;
      out.push(...walkDir(full, filter));
    } else if (entry.isFile() && filter(full, entry.name)) {
      out.push(full);
    }
  }
  return out;
}

// Minimal glob support: `*` and `?` within a path segment, `**` as a whole segment meaning "any
// number of path segments" (including zero). No brace/character-class expansion -- deliberately
// simple, matching this tool's overall "regex, not a real parser" scope.
function globToRegExp(patternSegments) {
  let re = '^';
  for (let i = 0; i < patternSegments.length; i++) {
    const seg = patternSegments[i];
    if (seg === '**') {
      re += '(?:.*/)?';
      continue;
    }
    re += seg.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]');
    if (i < patternSegments.length - 1) re += '/';
  }
  re += '$';
  return new RegExp(re);
}

function expandGlob(pattern) {
  const segments = pattern.split(path.sep).join('/').split('/');
  let splitIndex = 0;
  while (splitIndex < segments.length && !/[*?]/.test(segments[splitIndex])) splitIndex++;
  const baseSegments = segments.slice(0, splitIndex);
  const patternSegments = segments.slice(splitIndex);
  const base = path.resolve(baseSegments.length ? baseSegments.join('/') : '.');
  if (!fs.existsSync(base) || !fs.statSync(base).isDirectory()) return [];
  const regex = globToRegExp(patternSegments);
  return walkDir(base, () => true).filter((f) => regex.test(path.relative(base, f).split(path.sep).join('/')));
}

function collectFiles(targets, extensions) {
  const files = new Set();
  for (const target of targets) {
    if (/[*?]/.test(target)) {
      for (const f of expandGlob(target)) files.add(f);
      continue;
    }
    const resolved = path.resolve(target);
    if (!fs.existsSync(resolved)) {
      console.error(`warning: path not found, skipping: ${target}`);
      continue;
    }
    if (fs.statSync(resolved).isDirectory()) {
      for (const f of walkDir(resolved, (_full, name) => extensions.has(path.extname(name).slice(1).toLowerCase()))) {
        files.add(f);
      }
    } else {
      files.add(resolved);
    }
  }
  return [...files].sort();
}

function run(argv) {
  const opts = parseArgs(argv);
  if (opts.help || opts.targets.length === 0) {
    printUsage();
    return opts.help ? 0 : 1;
  }

  const readmePath = path.join(packageDir, 'README.md');
  if (!fs.existsSync(readmePath)) {
    console.error(`Could not find ${readmePath} to derive the migration table from.`);
    return 1;
  }
  const { map: tagMap, conflicts } = buildMirrorMap(fs.readFileSync(readmePath, 'utf8'));
  if (conflicts.length) {
    console.error(`Ambiguous README mirror-table entries (skipped):`);
    for (const c of conflicts) console.error(`  - ${c}`);
  }

  const files = collectFiles(opts.targets, opts.extensions);
  if (files.length === 0) {
    console.error('No files matched the given path(s)/pattern(s).');
    return 1;
  }

  let filesChanged = 0;
  let totalTagReplacements = 0;
  let totalImportRewrites = 0;
  let totalWarnings = 0;

  for (const file of files) {
    const original = fs.readFileSync(file, 'utf8');
    const { content, tagCounts, importChanges, importWarnings } = rewriteFile(original, tagMap);
    const changed = content !== original;
    if (!changed && importWarnings.length === 0) continue;

    const rel = path.relative(process.cwd(), file) || file;
    console.log(`${rel}${opts.dryRun ? '  [dry-run]' : ''}`);
    for (const [from, entry] of tagCounts) {
      console.log(`  <${from}> -> <${entry.to}>  (${entry.count}x)`);
      totalTagReplacements += entry.count;
    }
    for (const c of importChanges) {
      console.log(`  import: ${c}`);
      totalImportRewrites += 1;
    }
    for (const w of importWarnings) {
      console.log(`  warning: left unchanged, no direct lyra-ui subpath equivalent: '${w}' -- migrate manually`);
      totalWarnings += 1;
    }

    if (changed) {
      filesChanged += 1;
      if (!opts.dryRun) fs.writeFileSync(file, content, 'utf8');
    }
  }

  console.log('');
  console.log(
    `${files.length} file(s) scanned, ${filesChanged} changed, ${totalTagReplacements} tag rename(s), ` +
      `${totalImportRewrites} import rewrite(s)${totalWarnings ? `, ${totalWarnings} warning(s)` : ''}.`,
  );
  if (opts.dryRun && filesChanged > 0) {
    console.log('Dry run only -- no files were written. Re-run without --dry-run to apply.');
  }
  return 0;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  process.exitCode = run(process.argv.slice(2));
}

export { buildMirrorMap, rewriteFile, collectFiles, parseArgs, run };
