// Every interactive part that reacts to :hover must also react to :active.
// A control that lights up under the pointer and then does nothing at all when pressed reads as
// broken — the user cannot tell the click registered until whatever it triggers finishes, which on
// a slow action is the difference between "it's working" and "click it again". The library had 176
// stylesheets carrying :hover and, before 8.0.0, essentially no pressed treatment; two components
// declared an :active rule byte-identical to their :hover one, which is the same defect wearing a
// costume.
// Scope, deliberately narrow: a rule whose selector both targets a `[part=...]`/`::part()` and
// carries `:hover`. A `:hover` on an internal, non-parted node is a decoration (a row tint, a
// scrollbar thumb); demanding a pressed state there would be noise, and noise is how a gate gets
// suppressed wholesale.
// A part that genuinely should not have one records that with a marker comment on or immediately
// above the rule:
//     /* no-pressed-state: the row is a hover affordance for the checkbox inside it, not a target */
// which is the same bargain the rest of this repo strikes — a deliberate omission is a sentence,
// never a silence.
//
// The mirror-image contract, and the reason this file grew a second half: every part that is a
// pointer target must react to :hover. AGENTS.md calls the missing-:hover companion "the most
// repeated defect in this library's history" (four separate remediation commits, and it still
// recurs, because a new component copies an existing :focus-visible block and never adds the
// hover twin) — yet until now nothing machine-checked that direction at all. Keyboard users get a
// focus ring; mouse users get no "this is interactive" signal whatsoever.
//
// Two rules, each pitched at the precision its signal actually supports:
//
//   1. Pointer-target rule (per part). A rule that targets a part and declares `cursor: pointer`
//      is the author's own explicit claim that this box is a click target, so it owes a hover
//      affordance. That affordance does NOT have to sit on the part itself — the pointer lands on
//      one element and any ancestor of it is equally hovered — so the rule is satisfied by a
//      :hover on the same part, a host-level :hover (`:host(:hover) [part='base']`, which covers
//      the whole shadow tree), or a :hover on a part that CONTAINS this one in the component's own
//      template (lr-tree-item's `[part='row']:hover` is a real affordance for the `[part='toggle']`
//      button nested inside it). Containment is read from the sibling `*.class.ts`, because CSS
//      text alone cannot tell an ancestor from a sibling — and that distinction is exactly what
//      separates lr-tree-item's covered toggle from lr-flow-canvas's uncovered `edge-hit-area`,
//      which is a *sibling* of the `[part='edge']` that carries the hover.
//
//   2. Focus-affordance rule (per stylesheet). Promotes the hand-run grep that
//      docs/agents/a11y-responsive-motion.md already tells contributors to run before shipping:
//      a stylesheet that gives a part a `:focus-visible` treatment but carries no `:hover` rule
//      anywhere has styled the keyboard path and forgotten the pointer one outright. Deliberately
//      file-level, not per part: `:focus-visible` is owed by anything focusable, including scroll
//      containers, text fields and pan surfaces that no one should tint under the pointer, so a
//      per-part version of this rule is ~95% false positives — and noise is how a gate gets
//      suppressed wholesale.
//
// Both record a deliberate omission the same way :active does, with a marker comment:
//     /* no-hover-state: a transparent hit target with nothing of its own to paint */
// on or immediately above the rule for rule 1, anywhere in the file for rule 2.
// Run: node scripts/check-interaction-states.mjs

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const componentsRoot = join(packageDir, 'src', 'components');

function styleFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) return styleFiles(file);
    return entry.name.endsWith('.styles.ts') ? [file] : [];
  });
}

const OPT_OUT = /no-pressed-state:/;
const HOVER_OPT_OUT = /no-hover-state:/;

/**
 * Splits a stylesheet into `{ selector, line, precededByOptOut }` records. A regex rather than a CSS
 * parser is honest here: these files are `css` template literals whose shape this repo controls, and
 * the check is about selector text, not cascade semantics.
 */
export function readHoverRules(source) {
  const rules = [];
  // Comments are blanked, not dropped: this repo's stylesheets carry long multi-line rationales
  // that contain braces and selector fragments, and line-by-line skipping leaks their text into
  // the next selector. Blanking preserves line numbers so a finding still points somewhere real.
  const optOutLines = new Set();
  source.split('\n').forEach((line, index) => {
    if (OPT_OUT.test(line)) optOutLines.add(index + 1);
  });
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
  const lines = stripped.split('\n');
  let pendingOptOut = false;
  let buffer = '';
  let bufferLine = 0;

  lines.forEach((line, index) => {
    if (optOutLines.has(index + 1)) {
      pendingOptOut = true;
      return;
    }
    const trimmed = line.trim();
    if (trimmed === '') return;

    if (buffer === '') bufferLine = index + 1;
    buffer += ` ${trimmed}`;

    // A rule written entirely on one line (`[part='x']:hover { color: red; }`) never ends in `{`,
    // so an earlier version of this parser skipped every one of them -- six real missing pressed
    // states hid behind that. Take the selector from the first brace wherever it falls.
    const brace = buffer.indexOf('{');
    if (brace < 0) {
      // A selector list spanning several lines; keep accumulating until the brace arrives. A line
      // that closes or terminates a declaration means we were never inside a selector.
      if (trimmed.endsWith('}') || trimmed.endsWith(';')) buffer = '';
      return;
    }
    const selector = buffer.slice(0, brace).trim();
    buffer = '';
    if (/:hover/.test(selector)) {
      rules.push({ selector, line: bufferLine, optedOut: pendingOptOut });
    }
    pendingOptOut = false;
  });
  return rules;
}

/** Does this selector address a public part (either from inside the shadow root, or via ::part)? */
export const targetsPart = (selector) => /\[part[~*^$|]?=/.test(selector) || /::part\(/.test(selector);

/** The same selector with :hover swapped for :active, which is what a sibling rule looks like. */
export const pressedForm = (selector) => selector.replace(/:hover/g, ':active');

// ---------------------------------------------------------------------------
// Hover contract (rules 1 and 2 in the header)
// ---------------------------------------------------------------------------

/** Blank every CSS comment in place, keeping offsets and line numbers intact. */
const blankComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));

/**
 * Every leaf rule (a block with declarations rather than nested rules) as
 * `{ selector, body, line, optedOut }`. `readHoverRules` above only ever needed selector text; the
 * hover contract also has to read declarations (`cursor: pointer` is a declaration, not a
 * selector), so this walks braces directly instead of buffering lines. At-rule preludes
 * (`@media ... {`) come back as ordinary "selectors" that simply never match a part.
 */
export function readStyleRules(source) {
  const optOutLines = new Set();
  source.split('\n').forEach((line, index) => {
    if (HOVER_OPT_OUT.test(line)) optOutLines.add(index + 1);
  });
  const stripped = blankComments(source);
  const rules = [];
  const stack = [];
  let cursor = 0;
  let line = 1;
  // Same bargain as the :active half: a marker anywhere between the previous rule and this one
  // opts this one out, so the reason can be the multi-line paragraph these stylesheets favour
  // rather than a squeezed single line.
  let pendingOptOut = false;
  for (let index = 0; index < stripped.length; index += 1) {
    const char = stripped[index];
    if (char === '\n') {
      line += 1;
      if (optOutLines.has(line)) pendingOptOut = true;
    }
    if (char === '{') {
      stack.push({ selector: stripped.slice(cursor, index), bodyStart: index + 1, line });
      cursor = index + 1;
    } else if (char === '}') {
      const frame = stack.pop();
      if (frame) {
        const body = stripped.slice(frame.bodyStart, index);
        if (!body.includes('{')) {
          const selector = frame.selector.replace(/\s+/g, ' ').trim();
          // A selector list may start lines above the brace; anchor the finding at its own first
          // line so the message points at the selector a reader would go looking for. Only the
          // newlines *inside* the trimmed selector count -- the ones separating it from the
          // previous rule are not part of it.
          const selectorLine = frame.line - (frame.selector.trim().match(/\n/g)?.length ?? 0);
          rules.push({ selector, body, line: selectorLine, optedOut: pendingOptOut });
          pendingOptOut = false;
        }
      }
      cursor = index + 1;
    } else if (stack.length === 0 && (char === ';' || char === '`')) {
      // Outside any block the file is still TypeScript (`export const styles = css\``), and a
      // stylesheet may close and reopen one. Both boundaries end whatever selector text preceded.
      cursor = index + 1;
    }
  }
  return rules;
}

/**
 * Split a selector on the given top-level characters, ignoring anything nested inside `()` or `[]`.
 * The bracket half is not optional: `~`, `+` and `>` are combinators between compounds AND
 * attribute-matching operators inside one (`[part~="base"]`), and treating the latter as the former
 * silently truncates the compound to `:not(...)`-and-after, which is how this file first reported
 * lr-radio's fully-hovered `[part~="base"]` as unhovered.
 */
function splitTopLevel(selector, separators) {
  const out = [];
  let parens = 0;
  let brackets = 0;
  let buffer = '';
  for (const char of selector) {
    if (char === '(') parens += 1;
    else if (char === ')') parens -= 1;
    else if (char === '[') brackets += 1;
    else if (char === ']') brackets -= 1;
    if (parens === 0 && brackets === 0 && separators.test(char)) {
      if (buffer.trim()) out.push(buffer.trim());
      buffer = '';
    } else buffer += char;
  }
  if (buffer.trim()) out.push(buffer.trim());
  return out;
}

/** Split a selector list on top-level commas, ignoring commas nested inside `:is()`/`:where()`. */
function selectorList(selector) {
  return splitTopLevel(selector, /,/);
}

/** Split one complex selector into its compounds, ignoring combinators nested in `()` or `[]`. */
function compounds(selector) {
  return splitTopLevel(selector, /[\s>+~]/);
}

/**
 * The parts a selector list actually *styles* — the part names on each complex selector's subject
 * (its rightmost compound), never on an ancestor compound. `[part='toolbar'] button` styles an
 * unnamed button inside a part, not the part, which is the same "internal, non-parted node is a
 * decoration" scope the :active half of this file already draws.
 */
export function styledParts(selector) {
  const names = new Set();
  for (const complex of selectorList(selector)) {
    const chain = compounds(complex);
    for (const name of partsInSelector(chain[chain.length - 1] ?? '')) names.add(name);
  }
  return [...names];
}

/** Every part name a selector fragment addresses, from `[part='x']`, `[part~="x y"]` and `::part(x)`. */
export function partsInSelector(selector) {
  const names = new Set();
  for (const match of selector.matchAll(/part[~*^$|]?=\s*["']([^"']+)["']/g)) {
    for (const name of match[1].trim().split(/\s+/)) names.add(name);
  }
  for (const match of selector.matchAll(/::part\(([^)]*)\)/g)) {
    for (const name of match[1].trim().split(/\s+/)) if (name) names.add(name);
  }
  return [...names];
}

/**
 * What the stylesheet's `:hover` rules actually cover.
 *
 * `hostWide` is a `:host(...)`-carried hover, which is true for every element in the shadow tree.
 * `parts` are the parts whose own compound carries the `:hover`. A hover on an unnamed internal
 * element contributes nothing here on purpose: the checker cannot know which parts sit on it, and
 * a guess in either direction is worse than the narrow scope.
 */
export function hoverCoverage(rules) {
  const parts = new Set();
  let hostWide = false;
  for (const rule of rules) {
    if (!/:hover/.test(rule.selector)) continue;
    for (const complex of selectorList(rule.selector)) {
      for (const compound of compounds(complex)) {
        if (!/:hover/.test(compound)) continue;
        if (/:host/.test(compound)) hostWide = true;
        for (const name of partsInSelector(compound)) parts.add(name);
      }
    }
  }
  return { hostWide, parts };
}

/** HTML elements that never carry a closing tag, so they must not stay on the nesting stack. */
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/**
 * `Map<part, Set<partsNestedInsideIt>>` read off a component's own Lit templates.
 *
 * Deliberately a text scan rather than a template parser: only tag nesting and `part=` matter, the
 * markup lives in `html`/`svg` tagged templates this repo controls, and the interpolation holes
 * that would defeat a strict parser (`@click=${() => …}` puts a `>` inside a start tag) are
 * harmless once the scan only cares about the tag name and a `part` attribute that always precedes
 * them. Comments are blanked first, so a `<lr-tree-item>` in a JSDoc example is not markup. Closing
 * tags pop by name, so an unbalanced fragment degrades into "no containment known" rather than
 * into a wrong answer.
 */
export function partContainment(templateSource) {
  const source = templateSource
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (match, lead) => lead + ' '.repeat(match.length - lead.length));
  const contains = new Map();
  const stack = [];
  for (const match of source.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^<>]*)>/g)) {
    const [, closing, rawName, attributes] = match;
    const element = rawName.toLowerCase();
    if (closing) {
      const at = stack.map((frame) => frame.element).lastIndexOf(element);
      if (at >= 0) stack.length = at;
      continue;
    }
    const declared = attributes.match(/\bpart=\s*["']([^"']*)["']/);
    const parts = declared ? declared[1].trim().split(/\s+/).filter(Boolean) : [];
    for (const ancestor of stack) {
      for (const ancestorPart of ancestor.parts) {
        if (!contains.has(ancestorPart)) contains.set(ancestorPart, new Set());
        for (const part of parts) contains.get(ancestorPart).add(part);
      }
    }
    if (attributes.trimEnd().endsWith('/') || VOID_ELEMENTS.has(element)) continue;
    stack.push({ element, parts });
  }
  return contains;
}

/** Is `part`'s pointer affordance expressed anywhere in this stylesheet? */
export function hasHoverAffordance(part, coverage, containment) {
  if (coverage.hostWide || coverage.parts.has(part)) return true;
  for (const hovered of coverage.parts) {
    if (containment.get(hovered)?.has(part)) return true;
  }
  return false;
}

/**
 * The hover half of the contract for one stylesheet.
 *
 * @param {string} styleSource the `*.styles.ts` text
 * @param {string[]} templateSources the component modules whose Lit templates establish part nesting
 * @returns {{findings: Array<{line: number, message: string}>, pointerParts: number,
 *   focusVisible: boolean}}
 */
export function hoverContract(styleSource, templateSources = []) {
  const rules = readStyleRules(styleSource);
  const coverage = hoverCoverage(rules);
  const containment = new Map();
  for (const template of templateSources) {
    for (const [ancestor, descendants] of partContainment(template)) {
      if (!containment.has(ancestor)) containment.set(ancestor, new Set());
      for (const descendant of descendants) containment.get(ancestor).add(descendant);
    }
  }

  const findings = [];
  let pointerParts = 0;
  let focusVisible = null;
  for (const rule of rules) {
    if (!targetsPart(rule.selector)) continue;
    if (focusVisible === null && /:focus-visible/.test(rule.selector)) focusVisible = rule;
    // A rule that *is* the hover already answers the pointer; only a resting-state declaration
    // makes the "this is a click target" claim that can go unanswered.
    if (/:hover/.test(rule.selector)) continue;
    if (!/(?:^|[;{\s])cursor\s*:\s*pointer/.test(rule.body)) continue;
    for (const part of styledParts(rule.selector)) {
      pointerParts += 1;
      if (rule.optedOut) continue;
      if (hasHoverAffordance(part, coverage, containment)) continue;
      findings.push({
        line: rule.line,
        message:
          `\`${rule.selector}\` declares cursor: pointer on [part='${part}'] but nothing gives it ` +
          'a :hover affordance -- a mouse user gets no "this is interactive" signal',
      });
    }
  }
  if (focusVisible && !HOVER_OPT_OUT.test(styleSource) && !/:hover/.test(blankComments(styleSource))) {
    findings.push({
      line: focusVisible.line,
      message:
        `\`${focusVisible.selector}\` styles the keyboard path but this stylesheet has no :hover ` +
        'rule at all -- the pointer path was forgotten outright',
    });
  }
  findings.sort((a, b) => a.line - b.line);
  return { findings, pointerParts, focusVisible: focusVisible !== null };
}

/** The template modules a stylesheet's own component renders from, nearest sibling first. */
function templateSourcesFor(styleFile) {
  const directory = dirname(styleFile);
  const stem = basename(styleFile, '.styles.ts');
  return [`${stem}.class.ts`, `${stem}.ts`, `${stem}-shared.ts`]
    .map((name) => join(directory, name))
    .filter((file) => existsSync(file))
    .map((file) => readFileSync(file, 'utf8'));
}

if (process.argv[1] && process.argv[1].endsWith('check-interaction-states.mjs')) {
  const findings = [];
  let checked = 0;
  let pointerParts = 0;
  let focusVisibleSheets = 0;
  const files = styleFiles(componentsRoot);

  for (const file of files) {
    const raw = readFileSync(file, 'utf8');
    const source = raw.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
    const where = relative(packageDir, file);
    // Normalised so a sibling written with different whitespace still counts as present.
    const normalise = (text) => text.replace(/\s+/g, ' ').trim();
    const allSelectors = new Set(
      [...source.matchAll(/^([^{}\n][^{}]*)\{/gm)].map((match) => normalise(match[1])),
    );

    for (const rule of readHoverRules(raw)) {
      if (!targetsPart(rule.selector)) continue;
      checked += 1;
      if (rule.optedOut) continue;
      const pressed = normalise(pressedForm(rule.selector));
      // Either the exact :active twin, or any :active rule mentioning the same part -- a component
      // is free to express the pressed state on a different, simpler selector.
      const partNames = [...rule.selector.matchAll(/part[~*^$|]?=["']([^"']+)["']/g)].map((m) => m[1]);
      const hasTwin =
        allSelectors.has(pressed) ||
        [...allSelectors].some(
          (candidate) =>
            candidate.includes(':active') &&
            partNames.some((part) => candidate.includes(`'${part}'`) || candidate.includes(`"${part}"`)),
        );
      if (!hasTwin) {
        findings.push(`${where}:${rule.line}: \`${rule.selector}\` has no :active counterpart`);
      }
    }

    // ----- hover contract -------------------------------------------------
    const hover = hoverContract(raw, templateSourcesFor(file));
    pointerParts += hover.pointerParts;
    if (hover.focusVisible) focusVisibleSheets += 1;
    for (const finding of hover.findings) findings.push(`${where}:${finding.line}: ${finding.message}`);
  }

  if (checked === 0 || pointerParts === 0 || focusVisibleSheets === 0) {
    console.error(
      'Interaction-state contract matched ZERO hover rules, cursor: pointer parts or focus-visible ' +
        'stylesheets -- the file shape changed.',
    );
    process.exitCode = 1;
  } else if (findings.length) {
    console.error(`Interaction-state contract failed with ${findings.length} finding(s) across ${checked} hovered part(s):`);
    for (const finding of findings) console.error(`- ${finding}`);
    console.error(
      '\nAdd the matching :active rule, or record the omission with a `no-pressed-state: <reason>` comment.' +
        '\nAdd the matching :hover rule, or record the omission with a `no-hover-state: <reason>` comment.',
    );
    process.exitCode = 1;
  } else {
    console.log(
      `Interaction-state contract passed: ${checked} hovered part(s) all have a pressed state, ` +
        `${pointerParts} cursor: pointer part(s) all have a hover affordance, and all ` +
        `${focusVisibleSheets} focus-visible stylesheet(s) style the pointer path too ` +
        `(${files.length} stylesheets).`,
    );
  }
}

