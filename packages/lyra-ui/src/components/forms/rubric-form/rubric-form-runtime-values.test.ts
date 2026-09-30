import { expect, fixture, html } from '@open-wc/testing';
import './rubric-form.js';
import type { LyraRubricForm, RubricKey, RubricKeyOption } from './rubric-form.class.js';

it('contains revoked schema arrays without disturbing other mounted forms', async () => {
  const el = await fixture<LyraRubricForm>(html`<lr-rubric-form .keys=${[{ key: 'notes', type: 'comment' }]}></lr-rubric-form>`);
  const revoked = Proxy.revocable([], {});
  revoked.revoke();
  expect(() => { el.keys = revoked.proxy as readonly RubricKey[]; }).not.to.throw();
  await el.updateComplete;
  expect(el.keys).to.deep.equal([]);
  expect(el.shadowRoot!.querySelectorAll('lr-textarea').length).to.equal(0);
});

it('drops a revoked schema row while retaining the later accessible field', async () => {
  const el = await fixture<LyraRubricForm>(html`<lr-rubric-form></lr-rubric-form>`);
  const revoked = Proxy.revocable({ key: 'unavailable', type: 'comment' }, {});
  revoked.revoke();
  expect(() => {
    el.keys = [revoked.proxy as RubricKey, { key: 'notes', type: 'comment', label: 'Notes' }];
  }).not.to.throw();
  await el.updateComplete;
  expect(el.keys.map(key => key.key)).to.deep.equal(['notes']);
  expect(el.shadowRoot!.querySelectorAll('lr-textarea').length).to.equal(1);
  await expect(el).to.be.accessible();
});

it('contains revoked category options and removes invalid label metadata from valid choices', async () => {
  const revoked = Proxy.revocable([], {});
  revoked.revoke();
  const malformed = { value: 'yes', label: 42, description: false } as unknown as RubricKeyOption;
  const el = await fixture<LyraRubricForm>(html`<lr-rubric-form></lr-rubric-form>`);
  el.keys = [
    { key: 'empty', type: 'category', label: 'Empty choices', options: revoked.proxy as readonly RubricKeyOption[] },
    { key: 'decision', type: 'category', label: 'Decision', options: [malformed] },
  ];
  await el.updateComplete;
  const empty = el.keys[0]!;
  const decision = el.keys[1]!;
  expect(empty.type).to.equal('category');
  expect(decision.type).to.equal('category');
  if (empty.type !== 'category' || decision.type !== 'category') throw new Error('Expected category schemas');
  expect(empty.options).to.deep.equal([]);
  expect(decision.options).to.deep.equal([{ value: 'yes' }]);
  expect(el.shadowRoot!.textContent).not.to.contain('42');
  expect(el.shadowRoot!.textContent).not.to.contain('false');
});
