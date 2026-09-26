#!/usr/bin/env node
// Standalone test for scripts/check-interaction-states.mjs -- plain `node:assert`, not wired into
// the wtr suite (this checker reads source text, it does not render components). Run directly:
// `node scripts/check-interaction-states.test.mjs` (`--verbose` prints the per-case lines).
//
// Every fixture below is a reduced copy of a real shape from src/components. The two that matter
// most are the failing ones -- a checker with only passing fixtures proves nothing about whether it
// can still fire -- and the ancestor-containment pass, which is the whole reason this gate reads the
// component's template as well as its stylesheet: lr-tree-item's clickable `[part='toggle']` has no
// hover rule of its own and is nonetheless covered, because it sits inside the `[part='row']` that
// does, while lr-flow-canvas's `[part='edge-hit-area']` sits BESIDE the `[part='edge']` that does
// and was therefore genuinely dead under the pointer.

import assert from 'node:assert/strict';
import {
  adoptsSharedTransition,
  hasStateQualifier,
  hoverContract,
  hoverCoverage,
  paintedFamilies,
  partContainment,
  partsInSelector,
  pressedForm,
  readHoverRules,
  readStyleRules,
  repaintedParts,
  stateMaskedFallbacks,
  styledParts,
  targetsPart,
  transitionCoverage,
  transitionMarkerReason,
  transitionedFamilies,
} from './check-interaction-states.mjs';

const verbose = process.argv.includes('--verbose');
let failures = 0;
let passes = 0;
function test(name, fn) {
  try {
    fn();
    passes += 1;
    if (verbose) console.log(`ok - ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`not ok - ${name}`);
    console.error(err instanceof Error ? err.stack : err);
  }
}

const messages = (result) => result.findings.map((finding) => finding.message);

// ---------------------------------------------------------------------------
// The pressed-state half, unchanged
// ---------------------------------------------------------------------------

test('hover rules are read from multi-line and single-line selectors alike', () => {
  const source = [
    "[part='a']:hover,",
    "[part='b']:hover {",
    '  color: red;',
    '}',
    "[part='c']:hover { color: blue; }",
  ].join('\n');
  assert.deepEqual(
    readHoverRules(source).map((rule) => rule.selector),
    ["[part='a']:hover, [part='b']:hover", "[part='c']:hover"],
  );
  assert.equal(targetsPart("[part='a']:hover"), true);
  assert.equal(targetsPart('.internal:hover'), false);
  assert.equal(pressedForm("[part='a']:hover"), "[part='a']:active");
});

// ---------------------------------------------------------------------------
// Rule reading
// ---------------------------------------------------------------------------

test('readStyleRules pairs each selector with its declarations and its first line', () => {
  const source = [
    'export const styles = css`',
    "  [part='base'] {",
    '    cursor: pointer;',
    '  }',
    "  [part='x'],",
    "  [part='y'] { color: red; }",
    '`;',
  ].join('\n');
  const rules = readStyleRules(source);
  assert.deepEqual(
    rules.map((rule) => [rule.selector, rule.line]),
    [
      ["[part='base']", 2],
      ["[part='x'], [part='y']", 5],
    ],
    'the TypeScript prelude is not mistaken for selector text and a wrapped list reports its first line',
  );
  assert.match(rules[0].body, /cursor: pointer/);
});

test('an at-rule prelude is not a leaf rule, but the rules nested inside it are', () => {
  const rules = readStyleRules('@media (hover: hover) { [part="a"] { cursor: pointer; } }');
  assert.deepEqual(rules.map((rule) => rule.selector), ['[part="a"]']);
});

// ---------------------------------------------------------------------------
// Selector reading
// ---------------------------------------------------------------------------

test('an attribute-matching ~= is not read as a sibling combinator', () => {
  // Reduced from lr-radio, which this gate first reported as unhovered: splitting compounds on a
  // bare `~` truncated `[part~="base"]:not([part~="disabled"]):hover` down to the `:not(...)` tail,
  // losing the very part the hover applies to.
  const rules = readStyleRules('[part~="base"]:not([part~="disabled"]):hover [part~="circle"] { color: red; }');
  const coverage = hoverCoverage(rules);
  assert.deepEqual([...coverage.parts].sort(), ['base', 'disabled']);
  assert.equal(coverage.hostWide, false);
});

test('a host-level hover is recorded as covering the whole shadow tree', () => {
  const coverage = hoverCoverage(readStyleRules(":host(:hover) [part='base'] { background: red; }"));
  assert.equal(coverage.hostWide, true);
});

test('only the hovered compound contributes, not every part named in the selector', () => {
  const coverage = hoverCoverage(readStyleRules("[part='checkbox']:hover [part='control'] { color: red; }"));
  assert.deepEqual([...coverage.parts], ['checkbox'], 'the descendant is styled, the ancestor is hovered');
});

test('styledParts reads the subject compound, partsInSelector reads the whole selector', () => {
  assert.deepEqual(styledParts("[part='toolbar'] button"), [], 'an unnamed internal node is not a part');
  assert.deepEqual(partsInSelector("[part='toolbar'] button"), ['toolbar']);
  assert.deepEqual(styledParts('[part~="a"], lr-list::part(b)').sort(), ['a', 'b']);
});

// ---------------------------------------------------------------------------
// Template containment
// ---------------------------------------------------------------------------

test('part containment is read off the component template, ignoring JSDoc examples', () => {
  const template = `
    /** Renders a row. Example: <div part="fake"><span part="alsoFake"></span></div> */
    render() {
      return html\`
        <div part="row" @click=\${() => this.select()}>
          <span part="expand-button">
            <button part="toggle" ?disabled=\${this.busy}></button>
          </span>
        </div>
      \`;
    }
  `;
  const contains = partContainment(template);
  assert.deepEqual([...(contains.get('row') ?? [])].sort(), ['expand-button', 'toggle']);
  assert.deepEqual([...(contains.get('expand-button') ?? [])], ['toggle']);
  assert.equal(contains.has('fake'), false, 'markup inside a comment is not markup');
  assert.equal(contains.get('toggle'), undefined, 'a leaf contains nothing');
});

test('a void element does not swallow the parts that follow it', () => {
  const contains = partContainment('html`<div part="a"><input part="b"><span part="c"></span></div>`');
  assert.deepEqual([...(contains.get('a') ?? [])].sort(), ['b', 'c']);
  assert.equal(contains.has('b'), false, '<input> never closes, so it must not stay on the stack');
});

// ---------------------------------------------------------------------------
// The hover contract, end to end
// ---------------------------------------------------------------------------

// A clickable part plus an unrelated hovered part, so the file-level focus rule stays quiet and
// each case below isolates the per-part rule. The toggle carries the shared transition because
// several cases below move the hover onto it, and a repainted pointer target with no transition is
// a finding of its own -- one this fixture is not about.
const CLICKABLE = [
  'export const styles = css`',
  "  [part='label']:hover {",
  '    color: blue;',
  '  }',
  "  [part='toggle'] {",
  '    border: none;',
  '    cursor: pointer;',
  '    transition: var(--lr-transition-interactive);',
  '  }',
  '`;',
].join('\n');
const TEMPLATE = 'html`<button part="toggle"></button><span part="label"></span>`';

test('FIRES: a cursor: pointer part with no hover affordance anywhere', () => {
  const result = hoverContract(CLICKABLE, [TEMPLATE]);
  assert.equal(result.pointerParts, 1);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].line, 5, 'the finding points at the rule that made the claim');
  assert.match(result.findings[0].message, /cursor: pointer on \[part='toggle'\]/);
});

test('FIRES: a stylesheet that styles :focus-visible on a part and carries no :hover at all', () => {
  const result = hoverContract(`
    export const styles = css\`
      [part='content'] {
        overflow: auto;
      }
      [part='content']:focus-visible {
        outline: 1px solid red;
      }
    \`;
  `);
  assert.equal(result.focusVisible, true);
  assert.equal(result.findings.length, 1);
  assert.match(result.findings[0].message, /no :hover rule at all/);
});

test('PASSES: the same part carries its own :hover', () => {
  const compliant = CLICKABLE.replace("[part='label']:hover", "[part='toggle']:hover");
  assert.deepEqual(messages(hoverContract(compliant, [TEMPLATE])), []);
});

test('PASSES: a host-level :hover covers every part below it', () => {
  const compliant = CLICKABLE.replace("[part='label']:hover", ":host(:hover) [part='base']");
  assert.deepEqual(messages(hoverContract(compliant, [TEMPLATE])), []);
});

test('PASSES: an ancestor part carries the hover (the lr-tree-item shape)', () => {
  const stylesheet = `
    export const styles = css\`
      [part='row']:hover {
        background: red;
      }
      [part='toggle'] {
        cursor: pointer;
      }
    \`;
  `;
  const template = 'html`<div part="row"><button part="toggle"></button></div>`';
  assert.deepEqual(messages(hoverContract(stylesheet, [template])), []);
  assert.equal(
    hoverContract(stylesheet, ['html`<div part="row"></div><button part="toggle"></button>`']).findings.length,
    1,
    'a SIBLING hover is not an affordance -- this is exactly the lr-flow-canvas edge-hit-area bug',
  );
});

test('PASSES: a no-hover-state marker several lines above the rule records the omission', () => {
  const stylesheet = `
    export const styles = css\`
      /* no-hover-state: a transparent hit target with nothing of its
         own to paint; the feedback belongs to its nested action. */
      [part='toggle'] {
        cursor: pointer;
      }
    \`;
  `;
  const result = hoverContract(stylesheet, [TEMPLATE]);
  assert.deepEqual(messages(result), []);
  assert.equal(result.pointerParts, 1, 'an opted-out part is still counted, so the gate cannot silently empty');
});

test('PASSES: a marker anywhere in the file answers the file-level focus-visible rule', () => {
  const stylesheet = `
    export const styles = css\`
      /* no-hover-state: a scrollable prose surface, focusable only so the keyboard can scroll it. */
      [part='content']:focus-visible {
        outline: 1px solid red;
      }
    \`;
  `;
  assert.deepEqual(messages(hoverContract(stylesheet)), []);
});

test('a :hover rule that itself sets cursor: pointer is not a finding', () => {
  const stylesheet = "[part='a']:hover { cursor: pointer; background: red; }";
  const result = hoverContract(stylesheet);
  assert.deepEqual(messages(result), []);
  assert.equal(result.pointerParts, 0, 'the hover rule is the answer, not the claim');
});

test('a cursor value other than pointer makes no claim', () => {
  assert.equal(hoverContract("[part='viewport'] { cursor: grab; }").pointerParts, 0);
  assert.equal(hoverContract("[part='row'] { cursor: default; }").pointerParts, 0);
});

// ---------------------------------------------------------------------------
// The transition rule
// ---------------------------------------------------------------------------

// The same clickable shape as above, with the pointer part carrying BOTH the hover affordance and
// the repaint, so every case below isolates the transition rule from the hover one.
const REPAINTS = [
  'export const styles = css`',
  "  [part='toggle'] {",
  '    background: var(--lr-color-surface);',
  '    cursor: pointer;',
  '  }',
  "  [part='toggle']:hover {",
  '    background: var(--lr-color-brand-quiet);',
  '  }',
  '`;',
].join('\n');
const TOGGLE_TEMPLATE = 'html`<button part="toggle"></button>`';

test('FIRES: a pointer part repainted under the pointer with no transition anywhere', () => {
  const result = hoverContract(REPAINTS, [TOGGLE_TEMPLATE]);
  assert.equal(result.repaintedPointerParts, 1);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].rule, 'transition');
  assert.equal(result.findings[0].line, 2, 'the finding points at the resting rule that owes the declaration');
  assert.match(result.findings[0].message, /nothing transitions it/);
  assert.match(result.findings[0].message, /--lr-transition-interactive/);
});

test('PASSES: the resting rule declares the shared interactive transition', () => {
  const compliant = REPAINTS.replace('    cursor: pointer;', '    cursor: pointer;\n    transition: var(--lr-transition-interactive);');
  const result = hoverContract(compliant, [TOGGLE_TEMPLATE]);
  assert.deepEqual(messages(result), []);
  assert.equal(result.repaintedPointerParts, 1, 'the part is still counted, so the rule cannot silently empty');
});

test('FIRES: an ancestor part carries the transition -- which covers the ancestor and nothing else', () => {
  // The hover half reads containment because the pointer that is over a part is over every
  // ancestor of it. `transition` is NOT an inherited property and applies only to the element whose
  // own value changes, so the nested toggle's background still jumps in one frame however richly
  // the row is animated. Counting containment here is how eight real gaps passed.
  const stylesheet = [
    'export const styles = css`',
    "  [part='row'] {",
    '    background: var(--lr-color-surface);',
    '    transition: var(--lr-transition-interactive);',
    '  }',
    "  [part='row']:hover {",
    '    background: var(--lr-color-brand-quiet);',
    '  }',
    "  [part='toggle'] {",
    '    background: none;',
    '    cursor: pointer;',
    '  }',
    "  [part='toggle']:hover {",
    '    background: var(--lr-color-brand-quiet);',
    '  }',
    '`;',
  ].join('\n');
  const nested = 'html`<div part="row"><button part="toggle"></button></div>`';
  const inside = hoverContract(stylesheet, [nested]);
  assert.equal(inside.findings.length, 1);
  assert.equal(inside.findings[0].part, 'toggle');
  assert.equal(inside.findings[0].rule, 'transition');
  const sibling = 'html`<div part="row"></div><button part="toggle"></button>`';
  const apart = hoverContract(stylesheet, [sibling]);
  assert.equal(apart.findings.length, 1, 'a sibling transition covers nothing either, for the same reason');
  assert.equal(apart.findings[0].part, 'toggle');
});

test('FIRES: a :host transition covers the host box, never the parts below it', () => {
  // transition is not inherited, so `:host { transition: opacity ... }` -- lr-message-actions'
  // reveal-on-interaction fade -- animates the host and nothing in the shadow tree. Reading it as
  // tree-wide exempted every repainting part in that file at once.
  const hosted = [
    'export const styles = css`',
    '  :host([reveal-on-interaction]) {',
    '    transition: opacity var(--lr-transition-fast);',
    '  }',
    REPAINTS.replace('export const styles = css`', '').replace(/`;$/, ''),
    '`;',
  ].join('\n');
  const result = hoverContract(hosted, [TOGGLE_TEMPLATE]);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].part, 'toggle');
  assert.equal(transitionCoverage(readStyleRules(':host { transition: all 1ms; }')).treeWide.size, 0);
  assert.equal(
    transitionCoverage(readStyleRules(":host(:hover) [part='base'] { transition: all 1ms; }")).parts.has('base'),
    true,
    'the SUBJECT is the part there, so the part is what gets animated',
  );
});

test('FIRES: transition: none is the declaration that says "do not move", not coverage', () => {
  const disabled = REPAINTS.replace('    cursor: pointer;', '    cursor: pointer;\n    transition: none;');
  const result = hoverContract(disabled, [TOGGLE_TEMPLATE]);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].rule, 'transition');
  assert.deepEqual([...transitionedFamilies('none')], []);
  assert.deepEqual([...transitionedFamilies(' background-color 1ms, transform 1ms ')], ['background', 'transform']);
  assert.deepEqual(
    [...transitionedFamilies('var(--lr-transition-fast)')],
    ['all'],
    'a duration/easing pair names no property, which is the shorthand initial `all`',
  );
});

test('FIRES: a resting transition that lives only inside the reduced-motion block', () => {
  // Reduced motion is where this library PUTS `transition: none`, so a transition found only there
  // is the opposite of the resting coverage rule 3 asks about.
  const reduced = REPAINTS.replace(
    '`;',
    ['  @media (prefers-reduced-motion: reduce) {', "    [part='toggle'] {", '      transition: none !important;', '    }', '  }', '`;'].join('\n'),
  );
  const result = hoverContract(reduced, [TOGGLE_TEMPLATE]);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].rule, 'transition');
  const kept = reduced.replace('transition: none !important;', 'transition: var(--lr-transition-interactive);');
  assert.equal(
    hoverContract(kept, [TOGGLE_TEMPLATE]).findings.length,
    1,
    'even a real transition declared only under reduced motion is not the resting answer',
  );
});

test('FIRES: a transition that names a property this part does not repaint', () => {
  const mismatched = REPAINTS.replace(
    '    cursor: pointer;',
    '    cursor: pointer;\n    transition: transform var(--lr-transition-fast);',
  );
  const result = hoverContract(mismatched, [TOGGLE_TEMPLATE]);
  assert.equal(result.findings.length, 1);
  assert.match(result.findings[0].message, /repaints its background/);
  const matched = mismatched.replace('transform var(--lr-transition-fast)', 'background-color var(--lr-transition-fast)');
  assert.deepEqual(messages(hoverContract(matched, [TOGGLE_TEMPLATE])), [], 'a longhand answers a shorthand repaint');
});

test('a repaint outside the token is told to name the property, not handed a no-op declaration', () => {
  // The shared token animates background-color/color/border-color. A part whose only pointer paint
  // change is its box-shadow would be "fixed" by writing that token and would still snap.
  const shadowOnly = [
    'export const styles = css`',
    "  [part='thumb'] {",
    '    box-shadow: var(--lr-shadow-s);',
    '    cursor: pointer;',
    '  }',
    "  [part='thumb']:hover {",
    '    box-shadow: var(--lr-shadow-m);',
    '  }',
    '`;',
  ].join('\n');
  const result = hoverContract(shadowOnly, ['html`<div part="thumb"></div>`']);
  assert.equal(result.findings.length, 1);
  assert.match(result.findings[0].message, /naming box-shadow/);
  assert.match(result.findings[0].message, /covers only background\/color\/border/);
  assert.deepEqual([...paintedFamilies('box-shadow: var(--lr-shadow-m);')], ['box-shadow']);
});

test('PASSES: adopting the shared interactive-transition sheet covers the whole shadow tree', () => {
  const classSource = [
    "import { interactiveTransition } from '../../../internal/interactive-transition.styles.js';",
    'static styles = [LyraElement.styles, interactiveTransition, styles];',
    TOGGLE_TEMPLATE,
  ].join('\n');
  const result = hoverContract(REPAINTS, [classSource]);
  assert.deepEqual(messages(result), []);
  assert.equal(result.repaintedPointerParts, 1);
});

test('PASSES: a no-transition-needed marker above the rule records the omission', () => {
  const marked = REPAINTS.replace(
    "  [part='toggle'] {",
    '  /* no-transition-needed: the press starts a drag and must land in the same frame. */\n' + "  [part='toggle'] {",
  );
  const result = hoverContract(marked, [TOGGLE_TEMPLATE]);
  assert.deepEqual(messages(result), []);
  assert.equal(result.repaintedPointerParts, 1, 'an opted-out part is still counted');
});

test('FIRES: a no-transition-needed marker with no reason after the colon', () => {
  const marked = REPAINTS.replace(
    "  [part='toggle'] {",
    '  /* no-transition-needed: */\n' + "  [part='toggle'] {",
  );
  const result = hoverContract(marked, [TOGGLE_TEMPLATE]);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].rule, 'marker');
  assert.match(result.findings[0].message, /records no reason/);
  assert.equal(transitionMarkerReason('  /* no-transition-needed: */'), '');
  assert.equal(
    transitionMarkerReason('/* no-transition-needed: the drag owns this frame */'),
    'the drag owns this frame',
  );
  assert.equal(transitionMarkerReason('[part="x"] { color: red; }'), null);
});

test('an instant-by-convention hover is not a repaint: opacity, outline, filter, fill and accent-color', () => {
  const instant = [
    "[part='rect'] { opacity: 0.4; cursor: pointer; }",
    "[part='rect']:hover { opacity: 1; outline: 1px solid; filter: brightness(1.1); fill: red; accent-color: red; }",
  ].join('\n');
  const result = hoverContract(instant, ['html`<div part="rect"></div>`']);
  assert.equal(result.repaintedPointerParts, 0, 'none of those properties flicker the way a fill change does');
  assert.deepEqual(messages(result), []);
  assert.equal(repaintedParts(readStyleRules(instant)).size, 0);
});

test('transition coverage reads the subject compound, and a bare [part] presence covers everything', () => {
  const scoped = transitionCoverage(readStyleRules("[part='row']:hover [part='cell'] { transition: all 1ms; }"));
  assert.deepEqual([...scoped.parts.keys()], ['cell'], 'the transition applies to the subject, not to the hovered ancestor');
  assert.equal(scoped.treeWide.size, 0);
  assert.deepEqual(
    [...transitionCoverage(readStyleRules(':where([part]) { transition: var(--lr-transition-interactive); }')).treeWide],
    ['background', 'color', 'border'],
    'the shared sheet interpolated into a component stylesheet covers every part it renders',
  );
  assert.equal(
    transitionCoverage(readStyleRules("[part='x'] { color: red; }")).parts.size,
    0,
    'a rule with no transition declaration contributes no coverage',
  );
  assert.equal(
    transitionCoverage(readStyleRules("[part='x'] { transition: none; }")).parts.size,
    0,
    'and neither does one whose value animates nothing',
  );
});

test('the shared sheet has to be imported AND used, not merely mentioned', () => {
  const importLine = "import { interactiveTransition } from '../../../internal/interactive-transition.styles.js';";
  assert.equal(adoptsSharedTransition([importLine, 'static styles = [LyraElement.styles, interactiveTransition, styles];'].join('\n')), true);
  assert.equal(adoptsSharedTransition([importLine, 'export const styles = css`${interactiveTransition}`;'].join('\n')), true);
  assert.equal(
    adoptsSharedTransition('/* interactive-transition.styles is deliberately not adopted here. */'),
    false,
    'a prose mention of the module path is not adoption -- it used to exempt the whole stylesheet',
  );
  assert.equal(adoptsSharedTransition(importLine), false, 'an unused import is not adoption either');
});

test('a no-transition-needed reason may be the multi-line paragraph these stylesheets favour', () => {
  const marked = REPAINTS.replace(
    "  [part='toggle'] {",
    [
      '  /* no-transition-needed:',
      '     the press starts a drag, and the drag must land in the same frame as the',
      '     pointerdown that begins it. */',
      "  [part='toggle'] {",
    ].join('\n'),
  );
  assert.deepEqual(messages(hoverContract(marked, [TOGGLE_TEMPLATE])), []);
  assert.match(
    transitionMarkerReason('/* no-transition-needed:\n   the press starts\n   a drag. */'),
    /^the press starts a drag\.$/,
  );
});

// ----- rule 4: state-masked fallback -----------------------------------------------------------
// The reduced shape lr-switch shipped: the checked rule re-points a private, but every paint site
// layers it under the RESTING public token, so setting `--lr-switch-track-fill` masks the checked
// state entirely.
const MASKED_SWITCH = [
  '  [part~="track"] {',
  '    --_lr-switch-track-fill: var(--lr-color-border);',
  '    background: var(--lr-switch-track-fill, var(--_lr-switch-track-fill));',
  '  }',
  '  [part~="track"][part~="checked"] {',
  '    --_lr-switch-track-fill: var(--lr-switch-checked-track-fill, var(--lr-color-brand));',
  '  }',
  '  .layout:hover [part~="track"] {',
  '    background: var(',
  '      --lr-switch-track-hover-fill,',
  '      color-mix(in oklab, var(--lr-switch-track-fill, var(--_lr-switch-track-fill)), black 10%)',
  '    );',
  '  }',
].join('\n');

// The fixed shape: the private folds the public token in per state and is read bare; the pointer
// token wrapping it is a deliberate override, not a mask.
const FIXED_SWITCH = [
  '  [part~="track"] {',
  '    --_lr-switch-track-fill: var(--lr-switch-track-fill, var(--lr-color-border));',
  '    background: var(--_lr-switch-track-fill);',
  '  }',
  '  [part~="track"][part~="checked"] {',
  '    --_lr-switch-track-fill: var(--lr-switch-checked-track-fill, var(--lr-color-brand));',
  '  }',
  '  .layout:hover [part~="track"] {',
  '    background: var(',
  '      --lr-switch-track-hover-fill,',
  '      color-mix(in oklab, var(--_lr-switch-track-fill), black 10%)',
  '    );',
  '  }',
].join('\n');

test('rule 4 flags a state-declared private layered under a resting public token', () => {
  const findings = stateMaskedFallbacks(MASKED_SWITCH);
  assert.deepEqual(
    findings.map((finding) => finding.line),
    [3, 11],
    'one finding per consumption site, nested color-mix() fallback included',
  );
  assert.match(findings[0].message, /state rule at line 5/);
  assert.match(findings[0].message, /--lr-switch-track-fill/);
  assert.match(findings[0].message, /consume it bare/);
});

test('rule 4 passes the bare-consumption fix and a pointer token wrapping the private', () => {
  assert.deepEqual(stateMaskedFallbacks(FIXED_SWITCH), []);
});

test('rule 4 ignores a private no state rule declares', () => {
  const sizeOnly = MASKED_SWITCH.replace('[part~="track"][part~="checked"]', ':host([size="small"]) [part~="track"]');
  assert.deepEqual(stateMaskedFallbacks(sizeOnly), []);
});

test('rule 4 honours a state-fallback-ok marker above the consuming rule only', () => {
  const marked = MASKED_SWITCH.replace(
    '  [part~="track"] {',
    '  /* state-fallback-ok: the resting token is documented as authoritative in every state */\n  [part~="track"] {',
  );
  assert.deepEqual(
    stateMaskedFallbacks(marked).map((finding) => finding.line),
    [12],
    'the marker opts out the next rule, not the whole stylesheet',
  );
});

test('rule 4 state qualifiers cover the documented forms and skip outcome suffixes', () => {
  for (const selector of [
    ':host(:state(checked)) [part="track"]',
    '[part~="page-current"]',
    '[part~="checkbox__control--checked"]',
    '[part="item"][aria-selected="true"]',
    ':host(:where([open])) [part="panel"]',
    'input:checked + span',
    '[part="row"][data-active]',
  ]) {
    assert.equal(hasStateQualifier(selector), true, selector);
  }
  for (const selector of [
    ':host([size="small"]) [part="track"]',
    '[part~="status-success"]',
    ':host([variant="brand"]) [part="base"]',
    '[part="dot"][data-stalled]',
  ]) {
    assert.equal(hasStateQualifier(selector), false, selector);
  }
});

if (failures > 0) {
  console.error(`check-interaction-states self-test FAILED: ${failures} of ${failures + passes} case(s).`);
  process.exitCode = 1;
} else {
  console.log(`check-interaction-states self-test passed: ${passes} case(s).`);
}
