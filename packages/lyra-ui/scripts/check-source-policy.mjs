// Source policy checker: fast, dependency-free static rules over src/components (plus
// src/internal where noted) that guard the library's i18n/RTL invariants and two frozen
// test-coverage baselines. Rules:
//
//   localize-fallback       `this.localize(key, fallback)` with a *defined* fallback wins over
//                           `registerLyraLocale()` registrations (see resolveLyraString(): a
//                           defined fallback short-circuits the registered-locale lookup), so a
//                           key that already has a DEFAULT_STRINGS default must only ever pass
//                           `undefined` -- directly, via `expr || undefined`, or via a ternary
//                           whose default branch is `undefined`.
//   intl-outside-cache      `new Intl.<Formatter>` constructions perform an ICU locale-data
//                           lookup per call; all formatter instances must come from the shared
//                           per-locale+options caches in src/internal/intl-cache.ts.
//   pointercancel-pairing   A `pointermove` listener on window/document is drag tracking; the
//                           browser can end such an interaction with `pointercancel` (touch
//                           scroll takeover, alt-tab, stylus palm rejection) and never fire
//                           `pointerup`, so the file must also handle `pointercancel` or the
//                           move listener leaks.
//   rtl-arrow-keys          A keydown handler that maps ArrowLeft/ArrowRight must consult
//                           `effectiveDirection`/`isRtl` so horizontal arrows follow text
//                           direction, unless the surface is physically oriented (2-D canvas
//                           coordinates, an ltr-pinned strip) and says so via a suppression.
//   physical-css            *.styles.ts must use logical properties (inset-inline-*,
//                           margin-inline-*, text-align: start/end, ...) instead of physical
//                           left/right ones, except inside `:dir()` rules, in rule blocks that
//                           pin `direction: ltr`, or at explicitly suppressed declarations.
//
// Suppressions (pointercancel-pairing / rtl-arrow-keys / physical-css only): a comment on the
// flagged line, or in the contiguous comment block immediately above it, of the form
//   policy-allow(rule-id): specific reason
//
// Ratchets (frozen baselines in scripts/source-policy-baselines.json; new code must comply):
//   keyboard-test-coverage  A component class handles keydown but its colocated test never
//                           simulates keyboard input (sendKeys / KeyboardEvent / keydown).
//   strings-test-coverage   A component class calls this.localize() but its colocated test
//                           references neither `.strings` nor `registerLyraLocale`.
// Only offenders missing from the baseline fail the check; a baselined file that becomes clean
// is reported as a note so the baseline can shrink. `--list-baselines` prints the counts.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const componentsRoot = path.join(packageDir, 'src', 'components');
const internalRoot = path.join(packageDir, 'src', 'internal');
const baselinePath = path.join(packageDir, 'scripts', 'source-policy-baselines.json');

const RATCHET_RULES = ['keyboard-test-coverage', 'strings-test-coverage'];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return [fullPath];
  });
}

const isSource = (file) =>
  file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.endsWith('.stories.ts') && !file.endsWith('.d.ts');

const rel = (file) => path.relative(packageDir, file).replaceAll('\\', '/');

/**
 * Blanks out `//` and `/* ... *​/` comments (preserving newlines and byte offsets) while leaving
 * string and template-literal contents intact, so `'pointercancel'` in code still counts as a
 * reference but a mention in prose does not. Template `${}` holes are tracked so a brace inside
 * one doesn't end the template early.
 */
function stripJsComments(source) {
  const out = source.split('');
  let state = 'code';
  const templateStack = [];
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    const pair = source.slice(i, i + 2);
    if (state === 'code') {
      if (pair === '//') {
        state = 'line';
        out[i] = ' ';
      } else if (pair === '/*') {
        state = 'block';
        out[i] = ' ';
      } else if (c === "'") state = 'single';
      else if (c === '"') state = 'double';
      else if (c === '`') state = 'template';
      else if (c === '{' && templateStack.length > 0) templateStack[templateStack.length - 1]++;
      else if (c === '}' && templateStack.length > 0) {
        if (--templateStack[templateStack.length - 1] === 0) {
          templateStack.pop();
          state = 'template';
        }
      }
    } else if (state === 'line') {
      if (c === '\n') state = 'code';
      else out[i] = ' ';
    } else if (state === 'block') {
      if (pair === '*/') {
        state = 'code';
        out[i] = ' ';
        out[i + 1] = ' ';
        i++;
      } else if (c !== '\n') out[i] = ' ';
    } else if (state === 'single' || state === 'double') {
      if (c === '\\') i++;
      else if ((state === 'single' && c === "'") || (state === 'double' && c === '"')) state = 'code';
    } else if (state === 'template') {
      if (c === '\\') i++;
      else if (pair === '${') {
        templateStack.push(1);
        state = 'code';
        i++;
      } else if (c === '`') state = 'code';
    }
  }
  return out.join('');
}

const lineOf = (source, index) => source.slice(0, index).split('\n').length;

/**
 * True when the flagged line, or the contiguous comment block right above it, contains a
 * `policy-allow(ruleId):` marker. Comment lines are recognized structurally: a line that has
 * content in the raw source but nothing left after comment-stripping is pure comment, which
 * handles `//` runs and multi-line block comments alike.
 */
function isSuppressed(rawLines, strippedLines, flaggedLine, ruleId) {
  const marker = `policy-allow(${ruleId}):`;
  if (rawLines[flaggedLine - 1]?.includes(marker)) return true;
  for (let i = flaggedLine - 2; i >= 0; i--) {
    const isCommentLine = rawLines[i].trim() !== '' && strippedLines[i].trim() === '';
    if (!isCommentLine) return false;
    if (rawLines[i].includes(marker)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Rule 1: localize-fallback
// ---------------------------------------------------------------------------

function defaultStringKeys() {
  const source = fs.readFileSync(path.join(internalRoot, 'localization.ts'), 'utf8');
  const match = source.match(/const DEFAULT_STRINGS: Record<LyraMessageKey, string> = \{([\s\S]*?)\n\};/);
  if (!match) throw new Error('could not locate DEFAULT_STRINGS in src/internal/localization.ts');
  const keys = new Set([...match[1].matchAll(/^\s*([A-Za-z0-9_]+):/gm)].map((m) => m[1]));
  if (keys.size < 100) throw new Error(`implausibly few DEFAULT_STRINGS keys parsed (${keys.size})`);
  return keys;
}

/** Splits balanced argument text on top-level commas (string- and nesting-aware). */
function splitTopLevelArgs(argText) {
  const args = [];
  let current = '';
  let depth = 0;
  let state = 'code';
  for (let i = 0; i < argText.length; i++) {
    const c = argText[i];
    if (state !== 'code') {
      current += c;
      if (c === '\\') current += argText[++i] ?? '';
      else if ((state === 'single' && c === "'") || (state === 'double' && c === '"') || (state === 'template' && c === '`'))
        state = 'code';
      continue;
    }
    if (c === "'") state = 'single';
    else if (c === '"') state = 'double';
    else if (c === '`') state = 'template';
    else if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (c === ',' && depth === 0) {
      args.push(current);
      current = '';
      continue;
    }
    current += c;
  }
  if (current.trim()) args.push(current);
  return args;
}

/** Finds the top-level `cond ? a : b` split of an expression, if it is one. */
function splitTopLevelTernary(expression) {
  let depth = 0;
  let state = 'code';
  let question = -1;
  let ternaryDepth = 0;
  for (let i = 0; i < expression.length; i++) {
    const c = expression[i];
    if (state !== 'code') {
      if (c === '\\') i++;
      else if ((state === 'single' && c === "'") || (state === 'double' && c === '"') || (state === 'template' && c === '`'))
        state = 'code';
      continue;
    }
    if (c === "'") state = 'single';
    else if (c === '"') state = 'double';
    else if (c === '`') state = 'template';
    else if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (depth === 0 && c === '?' && expression[i + 1] !== '.' && expression[i + 1] !== '?' && expression[i - 1] !== '?') {
      if (question === -1) question = i;
      else ternaryDepth++;
    } else if (depth === 0 && c === ':' && question !== -1) {
      if (ternaryDepth > 0) ternaryDepth--;
      else
        return {
          then: expression.slice(question + 1, i),
          else: expression.slice(i + 1),
        };
    }
  }
  return undefined;
}

/** Allowed fallback shapes: `undefined`, `expr || undefined`, or a ternary with an allowed branch. */
function isAllowedFallback(expression) {
  const trimmed = expression.trim();
  if (trimmed === 'undefined') return true;
  if (/\|\|\s*undefined$/.test(trimmed)) return true;
  const ternary = splitTopLevelTernary(trimmed);
  if (ternary) return isAllowedFallback(ternary.then) || isAllowedFallback(ternary.else);
  return false;
}

/** Extracts the balanced `(...)` argument text starting right after an opening paren. */
function balancedArgText(source, openIndex) {
  let depth = 1;
  let state = 'code';
  for (let i = openIndex; i < source.length; i++) {
    const c = source[i];
    if (state !== 'code') {
      if (c === '\\') i++;
      else if ((state === 'single' && c === "'") || (state === 'double' && c === '"') || (state === 'template' && c === '`'))
        state = 'code';
      continue;
    }
    if (c === "'") state = 'single';
    else if (c === '"') state = 'double';
    else if (c === '`') state = 'template';
    else if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) {
      depth--;
      if (depth === 0) return source.slice(openIndex, i);
    }
  }
  return source.slice(openIndex);
}

function checkLocalizeFallback(file, stripped, knownKeys, findings) {
  for (const match of stripped.matchAll(/this\.localize\(/g)) {
    const args = splitTopLevelArgs(balancedArgText(stripped, match.index + match[0].length));
    if (args.length < 2) continue;
    const keyMatch = args[0].trim().match(/^['"]([A-Za-z0-9_]+)['"]$/);
    if (!keyMatch || !knownKeys.has(keyMatch[1])) continue;
    if (isAllowedFallback(args[1])) continue;
    findings.push(
      `${rel(file)}:${lineOf(stripped, match.index)} [localize-fallback] '${keyMatch[1]}' has a ` +
        `DEFAULT_STRINGS default, and a defined fallback argument overrides registerLyraLocale() ` +
        `translations -- pass undefined (or \`expr || undefined\`, or a ternary whose default branch is undefined)`,
    );
  }
}

// ---------------------------------------------------------------------------
// Rule 2: intl-outside-cache
// ---------------------------------------------------------------------------

const INTL_KINDS =
  /new\s+Intl\s*\.\s*(NumberFormat|DateTimeFormat|DisplayNames|RelativeTimeFormat|ListFormat|PluralRules|Collator|Segmenter)/g;

function checkIntlOutsideCache(file, stripped, findings) {
  for (const match of stripped.matchAll(INTL_KINDS)) {
    findings.push(
      `${rel(file)}:${lineOf(stripped, match.index)} [intl-outside-cache] construct Intl.${match[1]} ` +
        `through src/internal/intl-cache.ts (get${match[1]}, adding it there if the kind has no getter yet) ` +
        `so instances are shared per locale+options instead of re-running the ICU locale-data lookup`,
    );
  }
}

// ---------------------------------------------------------------------------
// Rule 3: pointercancel-pairing
// ---------------------------------------------------------------------------

const GLOBAL_POINTERMOVE = /\b(?:window|document|ownerDocument)\s*\.\s*addEventListener\s*\(\s*['"]pointermove['"]/;

function checkPointercancelPairing(file, stripped, rawLines, findings) {
  const match = stripped.match(GLOBAL_POINTERMOVE);
  if (!match || stripped.includes('pointercancel')) return;
  const line = lineOf(stripped, match.index);
  if (isSuppressed(rawLines, stripped.split('\n'), line, 'pointercancel-pairing')) return;
  findings.push(
    `${rel(file)}:${line} [pointercancel-pairing] adds a window/document pointermove listener but never ` +
      `references pointercancel; the browser can end the interaction (touch scroll takeover, focus loss) ` +
      `without a pointerup, leaving the move listener tracking a dead drag`,
  );
}

// ---------------------------------------------------------------------------
// Rule 4: rtl-arrow-keys
// ---------------------------------------------------------------------------

function checkRtlArrowKeys(file, stripped, rawLines, findings) {
  if (!file.endsWith('.class.ts')) return;
  if (!/keydown/i.test(stripped)) return;
  const match = stripped.match(/Arrow(?:Left|Right)/);
  if (!match) return;
  if (/effectiveDirection|isRtl/.test(stripped)) return;
  const line = lineOf(stripped, match.index);
  if (isSuppressed(rawLines, stripped.split('\n'), line, 'rtl-arrow-keys')) return;
  findings.push(
    `${rel(file)}:${line} [rtl-arrow-keys] keydown handling maps ArrowLeft/ArrowRight without consulting ` +
      `effectiveDirection/isRtl; horizontal arrows must follow text direction, or carry a ` +
      `policy-allow(rtl-arrow-keys) suppression naming the physical surface that never mirrors`,
  );
}

// ---------------------------------------------------------------------------
// Rule 5: physical-css
// ---------------------------------------------------------------------------

const PHYSICAL_PATTERNS = [
  [/(?:^|[^-\w$])left\s*:/, 'left', 'inset-inline-start'],
  [/(?:^|[^-\w$])right\s*:/, 'right', 'inset-inline-end'],
  [/\bmargin-left\s*:/, 'margin-left', 'margin-inline-start'],
  [/\bmargin-right\s*:/, 'margin-right', 'margin-inline-end'],
  [/\bpadding-left\s*:/, 'padding-left', 'padding-inline-start'],
  [/\bpadding-right\s*:/, 'padding-right', 'padding-inline-end'],
  [/\bborder-left(?:-width|-style|-color)?\s*:/, 'border-left*', 'border-inline-start*'],
  [/\bborder-right(?:-width|-style|-color)?\s*:/, 'border-right*', 'border-inline-end*'],
  [/\bborder-top-left-radius\s*:/, 'border-top-left-radius', 'border-start-start-radius'],
  [/\bborder-top-right-radius\s*:/, 'border-top-right-radius', 'border-start-end-radius'],
  [/\bborder-bottom-left-radius\s*:/, 'border-bottom-left-radius', 'border-end-start-radius'],
  [/\bborder-bottom-right-radius\s*:/, 'border-bottom-right-radius', 'border-end-end-radius'],
  [/\btext-align\s*:\s*(?:left|right)\b/, 'text-align: left|right', 'text-align: start|end'],
  [/\bfloat\s*:\s*(?:left|right)\b/, 'float: left|right', 'float: inline-start|inline-end'],
  [/\bbackground-position[^:;\n]*:[^;{}]*\b(?:left|right)\b/, 'background-position left|right keyword', 'logical offsets'],
];

/** Blanks `/* ... *​/` comments (CSS and JS block comments alike) while preserving offsets. */
function stripCssComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
    .replace(/^([ \t]*)\/\/.*$/gm, (line) => ' '.repeat(line.length));
}

/**
 * Brace-tracked CSS blocks with just enough structure to answer "is this declaration inside a
 * `:dir()` rule?" and "does its innermost rule directly pin `direction: ltr`?". Selector text is
 * whatever precedes the `{` back to the previous `{`, `}`, or `;` -- accurate for the flat
 * `css\`...\`` templates used by *.styles.ts.
 */
function cssBlocks(stripped) {
  const blocks = [];
  const stack = [];
  let lastBoundary = 0;
  for (let i = 0; i < stripped.length; i++) {
    const c = stripped[i];
    if (c === '{') {
      const selector = stripped.slice(lastBoundary, i);
      blocks.push({
        start: i,
        end: stripped.length,
        dirScoped: (stack[stack.length - 1]?.dirScoped ?? false) || selector.includes(':dir('),
        ltrPinned: false,
        children: [],
      });
      stack.push(blocks[blocks.length - 1]);
      lastBoundary = i + 1;
    } else if (c === '}') {
      const block = stack.pop();
      if (block) {
        block.end = i;
        if (stack.length > 0) stack[stack.length - 1].children.push(block);
      }
      lastBoundary = i + 1;
    } else if (c === ';') lastBoundary = i + 1;
  }
  for (const block of blocks) {
    let direct = stripped.slice(block.start + 1, block.end);
    for (const child of block.children) {
      const from = child.start - (block.start + 1);
      const to = child.end + 1 - (block.start + 1);
      direct = direct.slice(0, from) + ' '.repeat(to - from) + direct.slice(to);
    }
    block.ltrPinned = /direction\s*:\s*ltr\b/.test(direct);
  }
  return blocks;
}

function checkPhysicalCss(file, rawLines, findings) {
  const stripped = stripCssComments(fs.readFileSync(file, 'utf8'));
  const blocks = cssBlocks(stripped);
  const lines = stripped.split('\n');
  const strippedLines = lines;
  let offset = 0;
  lines.forEach((lineText, index) => {
    for (const [pattern, label, replacement] of PHYSICAL_PATTERNS) {
      const match = lineText.match(pattern);
      if (!match) continue;
      const position = offset + match.index;
      const innermost = blocks.filter((b) => b.start < position && position < b.end).at(-1);
      if (innermost?.dirScoped || innermost?.ltrPinned) continue;
      const line = index + 1;
      if (isSuppressed(rawLines, strippedLines, line, 'physical-css')) continue;
      findings.push(
        `${rel(file)}:${line} [physical-css] physical '${label}' -- use ${replacement} (or scope the rule ` +
          `with :dir(), pin \`direction: ltr\` in the same rule, or add a policy-allow(physical-css) suppression)`,
      );
    }
    offset += lineText.length + 1;
  });
}

// ---------------------------------------------------------------------------
// Ratchets: keyboard-test-coverage / strings-test-coverage
// ---------------------------------------------------------------------------

function colocatedTestSource(classFile) {
  const directory = path.dirname(classFile);
  const preferred = path.join(directory, `${path.basename(classFile, '.class.ts')}.test.ts`);
  const testFiles = fs.existsSync(preferred)
    ? [preferred]
    : fs
        .readdirSync(directory)
        .filter((name) => name.endsWith('.test.ts'))
        .map((name) => path.join(directory, name));
  return testFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
}

function collectRatchetOffenders(componentFiles, strippedByFile) {
  const offenders = { 'keyboard-test-coverage': [], 'strings-test-coverage': [] };
  for (const file of componentFiles) {
    if (!file.endsWith('.class.ts')) continue;
    const stripped = strippedByFile.get(file);
    const handlesKeydown = /keydown/i.test(stripped);
    const callsLocalize = stripped.includes('this.localize(');
    if (!handlesKeydown && !callsLocalize) continue;
    const tests = colocatedTestSource(file);
    if (handlesKeydown && !/sendKeys|KeyboardEvent|keydown/.test(tests))
      offenders['keyboard-test-coverage'].push(rel(file));
    if (callsLocalize && !/\.strings\b|registerLyraLocale/.test(tests))
      offenders['strings-test-coverage'].push(rel(file));
  }
  for (const rule of RATCHET_RULES) offenders[rule].sort();
  return offenders;
}

function loadBaselines() {
  if (!fs.existsSync(baselinePath)) return Object.fromEntries(RATCHET_RULES.map((rule) => [rule, []]));
  const parsed = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  return Object.fromEntries(RATCHET_RULES.map((rule) => [rule, parsed[rule] ?? []]));
}

// ---------------------------------------------------------------------------

const baselines = loadBaselines();

if (process.argv.includes('--list-baselines')) {
  for (const rule of RATCHET_RULES) console.log(`${rule}: ${baselines[rule].length} baselined file(s)`);
  process.exit(0);
}

const knownKeys = defaultStringKeys();
const componentFiles = walk(componentsRoot).filter(isSource).sort();
const internalFiles = walk(internalRoot)
  .filter(isSource)
  .filter((file) => path.basename(file) !== 'intl-cache.ts')
  .sort();

const findings = [];
const notes = [];
const strippedByFile = new Map();

for (const file of [...componentFiles, ...internalFiles]) {
  strippedByFile.set(file, stripJsComments(fs.readFileSync(file, 'utf8')));
}

for (const file of componentFiles) {
  const stripped = strippedByFile.get(file);
  const rawLines = fs.readFileSync(file, 'utf8').split('\n');
  if (file.endsWith('.styles.ts')) {
    checkPhysicalCss(file, rawLines, findings);
    continue;
  }
  checkLocalizeFallback(file, stripped, knownKeys, findings);
  checkIntlOutsideCache(file, stripped, findings);
  checkPointercancelPairing(file, stripped, rawLines, findings);
  checkRtlArrowKeys(file, stripped, rawLines, findings);
}

for (const file of internalFiles) {
  checkIntlOutsideCache(file, strippedByFile.get(file), findings);
}

const offenders = collectRatchetOffenders(componentFiles, strippedByFile);
for (const rule of RATCHET_RULES) {
  const baseline = new Set(baselines[rule]);
  const current = new Set(offenders[rule]);
  for (const file of offenders[rule]) {
    if (baseline.has(file)) continue;
    const reason =
      rule === 'keyboard-test-coverage'
        ? 'handles keydown but its colocated test never simulates keyboard input (sendKeys / KeyboardEvent / keydown dispatch)'
        : 'calls this.localize() but its colocated test references neither `.strings` nor registerLyraLocale';
    findings.push(`${file}:1 [${rule}] ${reason}; new components must ship this coverage`);
  }
  for (const file of baselines[rule]) {
    if (!current.has(file))
      notes.push(`note: ${file} is no longer an offender for ${rule} -- remove it from scripts/source-policy-baselines.json`);
  }
}

for (const note of notes) console.log(note);

if (findings.length > 0) {
  console.error(`Source policy failed with ${findings.length} finding(s):`);
  for (const finding of findings.sort()) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log(
    `Source policy passed for ${componentFiles.length + internalFiles.length} source files ` +
      `(baselines: ${RATCHET_RULES.map((rule) => `${baselines[rule].length} ${rule}`).join(', ')})`,
  );
}
