import { isMainModule } from './is-main-module.mjs';

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
// Three rules, each pitched at the precision its signal actually supports:
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
//   3. Transition rule (per part, hung off rule 1's pointer targets). A part that claims to be a
//      click target AND repaints under the pointer owes that repaint a transition, or the fill
//      jumps between two colours in one frame and reads as a flicker rather than as feedback.
//      Ninety-odd rules reached that conclusion one at a time and each re-typed the same
//      three-property list; `--lr-transition-interactive` (tokens.styles.ts) is now the one place
//      that list lives, so the declaration a rule owes is exactly:
//          transition: var(--lr-transition-interactive);
//      Coverage is read NARROWLY, and every narrowing is a correction of a way the first version of
//      this rule could be silenced without animating anything. `transition` is not an inherited
//      property and applies only to the element whose own value changes, so: a rule on the part
//      itself counts; a tree-wide `[part]`/`*` rule counts (that is
//      `interactive-transition.styles.ts`'s shape, and adopting that sheet in `static styles` counts
//      for the whole shadow tree, which is what it is for); a rule on a part that merely CONTAINS
//      this one does not, and neither does a `:host`-subject rule, which animates the host box and
//      nothing below it. The declaration's VALUE is read too -- it has to name a property this part
//      actually repaints (or `all`), so a `transition: transform` does not answer a background
//      change -- and a declaration inside `@media (prefers-reduced-motion: reduce)` is skipped,
//      because that block is where `transition: none` lives.
//      "Repaints" is deliberately a closed property list: background/border/text colour and
//      box-shadow. An opacity-only, outline-only, filter, SVG fill/stroke or accent-color hover
//      never triggers this rule at all -- those are the exclusions the library already recognises,
//      and a gate that argued with them would be arguing with itself. What is left is a judgement
//      call, and a judgement call is recorded the same way the other two are, except that this one
//      insists on the sentence:
//          /* no-transition-needed: the press must land in the same frame as the drag it starts */
//      A bare `no-transition-needed:` with nothing after it is itself a finding. The other two
//      markers predate that rule and keep their looser form; new markers do not get to be silent.
//
// Rules 1 and 2 record a deliberate omission the same way :active does, with a marker comment:
//     /* no-hover-state: a transparent hit target with nothing of its own to paint */
// on or immediately above the rule for rule 1, anywhere in the file for rule 2.
//
// Run: node scripts/check-interaction-states.mjs

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const componentsRoot = join(packageDir, 'src', 'components');
const internalRoot = join(packageDir, 'src', 'internal');

function styleFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) return styleFiles(file);
    return entry.name.endsWith('.styles.ts') ? [file] : [];
  });
}

const OPT_OUT = /no-pressed-state:/;
const HOVER_OPT_OUT = /no-hover-state:/;
const TRANSITION_OPT_OUT = /no-transition-needed:/;

/**
 * Every `transition`/`transition-property` declaration in a rule body, as `[property, value]` --
 * the property so `transition-property` is read as a bare list, the VALUE because a declaration
 * that names no property this rule repaints (or names `none`) is not coverage. The leading
 * boundary keeps a `transition` inside a var() name from matching.
 */
const TRANSITION_DECLARATION = /(?:^|[;{\s])(transition(?:-property)?)\s*:([^;}]*)/g;

/**
 * The properties whose change under the pointer reads as a flicker when it lands in one frame.
 * Everything absent from this list is absent on purpose: `opacity`, `outline`, `filter`, SVG
 * `fill`/`stroke` and `accent-color` hovers are the library's recognised instant treatments. The
 * leading boundary keeps `color` from matching the tail of `background-color`, `accent-color` or
 * `caret-color`, each of which would otherwise widen the rule by accident.
 */
const PAINT_DECLARATION =
  /(?:^|[;{\s])(background|background-color|background-image|border|border-color|border-[a-z-]+color|box-shadow|color)\s*:/g;

/**
 * The paint FAMILY a property belongs to, which is the unit coverage is matched on. A repaint and
 * the transition that covers it are routinely written at different levels of the shorthand ladder
 * -- `background: var(--x)` answered by `transition: background-color`, `border: 1px solid` by
 * `transition: border-color` -- and matching the literal property names would call each of those
 * pairs a miss. Anything outside the four families (`opacity`, `transform`, ...) maps to itself and
 * therefore never matches a repaint, which is exactly the point of reading the value at all.
 */
function paintFamily(property) {
  if (property.startsWith('background')) return 'background';
  if (property.startsWith('border')) return 'border';
  return property;
}

/** Longhand/shorthand-tolerant paint families this rule body changes. */
export function paintedFamilies(body) {
  const families = new Set();
  for (const [, property] of body.matchAll(PAINT_DECLARATION)) families.add(paintFamily(property));
  return families;
}

/** Components of a transition value that are a duration/delay, an easing, or a behavior keyword. */
const NOT_A_PROPERTY =
  /^(?:\d|\.\d|-?\d*\.?\d+m?s$|ease(?:-in)?(?:-out)?$|linear$|step-(?:start|end)$|steps\(|cubic-bezier\(|normal$|allow-discrete$)/;

/** The transition property named by one comma-separated segment of a transition value. */
const namedProperty = (segment) =>
  splitTopLevel(segment, /\s/).find((token) => !NOT_A_PROPERTY.test(token));

/**
 * The paint families `--lr-transition-interactive` itself animates, READ from the token rather than
 * re-typed here. The token is the one place that property list lives (that is the whole argument
 * for it), so a checker carrying a second copy would be the exact duplication rule 3 exists to
 * end -- and widening the token later, say to cover `box-shadow`, would silently leave the gate
 * prescribing a declaration that does not animate what changed.
 */
const INTERACTIVE_TRANSITION_FAMILIES = (() => {
  const tokens = readFileSync(join(internalRoot, 'tokens.styles.ts'), 'utf8');
  const declaration = /--lr-transition-interactive\s*:([^;]*);/.exec(tokens);
  if (!declaration) {
    throw new Error(
      '--lr-transition-interactive is not declared in src/internal/tokens.styles.ts -- rule 3 of ' +
        'the interaction-state contract reads its property list from there.',
    );
  }
  const families = new Set();
  for (const segment of splitTopLevel(declaration[1], /,/)) {
    const named = namedProperty(segment);
    if (named !== undefined && named !== 'none' && !named.startsWith('var(')) {
      families.add(paintFamily(named));
    }
  }
  return families;
})();

/**
 * The paint families a `transition`/`transition-property` VALUE actually animates.
 *
 * `all` comes back as the literal `'all'`, which covers every family -- and it is also what an
 * omitted property means, so `transition: var(--lr-transition-fast)` (a duration/easing pair, no
 * property named) is tree-wide coverage rather than none. `none` covers nothing, which is the
 * whole reason this function exists: the library writes `transition: none` inside its
 * reduced-motion blocks, and reading only the property NAME counted that as an answer.
 */
export function transitionedFamilies(value) {
  const families = new Set();
  for (const segment of splitTopLevel(value.replace(/!important/g, ''), /,/)) {
    if (/var\(\s*--lr-transition-interactive/.test(segment)) {
      for (const family of INTERACTIVE_TRANSITION_FAMILIES) families.add(family);
      continue;
    }
    const named = namedProperty(segment);
    // No property named at all -> the shorthand's initial `all`. An unresolvable `var()` is read
    // the same way: the checker cannot expand it, and a false miss is worse than a false pass.
    if (named === undefined || named.startsWith('var(')) families.add('all');
    else if (named !== 'none') families.add(paintFamily(named));
  }
  return families;
}

/**
 * The reason text on a `no-transition-needed:` marker, read to the END of its comment block rather
 * than to the end of its line: `readStyleRules` deliberately accepts a marker several lines above
 * the rule so the reason can be the multi-line paragraph these stylesheets favour, and a
 * line-scoped reader would call every one of those "records no reason".
 */
export function transitionMarkerReason(comment) {
  const match = /no-transition-needed:([\s\S]*)/.exec(comment);
  if (!match) return null;
  return match[1]
    .replace(/\*\/[\s\S]*$/, '')
    .replace(/^[\s*]+/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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
 * `{ selector, body, line, optedOut, transitionOptedOut, enclosing }`. `readHoverRules` above only
 * ever needed selector text; the hover contract also has to read declarations (`cursor: pointer` is
 * a declaration, not a selector), so this walks braces directly instead of buffering lines.
 * At-rule preludes (`@media ... {`) come back as ordinary "selectors" that simply never match a
 * part, and each leaf also carries its `enclosing` preludes outermost-first -- the transition rule
 * has to know that a declaration sits inside a reduced-motion query, where the library's answer to
 * "should this move" is deliberately "no".
 */
export function readStyleRules(source) {
  const optOutLines = new Set();
  const transitionOptOutLines = new Set();
  source.split('\n').forEach((line, index) => {
    if (HOVER_OPT_OUT.test(line)) optOutLines.add(index + 1);
    if (TRANSITION_OPT_OUT.test(line)) transitionOptOutLines.add(index + 1);
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
  let pendingTransitionOptOut = false;
  for (let index = 0; index < stripped.length; index += 1) {
    const char = stripped[index];
    if (char === '\n') {
      line += 1;
      if (optOutLines.has(line)) pendingOptOut = true;
      if (transitionOptOutLines.has(line)) pendingTransitionOptOut = true;
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
          rules.push({
            selector,
            body,
            line: selectorLine,
            optedOut: pendingOptOut,
            transitionOptedOut: pendingTransitionOptOut,
            enclosing: stack.map((outer) => outer.selector.replace(/\s+/g, ' ').trim()),
          });
          pendingOptOut = false;
          pendingTransitionOptOut = false;
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

/** A `@media` query that is the reduced-motion branch, where `transition: none` is the answer. */
const REDUCED_MOTION_QUERY = (prelude) =>
  /prefers-reduced-motion/.test(prelude) && !/no-preference/.test(prelude);

/**
 * What the stylesheet's `transition` declarations actually cover: `Map<part, Set<paintFamily>>`,
 * plus a `treeWide` family set for the rules that reach every part at once.
 *
 * Three things this deliberately does NOT count, each of which it used to:
 *
 * - **A `:host`-subject transition.** `transition` is not an inherited property, so a declaration
 *   on `:host` animates the host box and nothing else in the shadow tree. Counting it tree-wide
 *   meant one `:host([reveal-on-interaction]) { transition: opacity ... }` exempted every
 *   repainting part in the file. `:host(:hover) [part='base']` still counts for `base`, because
 *   there the SUBJECT is the part.
 * - **A `transition: none`, or any transition naming no property this rule repaints.** Reading only
 *   the property name counted `transition: none` -- the exact declaration that says "do not move" --
 *   as proof that something moves.
 * - **A rule inside `@media (prefers-reduced-motion: reduce)`.** That block is where the library
 *   PUTS `transition: none`; a resting transition declared only there covers nothing in the state
 *   the rule is about.
 *
 * `treeWide` is a bare `[part]`/`:where([part])` presence selector or `*`, which is
 * `interactive-transition.styles.ts`'s own shape -- a component that interpolates that sheet, or
 * writes the same selector itself, has covered everything it can name.
 */
export function transitionCoverage(rules) {
  const parts = new Map();
  const treeWide = new Set();
  const add = (into, families) => {
    for (const family of families) into.add(family);
  };
  for (const rule of rules) {
    if ((rule.enclosing ?? []).some(REDUCED_MOTION_QUERY)) continue;
    const families = new Set();
    for (const [, , value] of rule.body.matchAll(TRANSITION_DECLARATION)) {
      add(families, transitionedFamilies(value));
    }
    if (families.size === 0) continue;
    for (const complex of selectorList(rule.selector)) {
      const chain = compounds(complex);
      const subject = chain[chain.length - 1] ?? '';
      // `[part]` with no `=` addresses every part at once; `[part='x']` addresses one.
      if (subject === '*' || /\[part\](?![~*^$|]?=)/.test(subject)) add(treeWide, families);
      for (const name of partsInSelector(subject)) {
        if (!parts.has(name)) parts.set(name, new Set());
        add(parts.get(name), families);
      }
    }
  }
  return { treeWide, parts };
}

/**
 * `Map<part, Set<paintFamily>>` -- what this stylesheet repaints under the pointer, per
 * `PAINT_DECLARATION`, and which families each repaint touches. The families matter because the
 * covering transition has to name one of them: a `transition: transform` on a part whose hover
 * changes its `background` leaves that background change landing in one frame, which is the very
 * defect this rule exists to catch.
 */
export function repaintedParts(rules) {
  const parts = new Map();
  for (const rule of rules) {
    if (!/:hover|:active/.test(rule.selector)) continue;
    const families = paintedFamilies(rule.body);
    if (families.size === 0) continue;
    for (const name of styledParts(rule.selector)) {
      if (!parts.has(name)) parts.set(name, new Set());
      for (const family of families) parts.get(name).add(family);
    }
  }
  return parts;
}

/**
 * Does `coverage` animate at least one of the families that repaint?
 *
 * "At least one", not "every one", on purpose: a part that eases its fill and snaps its shadow has
 * a transition, a designer's judgement behind it and no flicker worth the name, while a part with
 * NO transition at all is the defect. The gate is pitched at the defect.
 *
 * Containment is deliberately absent here, and that is the difference between this rule and the
 * hover one. Hover propagates up the tree, so an ancestor's `:hover` rule genuinely fires when the
 * pointer is over a descendant; `transition` is not inherited and applies only to the element whose
 * own property changes, so an ancestor's transition animates nothing about a nested part.
 */
export function transitionCovers(part, repainted, coverage) {
  const covered = new Set(coverage.treeWide);
  for (const family of coverage.parts.get(part) ?? []) covered.add(family);
  if (covered.has('all')) return true;
  for (const family of repainted) if (covered.has(family)) return true;
  return false;
}

/**
 * Is `part` covered by `coverage` -- on its own compound, tree-wide, or through a part that
 * contains it in the component's template? The containment arm is what makes this a HOVER question
 * specifically: the pointer that is over a part is also over every ancestor of it, so an ancestor's
 * `:hover` rule is a real affordance for the descendant. Nothing about `transition` propagates that
 * way, which is why `transitionCovers` asks a narrower question.
 */
export function coversPart(part, coverage, containment) {
  if (coverage.hostWide || coverage.parts.has(part)) return true;
  for (const covered of coverage.parts) {
    if (containment.get(covered)?.has(part)) return true;
  }
  return false;
}

/** Is `part`'s pointer affordance expressed anywhere in this stylesheet? */
export function hasHoverAffordance(part, coverage, containment) {
  return coversPart(part, coverage, containment);
}

/**
 * Does this module actually adopt `interactive-transition.styles.ts`? The import alone is not
 * adoption and neither is a mention of the path -- the symbol has to reach a `styles` array (the
 * class-module shape) or be interpolated into a `css` template (the stylesheet shape).
 */
export function adoptsSharedTransition(text) {
  const imported =
    /import\s*\{[^}]*\binteractiveTransition\b[^}]*\}\s*from\s*['"][^'"]*interactive-transition\.styles(?:\.js)?['"]/.test(
      text,
    );
  const used =
    /styles\s*=\s*\[[^\]]*\binteractiveTransition\b/.test(text) ||
    /\$\{\s*interactiveTransition\s*\}/.test(text);
  return imported && used;
}

/**
 * The pointer half of the contract for one stylesheet: rules 1, 2 and 3.
 *
 * @param {string} styleSource the `*.styles.ts` text
 * @param {string[]} templateSources the component modules whose Lit templates establish part nesting
 * @returns {{findings: Array<{line: number, part?: string, message: string}>, pointerParts: number,
 *   repaintedPointerParts: number, focusVisible: boolean}}
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
  const transitions = transitionCoverage(rules);
  // Adopting the shared sheet covers the whole shadow tree, and it is composed in the class module
  // (`static styles`) as often as it is interpolated into the stylesheet, so both are read. The
  // symbol has to be IMPORTED and then USED: a bare mention of the module path would let a comment
  // saying "deliberately not adopted here" exempt the component's entire stylesheet.
  if ([styleSource, ...templateSources].some(adoptsSharedTransition)) {
    for (const family of INTERACTIVE_TRANSITION_FAMILIES) transitions.treeWide.add(family);
  }
  const repainted = repaintedParts(rules);

  const findings = [];
  let pointerParts = 0;
  let repaintedPointerParts = 0;
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
      if (!rule.optedOut && !hasHoverAffordance(part, coverage, containment)) {
        findings.push({
          rule: 'hover',
          line: rule.line,
          part,
          message:
            `\`${rule.selector}\` declares cursor: pointer on [part='${part}'] but nothing gives it ` +
            'a :hover affordance -- a mouse user gets no "this is interactive" signal',
        });
      }
      // The transition rule, on the same pointer targets: only a part that actually repaints has
      // a state change that can flicker.
      const repaints = repainted.get(part);
      if (!repaints) continue;
      repaintedPointerParts += 1;
      if (rule.transitionOptedOut) continue;
      if (transitionCovers(part, repaints, transitions)) continue;
      // The shared token answers the three families it names and no others, so a part whose only
      // pointer repaint is outside them (a `box-shadow`-only press) is told what to write instead
      // of being handed a declaration that would silence the gate without animating anything.
      const outside = [...repaints].filter((family) => !INTERACTIVE_TRANSITION_FAMILIES.has(family));
      const remedy =
        outside.length === repaints.size
          ? `Declare a transition naming ${outside.join('/')} on the resting rule ` +
            `(\`var(--lr-transition-interactive)\` covers only ${[...INTERACTIVE_TRANSITION_FAMILIES].join('/')})`
          : 'Declare `transition: var(--lr-transition-interactive);` on the resting rule';
      findings.push({
        rule: 'transition',
        line: rule.line,
        part,
        message:
          `\`${rule.selector}\` declares cursor: pointer on [part='${part}'] and the stylesheet ` +
          `repaints its ${[...repaints].join('/')} under the pointer, but nothing transitions it -- ` +
          'the change lands in one frame and reads as a flicker. ' +
          `${remedy}, or record the omission with a \`no-transition-needed: <reason>\` comment`,
      });
    }
  }
  // Read to the end of the comment block, not to the end of the line: the marker's reason is
  // routinely the multi-line paragraph these stylesheets favour.
  for (const comment of styleSource.matchAll(/\/\*[\s\S]*?\*\//g)) {
    const reason = transitionMarkerReason(comment[0]);
    if (reason === null || reason !== '') continue;
    const marker = comment.index + comment[0].indexOf('no-transition-needed:');
    findings.push({
      rule: 'marker',
      line: styleSource.slice(0, marker).split('\n').length,
      message:
        'a `no-transition-needed:` marker records no reason -- the whole point of the marker is the ' +
        'sentence after the colon',
    });
  }
  if (focusVisible && !HOVER_OPT_OUT.test(styleSource) && !/:hover/.test(blankComments(styleSource))) {
    findings.push({
      rule: 'focus',
      line: focusVisible.line,
      message:
        `\`${focusVisible.selector}\` styles the keyboard path but this stylesheet has no :hover ` +
        'rule at all -- the pointer path was forgotten outright',
    });
  }
  findings.sort((a, b) => a.line - b.line);
  return { findings, pointerParts, repaintedPointerParts, focusVisible: focusVisible !== null };
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

/**
 * Pointer parts that repaint with no transition covering that repaint, and PREDATE
 * `--lr-transition-interactive`.
 *
 * This list exists so rule 3 could land at full strength without a source sweep attached to it.
 * Adding a transition to a part that never had one changes what a test reading a hovered colour
 * sees -- the library has already had to repair five such tests, four of which only reproduced on
 * a non-Chromium engine -- so each of these is owed a fix plus a look at its component's own hover
 * assertions, which is a per-component job, not a one-line edit made in bulk.
 *
 * WHAT DISCHARGES AN ENTRY, since a grandfather list with no named owner is just a nicer silence:
 * the component's own next substantive change. Add `transition: var(--lr-transition-interactive);`
 * to the resting rule, re-read that component's pointer-state assertions for the
 * read-a-hovered-colour pattern docs/agents/testing.md describes, run its test file on all three
 * engines, and delete the line here in the same commit. Nothing else retires these; in particular
 * no bulk rename pass does, because every entry names a part with no covering transition to rename.
 *
 * Two properties keep it from becoming a permanent silence: it may only ever SHRINK (a size above
 * the ceiling below fails), and an entry that no longer names a real finding fails too, so a fixed
 * part cannot leave its line behind. Delete the line in the same change that adds the transition.
 */
const PRE_TOKEN_TRANSITION_GAPS = new Set([
  'src/components/agent-tools/activity-feed/activity-feed.styles.ts:header',
  'src/components/agent-tools/task-list/task-list.styles.ts:header',
  'src/components/agent-tools/terminal/terminal.styles.ts:copy-button',
  'src/components/agent-tools/terminal/terminal.styles.ts:download-button',
  'src/components/agent-tools/thinking-panel/thinking-panel.styles.ts:header',
  'src/components/agent-tools/tool-approval-dialog/tool-approval-dialog.styles.ts:edit-button',
  'src/components/agent-tools/trace-tree/trace-tree.styles.ts:row',
  'src/components/agent-tools/trace-tree/trace-tree.styles.ts:toggle',
  'src/components/charts/chart/box-plot.styles.ts:legend-item',
  'src/components/charts/chart/box-plot.styles.ts:data-table-toggle',
  'src/components/charts/chart/chart.styles.ts:legend-item',
  'src/components/charts/chart/chart.styles.ts:reset-zoom-button',
  'src/components/charts/chart/chart.styles.ts:data-table-toggle',
  'src/components/charts/chart/lite-chart.styles.ts:data-table-toggle',
  'src/components/conversation/chat-message/chat-message.styles.ts:collapse-button',
  'src/components/conversation/chat-message/chat-message.styles.ts:retry-button',
  'src/components/conversation/checkpoint/checkpoint.styles.ts:confirm-button',
  'src/components/conversation/checkpoint/checkpoint.styles.ts:cancel-button',
  'src/components/conversation/code-block/code-block.styles.ts:toggle',
  'src/components/conversation/message-feedback/message-feedback.styles.ts:up-button',
  'src/components/conversation/message-feedback/message-feedback.styles.ts:down-button',
  'src/components/conversation/model-select/model-select.styles.ts:trigger',
  'src/components/conversation/model-select/model-select.styles.ts:option',
  'src/components/conversation/push-to-talk/push-to-talk.styles.ts:trigger',
  'src/components/conversation/thread-list/thread-list.styles.ts:clear-button',
  'src/components/conversation/thread-list/thread-list.styles.ts:group-toggle',
  'src/components/conversation/thread-list/thread-list.styles.ts:row-action',
  'src/components/conversation/voice-picker/voice-picker.styles.ts:trigger',
  'src/components/conversation/voice-picker/voice-picker.styles.ts:preview-button',
  'src/components/conversation/voice-picker/voice-picker.styles.ts:option',
  'src/components/conversation/voice-picker/voice-picker.styles.ts:option-preview',
  'src/components/data/data-grid/data-grid.styles.ts:header-cell',
  'src/components/data/data-grid/data-grid.styles.ts:page-size',
  'src/components/data/table/table.styles.ts:header-cell',
  'src/components/data/table/table.styles.ts:cell-editor',
  'src/components/data/table/table.styles.ts:row-expand-toggle',
  'src/components/data/table/table.styles.ts:more-button',
  'src/components/data/table/table.styles.ts:reveal-columns-button',
  'src/components/data/table/table.styles.ts:retry-button',
  'src/components/forms/color-picker/color-picker.styles.ts:slider',
  'src/components/forms/combobox/combobox.styles.ts:tag__remove-button',
  'src/components/forms/combobox/combobox.styles.ts:clear-button',
  'src/components/forms/combobox/combobox.styles.ts:option',
  'src/components/forms/date-picker/date-input.styles.ts:clear-button',
  'src/components/forms/date-picker/date-input.styles.ts:expand-button',
  'src/components/forms/input/time-input.styles.ts:clear-button',
  'src/components/forms/input/time-input.styles.ts:expand-button',
  'src/components/forms/input/time-input.styles.ts:column-item',
  'src/components/forms/select/select.styles.ts:trigger',
  'src/components/forms/select/select.styles.ts:tag__remove-button',
  'src/components/forms/select/select.styles.ts:clear-button',
  'src/components/forms/select/select.styles.ts:option',
  'src/components/layout/app-rail/app-rail.styles.ts:toggle',
  'src/components/layout/details/accordion-item.styles.ts:button',
  'src/components/layout/details/details.styles.ts:summary',
  'src/components/layout/menu/menu-item.styles.ts:base',
  'src/components/layout/widget/widget.styles.ts:view-toggle',
  'src/components/media/image-viewer/image-viewer.styles.ts:fit-control',
  'src/components/media/image-viewer/image-viewer.styles.ts:rotate-button',
  'src/components/media/image-viewer/image-viewer.styles.ts:annotate-toggle',
  'src/components/media/image-viewer/image-viewer.styles.ts:highlight',
  'src/components/retrieval/source-list/source-list.styles.ts:header',
  'src/components/utility/diff-view/diff-view.styles.ts:copy-button',
  'src/components/utility/export-button/export-button.styles.ts:trigger',
  'src/components/utility/json-viewer/json-viewer.styles.ts:toggle',
  'src/components/utility/json-viewer/json-viewer.styles.ts:copy-button',
  'src/components/utility/mention-popover/mention-popover.styles.ts:option',
  'src/components/utility/poll-status/poll-status.styles.ts:pause-button',
  'src/components/utility/tour/tour.styles.ts:previous-button',
  'src/components/utility/tour/tour.styles.ts:skip-button',
  'src/components/utility/tour/tour.styles.ts:next-button',
  'src/components/viewers/document-preview/document-preview.styles.ts:region-highlight-action',
  'src/components/viewers/highlight-layer/highlight-layer.styles.ts:highlight-action',
  'src/components/viewers/xml-viewer/xml-viewer.styles.ts:highlight-action',
  'src/components/viewers/xml-viewer/xml-viewer.styles.ts:toggle',
  'src/components/viewers/xml-viewer/xml-viewer.styles.ts:copy-button',

  // Second block, same class of defect, found only once rule 3 learned to read a transition's
  // VALUE and stopped counting an ancestor's transition or a `:host` one. Each of these carries a
  // transition that animates something OTHER than what changes under the pointer -- `opacity`,
  // `transform`, `inline-size`, the container's own fade -- or carries one only inside
  // `@media (prefers-reduced-motion: reduce)`, where it is `none`. To the eye they are identical
  // to the block above: a fill that jumps in one frame. They are listed rather than repaired for
  // the same reason, and they discharge the same way.
  'src/components/agent-tools/terminal/terminal.styles.ts:jump-to-latest',
  'src/components/agent-tools/tool-result-dialog/tool-result-dialog.styles.ts:maximize-button',
  'src/components/agent-tools/tool-result-dialog/tool-result-dialog.styles.ts:close-button',
  'src/components/conversation/chat-viewport/chat-viewport.styles.ts:jump-pill',
  'src/components/conversation/message-feedback/message-feedback.styles.ts:submit-button',
  'src/components/data/calendar/calendar.styles.ts:event',
  'src/components/forms/input/time-input.styles.ts:now-button',
  'src/components/layout/page/page.styles.ts:navigation-toggle',
  'src/components/layout/widget/widget.styles.ts:collapse-button',
  'src/components/layout/widget/widget.styles.ts:fullscreen-button',
  'src/components/media/video/video.styles.ts:poster-play-button',
  'src/components/overlays/alert/alert.styles.ts:close-button',
  'src/components/overlays/toast/toast-item.styles.ts:close-button',
  'src/components/retrieval/graph-legend/graph-legend.styles.ts:item',
  'src/components/utility/export-button/export-button.styles.ts:menu-item',
]);
/**
 * The list may only shrink. A new part with no transition is a finding, never a new entry.
 *
 * This number has moved UP exactly once, from 77 to 96, in the change that taught rule 3 to read a
 * transition's value and to stop believing a `:host` or ancestor declaration. That is the only
 * reason it may ever move up: the DETECTOR got stricter and named nineteen more instances of the
 * defect it already knew about. It may not move up because a component regressed, and it may not
 * move up to admit a newly written part -- new code writes the declaration.
 */
const PRE_TOKEN_TRANSITION_GAP_CEILING = 96;

if (isMainModule(import.meta.url)) {
  const findings = [];
  let checked = 0;
  let pointerParts = 0;
  let repaintedPointerParts = 0;
  let focusVisibleSheets = 0;
  const grandfatheredHits = new Set();
  const files = [...styleFiles(componentsRoot), ...styleFiles(internalRoot)].sort();

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

    // ----- hover and transition contracts ---------------------------------
    const hover = hoverContract(raw, templateSourcesFor(file));
    pointerParts += hover.pointerParts;
    repaintedPointerParts += hover.repaintedPointerParts;
    if (hover.focusVisible) focusVisibleSheets += 1;
    for (const finding of hover.findings) {
      const key = `${where}:${finding.part}`;
      if (finding.rule === 'transition' && PRE_TOKEN_TRANSITION_GAPS.has(key)) {
        grandfatheredHits.add(key);
        continue;
      }
      findings.push(`${where}:${finding.line}: ${finding.message}`);
    }
  }

  for (const entry of PRE_TOKEN_TRANSITION_GAPS) {
    if (grandfatheredHits.has(entry)) continue;
    findings.push(
      `${entry}: is recorded as a pre-token transition gap but no longer is one -- delete the ` +
        'entry from PRE_TOKEN_TRANSITION_GAPS',
    );
  }
  if (PRE_TOKEN_TRANSITION_GAPS.size > PRE_TOKEN_TRANSITION_GAP_CEILING) {
    findings.push(
      `PRE_TOKEN_TRANSITION_GAPS holds ${PRE_TOKEN_TRANSITION_GAPS.size} entries, above its ` +
        `ceiling of ${PRE_TOKEN_TRANSITION_GAP_CEILING} -- the list may only shrink`,
    );
  }

  if (checked === 0 || pointerParts === 0 || repaintedPointerParts === 0 || focusVisibleSheets === 0) {
    console.error(
      'Interaction-state contract matched ZERO hover rules, cursor: pointer parts, repainted ' +
        'pointer parts or focus-visible stylesheets -- the file shape changed.',
    );
    process.exitCode = 1;
  } else if (findings.length) {
    console.error(`Interaction-state contract failed with ${findings.length} finding(s) across ${checked} hovered part(s):`);
    for (const finding of findings) console.error(`- ${finding}`);
    console.error(
      '\nAdd the matching :active rule, or record the omission with a `no-pressed-state: <reason>` comment.' +
        '\nAdd the matching :hover rule, or record the omission with a `no-hover-state: <reason>` comment.' +
        '\nAdd `transition: var(--lr-transition-interactive);` to the resting rule, or record the ' +
        'omission with a `no-transition-needed: <reason>` comment.',
    );
    process.exitCode = 1;
  } else {
    console.log(
      `Interaction-state contract passed: ${checked} hovered part(s) all have a pressed state, ` +
        `${pointerParts} cursor: pointer part(s) all have a hover affordance, ` +
        `${repaintedPointerParts} repainting pointer part(s) all transition that repaint ` +
        `(${PRE_TOKEN_TRANSITION_GAPS.size} still on the pre-token list), and all ` +
        `${focusVisibleSheets} focus-visible stylesheet(s) style the pointer path too ` +
        `(${files.length} stylesheets).`,
    );
  }
}
