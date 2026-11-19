import assert from 'node:assert/strict';
import test from 'node:test';

import { exercisesTag, hasAccessibilityAssertion } from './check-component-coverage.mjs';

const mounted = "const el = await fixture(html`<lr-demo></lr-demo>`);";

test('prose that mentions accessibility does not satisfy the axe requirement', () => {
  const prose = `${mounted}\n// the demo stays accessible to screen readers\nit('is accessible by name', () => {});`;
  assert.equal(hasAccessibilityAssertion([prose], 'lr-demo'), false);
});

test('an axe call in a file that never mounts the tag does not count for that tag', () => {
  const other = "await fixture(html`<lr-other></lr-other>`); await expect(el).to.be.accessible();";
  assert.equal(hasAccessibilityAssertion([other], 'lr-demo'), false);
});

test('a file that mounts the tag and calls to.be.accessible satisfies the requirement', () => {
  assert.equal(hasAccessibilityAssertion([`${mounted} await expect(el).to.be.accessible();`], 'lr-demo'), true);
});

test('separate files for the axe call and mount do not satisfy the requirement', () => {
  assert.equal(hasAccessibilityAssertion([mounted, 'await expect(el).to.be.accessible();'], 'lr-demo'), false);
});

test('a parameterized tag string counts as mounting the tag', () => {
  assert.equal(exercisesTag("for (const tag of ['lr-demo']) {}", 'lr-demo'), true);
});

test('comments, strings, and property reads do not execute an axe assertion', () => {
  for (const source of [
    '// await expect(el).to.be.accessible();',
    "it('should call to.be.accessible()', () => {});",
    'const check = expect(el).to.be.accessible;',
    'await expect(el).to.be[otherAssertion]();',
    'await expect(el)[modifier].to.be.accessible();',
    'await report.to.be.accessible();',
  ]) {
    assert.equal(hasAccessibilityAssertion([`${mounted}\n${source}`], 'lr-demo'), false, source);
  }
});

test('an axe assertion is recognized across lines and through shadowDom', () => {
  const assertion = 'await expect(el).shadowDom\n  .to.be\n  .accessible({ ignoredRules: [] });';
  assert.equal(hasAccessibilityAssertion([`${mounted}\n${assertion}`], 'lr-demo'), true);
});

test('an asserted violation does not meet the accessibility requirement', () => {
  assert.equal(hasAccessibilityAssertion([`${mounted} await expect(el).to.not.be.accessible();`], 'lr-demo'), false);
});

test('a tag mentioned only in a comment does not count as mounted', () => {
  const source = "// <lr-demo>\nawait fixture(html`<lr-other></lr-other>`); await expect(el).to.be.accessible();";
  assert.equal(hasAccessibilityAssertion([source], 'lr-demo'), false);
});

test('a parameterized axe fixture can name its tags in an array', () => {
  const source = "for (const tag of ['lr-demo']) { await expect(await fixture(html`<${tag}>`)).to.be.accessible(); }";
  assert.equal(hasAccessibilityAssertion([source], 'lr-demo'), true);
});
