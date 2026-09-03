import { isMainModule } from './is-main-module.mjs';

// Source policy checker: fast, dependency-free static rules over src/components (plus
// src/internal where noted) that guard the library's i18n/RTL invariants and two frozen
// test-coverage baselines. Rules:
//   localize-fallback       `this.localize(key, fallback)` with a *defined* fallback wins over
//                           `registerLyraLocale()` registrations (see resolveLyraString(): a
//                           defined fallback short-circuits the registered-locale lookup), so a
//                           key that already has a DEFAULT_STRINGS default must only ever pass
//                           `undefined` -- directly, via `expr || undefined`, or via a ternary
//                           whose default branch is `undefined`.
//   intl-outside-cache      `new Intl.<Formatter>` constructions perform an ICU locale-data
//                           lookup per call; all formatter instances must come from the shared
//                           per-locale+options caches in src/internal/intl-cache.ts.
//   unsafe-intl-locale      Native `toLocale*()`/`localeCompare()` calls must receive an explicit
//                           validated effective locale. Bare runtime-default, hardcoded, and raw
//                           host locale arguments bypass the safe Intl boundary.
//   pointercancel-pairing   A `pointermove` listener on window/document is drag tracking; the
//                           browser can end such an interaction with `pointercancel` (touch
//                           scroll takeover, alt-tab, stylus palm rejection) and never fire
//                           `pointerup`, so the file must also handle `pointercancel` or the
//                           move listener leaks.
//   rtl-arrow-keys          A keydown handler that maps ArrowLeft/ArrowRight must consult
//                           `effectiveDirection`/`isRtl` so horizontal arrows follow text
//                           direction, unless the surface is physically oriented (2-D canvas
//                           coordinates, an ltr-pinned strip) and says so via a suppression.
//   shadow-live-region      `role="status"`, `role="alert"`, and active `aria-live` markup inside
//                           a component template is not announced reliably across AT/browser
//                           pairs. Stateful announcements must use the shared light-DOM sink.
//   announcement-source     Component-owned light-DOM sinks must identify their owner document
//                           and source element, so adoption targets the right realm and the shared
//                           announcer suppresses hidden, inert, or stale-document messages.
//   nul-byte                A literal NUL makes ordinary source tools treat a text file as binary;
//                           express an intentional delimiter with an escaped source spelling.
//   double-quoted-literal   A double-quoted string literal outside a template literal, whose
//                           content has no single quote to escape, is off this codebase's
//                           single-quote convention -- and if it's a public member's printed
//                           type/default text, it desyncs check:pinned-upstream-manifests.
//   announcer-timer-realm   A component-owned Announcer must bind its timers to the host's owner
//                           window on connection/adoption instead of retaining the ambient realm.
//   physical-css            *.styles.ts must use logical properties (inset-inline-*,
//                           margin-inline-*, text-align: start/end, ...) instead of physical
//                           left/right ones, except inside `:dir()` rules, in rule blocks that
//                           pin `direction: ltr`, or at explicitly suppressed declarations.
//   shipped-review-token    Private C-###/O-### review identifiers must not ship in source
//                           comments or package documentation; use a public technical rationale.
// Suppressions (pointercancel-pairing / rtl-arrow-keys / physical-css only): a comment on the
// flagged line, or in the contiguous comment block immediately above it, of the form
//   policy-allow(rule-id): specific reason
// Ratchets (frozen baselines in scripts/source-policy-baselines.json; new code must comply):
//   keyboard-test-coverage  A component class handles keydown but its colocated test never
//                           simulates keyboard input (sendKeys / KeyboardEvent / keydown).
//   strings-test-coverage   A component class calls this.localize() but its colocated test
//                           references neither `.strings` nor `registerLyraLocale`. Enrolled
//                           components additionally prove each literal localize key reaches
//                           rendered text, a relevant attribute, or validationMessage in the
//                           same test instead of merely mentioning a catalog/key.
// Only offenders missing from the baseline fail the check; a baselined file that becomes clean
// is reported as a note so the baseline can shrink. `--list-baselines` prints the counts.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'oxc-parser';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(packageDir, 'src');
const componentsRoot = path.join(packageDir, 'src', 'components');
const internalRoot = path.join(packageDir, 'src', 'internal');
const baselinePath = path.join(packageDir, 'scripts', 'source-policy-baselines.json');

const RATCHET_RULES = ['keyboard-test-coverage', 'strings-test-coverage'];
const STRUCTURAL_STRINGS_TEST_FILES = new Set([
  'src/components/forms/locale-picker/locale-picker.class.ts',
]);

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

/** Literal NUL bytes are never valid source text, even when JavaScript accepts them in a string. */
export function findNulByteLines(source) {
  return [...new Set(Array.from(source.matchAll(/\0/gu), (match) => lineOf(source, match.index)))];
}

/**
 * Double-quoted string literals outside template literals/comments, whose content has no
 * embedded single quote (so converting is never an escaping trade-off). This codebase's own
 * convention is single quotes; a stray double-quoted literal is the fingerprint of a source file
 * run through a different formatter's defaults. It is not just cosmetic: a double-quoted literal
 * in a public member's type/default text is printed verbatim into custom-elements.json and the
 * check:pinned-upstream-manifests comparison, so it silently reclassifies an otherwise-identical
 * upstream mapping as a release-blocking surface drift (see docs/agents/coding-conventions.md).
 */
export function findDoubleQuotedStringLiterals(source) {
  const findings = [];
  let state = 'code';
  const templateStack = [];
  let start = -1;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    const pair = source.slice(i, i + 2);
    if (state === 'code') {
      if (pair === '//') state = 'line';
      else if (pair === '/*') state = 'block';
      else if (c === "'") state = 'single';
      else if (c === '"') { state = 'double'; start = i + 1; }
      else if (c === '`') state = 'template';
      else if (c === '{' && templateStack.length > 0) templateStack[templateStack.length - 1]++;
      else if (c === '}' && templateStack.length > 0) {
        if (--templateStack[templateStack.length - 1] === 0) { templateStack.pop(); state = 'template'; }
      }
    } else if (state === 'line') {
      if (c === '\n') state = 'code';
    } else if (state === 'block') {
      if (pair === '*/') { state = 'code'; i++; }
    } else if (state === 'single') {
      if (c === '\\') i++;
      else if (c === "'") state = 'code';
    } else if (state === 'double') {
      if (c === '\\') { i++; continue; }
      if (c === "'") continue;
      if (c === '"') {
        const content = source.slice(start, i);
        if (!content.includes("'")) findings.push(lineOf(source, start));
        state = 'code';
      }
    } else if (state === 'template') {
      if (c === '\\') i++;
      else if (pair === '${') { templateStack.push(1); state = 'code'; i++; }
      else if (c === '`') state = 'code';
    }
  }
  return [...new Set(findings)];
}

/** Private review identifiers are not useful to package consumers and disclose internal process. */
export function findOpaqueReviewTokens(source) {
  return Array.from(source.matchAll(/\b(?:C|O)-\d{3}\b/gu), (match) => ({
    line: lineOf(source, match.index),
    token: match[0],
  }));
}

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
  // `LyraMessage` since 8.0.0 (a plain string OR a plural-category object); `string` is still
  // accepted so this rule keeps working if the value type is ever narrowed back.
  const match = source.match(/const DEFAULT_STRINGS: Record<LyraMessageKey, (?:string|LyraMessage)> = \{([\s\S]*?)\n\};/);
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
// Rule 3: unsafe-intl-locale
// ---------------------------------------------------------------------------

const LOCALE_SENSITIVE_METHOD = /\.(toLocale[A-Za-z]*|localeCompare)\s*\(/g;

function safeConstInitializer(identifier, source, beforeIndex) {
  const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const declaration = new RegExp(
    `\\bconst\\s+${escaped}(?:\\s*:[^=;\\n]+)?\\s*=\\s*([^;\\n]+)`,
    'gu',
  );
  let initializer;
  let initializerIndex = -1;
  for (const match of source.matchAll(declaration)) {
    if (match.index >= beforeIndex) break;
    initializer = match[1];
    initializerIndex = match.index;
  }
  return initializer === undefined ? undefined : { initializer, initializerIndex };
}

/**
 * Positive proof that one locale expression crossed the safe Intl boundary. An arbitrary variable
 * name is never evidence by itself: a local identifier is accepted only when its nearest preceding
 * `const` initializer is itself provably safe.
 */
function isSafeDirectLocale(expression, source, beforeIndex, seen = new Set()) {
  if (expression === undefined) return false;
  let locale = expression.trim();
  while (locale.startsWith('(') && locale.endsWith(')')) locale = locale.slice(1, -1).trim();
  if (/^this\s*\.\s*(?:effectiveLocale|effectiveIntlLocale)$/u.test(locale)) return true;
  if (/^resolveIntlLocale\s*\([\s\S]*\)$/u.test(locale)) return true;

  const fallback = locale.match(/^([\s\S]+?)\s*(?:\|\||\?\?)\s*undefined$/u);
  if (fallback) return isSafeDirectLocale(fallback[1], source, beforeIndex, seen);

  if (!/^[A-Za-z_$][\w$]*$/u.test(locale) || seen.has(locale)) return false;
  const declaration = safeConstInitializer(locale, source, beforeIndex);
  if (!declaration) return false;
  seen.add(locale);
  return isSafeDirectLocale(
    declaration.initializer,
    source,
    declaration.initializerIndex,
    seen,
  );
}

/** Pure classification seam used by the checker's unit tests. */
export function isSafeIntlLocaleExpression(
  expression,
  { source = '', beforeIndex = source.length } = {},
) {
  return isSafeDirectLocale(expression, source, beforeIndex);
}

function assertUnsafeIntlLocaleRule() {
  const source = `
    const safeAlias = this.effectiveLocale;
    const safeResolved = resolveIntlLocale(rawLocale);
  `;
  for (const expression of [
    'this.effectiveLocale',
    'this.effectiveIntlLocale',
    'resolveIntlLocale(rawLocale)',
    'safeAlias',
    'safeResolved',
  ]) {
    if (!isSafeDirectLocale(expression, source, source.length)) {
      throw new Error(`unsafe-intl-locale self-test rejected safe expression: ${expression}`);
    }
  }
  for (const expression of [
    undefined,
    '',
    'undefined',
    'null',
    "'en'",
    'this.locale',
    'resolveLyraLocale(this)',
    'getLyraLocale()',
    'rawLocale',
    // Even a reassuring name is not proof without a safe initializer.
    'effectiveLocale',
  ]) {
    if (isSafeDirectLocale(expression, source, source.length)) {
      throw new Error(`unsafe-intl-locale self-test accepted unsafe expression: ${String(expression)}`);
    }
  }
}

function checkUnsafeIntlLocale(file, stripped, findings) {
  for (const match of stripped.matchAll(LOCALE_SENSITIVE_METHOD)) {
    const args = splitTopLevelArgs(balancedArgText(stripped, match.index + match[0].length));
    const localeArg = match[1] === 'localeCompare' ? args[1] : args[0];
    if (isSafeDirectLocale(localeArg, stripped, match.index)) continue;
    findings.push(
      `${rel(file)}:${lineOf(stripped, match.index)} [unsafe-intl-locale] .${match[1]}() must receive ` +
        `this.effectiveLocale/effectiveIntlLocale or a locale derived from resolveIntlLocale(); ` +
        `do not use the runtime default, a hardcoded tag, this.locale, or resolveLyraLocale() directly`,
    );
  }
}

// ---------------------------------------------------------------------------
// Rule 4: pointercancel-pairing
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
// Rule 5: rtl-arrow-keys
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
// Rule 6: shadow-live-region
// ---------------------------------------------------------------------------

/**
 * Returns active live-region attributes written as markup in a component source file. Comments
 * are blanked first, so public JSDoc may describe the semantics without tripping the runtime rule.
 * Host `setAttribute()` calls are intentionally outside this syntax: the host lives in the
 * consumer's light DOM. `aria-live="off"` is also allowed to suppress a nested region.
 */
export function findShadowLiveRegionMarkup(source) {
  const stripped = stripJsComments(source);
  const findings = [];
  const pattern = /\b(role|aria-live)\s*=\s*(['"])(status|alert|polite|assertive)\2/g;

  for (const match of stripped.matchAll(pattern)) {
    const attribute = match[1];
    const value = match[3];
    if (attribute === 'role' ? value !== 'status' && value !== 'alert' : value !== 'polite' && value !== 'assertive') {
      continue;
    }
    findings.push({ attribute, line: lineOf(stripped, match.index), value });
  }

  return findings;
}

/**
 * Finds nested components whose default host semantics would create a live region inside their
 * parent's shadow root. Skeleton is true-defaulting, so attribute omission and `aria-hidden` do
 * not disable its host `role="status"`; callers must use a property binding.
 */
export function findImplicitShadowLiveComponents(source) {
  const stripped = stripJsComments(source);
  const findings = [];
  const skeleton = /<lr-skeleton\b([^>]*)>/gs;

  for (const match of stripped.matchAll(skeleton)) {
    if (/\.announce\s*=\s*\$\{\s*false\s*\}/u.test(match[1])) continue;
    findings.push({ line: lineOf(stripped, match.index), tag: 'lr-skeleton' });
  }

  return findings;
}

function checkShadowLiveRegion(file, source, findings) {
  for (const match of findShadowLiveRegionMarkup(source)) {
    findings.push(
      `${rel(file)}:${match.line} [shadow-live-region] ${match.attribute}="${match.value}" is rendered ` +
        `inside the component shadow root, where announcements are unreliable; route state changes through ` +
        'acquireAnnouncementSink() in src/internal/announcer.ts, or put host semantics on the light-DOM custom element',
    );
  }
  for (const match of findImplicitShadowLiveComponents(source)) {
    findings.push(
      `${rel(file)}:${match.line} [shadow-live-region] nested <${match.tag}> uses its default host ` +
        'role="status" inside the parent shadow root; bind .announce=${false} and keep any needed ' +
        'loading label as ordinary non-live parent content',
    );
  }
}

// ---------------------------------------------------------------------------
// Rule 7: announcement-source
// ---------------------------------------------------------------------------

/** Returns the closing parenthesis for a call whose opening parenthesis is at `openingIndex`. */
function findCallEnd(source, openingIndex) {
  let depth = 1;
  let quote = '';
  for (let index = openingIndex + 1; index < source.length; index++) {
    const character = source[index];
    if (quote) {
      if (character === '\\') index++;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      continue;
    }
    if (character === '(') depth++;
    else if (character === ')' && --depth === 0) return index;
  }
  return -1;
}

/** Splits a call's arguments without treating nested object/array/call commas as separators. */
function splitTopLevelArguments(source) {
  const argumentsFound = [];
  let start = 0;
  let braces = 0;
  let brackets = 0;
  let parentheses = 0;
  let quote = '';
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (quote) {
      if (character === '\\') index++;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') braces++;
    else if (character === '}') braces--;
    else if (character === '[') brackets++;
    else if (character === ']') brackets--;
    else if (character === '(') parentheses++;
    else if (character === ')') parentheses--;
    else if (character === ',' && braces === 0 && brackets === 0 && parentheses === 0) {
      argumentsFound.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }
  argumentsFound.push(source.slice(start).trim());
  return argumentsFound;
}

/** Proves that an inline options object owns the requested top-level property. */
function hasTopLevelObjectProperty(argument, propertyName) {
  const source = argument.trim();
  if (!source.startsWith('{')) return false;
  let braces = 0;
  let brackets = 0;
  let parentheses = 0;
  let quote = '';
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (quote) {
      if (character === '\\') index++;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') braces++;
    else if (character === '}') braces--;
    else if (character === '[') brackets++;
    else if (character === ']') brackets--;
    else if (character === '(') parentheses++;
    else if (character === ')') parentheses--;

    if (
      braces === 1 &&
      brackets === 0 &&
      parentheses === 0 &&
      source.startsWith(propertyName, index) &&
      !/[\w$]/u.test(source[index - 1] ?? '') &&
      !/[\w$]/u.test(source[index + propertyName.length] ?? '')
    ) {
      let previous = index - 1;
      while (previous >= 0 && /\s/u.test(source[previous])) previous--;
      let next = index + propertyName.length;
      while (next < source.length && /\s/u.test(source[next])) next++;
      if ((source[previous] === '{' || source[previous] === ',') && /[:,}]/u.test(source[next] ?? '')) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Finds component/controller sink acquisitions that cannot be statically proven to bind both the
 * owner document and producing element. Low-level callers outside the component/internal source
 * trees remain free to omit them; this policy guards every shipped producer that announces for a
 * user-facing component.
 */
export function findUnboundAnnouncementSinks(source) {
  const stripped = stripJsComments(source);
  const findings = [];
  const pattern = /\bacquireAnnouncementSink\s*\(/gu;
  for (const match of stripped.matchAll(pattern)) {
    const openingIndex = stripped.indexOf('(', match.index);
    const closingIndex = findCallEnd(stripped, openingIndex);
    if (closingIndex < 0) {
      findings.push({ line: lineOf(stripped, match.index), reason: 'unterminated call' });
      continue;
    }
    const argumentsFound = splitTopLevelArguments(stripped.slice(openingIndex + 1, closingIndex));
    const options = argumentsFound[1] ?? '';
    const missing = ['document', 'source'].filter(
      (propertyName) => !hasTopLevelObjectProperty(options, propertyName),
    );
    if (missing.length > 0) {
      findings.push({
        line: lineOf(stripped, match.index),
        reason: `missing inline ${missing.join(' and ')} option${missing.length === 1 ? '' : 's'}`,
      });
    }
  }
  return findings;
}

function checkAnnouncementSource(file, source, findings) {
  for (const match of findUnboundAnnouncementSinks(source)) {
    findings.push(
      `${rel(file)}:${match.line} [announcement-source] acquireAnnouncementSink() ${match.reason}; ` +
        'pass an inline { document: ..., source: <producing element> } options object so hidden, inert, ' +
        'and adopted sources cannot write to an active or stale document live region',
    );
  }
}

/**
 * Returns each Announcer construction when the containing component cannot prove it rebinds the
 * timer host through `ownerDocument.defaultView`. One binding can serve repeated constructions in
 * the same class module; runtime tests still prove connection/adoption timing.
 */
export function findUnboundAnnouncerTimerHosts(source) {
  const stripped = stripJsComments(source);
  const constructions = Array.from(stripped.matchAll(/\bnew\s+Announcer\s*\(/gu));
  if (constructions.length === 0) return [];
  if (/\.setTimerHost\s*\(/u.test(stripped) && /this\.ownerDocument\.defaultView/u.test(stripped)) {
    return [];
  }
  return constructions.map((match) => ({ line: lineOf(stripped, match.index) }));
}

function checkAnnouncerTimerRealm(file, source, findings) {
  for (const match of findUnboundAnnouncerTimerHosts(source)) {
    findings.push(
      `${rel(file)}:${match.line} [announcer-timer-realm] components constructing Announcer must ` +
        'bind its timer host to this.ownerDocument.defaultView on connection/adoption',
    );
  }
}

// ---------------------------------------------------------------------------
// Rule 9: physical-css
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

function checkPhysicalCss(file, rawSource, findings) {
  const rawLines = rawSource.split('\n');
  const stripped = stripCssComments(rawSource);
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

function parseSyntaxProgram(source, file) {
  const parsed = parseSync(file, source);
  if (parsed.errors.length === 0) return parsed.program;
  const detail = parsed.errors
    .slice(0, 3)
    .map((error) => error.message)
    .join('; ');
  throw new Error(rel(file) + ': source-policy parser failed: ' + detail);
}

/** Removes transparent TypeScript and parenthesis wrappers without reading source text. */
function unwrapSyntaxExpression(node) {
  let expression = node;
  while (
    expression &&
    [
      'ChainExpression',
      'ParenthesizedExpression',
      'TSAsExpression',
      'TSInstantiationExpression',
      'TSNonNullExpression',
      'TSTypeAssertion',
    ].includes(expression.type)
  ) {
    expression = expression.expression;
  }
  return expression;
}

function unwrapAwaitedExpression(node) {
  let expression = unwrapSyntaxExpression(node);
  while (expression?.type === 'AwaitExpression') expression = unwrapSyntaxExpression(expression.argument);
  return expression;
}

function syntaxIdentifierName(node) {
  const expression = unwrapSyntaxExpression(node);
  return expression?.type === 'Identifier' ? expression.name : undefined;
}

function syntaxMemberName(node) {
  const expression = unwrapSyntaxExpression(node);
  if (expression?.type !== 'MemberExpression') return undefined;
  if (!expression.computed && expression.property?.type === 'Identifier') return expression.property.name;
  if (expression.computed && expression.property?.type === 'Literal' && typeof expression.property.value === 'string')
    return expression.property.value;
  return undefined;
}

function syntaxStaticString(node) {
  const expression = unwrapSyntaxExpression(node);
  return expression?.type === 'Literal' && typeof expression.value === 'string'
    ? expression.value
    : undefined;
}

/** Visits ESTree-compatible parser nodes, including TypeScript extensions. */
function visitSyntaxNodes(node, visitor) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visitor(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent' || key === 'type' || key === 'start' || key === 'end') continue;
    if (Array.isArray(value)) {
      for (const child of value) visitSyntaxNodes(child, visitor);
    } else if (value && typeof value === 'object') visitSyntaxNodes(value, visitor);
  }
}

/** Literal `this.localize(key)` calls in executable code only. Parsing, rather than a regex over
 * source text, intentionally excludes comments, strings, and static template text that merely
 * mention a localization call. */
function literalLocalizeCalls(source, file) {
  const program = parseSyntaxProgram(source, file);
  const calls = [];
  const seen = new Set();
  visitSyntaxNodes(program, (node) => {
    if (node.type !== 'CallExpression') return;
    const callee = node.callee;
    if (
      callee?.type !== 'MemberExpression' ||
      callee.computed ||
      callee.object?.type !== 'ThisExpression' ||
      callee.property?.type !== 'Identifier' ||
      callee.property.name !== 'localize'
    ) return;
    const argument = node.arguments?.[0];
    if (
      argument?.type !== 'Literal' ||
      typeof argument.value !== 'string' ||
      !/^[A-Za-z0-9_]+$/u.test(argument.value) ||
      seen.has(argument.value)
    ) return;
    seen.add(argument.value);
    calls.push({ key: argument.value, index: node.start ?? 0 });
  });
  calls.sort((a, b) => a.index - b.index);
  return calls;
}

function isFunctionLike(node) {
  return node?.type === 'ArrowFunctionExpression' ||
    node?.type === 'FunctionExpression' ||
    node?.type === 'FunctionDeclaration';
}

function calleeRootName(callee) {
  const expression = unwrapSyntaxExpression(callee);
  if (expression?.type === 'CallExpression') return calleeRootName(expression.callee);
  if (expression?.type === 'MemberExpression') return calleeRootName(expression.object);
  return syntaxIdentifierName(expression);
}

function testCallbacks(source, file) {
  const callbacks = [];
  visitSyntaxNodes(parseSyntaxProgram(source, file), (node) => {
    if (node.type !== 'CallExpression' || !['it', 'test'].includes(calleeRootName(node.callee))) return;
    const callback = [...node.arguments].reverse().find(isFunctionLike);
    if (callback) callbacks.push(callback);
  });
  return callbacks;
}

/** Walks executable nodes of one test callback without treating nested function bodies as setup. */
function visitTestCallbackCode(node, visitor, root = true) {
  if (!node || typeof node !== 'object') return;
  if (!root && isFunctionLike(node)) return;
  if (typeof node.type === 'string') visitor(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent' || key === 'type' || key === 'start' || key === 'end') continue;
    if (Array.isArray(value)) {
      for (const child of value) visitTestCallbackCode(child, visitor, false);
    } else if (value && typeof value === 'object') {
      visitTestCallbackCode(value, visitor, false);
    }
  }
}

function isLocalePickerMarkupTemplate(node) {
  const expression = unwrapSyntaxExpression(node);
  if (expression?.type !== 'TaggedTemplateExpression') return false;
  const tag = syntaxIdentifierName(expression.tag) ?? syntaxMemberName(expression.tag);
  if (tag !== 'html' && tag !== 'staticHtml') return false;
  return expression.quasi?.quasis?.some((quasi) =>
    /<lr-locale-picker\b/u.test(quasi.value?.raw ?? quasi.value?.cooked ?? ''));
}

function containsLocalePickerMarkup(node) {
  let found = false;
  visitSyntaxNodes(node, (candidate) => {
    if (!found && isLocalePickerMarkupTemplate(candidate)) found = true;
  });
  return found;
}

function isLocalePickerControlInitializer(initializer) {
  const expression = unwrapAwaitedExpression(initializer);
  if (expression?.type !== 'CallExpression') return false;
  if (syntaxIdentifierName(expression.callee) === 'fixture')
    return expression.arguments.some((argument) => containsLocalePickerMarkup(argument));

  const callee = unwrapSyntaxExpression(expression.callee);
  const method = syntaxMemberName(callee);
  const argument = syntaxStaticString(expression.arguments[0]);
  if (
    method === 'createElement' &&
    syntaxIdentifierName(callee?.object) === 'document' &&
    argument === 'lr-locale-picker'
  ) return true;
  if (method === 'querySelector' && argument?.includes('lr-locale-picker')) return true;

  const typeAnnotation = initializer?.type === 'TSAsExpression' || initializer?.type === 'TSTypeAssertion'
    ? initializer.typeAnnotation
    : undefined;
  return (
    method === 'querySelector' &&
    typeAnnotation?.type === 'TSTypeReference' &&
    syntaxIdentifierName(typeAnnotation.typeName) === 'LyraLocalePicker'
  );
}

function localePickerControlNames(nodes) {
  const controls = new Set();
  for (const node of nodes) {
    if (node.type !== 'VariableDeclarator' || node.id?.type !== 'Identifier') continue;
    if (isLocalePickerControlInitializer(node.init)) controls.add(node.id.name);
  }
  return controls;
}

function objectPropertyName(property) {
  if (property?.type !== 'Property') return undefined;
  if (!property.computed && property.key?.type === 'Identifier') return property.key.name;
  return syntaxStaticString(property.key);
}

function localizedObjectValues(expression, key) {
  const object = unwrapSyntaxExpression(expression);
  if (object?.type !== 'ObjectExpression') return [];
  const values = [];
  for (const property of object.properties) {
    if (objectPropertyName(property) !== key) continue;
    const value = syntaxStaticString(property.value);
    if (value !== undefined) values.push(value);
  }
  return values;
}

function assignmentDetails(node) {
  if (node?.type !== 'AssignmentExpression' || node.operator !== '=') return undefined;
  const left = unwrapSyntaxExpression(node.left);
  if (left?.type !== 'MemberExpression') return undefined;
  const control = syntaxIdentifierName(left.object);
  const member = syntaxMemberName(left);
  return control === undefined || member === undefined ? undefined : { control, member, right: node.right };
}

function isNamedCall(node, name) {
  const expression = unwrapSyntaxExpression(node);
  return expression?.type === 'CallExpression' && syntaxIdentifierName(expression.callee) === name;
}

function pickerControlForDomExpression(expression) {
  const node = unwrapSyntaxExpression(expression);
  if (node?.type === 'CallExpression') {
    if (syntaxIdentifierName(node.callee) === 'trigger') return syntaxIdentifierName(node.arguments[0]);
    const callee = unwrapSyntaxExpression(node.callee);
    if (['getElementById', 'querySelector', 'querySelectorAll'].includes(syntaxMemberName(callee)))
      return pickerControlForDomExpression(callee.object);
    return undefined;
  }
  if (node?.type !== 'MemberExpression') return undefined;
  if (['renderRoot', 'shadowRoot'].includes(syntaxMemberName(node)))
    return syntaxIdentifierName(node.object);
  return pickerControlForDomExpression(node.object);
}

function outputControlForExpression(expression) {
  const node = unwrapSyntaxExpression(expression);
  if (node?.type === 'MemberExpression') {
    const member = syntaxMemberName(node);
    if (member === 'validationMessage') return syntaxIdentifierName(node.object);
    if (['innerHTML', 'innerText', 'textContent'].includes(member))
      return pickerControlForDomExpression(node.object);
    return undefined;
  }
  if (node?.type !== 'CallExpression') return undefined;
  const callee = unwrapSyntaxExpression(node.callee);
  if (syntaxMemberName(callee) !== 'getAttribute') return undefined;
  const attribute = syntaxStaticString(node.arguments[0]);
  if (
    attribute === undefined ||
    !(/^(?:aria-[A-Za-z0-9_-]+|alt|placeholder|title|value)$/u.test(attribute))
  ) return undefined;
  return pickerControlForDomExpression(callee.object);
}

function expectAssertion(node) {
  if (node?.type !== 'CallExpression') return undefined;
  if (!['contain', 'equal', 'equals', 'include', 'match'].includes(syntaxMemberName(node.callee)))
    return undefined;
  const expected = syntaxStaticString(node.arguments[0]);
  if (expected === undefined) return undefined;
  const chain = unwrapSyntaxExpression(node.callee?.object);
  if (syntaxMemberName(chain) !== 'to') return undefined;
  const expectation = unwrapSyntaxExpression(chain.object);
  if (!isNamedCall(expectation, 'expect')) return undefined;
  return { actual: expectation.arguments[0], expected };
}

function testCallbackCoversLocalizedKey(callback, key) {
  const nodes = [];
  visitTestCallbackCode(callback, (node) => nodes.push(node));
  const controls = localePickerControlNames(nodes);
  const configured = new Set();
  const localeAssignments = [];
  const catalogs = [];

  for (const node of nodes) {
    const assignment = assignmentDetails(node);
    if (assignment && controls.has(assignment.control)) {
      if (assignment.member === 'strings') {
        for (const value of localizedObjectValues(assignment.right, key))
          configured.add(assignment.control + '\u0000' + value);
      } else if (assignment.member === 'lang' || assignment.member === 'locale') {
        const locale = syntaxStaticString(assignment.right);
        if (locale !== undefined) localeAssignments.push({ control: assignment.control, locale });
      }
    }

    if (!isNamedCall(node, 'registerLyraLocale')) continue;
    const locale = syntaxStaticString(node.arguments[0]);
    const values = localizedObjectValues(node.arguments[1], key);
    if (locale !== undefined && values.length > 0) catalogs.push({ locale, values });
  }

  for (const catalog of catalogs) {
    for (const assignment of localeAssignments) {
      if (assignment.locale !== catalog.locale) continue;
      for (const value of catalog.values) configured.add(assignment.control + '\u0000' + value);
    }
  }

  for (const node of nodes) {
    const assertion = expectAssertion(node);
    if (!assertion) continue;
    const control = outputControlForExpression(assertion.actual);
    if (control !== undefined && configured.has(control + '\u0000' + assertion.expected)) return true;
  }
  return false;
}

function findLocalizedOutputCoverageFindings(file, source, testSource) {
  const callbacks = testCallbacks(testSource, file);
  const findings = [];
  for (const { key, index } of literalLocalizeCalls(source, file)) {
    const covered = callbacks.some((callback) => testCallbackCoversLocalizedKey(callback, key));
    if (covered) continue;
    findings.push(
      `${rel(file)}:${lineOf(source, index)} [strings-test-coverage] '${key}' must be assigned through ` +
        '`.strings` or an applied registerLyraLocale() catalog and asserted as rendered text, a relevant attribute, or validationMessage in the same test',
    );
  }
  return findings;
}

/**
 * Runs the per-file source rules through one shared routing seam. Keeping component and internal
 * callers on this function prevents shared helpers from silently receiving a smaller policy set.
 * The two exclusions are low-level implementation boundaries, not directory-wide exemptions:
 * intl-cache.ts constructs the cached Intl formatters, and announcer.ts implements the sink API.
 */
export function collectSourcePolicyFindings({
  file,
  source,
  knownKeys = new Set(),
  skipIntlOutsideCache = false,
  skipAnnouncementSource = false,
  testSource,
}) {
  const findings = [];
  const rawLines = source.split('\n');
  if (file.endsWith('.styles.ts')) {
    checkPhysicalCss(file, source, findings);
    return findings;
  }

  const stripped = stripJsComments(source);
  checkLocalizeFallback(file, stripped, knownKeys, findings);
  if (!skipIntlOutsideCache) checkIntlOutsideCache(file, stripped, findings);
  checkUnsafeIntlLocale(file, stripped, findings);
  checkPointercancelPairing(file, stripped, rawLines, findings);
  checkRtlArrowKeys(file, stripped, rawLines, findings);
  checkShadowLiveRegion(file, source, findings);
  if (!skipAnnouncementSource) checkAnnouncementSource(file, source, findings);
  if (file.endsWith('.class.ts')) checkAnnouncerTimerRealm(file, source, findings);
  if (testSource !== undefined)
    findings.push(...findLocalizedOutputCoverageFindings(file, source, testSource));
  return findings;
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

export function runSourcePolicy() {
  const baselines = loadBaselines();

  assertUnsafeIntlLocaleRule();

  if (process.argv.includes('--list-baselines')) {
    for (const rule of RATCHET_RULES) console.log(`${rule}: ${baselines[rule].length} baselined file(s)`);
    return;
  }

  const knownKeys = defaultStringKeys();
  const componentTreeFiles = walk(componentsRoot);
  const internalTreeFiles = walk(internalRoot);
  const componentFiles = componentTreeFiles.filter(isSource).sort();
  const allInternalFiles = internalTreeFiles.filter(isSource).sort();
  const findings = [];
  const notes = [];
  const strippedByFile = new Map();

  const shippedSourceFiles = walk(sourceRoot).filter(
    (file) =>
      (file.endsWith('.ts') || file.endsWith('.css')) &&
      !file.endsWith('.test.ts') &&
      !file.endsWith('.stories.ts') &&
      !file.endsWith('.d.ts'),
  );
  const packageDocs = [
    path.join(packageDir, 'README.md'),
    path.join(packageDir, 'CHANGELOG.md'),
    ...walk(path.join(packageDir, 'llms')).filter((file) => file.endsWith('.md')),
    path.join(packageDir, 'llms.txt'),
    path.join(packageDir, 'llms-full.txt'),
  ].filter((file) => fs.existsSync(file));
  for (const file of [...shippedSourceFiles, ...packageDocs]) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of findOpaqueReviewTokens(source)) {
      findings.push(
        `${rel(file)}:${match.line} [shipped-review-token] replace private ${match.token} bookkeeping ` +
          'with a public technical rationale',
      );
    }
  }

  for (const file of [...componentTreeFiles, ...internalTreeFiles].filter((candidate) => candidate.endsWith('.ts'))) {
    const source = fs.readFileSync(file, 'utf8');
    for (const line of findNulByteLines(source)) {
      findings.push(
        `${rel(file)}:${line} [nul-byte] literal NUL makes source tooling treat this text file as ` +
          'binary; use an escaped source spelling such as \\u0000 for an intentional delimiter',
      );
    }
  }

  for (const file of [...componentTreeFiles, ...internalTreeFiles].filter(isSource)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const line of findDoubleQuotedStringLiterals(source)) {
      findings.push(
        `${rel(file)}:${line} [double-quoted-literal] this codebase uses single-quoted string ` +
          'literals; a public member\'s printed type/default text feeds check:pinned-upstream-manifests ' +
          'verbatim, so a stray double quote silently desyncs an otherwise-identical upstream mapping',
      );
    }
  }

  for (const file of [...componentFiles, ...allInternalFiles]) {
    const source = fs.readFileSync(file, 'utf8');
    strippedByFile.set(file, stripJsComments(source));
  }

  for (const file of componentFiles) {
    const rawSource = fs.readFileSync(file, 'utf8');
    const testSource = STRUCTURAL_STRINGS_TEST_FILES.has(rel(file)) ? colocatedTestSource(file) : undefined;
    findings.push(...collectSourcePolicyFindings({ file, source: rawSource, knownKeys, testSource }));
  }

  for (const file of allInternalFiles) {
    findings.push(
      ...collectSourcePolicyFindings({
        file,
        source: fs.readFileSync(file, 'utf8'),
        knownKeys,
        skipIntlOutsideCache: path.basename(file) === 'intl-cache.ts',
        skipAnnouncementSource: path.basename(file) === 'announcer.ts',
      })
    );
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
      `Source policy passed for ${componentFiles.length + allInternalFiles.length} source files ` +
        `(baselines: ${RATCHET_RULES.map((rule) => `${baselines[rule].length} ${rule}`).join(', ')})`,
    );
  }
}

if (isMainModule(import.meta.url)) runSourcePolicy();
