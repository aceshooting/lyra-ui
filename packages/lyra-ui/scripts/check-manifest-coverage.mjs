#!/usr/bin/env node
// Reports every component-scoped `--lr-<component>-*` custom property a component's own stylesheet
// reads, every consumer hook a shared stylesheet it composes reads on its behalf, and every
// `part="…"` its template renders, that `custom-elements.json` does not declare.
// The manifest is generated from JSDoc, so an undeclared token or part is invisible to
// `vscode-css-data.json`, `web-types.json`, every manifest-driven editor integration, and to
// `check-llms-freshness.mjs` — which is how 60 custom properties and 15 parts came to be documented
// nowhere at all. `scripts/llms-gap-report.mjs` compensates by scanning stylesheets directly; this
// check exists so the manifest itself stops being the weak link.
// Run: `node scripts/check-manifest-coverage.mjs [--list]`
//   --list  print the worklist and exit 0 (authoring aid); default exits 1 on any finding.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expandManifestInheritance } from './manifest-compact.mjs';

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifest = expandManifestInheritance(
  JSON.parse(readFileSync(path.join(packageDir, 'custom-elements.json'), 'utf8')),
);
const listOnly = process.argv.includes('--list');

/** Tokens/parts a component legitimately reads but does not own. */
const isSharedToken = (token) =>
  /^--lr-(color|space|radius|shadow|font|transition|opacity|focus-ring|size|layer|line-height|border-width|safe-area|no-data)/.test(
    token,
  );

/**
 * The library-wide theme override layer (`--lr-theme-*`). Read as a `var()` fallback by the token
 * registry itself, never owned by a component, and documented once in `llms/tokens.md`.
 */
const isThemeOverride = (token) => token.startsWith('--lr-theme-');

/**
 * Relative `*.styles.js` imports of a stylesheet, resolved back to their `.ts` sources.
 *
 * A component's stylesheet composes shared sheets from `src/internal/` by interpolating them into
 * its own `css` template (`${formControlRequiredMarker}`), so the consumer-settable hooks those
 * sheets read are part of *this* component's public theming surface even though its own file never
 * names them. Scanning only the component's own text is how `--lr-form-control-required-content`
 * came to be advertised on three components and hidden on eighteen others that honour it
 * identically.
 */
const resolveSheetGraph = (entry, seen = new Set()) => {
  if (seen.has(entry) || !existsSync(entry)) return seen;
  seen.add(entry);
  const text = readFileSync(entry, 'utf8');
  for (const m of text.matchAll(/from\s+['"](\.[^'"]*\.styles\.js)['"]/g)) {
    resolveSheetGraph(path.resolve(path.dirname(entry), m[1]).replace(/\.js$/, '.ts'), seen);
  }
  return seen;
};

/**
 * Custom properties an imported shared sheet exposes to the components that compose it: every
 * `var(--lr-…)` it reads that it does not also declare itself.
 *
 * The "reads but never declares" shape is exactly what makes a property a consumer hook — a sheet
 * that declares `--lr-form-control-height-m` before reading it is resolving its own plumbing, while
 * `--lr-form-control-required-content` is read through an inline fallback precisely so a consumer
 * can set it. Shared tokens and the `--lr-theme-*` override layer are excluded as everywhere else.
 *
 * Comments are stripped first: these sheets carry long rationale blocks that quote token names and
 * whole `var()` expressions in prose (`internal/tokens.styles.ts`'s REQUIRED_MARKER note), and a
 * quoted name is not a read.
 */
const sharedSheetHooks = (source) => {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const declared = new Set([...text.matchAll(/(--lr-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const hooks = new Set();
  for (const m of text.matchAll(/var\(\s*(--lr-[a-z0-9-]+)/g)) {
    const token = m[1];
    if (isSharedToken(token) || isThemeOverride(token) || declared.has(token)) continue;
    hooks.add(token);
  }
  return hooks;
};

const findings = [];

for (const mod of manifest.modules ?? []) {
  const match = mod.path.match(/^src\/components\/([^/]+)\/([^/]+)\//);
  if (!match) continue;
  for (const decl of mod.declarations ?? []) {
    if (!decl.customElement || !decl.tagName) continue;
    const dir = path.join(packageDir, path.dirname(mod.path));
    if (!existsSync(dir)) continue;

    const declaredProps = new Set((decl.cssProperties ?? []).map((p) => p.name));
    const declaredParts = new Set((decl.cssParts ?? []).map((p) => p.name));

    // Own-namespace tokens only: `--lr-table-*` belongs to `lr-table`, `--lr-color-brand` does not.
    // Scope the scan to the declaration's *own* stylesheet where one exists. Two components sharing
    // a directory share a token namespace prefix — `--lr-timeline-item-*` starts with
    // `--lr-timeline-`, and `--lr-tree-depth` with `--lr-tree-` — so a directory-wide scan makes the
    // parent absorb its sibling's tokens and demands a declaration that would advertise a dead
    // override (a matching rule on the child's own `:host` beats inheritance from the parent).
    // Components with no stylesheet of their own (a subclass reusing its base's) fall back to the
    // directory, where the prefix filter alone is unambiguous.
    const ownPrefix = `--${decl.tagName}-`;
    const ownStylesheet = path.basename(mod.path).replace(/\.class\.ts$|\.ts$/, '.styles.ts');
    const stylesheets = existsSync(path.join(dir, ownStylesheet))
      ? [ownStylesheet]
      : readdirSync(dir).filter((file) => /\.styles\.ts$/.test(file));
    const usedProps = new Set();
    const entrySheets = stylesheets.map((file) => path.join(dir, file));
    for (const file of entrySheets) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/var\(\s*(--lr-[a-z0-9-]+)/g)) {
        if (m[1].startsWith(ownPrefix) && !isSharedToken(m[1])) usedProps.add(m[1]);
      }
    }

    // Shared sheets composed into those entry sheets contribute their own consumer hooks — see
    // `resolveSheetGraph`/`sharedSheetHooks`. The own-namespace prefix cannot apply here: a shared
    // hook is shared precisely because it is not named after any one component.
    // Only sheets from *outside* the component's directory count. A same-directory import is a
    // component's own stylesheet under another name (`histogram.styles.ts` is one line re-exporting
    // `chart.styles.ts`), still governed by the own-namespace prefix above; treating it as shared
    // would demand a declaration for every unprefixed token a sibling happens to read.
    const composed = new Set();
    for (const file of entrySheets) for (const sheet of resolveSheetGraph(file)) composed.add(sheet);
    for (const sheet of composed) {
      if (path.dirname(sheet) === dir) continue;
      for (const token of sharedSheetHooks(readFileSync(sheet, 'utf8'))) usedProps.add(token);
    }

    // Parts rendered from a static `part="…"` attribute in the class module. Dynamic/computed part
    // names are out of scope here (check-manifest.mjs already covers the exportparts contract).
    // Two sources of false positives have to be excluded, both of which name *another* component's
    // parts rather than declaring one of this component's own:
    //   - JSDoc/line comments describing a collaborator's contract in prose;
    //   - CSS attribute selectors, `[part="x"]`, used to query into a child's shadow root.
    // A rendered part is `part="x"`; a selector is `[part="x"]`, so the preceding `[` discriminates.
    const usedParts = new Set();
    const classFile = path.join(packageDir, mod.path);
    if (existsSync(classFile)) {
      const text = readFileSync(classFile, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
      for (const m of text.matchAll(/(\[?)part="([a-z0-9 -]+)"/g)) {
        if (m[1] === '[') continue;
        for (const name of m[2].split(/\s+/)) if (name) usedParts.add(name);
      }
    }

    const missingProps = [...usedProps].filter((p) => !declaredProps.has(p)).sort();
    const missingParts = [...usedParts].filter((p) => !declaredParts.has(p)).sort();
    if (missingProps.length || missingParts.length) {
      findings.push({ tag: decl.tagName, module: mod.path, missingProps, missingParts });
    }
  }
}

if (findings.length === 0) {
  console.log(
    'Manifest coverage verified: every component-scoped custom property and static CSS part is declared.',
  );
  process.exit(0);
}

const totalProps = findings.reduce((a, f) => a + f.missingProps.length, 0);
const totalParts = findings.reduce((a, f) => a + f.missingParts.length, 0);
const out = listOnly ? console.log : console.error;
out(
  `${totalProps} custom propert${totalProps === 1 ? 'y' : 'ies'} and ${totalParts} CSS part${
    totalParts === 1 ? '' : 's'
  } are used but not declared in custom-elements.json, across ${findings.length} component(s):\n`,
);
for (const finding of findings) {
  out(`  ${finding.tag}  (${finding.module})`);
  if (finding.missingProps.length) out(`      @cssprop  ${finding.missingProps.join(', ')}`);
  if (finding.missingParts.length) out(`      @csspart  ${finding.missingParts.join(', ')}`);
}
if (!listOnly) {
  out('\nAdd the missing @cssprop/@csspart JSDoc lines, then re-run `pnpm manifest`.');
  process.exit(1);
}

