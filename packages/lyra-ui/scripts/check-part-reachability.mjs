// Part-reachability checker: two static rules over src/components that catch `::part()`-related
// CSS which parses fine, ships fine, and never matches anything. Both classes of bug are invisible
// to tsc, to the style policy, and to any test that inspects stylesheet *text* rather than the
// rendered result.
//
//   cross-root-part   A component whose template mounts `<lr-virtual-list>` and hands it a
//                     `renderItem`/`renderGroup` callback emits its row markup into
//                     *lr-virtual-list's own shadow root* (lit commits the callback's return value
//                     wherever virtual-list is rendering). A bare `[part='x']` selector in the
//                     composing component's stylesheet is scoped to that component's shadow root,
//                     so it can never match such a node. The reachable form is
//                     `lr-virtual-list::part(x)` (plus an `exportparts` entry so consumers can
//                     reach it too).
//   part-compound     Per Selectors L4 a pseudo-element may only be followed by pseudo-classes (and
//                     certain pseudo-elements). `::part(a)[attr]`, `::part(a).cls` and
//                     `::part(a) .descendant` therefore parse but never match --
//                     `CSS.supports('selector(x::part(a)[data-b])')` is false. `::part(a):hover`,
//                     `::part(a)::selection` and the part-list form `::part(a b)` are all fine.
//
// Deliberately conservative -- a false positive costs a contributor a noisy suppression, which is
// worse than slightly narrow coverage:
//   * cross-root-part only fires when the styles file has *no* `::part(<name>)` rule for that name
//     anywhere. Components that legitimately render the same part into both their own shadow root
//     (below a virtualization threshold, or for a directly-rendered header row) and into
//     lr-virtual-list's carry both selectors, and are silently correct by construction. See
//     `retrieval/ingestion-queue/ingestion-queue.styles.ts` for the canonical dual-path pairing and
//     `viewers/csv-viewer` for the header-row variant.
//   * Only *literal* part names are collected -- the static words of `part="..."` and the string
//     literals of a bound `part=${...}` -- so a name assembled at runtime is simply not known to
//     this check. It would rather miss one than invent a name a stylesheet coincidentally mentions.
//   * part-compound scans `*.styles.ts` only -- the stylesheet corpus. It is exact and needs no
//     allowlist, because the pattern is never correct.
//
// Fixtures for both rules, including the shapes that must NOT be flagged, live in
// scripts/check-part-reachability.test.mjs (run by the same chain).
//
// Suppression (cross-root-part only): a comment on the flagged line, or in the contiguous comment
// block immediately above it, of the form
//   policy-allow(cross-root-part): specific reason
//
// Run directly: `node scripts/check-part-reachability.mjs`. Wired into `pnpm run contract-policy`.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const componentsRoot = path.join(packageDir, 'src', 'components');
const internalRoot = path.join(packageDir, 'src', 'internal');

/** The virtualizing element whose shadow root swallows `renderItem` output. */
const HOST_TAG = 'lr-virtual-list';
/**
 * Bindings whose callback output is committed inside HOST_TAG's shadow root. `renderItem` is the
 * only such property today; `renderGroup` is listed so a future row-callback of that name is
 * covered from the moment it exists.
 */
const CALLBACK_PROPERTIES = ['renderItem', 'renderGroup'];

// ---------------------------------------------------------------------------
// Shared scanning helpers
// ---------------------------------------------------------------------------

/**
 * Blanks `//` and block comments (preserving newlines and byte offsets) while leaving string and
 * template-literal contents intact, so `part="row"` in markup still counts but the same text in a
 * JSDoc `@example` does not. Template `${}` holes are tracked so a brace inside one does not end
 * the template early.
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

/**
 * Same, plus the CSS comments *inside* the `css` template literal (which stripJsComments leaves
 * alone, being template content). Rules quoted in a prose comment must not be mistaken for rules,
 * and a `policy-allow` marker has to be recognizable as a comment line.
 */
function stripStyleComments(source) {
  return stripJsComments(source).replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
}

const lineOf = (source, index) => source.slice(0, index).split('\n').length;

const rel = (file) => path.relative(packageDir, file).replaceAll('\\', '/');

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return [fullPath];
  });
}

/**
 * True when the flagged line, or the contiguous comment block right above it, carries a
 * `policy-allow(ruleId):` marker. Comment lines are recognized structurally: a line with content in
 * the raw source but nothing left after comment-stripping is a pure comment line, which covers `//`
 * runs, `/* ... *\/` blocks, and the CSS comments inside a `css` template alike.
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

/**
 * Exclusive end offset of the `{ ... }` block opening at `openIndex`, tracking strings, template
 * literals and the `${}` holes inside them (a hole's closing brace must not close the block).
 */
function blockEnd(source, openIndex) {
  let depth = 0;
  let state = 'code';
  const holeDepths = [];
  for (let i = openIndex; i < source.length; i++) {
    const c = source[i];
    const pair = source.slice(i, i + 2);
    if (state === 'code') {
      if (c === "'") state = 'single';
      else if (c === '"') state = 'double';
      else if (c === '`') state = 'template';
      else if (c === '{') depth++;
      else if (c === '}') {
        if (holeDepths.length > 0 && depth === holeDepths[holeDepths.length - 1]) {
          holeDepths.pop();
          state = 'template';
        } else if (--depth === 0) return i + 1;
      }
    } else if (state === 'single' || state === 'double') {
      if (c === '\\') i++;
      else if ((state === 'single' && c === "'") || (state === 'double' && c === '"')) state = 'code';
    } else if (state === 'template') {
      if (c === '\\') i++;
      else if (pair === '${') {
        holeDepths.push(depth);
        state = 'code';
        i++;
      } else if (c === '`') state = 'code';
    }
  }
  return source.length;
}

/**
 * Walks `source` from `start` (just after a member's name), tracking bracket depth, strings and
 * template literals, and returns the exclusive end offset of that class member: the matching `}` of
 * its block body, or the top-level `;` of an expression-bodied arrow or plain field.
 */
function memberEnd(source, start) {
  let depth = 0;
  let state = 'code';
  const holeDepths = [];
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    const pair = source.slice(i, i + 2);
    if (state === 'code') {
      if (c === "'") state = 'single';
      else if (c === '"') state = 'double';
      else if (c === '`') state = 'template';
      else if (c === '(' || c === '[') depth++;
      else if (c === ')' || c === ']') depth--;
      else if (c === '{') {
        // A brace at depth 0 outside any `${}` hole opens the member's block body.
        if (depth === 0 && holeDepths.length === 0) return blockEnd(source, i);
        depth++;
      } else if (c === '}') {
        if (holeDepths.length > 0 && depth === holeDepths[holeDepths.length - 1]) {
          holeDepths.pop();
          state = 'template';
        } else if (depth === 0) return i; // end of the enclosing class body
        else depth--;
      } else if (c === ';' && depth === 0 && holeDepths.length === 0) return i + 1;
    } else if (state === 'single' || state === 'double') {
      if (c === '\\') i++;
      else if ((state === 'single' && c === "'") || (state === 'double' && c === '"')) state = 'code';
    } else if (state === 'template') {
      if (c === '\\') i++;
      else if (pair === '${') {
        holeDepths.push(depth);
        state = 'code';
        i++;
      } else if (c === '`') state = 'code';
    }
  }
  return source.length;
}

/** Source text of the class member named `name`, or undefined when it cannot be located. */
function memberSource(stripped, name) {
  const declaration = new RegExp(
    String.raw`^[ \t]*(?:(?:private|protected|public|static|readonly|override|async|accessor|get|set)\s+)*` +
      name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
      String.raw`\s*(?:[(<]|=(?!=))`,
    'm',
  );
  const match = declaration.exec(stripped);
  if (!match) return undefined;
  const nameEnd = match.index + match[0].length - 1;
  return stripped.slice(match.index, memberEnd(stripped, nameEnd));
}

/** Balanced `${ ... }` expression text starting at the `${` located at `open`. */
function bindingExpression(source, open) {
  let depth = 0;
  for (let i = open + 1; i < source.length; i++) {
    const c = source[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return source.slice(open + 2, i);
    }
  }
  return source.slice(open + 2);
}

// ---------------------------------------------------------------------------
// Rule 1: cross-root-part
// ---------------------------------------------------------------------------

const HOLE = ' ';

/** Adds each whitespace-separated word of `value`, skipping any that a `${}` hole bled into. */
function addWords(value, names) {
  for (const word of value.split(/\s+/)) if (word && !word.includes(HOLE)) names.add(word);
}

/** Adds the words of every string literal in an expression (`cond ? 'a b' : 'a'` -> a, b). */
function addLiteralWords(expression, names) {
  for (const literal of expression.matchAll(/(['"])((?:[^'"\\]|\\.)*)\1/g)) addWords(literal[2], names);
}

/**
 * Literal part names in a chunk of template source. Both attribute forms are read:
 * `part="entry-name ${isDir ? 'entry-name-dir' : ''}"` (static words plus the literals in its holes)
 * and `part=${isCurrent ? 'page page-current' : 'page'}` (the literals of the bound expression).
 * A name assembled at runtime out of non-literal pieces contributes nothing, by design -- this
 * check would rather miss one than invent a name a stylesheet might coincidentally mention.
 */
function literalPartNames(text) {
  const names = new Set();
  for (const match of text.matchAll(/(?<![\w-])part="((?:[^"\\]|\\.)*)"/g)) {
    const value = match[1];
    for (const hole of value.matchAll(/\$\{([\s\S]*?)\}/g)) addLiteralWords(hole[1], names);
    addWords(value.replace(/\$\{[\s\S]*?\}/g, HOLE), names);
  }
  for (const match of text.matchAll(/(?<![\w-])part=\$\{/g)) {
    addLiteralWords(bindingExpression(text, match.index + match[0].length - 2), names);
  }
  return names;
}

/** `this.<name>` references in a chunk of source (seed bindings), and `this.<name>(` calls. */
function thisReferences(text, callsOnly) {
  const pattern = callsOnly ? /this\.([A-Za-z_$][\w$]*)\s*\(/g : /this\.([A-Za-z_$][\w$]*)/g;
  return new Set([...text.matchAll(pattern)].map((match) => match[1]));
}

/**
 * Every part name a component renders *through* HOST_TAG: the literal `part="..."` names inside the
 * `renderItem`/`renderGroup` binding expressions, plus those in the class members those bindings
 * reach (transitively, through `this.x(` calls).
 */
export function virtualizedPartNames(classSource) {
  const stripped = stripJsComments(classSource);
  if (!stripped.includes(`<${HOST_TAG}`)) return new Set();

  const names = new Set();
  const pending = [];
  for (const property of CALLBACK_PROPERTIES) {
    const binding = new RegExp(String.raw`\.${property}\s*=\s*\$\{`, 'g');
    for (const match of stripped.matchAll(binding)) {
      const expression = bindingExpression(stripped, match.index + match[0].length - 2);
      for (const name of literalPartNames(expression)) names.add(name);
      for (const reference of thisReferences(expression, false)) pending.push(reference);
    }
  }

  const visited = new Set();
  while (pending.length > 0) {
    const member = pending.pop();
    if (visited.has(member)) continue;
    visited.add(member);
    const body = memberSource(stripped, member);
    if (!body) continue;
    for (const name of literalPartNames(body)) names.add(name);
    for (const reference of thisReferences(body, true)) if (!visited.has(reference)) pending.push(reference);
  }
  return names;
}

/** Bare `[part='x']` / `[part~="x"]` attribute selectors in a stylesheet, with 1-based line numbers. */
export function barePartSelectors(styleSource) {
  const stripped = stripStyleComments(styleSource);
  return [...stripped.matchAll(/\[\s*part\s*[~^*$|]?=\s*['"]([^'"]+)['"]\s*\]/g)].map((match) => ({
    name: match[1].trim(),
    line: lineOf(stripped, match.index),
  }));
}

/** Every part name mentioned inside a `::part( ... )` argument list in a stylesheet. */
export function reachablePartNames(styleSource) {
  const stripped = stripStyleComments(styleSource);
  const names = new Set();
  for (const match of stripped.matchAll(/::part\(([^)]*)\)/g)) {
    for (const word of match[1].trim().split(/\s+/)) if (word) names.add(word);
  }
  return names;
}

/**
 * Findings for one component: part names rendered through HOST_TAG that the component's own
 * stylesheet only reaches with a bare `[part]` selector.
 */
export function checkCrossRootParts(classFile, classSource, styleFile, styleSource) {
  const rendered = virtualizedPartNames(classSource);
  if (rendered.size === 0) return [];
  const reachable = reachablePartNames(styleSource);
  const rawLines = styleSource.split('\n');
  const strippedLines = stripStyleComments(styleSource).split('\n');
  const findings = [];
  // Reported per occurrence, not per part name: each dead rule needs rewriting, and a suppression
  // must only ever cover the one selector it sits above.
  for (const { name, line } of barePartSelectors(styleSource)) {
    if (!rendered.has(name) || reachable.has(name)) continue;
    if (isSuppressed(rawLines, strippedLines, line, 'cross-root-part')) continue;
    findings.push(
      `${rel(styleFile)}:${line} [cross-root-part] part '${name}' is rendered through <${HOST_TAG}> ` +
        `(${path.basename(classFile)}), so it lives in that element's shadow root and this bare ` +
        `[part='${name}'] selector can never match -- use ${HOST_TAG}::part(${name}) (and export the ` +
        `part), keep the bare selector too only if a non-virtualized path renders it, or add a ` +
        `policy-allow(cross-root-part) suppression`,
    );
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Rule 2: part-compound
// ---------------------------------------------------------------------------

/**
 * Findings for `::part(x)` followed by anything a pseudo-element may not be followed by: an
 * attribute selector, a class or id, or any combinator (descendant, `>`, `+`, `~`). Pseudo-classes
 * and pseudo-elements attached directly to the `)` are valid and pass.
 */
export function checkPartCompounds(file, styleSource) {
  const stripped = stripStyleComments(styleSource);
  const findings = [];
  for (const match of stripped.matchAll(/::part\([^)]*\)/g)) {
    const after = stripped.slice(match.index + match[0].length);
    const line = lineOf(stripped, match.index);
    const gap = /^\s*/.exec(after)[0];
    const next = after.slice(gap.length)[0];
    let reason;
    if (gap.length === 0 && after[0] === '[')
      reason =
        'an attribute selector -- encode the state in the part name (part="x x-state") and select ' +
        '::part(x-state), or pass the state in as an inline custom property';
    else if (gap.length === 0 && after[0] === '.')
      reason = 'a class selector -- a class inside another shadow root is not selectable; give the element its own part name';
    else if (gap.length === 0 && after[0] === '#')
      reason = 'an id selector -- an id inside another shadow root is not selectable; give the element its own part name';
    else if (gap.length > 0 && next !== undefined && '>+~'.includes(next))
      reason = 'a combinator -- ::part() matches a single element and cannot reach its subtree or siblings; give the target its own part name';
    // A gap followed by the start of another compound selector is a descendant combinator. Anything
    // that ends or continues the *same* selector (`{`, `,`, `)`, a closing template backtick, a `$`
    // interpolation whose content is unknown) is fine, as is a pseudo attached with no gap at all.
    else if (gap.length > 0 && next !== undefined && !'{,)`$;'.includes(next))
      reason = 'a descendant selector -- ::part() matches a single element and cannot reach into its subtree; give the descendant its own part name';
    if (!reason) continue;
    findings.push(
      `${rel(file)}:${line} [part-compound] '${match[0]}' is followed by ${reason}. Per Selectors L4 a ` +
        `pseudo-element may only be followed by pseudo-classes, so this rule parses but never matches`,
    );
  }
  return findings;
}

// ---------------------------------------------------------------------------

function run() {
  const files = walk(componentsRoot);
  const styleFiles = [...files, ...walk(internalRoot)].filter((file) => file.endsWith('.styles.ts')).sort();
  const classFiles = files.filter((file) => file.endsWith('.class.ts')).sort();

  const findings = [];
  let consumers = 0;

  for (const classFile of classFiles) {
    const styleFile = classFile.replace(/\.class\.ts$/, '.styles.ts');
    if (!fs.existsSync(styleFile)) continue;
    const classSource = fs.readFileSync(classFile, 'utf8');
    // Comment-stripped, so a `<lr-virtual-list>` in a JSDoc example does not count as a mount.
    if (!stripJsComments(classSource).includes(`<${HOST_TAG}`)) continue;
    consumers++;
    findings.push(...checkCrossRootParts(classFile, classSource, styleFile, fs.readFileSync(styleFile, 'utf8')));
  }

  for (const styleFile of styleFiles) {
    findings.push(...checkPartCompounds(styleFile, fs.readFileSync(styleFile, 'utf8')));
  }

  if (findings.length > 0) {
    console.error(`Part reachability failed with ${findings.length} finding(s):`);
    for (const finding of findings.sort()) console.error(`- ${finding}`);
    process.exitCode = 1;
  } else {
    console.log(
      `Part reachability passed: ${consumers} <${HOST_TAG}> consumer(s) and ${styleFiles.length} style file(s) checked.`,
    );
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) run();

export { run, stripJsComments };
