import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { AXE_ASSERTION, evaluateQualification, mountsTag, normalizeExemptions } from './check-qualification.mjs';

const stable = (tag) => ({ tag, maturity: { status: 'stable' }, classModule: `src/components/x/${tag}/${tag}.ts` });
const evaluate = (components, exemptions, tests) =>
  evaluateQualification({ components, exemptions: { exemptions }, loadTests: () => tests });

test('mountsTag matches a literal fixture and a tag string, not a prefix collision', () => {
  assert.ok(mountsTag('<lr-button>', 'lr-button'));
  assert.ok(mountsTag('<lr-button />', 'lr-button'));
  assert.ok(mountsTag("fixture(`<${'lr-button'}>`)", 'lr-button'));
  assert.equal(mountsTag('<lr-button-group>', 'lr-button'), false);
});

// --- the evidence predicate itself -------------------------------------------------------------
// Regression pin for the 2026-08-02 false-negative incident: the first predicate omitted
// `be.accessible`, which is the ONLY spelling this package writes, so it failed 234 of 280 stable
// components that all had real axe assertions. See docs/agents/component-qualification.md.

test("the library's real idiom counts as an axe assertion", () => {
  // Copied verbatim from src/components/forms/button/button.test.ts -- not a paraphrase, because
  // a paraphrase is exactly how the predicate drifted off the real idiom in the first place.
  assert.ok(AXE_ASSERTION.test('    await expect(el).to.be.accessible();'));
  assert.ok(AXE_ASSERTION.test('await expect(el).to.be.accessible()'));
  assert.ok(AXE_ASSERTION.test('expect(await fixture(html`<lr-a></lr-a>`)).to.be.accessible();'));
});

test('the other axe spellings still count, so an imported idiom is not rejected', () => {
  for (const spelling of ['await axe(el);', 'expect(results).toBeAccessible();', 'await isAccessible(el);']) {
    assert.ok(AXE_ASSERTION.test(spelling), spelling);
  }
});

test('prose that merely mentions accessibility is not evidence', () => {
  assert.equal(AXE_ASSERTION.test('it("is accessible", () => { expect(el).to.exist; })'), false);
  assert.equal(AXE_ASSERTION.test('// this component is accessible by construction'), false);
});

test('a lone negative accessibility assertion is not evidence', () => {
  // `to.not.be.accessible()` pins a *documented violation*; counting it would qualify a component
  // on a proof that it is inaccessible.
  assert.equal(AXE_ASSERTION.test('await expect(el).to.not.be.accessible();'), false);
});

test('a positive assertion still counts alongside a negative one in the same file', () => {
  assert.ok(
    AXE_ASSERTION.test(
      ['await expect(bad).to.not.be.accessible();', 'await expect(good).to.be.accessible();'].join('\n'),
    ),
  );
});

test('a stable component whose only evidence is the real idiom needs no exemption', () => {
  const { failures, stale } = evaluate(
    [stable('lr-a')],
    [],
    'const el = await fixture(html`<lr-a>Save</lr-a>`);\n    await expect(el).to.be.accessible();',
  );
  assert.deepEqual(failures, []);
  assert.deepEqual(stale, []);
});

test('the ratchet fires on the real idiom too, not just on axe()', () => {
  const { stale } = evaluate(
    [stable('lr-a')],
    [{ tag: 'lr-a', dimension: 'accessibility', reason: 'documented reason that is long enough' }],
    'const el = await fixture(html`<lr-a></lr-a>`);\n    await expect(el).to.be.accessible();',
  );
  assert.equal(stale.length, 1);
  assert.match(stale[0], /evidence has landed/);
});

test('the shipped exemptions file is well-formed', () => {
  const shipped = JSON.parse(fs.readFileSync(new URL('./qualification-exemptions.json', import.meta.url), 'utf8'));
  const { problems } = normalizeExemptions(shipped);
  assert.deepEqual(problems, []);
});

test('a stable component with a populated-state axe assertion qualifies', () => {
  const { failures, stale } = evaluate([stable('lr-a')], [], 'it("a11y", async () => { const el = await fixture(`<lr-a></lr-a>`); await expect(el).to.be.accessible(); await axe(el); })');
  assert.deepEqual(failures, []);
  assert.deepEqual(stale, []);
});

test('an axe call that never mounts THIS tag does not qualify it', () => {
  const { failures } = evaluate([stable('lr-a')], [], 'await axe(await fixture(`<lr-other></lr-other>`))');
  assert.equal(failures.length, 1);
  assert.match(failures[0], /lr-a: claims maturity "stable"/);
});

test('mounting the tag without any axe assertion does not qualify it', () => {
  // This is precisely the hole check-component-coverage.mjs leaves open.
  const { failures } = evaluate([stable('lr-a')], [], 'await fixture(`<lr-a></lr-a>`); expect(el).to.exist;');
  assert.equal(failures.length, 1);
});

test('a reviewed exemption suppresses the failure', () => {
  const { failures, stale } = evaluate(
    [stable('lr-a')],
    [{ tag: 'lr-a', dimension: 'accessibility', reason: 'documented reason that is long enough' }],
    'no evidence here',
  );
  assert.deepEqual(failures, []);
  assert.deepEqual(stale, []);
});

test('an exemption whose evidence has landed is reported stale (the ratchet)', () => {
  const { failures, stale } = evaluate(
    [stable('lr-a')],
    [{ tag: 'lr-a', dimension: 'accessibility', reason: 'documented reason that is long enough' }],
    'await axe(await fixture(`<lr-a></lr-a>`))',
  );
  assert.deepEqual(failures, []);
  assert.equal(stale.length, 1);
  assert.match(stale[0], /evidence has landed/);
});

test('an exemption for a component that no longer exists is stale', () => {
  const { stale } = evaluate(
    [stable('lr-a')],
    [
      { tag: 'lr-a', dimension: 'accessibility', reason: 'documented reason that is long enough' },
      { tag: 'lr-gone', dimension: 'accessibility', reason: 'documented reason that is long enough' },
    ],
    'no evidence',
  );
  assert.equal(stale.length, 1);
  assert.match(stale[0], /lr-gone.*no such component/);
});

test('an exemption for a component that is no longer stable is stale', () => {
  const experimental = { tag: 'lr-b', maturity: { status: 'experimental' }, classModule: 'src/components/x/b/b.ts' };
  const { failures, stale } = evaluate(
    [experimental],
    [{ tag: 'lr-b', dimension: 'accessibility', reason: 'documented reason that is long enough' }],
    'no evidence',
  );
  assert.deepEqual(failures, []);
  assert.equal(stale.length, 1);
  assert.match(stale[0], /no longer "stable"/);
});

test('an experimental component is not gated at all', () => {
  const experimental = { tag: 'lr-b', maturity: { status: 'experimental' }, classModule: 'src/components/x/b/b.ts' };
  const { failures, stale } = evaluate([experimental], [], 'no evidence');
  assert.deepEqual(failures, []);
  assert.deepEqual(stale, []);
});

test('malformed exemptions are rejected rather than silently ignored', () => {
  const { problems } = normalizeExemptions({
    exemptions: [
      { dimension: 'accessibility', reason: 'missing the tag entirely' },
      { tag: 'lr-a', dimension: 'telepathy', reason: 'not a real dimension at all' },
      { tag: 'lr-a', dimension: 'accessibility', reason: 'too short' },
    ],
  });
  assert.equal(problems.length, 3);
});
