#!/usr/bin/env node
import { isMainModule } from './is-main-module.mjs';

// `src/internal/a11y.ts` exports a shared `srOnly` css block that defines the `.sr-only`
// visually-hidden class (position: absolute, clip-path: inset(50%), a hairline box). A component
// only gets that rule if it composes `srOnly` into its own `static override styles` -- the class
// name alone renders as ordinary visible content otherwise, since Lit's shadow-scoped stylesheets
// never leak in from a sibling component or from this module's own (never-adopted) `css` template.
//
// This checker walks every `src/components/**/*.class.ts` file, decides whether its own render
// template ever applies the `sr-only` class (a static `class="...sr-only..."` attribute, or a
// `class=${...}` binding whose expression contains a quoted string with an `sr-only` token), and
// -- only for files that do -- requires ONE of two remediations:
//   1. The file imports `srOnly` from `internal/a11y.js` and composes it into
//      `static override styles` (`time-input.class.ts` is the reference shape), or
//   2. The sibling `*.styles.ts` file declares its own matching `.sr-only { ... }` rule
//      (`pagination.class.ts`/`pagination.styles.ts` is the reference shape -- a component that
//      only ever applies the class to one specific `[part]` may prefer a scoped selector over the
//      shared, unscoped `.sr-only` block).
//
// Detection is regex-based, matching the level of rigor `check-custom-property-cycles.mjs` uses for
// its own template scanning, not a full parse. `/* ... */` block comments and `<!-- ... -->` HTML
// comments (the latter reachable INSIDE an `html` template's literal text, unlike a `//` line
// comment) are blanked before matching, so a comment that merely prose-mentions `class="sr-only"`
// -- as one already does, describing a sibling element -- cannot masquerade as a real usage. `//`
// line comments are deliberately NOT stripped: unlike the two bounded forms above, blanking them
// blind risks truncating real template text such as an `href="https://..."` attribute value that
// happens to follow a `//`. The residual gap is a hand-written `// class="sr-only"`-shaped line
// comment written with real quote characters (not this codebase's own backtick-quoted-code-in-prose
// convention) never appears today; the checker under-reports that specific shape, not over-reports.
//
// Run: node scripts/check-visually-hidden.mjs

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const componentsRoot = join(packageDir, 'src', 'components');

/** Every `*.class.ts` file under `directory`, recursively. */
export function classFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) return classFiles(file);
    return entry.name.endsWith('.class.ts') ? [file] : [];
  });
}

/** Blanks `/* *\/` block comments and `<!-- -->` HTML comments (preserving line breaks so any
 *  reported line number stays accurate), leaving every other character -- including real template
 *  text -- untouched. */
export function stripNonRenderedText(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
    .replace(/<!--[\s\S]*?-->/g, (comment) => comment.replace(/[^\n]/g, ' '));
}

/** Every `${...}` expression bound to `attrName=`, extracted by brace-depth counting (mirrors
 *  `check-custom-property-cycles.mjs`'s paren-depth counting for a CSS value) rather than a naive
 *  non-greedy regex, so a nested object literal (a future `classMap({ 'sr-only': cond })`) cannot
 *  truncate the captured expression at its own inner `}`.
 *
 * @param {string} text
 * @param {string} attrName
 * @returns {string[]}
 */
export function dynamicAttributeExpressions(text, attrName) {
  const results = [];
  const open = new RegExp(`${attrName}\\s*=\\s*\\$\\{`, 'g');
  let match;
  while ((match = open.exec(text))) {
    let index = open.lastIndex;
    let depth = 1;
    const start = index;
    for (; index < text.length && depth > 0; index += 1) {
      if (text[index] === '{') depth += 1;
      else if (text[index] === '}') depth -= 1;
    }
    results.push(text.slice(start, index - 1));
    open.lastIndex = index;
  }
  return results;
}

const STATIC_CLASS_ATTR_RE = /class\s*=\s*"[^"]*\bsr-only\b[^"]*"/;
const QUOTED_SR_ONLY_TOKEN_RE = /['"][^'"]*\bsr-only\b[^'"]*['"]/;

/** Whether `source`'s own render template ever applies the `sr-only` class, statically or through
 *  a `class=${...}` binding. */
export function rendersSrOnlyClass(source) {
  const text = stripNonRenderedText(source);
  if (STATIC_CLASS_ATTR_RE.test(text)) return true;
  return dynamicAttributeExpressions(text, 'class').some((expr) => QUOTED_SR_ONLY_TOKEN_RE.test(expr));
}

/** Whether `source` imports the named export from a `.../internal/a11y.js` specifier, tolerating a
 *  multi-line named-import list (`menu-item.class.ts`'s own a11y.js import is one).
 *
 *  Matches each `import { ... } from '...'` statement one at a time (the closing brace ends the
 *  match before the following `from` clause is even inspected), then filters to the specifier --
 *  rather than folding "ends with internal/a11y.js" into one non-greedy regex, which would let the
 *  lazy `{...}` span jump clean over an EARLIER, unrelated import statement (its own `}  from
 *  '...'` doesn't satisfy the a11y.js suffix, so a single combined pattern keeps expanding right
 *  through the next statement's opening `import {` looking for one that does) and silently fold two
 *  or more real import statements into one bogus captured name list. */
export function importsFromA11y(source, exportName) {
  const importRe = /import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]*)['"]/g;
  let match;
  while ((match = importRe.exec(source))) {
    if (!match[2].endsWith('internal/a11y.js')) continue;
    const names = match[1]
      .split(',')
      .map((name) => name.trim().replace(/^type\s+/, ''))
      .filter(Boolean);
    if (names.includes(exportName)) return true;
  }
  return false;
}

/** Whether `source`'s `static override styles` array literal composes the identifier `name`,
 *  tolerating the multi-line array shape (`graph.class.ts`'s own styles array is one). */
export function stylesArrayIncludes(source, name) {
  const match = source.match(/static\s+override\s+styles\s*=\s*\[([\s\S]*?)\]/);
  if (!match) return false;
  const identifiers = match[1]
    .split(',')
    .map((identifier) => identifier.trim())
    .filter(Boolean);
  return identifiers.includes(name);
}

/** Whether a `.class.ts` file composes the shared `srOnly` export into its own styles. */
export function composesSharedSrOnly(source) {
  return importsFromA11y(source, 'srOnly') && stylesArrayIncludes(source, 'srOnly');
}

const STYLES_SR_ONLY_RULE_RE = /\.sr-only\b[^;{}]*\{/;

/** Whether a `*.styles.ts` file's own source declares a rule targeting `.sr-only` (any selector
 *  compounded with it, e.g. `pagination.styles.ts`'s `[part="live-region"].sr-only { ... }`). */
export function stylesFileDeclaresSrOnlyRule(source) {
  return STYLES_SR_ONLY_RULE_RE.test(stripNonRenderedText(source));
}

/** The sibling `*.styles.ts` path for a `<name>.class.ts` file. */
export function siblingStylesFile(classFilePath) {
  return classFilePath.replace(/\.class\.ts$/, '.styles.ts');
}

if (isMainModule(import.meta.url)) {
  const files = classFiles(componentsRoot).sort();
  const findings = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    if (!rendersSrOnlyClass(source)) continue;
    if (composesSharedSrOnly(source)) continue;
    const stylesPath = siblingStylesFile(file);
    if (existsSync(stylesPath) && stylesFileDeclaresSrOnlyRule(readFileSync(stylesPath, 'utf8'))) continue;
    findings.push(relative(packageDir, file));
  }
  if (files.length === 0) {
    console.error('Visually-hidden contract matched ZERO component files -- the file shape changed.');
    process.exitCode = 1;
  } else if (findings.length) {
    console.error(
      `Visually-hidden contract failed: ${findings.length} of ${files.length} component file(s) render ` +
        'the `sr-only` class without making it actually invisible-to-sighted-users:',
    );
    for (const finding of findings) console.error(`- ${finding}`);
    console.error(
      '\nEither compose the shared `srOnly` export from `internal/a11y.js` into `static override ' +
        "styles` (import it alongside the component's own styles, add it to the array -- " +
        '`time-input.class.ts` is the reference shape), or declare a matching `.sr-only { ... }` rule ' +
        "in the component's own sibling `*.styles.ts` file if it needs a selector scoped to one " +
        "specific part (`pagination.class.ts`/`pagination.styles.ts` is the reference shape). A class " +
        'name alone renders as ordinary visible content -- Lit shadow-scoped stylesheets never leak in ' +
        'from a sibling component or from `internal/a11y.ts`\'s own never-adopted `css` template.',
    );
    process.exitCode = 1;
  } else {
    console.log(`Visually-hidden contract passed: 0 uncomposed sr-only usage(s) out of ${files.length} component file(s).`);
  }
}
