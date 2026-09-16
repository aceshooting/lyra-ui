import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classFiles,
  composesSharedSrOnly,
  dynamicAttributeExpressions,
  importsFromA11y,
  rendersSrOnlyClass,
  siblingStylesFile,
  stripNonRenderedText,
  stylesArrayIncludes,
  stylesFileDeclaresSrOnlyRule,
} from './check-visually-hidden.mjs';

test('classFiles finds only *.class.ts files, recursively', () => {
  const files = classFiles(new URL('./', import.meta.url).pathname.replace(/\/$/, '').concat('/../src/internal'));
  // internal/ has no *.class.ts files at all -- components live under src/components -- so this
  // proves the walker recurses without ever matching a sibling *.ts/.styles.ts/.test.ts file.
  assert.deepEqual(files, []);
});

// -- stripNonRenderedText ------------------------------------------------------------------

test('stripNonRenderedText blanks a /* */ block comment but keeps real code intact', () => {
  const source = 'const a = 1;\n/* a block comment about class="sr-only" */\nconst b = 2;';
  const stripped = stripNonRenderedText(source);
  assert.ok(!stripped.includes('sr-only'), 'the commented-out mention must not survive');
  assert.ok(stripped.includes('const a = 1;') && stripped.includes('const b = 2;'));
});

test('stripNonRenderedText blanks an HTML comment reachable inside an html`` template', () => {
  const source = 'html`<!-- refers to [part="x"]\'s class="sr-only" box --><div>real</div>`';
  const stripped = stripNonRenderedText(source);
  assert.ok(!stripped.includes('sr-only'), 'prose inside an HTML comment must not survive');
  assert.ok(stripped.includes('<div>real</div>'));
});

test('stripNonRenderedText leaves a backtick-quoted mention (this codebase\'s own JSDoc convention) untouched either way', () => {
  // button.class.ts's real shape: a `.sr-only` markdown code-span in a `//` line comment. Line
  // comments are deliberately NOT stripped (see the script's own header comment), so this must
  // survive stripNonRenderedText -- rendersSrOnlyClass is the layer that must still not be fooled
  // by it, because it requires a real quote character immediately around the token, not a backtick.
  const source = '// counting it as content made an icon+`.sr-only` button work';
  assert.equal(stripNonRenderedText(source), source);
});

// -- dynamicAttributeExpressions -----------------------------------------------------------

test('dynamicAttributeExpressions extracts a simple ternary bound to class=', () => {
  const source = "html`<span class=${cond ? 'sr-only' : ''}>x</span>`";
  assert.deepEqual(dynamicAttributeExpressions(source, 'class'), ["cond ? 'sr-only' : ''"]);
});

test('dynamicAttributeExpressions is not fooled by a nested object literal\'s own inner brace', () => {
  // A hypothetical future classMap() binding -- not used by any component today, but the whole
  // point of brace-depth counting (mirroring check-custom-property-cycles.mjs's paren counting)
  // rather than a naive `[^}]*?` is to keep working if one is ever added.
  const source = "html`<span class=${classMap({ 'sr-only': cond, base: true })}>x</span>`";
  assert.deepEqual(
    dynamicAttributeExpressions(source, 'class'),
    ["classMap({ 'sr-only': cond, base: true })"],
  );
});

test('dynamicAttributeExpressions finds every class=${...} binding in the file', () => {
  const source = "html`<a class=${x}></a><b class=${y}></b>`";
  assert.deepEqual(dynamicAttributeExpressions(source, 'class'), ['x', 'y']);
});

// -- rendersSrOnlyClass ---------------------------------------------------------------------

test('flags a static class="sr-only" attribute', () => {
  assert.equal(rendersSrOnlyClass('html`<span class="sr-only">x</span>`'), true);
});

test('flags a static class attribute where sr-only is one of several tokens', () => {
  assert.equal(rendersSrOnlyClass('html`<span class="sr-only loading-label">x</span>`'), true);
});

test('flags a dynamic class=${cond ? \'sr-only\' : \'\'} binding', () => {
  assert.equal(rendersSrOnlyClass("html`<span class=${cond ? 'sr-only' : ''}>x</span>`"), true);
});

test('flags a dynamic class binding where sr-only is one of several space-separated tokens', () => {
  // filter-bar.class.ts's actual shape has the plain form; locale-picker.class.ts's real shape is
  // this multi-token one: `class=${flagOnly ? 'trigger-label sr-only' : 'trigger-label'}`.
  const source = "html`<span class=${flagOnly ? 'trigger-label sr-only' : 'trigger-label'}>x</span>`";
  assert.equal(rendersSrOnlyClass(source), true);
});

test('does not flag a component that never renders the class at all', () => {
  assert.equal(rendersSrOnlyClass('html`<span part="label">${this.label}</span>`'), false);
});

test('does not flag a backtick-quoted comment mention (button.class.ts\'s real shape)', () => {
  const source = [
    "// counting it as content made an icon+`.sr-only` button -- the library's own recommended way",
    'html`<button part="button"><slot></slot></button>`',
  ].join('\n');
  assert.equal(rendersSrOnlyClass(source), false);
});

test('does not flag an HTML comment prose mention inside a template (graph.class.ts\'s real shape)', () => {
  const source = 'html`<!-- lives inside [part="cursor-items"]\'s class="sr-only" box --><button>x</button>`';
  assert.equal(rendersSrOnlyClass(source), false);
});

test('does not flag an unrelated quoted string that merely contains the substring near other classes', () => {
  assert.equal(rendersSrOnlyClass('const label = "not-sr-only-really";'), false);
});

// -- importsFromA11y -------------------------------------------------------------------------

test('finds srOnly imported alone from a11y.js', () => {
  const source = "import { srOnly } from '../../../internal/a11y.js';";
  assert.equal(importsFromA11y(source, 'srOnly'), true);
});

test('finds srOnly imported alongside other named exports from a11y.js', () => {
  const source = "import { hostAriaLabel, nextId, srOnly } from '../../../internal/a11y.js';";
  assert.equal(importsFromA11y(source, 'srOnly'), true);
});

test('finds srOnly across a multi-line named-import list (menu-item.class.ts\'s own a11y.js import shape)', () => {
  const source = [
    'import {',
    '  composedParentElement,',
    '  srOnly,',
    "} from '../../../internal/a11y.js';",
  ].join('\n');
  assert.equal(importsFromA11y(source, 'srOnly'), true);
});

test('returns false when a11y.js is imported but srOnly is not among the names', () => {
  const source = "import { hasRealContent } from '../../../internal/a11y.js';";
  assert.equal(importsFromA11y(source, 'srOnly'), false);
});

test('returns false when srOnly only ever comes from an unrelated module', () => {
  const source = "import { srOnly } from '../../../internal/something-else.js';";
  assert.equal(importsFromA11y(source, 'srOnly'), false);
});

test('is not fooled by an EARLIER, unrelated import statement into folding two statements into one', () => {
  // Regression test for the real defect this checker's first draft had: agent-run.class.ts's own
  // real source imports `lit` (with a `{ ... }` named-import list) several lines before its
  // separate, single-name `import { srOnly } from '.../a11y.js';` statement. A single non-greedy
  // regex requiring "ends with internal/a11y.js" inside the SAME match let the lazy `{...}` span
  // jump clean over the `lit` import's own unrelated `} from 'lit'` (which doesn't satisfy the
  // suffix) and keep expanding into the next statement, splicing "import { srOnly" together as one
  // bogus, un-matchable token instead of the real standalone name "srOnly". Reverting the fix (by
  // combining both conditions into one non-greedy `import\s*\{([\s\S]*?)\}\s*from\s*['"][^'"]*
  // internal\/a11y\.js['"]` pattern) reproduces a false negative here.
  const source = [
    "import { html, nothing, type TemplateResult } from 'lit';",
    "import { property, state } from 'lit/decorators.js';",
    "import { srOnly } from '../../../internal/a11y.js';",
  ].join('\n');
  assert.equal(importsFromA11y(source, 'srOnly'), true);
});

// -- stylesArrayIncludes ---------------------------------------------------------------------

test('finds an identifier in a single-line styles array', () => {
  const source = 'static override styles = [LyraElement.styles, sizes, srOnly, styles];';
  assert.equal(stylesArrayIncludes(source, 'srOnly'), true);
});

test('finds an identifier in a multi-line styles array (graph.class.ts\'s own shape)', () => {
  const source = [
    'static override styles = [',
    '  LyraElement.styles,',
    '  specialistTokens,',
    '  styles,',
    '  srOnly,',
    '];',
  ].join('\n');
  assert.equal(stylesArrayIncludes(source, 'srOnly'), true);
});

test('does not find an identifier absent from the styles array', () => {
  const source = 'static override styles = [LyraElement.styles, styles];';
  assert.equal(stylesArrayIncludes(source, 'srOnly'), false);
});

// -- stylesFileDeclaresSrOnlyRule / siblingStylesFile ----------------------------------------

test('finds a scoped .sr-only rule (pagination.styles.ts\'s own shape)', () => {
  const source = '[part="live-region"].sr-only {\n  position: absolute;\n}';
  assert.equal(stylesFileDeclaresSrOnlyRule(source), true);
});

test('finds a plain .sr-only rule', () => {
  assert.equal(stylesFileDeclaresSrOnlyRule('.sr-only { position: absolute; }'), true);
});

test('does not find a rule for an unrelated selector', () => {
  assert.equal(stylesFileDeclaresSrOnlyRule(':host { display: block; }'), false);
});

test('does not find a bare mention of the token with no rule body', () => {
  assert.equal(stylesFileDeclaresSrOnlyRule('/* apply .sr-only by hand if needed */'), false);
});

test('siblingStylesFile swaps the .class.ts suffix for .styles.ts', () => {
  assert.equal(
    siblingStylesFile('/repo/src/components/data/pagination/pagination.class.ts'),
    '/repo/src/components/data/pagination/pagination.styles.ts',
  );
});

// -- composesSharedSrOnly, and the real before/after fix shapes ------------------------------

const BEFORE_FIX_INPUT_SHAPE = `
import { html, nothing } from 'lit';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './input.styles.js';

export class LyraInput extends LyraElement {
  static override styles = [LyraElement.styles, styles];

  override render() {
    return html\`
      <span id="input-required" class="sr-only" ?hidden=\${!this.required}
        >\${this.localize('fieldRequired')}</span
      >
    \`;
  }
}
`;

const AFTER_FIX_SHARED_SR_ONLY_SHAPE = `
import { html, nothing } from 'lit';
import { LyraElement } from '../../../internal/lyra-element.js';
import { srOnly } from '../../../internal/a11y.js';
import { styles } from './input.styles.js';

export class LyraInput extends LyraElement {
  static override styles = [LyraElement.styles, srOnly, styles];

  override render() {
    return html\`
      <span id="input-required" class="sr-only" ?hidden=\${!this.required}
        >\${this.localize('fieldRequired')}</span
      >
    \`;
  }
}
`;

/** The same pass/fail decision `check-visually-hidden.mjs`'s main block makes for one file, given
 *  its own source and (when present) its sibling `*.styles.ts` source. */
function isRemediated(classSource, stylesSource) {
  if (!rendersSrOnlyClass(classSource)) return true;
  if (composesSharedSrOnly(classSource)) return true;
  return stylesSource != null && stylesFileDeclaresSrOnlyRule(stylesSource);
}

test('flags the pre-fix input.class.ts shape (renders the class, composes nothing)', () => {
  assert.equal(rendersSrOnlyClass(BEFORE_FIX_INPUT_SHAPE), true);
  assert.equal(composesSharedSrOnly(BEFORE_FIX_INPUT_SHAPE), false);
  assert.equal(isRemediated(BEFORE_FIX_INPUT_SHAPE, null), false);
});

test('does not flag the post-fix shape that composes the shared srOnly export', () => {
  assert.equal(composesSharedSrOnly(AFTER_FIX_SHARED_SR_ONLY_SHAPE), true);
  assert.equal(isRemediated(AFTER_FIX_SHARED_SR_ONLY_SHAPE, null), true);
});

test('does not flag the post-fix shape that instead declares its own scoped rule (pagination\'s shape)', () => {
  const classSource = `
    import { html } from 'lit';
    import { LyraElement } from '../../../internal/lyra-element.js';
    import { styles } from './pagination.styles.js';
    export class LyraPagination extends LyraElement {
      static override styles = [LyraElement.styles, styles];
      override render() {
        return html\`<span part="live-region" class="sr-only">\${this.liveText}</span>\`;
      }
    }
  `;
  const stylesSource = '[part="live-region"].sr-only { position: absolute; clip-path: inset(50%); }';
  assert.equal(composesSharedSrOnly(classSource), false);
  assert.equal(isRemediated(classSource, stylesSource), true);
});

test('still flags a component with a sibling styles file that does not declare a matching rule', () => {
  const classSource = BEFORE_FIX_INPUT_SHAPE;
  const stylesSource = ':host { display: block; }';
  assert.equal(isRemediated(classSource, stylesSource), false);
});
