// Guards against a bug class that has already hit this package twice: a numeric reactive
// property (`type: Number`) reaches layout/timer/simulation math while `NaN`, non-finite, or
// unbounded, because it bypasses the shared finite-number normalization layer at
// `src/internal/numbers.ts` (`finiteNumber`/`finiteRange`/`finiteInteger`/`finiteCount`/
// `finiteDuration`). That layer was built specifically to make this class of bug impossible; a
// new numeric property that never calls into it can silently reintroduce it.
//
// This is a *heuristic*, textual check, not a dataflow analysis -- deliberately, to match the
// pragmatic style of scripts/check-style-policy.mjs's own regex-based checks. It cannot know
// whether a given numeric property genuinely needs bounds (an opaque pass-through id, or a value
// already validated by a native HTML input type, doesn't). For those, add an inline
//
//   // numeric-guard-exempt: <short reason>
//
// comment directly above the property declaration (or, for a `static properties = { ... }`
// entry, directly above that entry's key). A property with neither guard-helper usage nor an
// exemption comment hard-fails; one with an exemption comment is reported but does not fail --
// matching how this script's sibling checks (e.g. check-component-coverage.mjs's
// scripts/component-coverage.json allowlist, which pairs every exception with its own documented
// `reason`) require an exception to be explicit and self-documenting rather than silent.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const componentsRoot = path.join(packageDir, 'src', 'components');

const GUARD_HELPERS = ['finiteNumber', 'finiteRange', 'finiteInteger', 'finiteCount', 'finiteDuration'];
const GUARD_IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*['"][^'"]*\/internal\/numbers(?:\.js)?['"]/g;
const GUARD_CALL_RE = /\bfinite(?:Number|Range|Integer|Count|Duration)\s*\(/g;
const EXEMPT_RE = /^\s*\/\/\s*numeric-guard-exempt:\s*(.+?)\s*$/;

// How many lines around a guard-helper call site count as "near" a property's own name for the
// proximity check -- generous on purpose (low false-positive rate matters more than precision
// here): real usages in this codebase range from "same line" (e.g. `this._min = finiteNumber(
// next, 0);`) to a couple of lines apart (a raw value read into a local a line or two above the
// call that consumes it).
const LOOKBACK_LINES = 6;
const LOOKAHEAD_LINES = 6;

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return entry.name.endsWith('.class.ts') ? [fullPath] : [];
  });
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Returns the index of the bracket matching the one at `openIndex` (which must contain
// `openChar`), by simple depth counting. Doesn't special-case string/comment contents, which is
// fine for this file's targets: flat `@property({ ... })` option objects and `static properties`
// blocks, none of which currently (or plausibly) embed unbalanced brackets inside a string.
function matchBalanced(source, openIndex, openChar, closeChar) {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    if (source[i] === openChar) depth++;
    else if (source[i] === closeChar) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Builds a fast index->0-based-line-number lookup for a single source string. */
function makeLineLookup(source) {
  const newlineIndexes = [];
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') newlineIndexes.push(i);
  return (index) => {
    // Number of newlines strictly before `index` == 0-based line number.
    let lo = 0;
    let hi = newlineIndexes.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (newlineIndexes[mid] < index) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
}

/** Finds every `type: Number` reactive property in `source`, covering both the
 *  `@property({ ..., type: Number, ... }) name = ...` decorator form and the
 *  `static properties = { name: { type: Number, ... }, ... }` object-literal form. Returns
 *  `{ name, siteIndex }[]`, where `siteIndex` is the character offset of the decorator/entry (used
 *  to find an exemption comment directly above it). */
function findNumericProperties(source) {
  const results = [];

  const decoratorRe = /@property\s*\(/g;
  let match;
  while ((match = decoratorRe.exec(source))) {
    const openParenIndex = match.index + match[0].length - 1;
    const closeParenIndex = matchBalanced(source, openParenIndex, '(', ')');
    if (closeParenIndex === -1) continue;
    const optionsText = source.slice(openParenIndex + 1, closeParenIndex);
    if (!/\btype\s*:\s*Number\b/.test(optionsText)) continue;

    const after = source.slice(closeParenIndex + 1, closeParenIndex + 1 + 200);
    // Field form: `name = ...;` or `name?: number;` (no initializer, e.g. an optional numeric
    // prop with no default). The type-annotation group deliberately excludes `=`/`;` so it can't
    // run past the field it belongs to.
    const fieldMatch = /^\s*(?:readonly\s+)?(\w+)\??\s*(?::\s*[^=;]+)?\s*[=;]/.exec(after);
    // Getter/setter accessor form: `@property(...)` decorates the `get name()` half of the pair.
    const accessorMatch = fieldMatch ? null : /^\s*(?:get|set)\s+(\w+)\s*\(/.exec(after);
    const name = fieldMatch?.[1] ?? accessorMatch?.[1];
    if (!name) continue;
    results.push({ name, siteIndex: match.index });
  }

  const staticPropertiesRe = /static\s+properties\s*=\s*\{/g;
  while ((match = staticPropertiesRe.exec(source))) {
    const openBraceIndex = match.index + match[0].length - 1;
    const closeBraceIndex = matchBalanced(source, openBraceIndex, '{', '}');
    if (closeBraceIndex === -1) continue;
    const blockText = source.slice(openBraceIndex + 1, closeBraceIndex);
    const blockOffset = openBraceIndex + 1;

    const entryRe = /(\w+)\s*:\s*\{/g;
    let entryMatch;
    while ((entryMatch = entryRe.exec(blockText))) {
      const entryOpenIndex = entryMatch.index + entryMatch[0].length - 1;
      const entryCloseIndex = matchBalanced(blockText, entryOpenIndex, '{', '}');
      if (entryCloseIndex === -1) continue;
      const entryOptionsText = blockText.slice(entryOpenIndex + 1, entryCloseIndex);
      if (/\btype\s*:\s*Number\b/.test(entryOptionsText)) {
        results.push({ name: entryMatch[1], siteIndex: blockOffset + entryMatch.index });
      }
    }
  }

  return results;
}

function importedGuardHelpers(source) {
  const imported = new Set();
  let match;
  GUARD_IMPORT_RE.lastIndex = 0;
  while ((match = GUARD_IMPORT_RE.exec(source))) {
    for (const rawName of match[1].split(',')) {
      const name = rawName.trim();
      if (GUARD_HELPERS.includes(name)) imported.add(name);
    }
  }
  return imported;
}

/** Heuristic proximity check: does `propName` (allowing for a `_propName` private-backing-field
 *  spelling, this codebase's convention for a property with a hand-written accessor) appear
 *  within a few lines of some call to one of the finite* guard helpers, anywhere in the file? */
function hasNearbyGuardUsage(source, lines, lineAt, propName) {
  const propRe = new RegExp(`\\b_?${escapeRegExp(propName)}\\b`);
  GUARD_CALL_RE.lastIndex = 0;
  let match;
  while ((match = GUARD_CALL_RE.exec(source))) {
    const callLine = lineAt(match.index);
    const openParenIndex = match.index + match[0].length - 1;
    const closeParenIndex = matchBalanced(source, openParenIndex, '(', ')');
    const callEndLine = closeParenIndex === -1 ? callLine : lineAt(closeParenIndex);
    const from = Math.max(0, callLine - LOOKBACK_LINES);
    const to = Math.min(lines.length - 1, callEndLine + LOOKAHEAD_LINES);
    const windowText = lines.slice(from, to + 1).join('\n');
    if (propRe.test(windowText)) return true;
  }
  return false;
}

// How far up to keep scanning through a contiguous run of blank/`//`-comment lines looking for
// the marker -- generous enough to cover a multi-line reason (the marker need not be the single
// line directly touching the declaration, just somewhere in the `//` comment block immediately
// above it), but stops the instant it hits anything else (code, or a `/** ... */` doc comment),
// so it can't reach past an unrelated previous property.
const EXEMPTION_SCAN_LINES = 15;

function exemptionReason(lines, siteLine) {
  for (let offset = 1; offset <= EXEMPTION_SCAN_LINES; offset++) {
    const candidate = lines[siteLine - offset];
    if (candidate === undefined) break;
    if (candidate.trim() === '') continue;
    const exempted = EXEMPT_RE.exec(candidate);
    if (exempted) return exempted[1];
    if (!/^\s*\/\//.test(candidate)) break; // not part of a `//` comment block -- stop scanning
  }
  return null;
}

const classFiles = walk(componentsRoot).sort();

const flagged = [];
const exempted = [];
let guardedCount = 0;
let totalCount = 0;

for (const file of classFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const lines = source.split('\n');
  const lineAt = makeLineLookup(source);
  const relPath = path.relative(packageDir, file);

  const properties = findNumericProperties(source);
  if (properties.length === 0) continue;

  const guardImports = importedGuardHelpers(source);
  const seen = new Set();

  for (const { name, siteIndex } of properties) {
    // A getter/setter pair, or a property redeclared some other way, can otherwise produce the
    // same name twice for one file.
    if (seen.has(name)) continue;
    seen.add(name);
    totalCount += 1;

    const siteLine = lineAt(siteIndex);
    const reason = exemptionReason(lines, siteLine);
    if (reason) {
      exempted.push({ file: relPath, line: siteLine + 1, name, reason });
      continue;
    }

    const guarded = guardImports.size > 0 && hasNearbyGuardUsage(source, lines, lineAt, name);
    if (guarded) {
      guardedCount += 1;
      continue;
    }

    flagged.push({
      file: relPath,
      line: siteLine + 1,
      name,
      reason:
        guardImports.size === 0
          ? 'file does not import any internal/numbers.js finite-guard helper'
          : 'no finite-guard helper call found near this property in the file',
    });
  }
}

console.log(
  `Numeric guard check: ${totalCount} \`type: Number\` propert${totalCount === 1 ? 'y' : 'ies'} found across ${classFiles.length} component class files.`,
);
console.log(`  guarded (helper usage detected): ${guardedCount}`);
console.log(`  exempted (numeric-guard-exempt comment): ${exempted.length}`);
console.log(`  flagged (neither): ${flagged.length}`);

if (exempted.length > 0) {
  console.log('\nExemptions:');
  for (const item of exempted) console.log(`- ${item.file}:${item.line}: ${item.name} -- ${item.reason}`);
}

if (flagged.length > 0) {
  console.error(`\nNumeric guard check failed with ${flagged.length} finding(s):`);
  for (const item of flagged) console.error(`- ${item.file}:${item.line}: \`${item.name}\` -- ${item.reason}`);
  console.error(
    '\nEach numeric property must either call into a shared finite-number helper ' +
      '(finiteNumber/finiteRange/finiteInteger/finiteCount/finiteDuration from internal/numbers.js) ' +
      'somewhere in its file, or carry an inline exemption comment directly above its declaration:\n' +
      '  // numeric-guard-exempt: <short reason>\n',
  );
  process.exitCode = 1;
} else {
  console.log('\nNumeric guard check passed.');
}
