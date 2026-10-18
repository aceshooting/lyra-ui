import { expect } from '@open-wc/testing';
import type { RubricKey, RubricValue } from '../../forms/rubric-form/rubric-form.class.js';
import { projectEvalSourceReview } from './eval-result-source.js';

const keys: readonly RubricKey[] = [{ key: 'choices', type: 'category', multiple: true }, { key: 'notes', type: 'comment' }];

it('owns configured review arrays without reading unrelated provider fields', () => {
  const choices = ['a', 'b'];
  let unrelatedReads = 0;
  const review = Object.defineProperty({ choices }, 'unrelated', { get() { unrelatedReads++; throw new Error('Unrelated field'); } });
  const projected = projectEvalSourceReview(review, keys, () => true);
  expect(projected['choices']).to.deep.equal(['a', 'b']);
  expect(projected['choices'] === choices).to.equal(false);
  expect(Object.isFrozen(projected)).to.equal(true);
  expect(Object.isFrozen(projected['choices'])).to.equal(true);
  expect(Object.hasOwn(projected, 'notes')).to.equal(true);
  expect(projected['notes']).to.equal(undefined);
  expect(Object.hasOwn(projected, 'unrelated')).to.equal(false);
  choices[0] = 'changed';
  expect(projected['choices']).to.deep.equal(['a', 'b']);
  expect(unrelatedReads).to.equal(0);
});

it('enforces aggregate entry and text limits before publishing review arrays', () => {
  const configured = keys.slice(0, 1);
  const entries = Array.from({ length: 9999 }, () => '');
  expect((projectEvalSourceReview({ choices: entries }, configured, () => true)['choices'] as readonly string[]).length).to.equal(9999);
  let excessReads = 0;
  const oversized = new Array<string>(10_000);
  Object.defineProperty(oversized, '0', { get() { excessReads++; return 'unsafe'; } });
  expect(() => projectEvalSourceReview({ choices: oversized }, configured, () => true)).to.throw(RangeError);
  expect(excessReads).to.equal(0);
  const text = 'x'.repeat(65_536 - 'choices'.length);
  expect(projectEvalSourceReview({ choices: [text] }, configured, () => true)['choices']).to.deep.equal([text]);
  expect(() => projectEvalSourceReview({ choices: [text + 'x'] }, configured, () => true)).to.throw(RangeError);
});

it('rejects sparse, accessor and malformed review selections without invoking getters', () => {
  let reads = 0;
  const accessor = ['a'];
  Object.defineProperty(accessor, '0', { get() { reads++; return 'unsafe'; } });
  for (const choices of [new Array<string>(1), accessor, [42], { selected: 'a' }]) {
    expect(() => projectEvalSourceReview({ choices } as unknown as RubricValue, keys, () => true)).to.throw(TypeError);
  }
  expect(reads).to.equal(0);
});

it('stops review projection when an array descriptor revokes the current source', () => {
  let current = true;
  const visited: PropertyKey[] = [];
  const choices = new Proxy(['a', 'b'], {
    getOwnPropertyDescriptor(target, key) {
      visited.push(key);
      if (key === '0') current = false;
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  expect(() => projectEvalSourceReview({ choices }, keys, () => current)).to.throw('Source record revoked');
  expect(visited).to.deep.equal(['length', '0']);
});
