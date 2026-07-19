#!/usr/bin/env node
// Reports every component-scoped `--lr-<component>-*` custom property a component's own stylesheet
// reads, and every `part="…"` its template renders, that `custom-elements.json` does not declare.
//
// The manifest is generated from JSDoc, so an undeclared token or part is invisible to
// `vscode-css-data.json`, `web-types.json`, every manifest-driven editor integration, and to
// `check-llms-freshness.mjs` — which is how 60 custom properties and 15 parts came to be documented
// nowhere at all. `scripts/llms-gap-report.mjs` compensates by scanning stylesheets directly; this
// check exists so the manifest itself stops being the weak link.
//
// Run: `node scripts/check-manifest-coverage.mjs [--list]`
//   --list  print the worklist and exit 0 (authoring aid); default exits 1 on any finding.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(readFileSync(path.join(packageDir, 'custom-elements.json'), 'utf8'));
const listOnly = process.argv.includes('--list');

/** Tokens/parts a component legitimately reads but does not own. */
const isSharedToken = (token) =>
  /^--lr-(color|space|radius|shadow|font|transition|opacity|focus-ring|size|layer|line-height|border-width|safe-area|no-data)/.test(
    token,
  );

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
    //
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
    for (const file of stylesheets) {
      const text = readFileSync(path.join(dir, file), 'utf8');
      for (const m of text.matchAll(/var\(\s*(--lr-[a-z0-9-]+)/g)) {
        if (m[1].startsWith(ownPrefix) && !isSharedToken(m[1])) usedProps.add(m[1]);
      }
    }

    // Parts rendered from a static `part="…"` attribute in the class module. Dynamic/computed part
    // names are out of scope here (check-manifest.mjs already covers the exportparts contract).
    //
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
