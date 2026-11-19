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

test('the axe call and the mount may live in different files only when one file has both', () => {
  assert.equal(hasAccessibilityAssertion([mounted, 'await expect(el).to.be.accessible();'], 'lr-demo'), false);
});

test('a parameterized tag string counts as mounting the tag', () => {
  assert.equal(exercisesTag("for (const tag of ['lr-demo']) {}", 'lr-demo'), true);
});
