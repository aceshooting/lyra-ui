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
  hoverContract,
  hoverCoverage,
  partContainment,
  partsInSelector,
  pressedForm,
  readHoverRules,
  readStyleRules,
  styledParts,
  targetsPart,
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
// each case below isolates the per-part rule.
const CLICKABLE = [
  'export const styles = css`',
  "  [part='label']:hover {",
  '    color: blue;',
  '  }',
  "  [part='toggle'] {",
  '    border: none;',
  '    cursor: pointer;',
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

if (failures > 0) {
  console.error(`check-interaction-states self-test FAILED: ${failures} of ${failures + passes} case(s).`);
  process.exitCode = 1;
} else {
  console.log(`check-interaction-states self-test passed: ${passes} case(s).`);
}
