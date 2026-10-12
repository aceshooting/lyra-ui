import { expect, fixture, html } from '@open-wc/testing';
import type { LyraStepper } from './stepper.class.js';
import './stepper.js';

const validSteps = [
  { stepId: 'review', label: 'Review', state: 'current' as const },
  { stepId: 'submit', label: 'Submit', state: 'pending' as const },
];

it('fails closed for revoked arrays and throwing lengths, then renders a later valid assignment', async () => {
  const el = (await fixture(html`<lr-stepper></lr-stepper>`)) as LyraStepper;
  const revoked = Proxy.revocable([], {});
  revoked.revoke();
  el.steps = revoked.proxy as unknown as typeof el.steps;
  await el.updateComplete;
  expect(el.steps).to.have.length(0);
  expect(el.shadowRoot!.querySelectorAll('[part="step"]').length).to.equal(0);

  const hostileLength = new Proxy([], {
    get(target, property, receiver) {
      if (property === 'length') throw new Error('length is unavailable');
      return Reflect.get(target, property, receiver);
    },
  });
  el.steps = hostileLength as unknown as typeof el.steps;
  await el.updateComplete;
  expect(el.steps).to.have.length(0);

  el.steps = validSteps;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[data-step-id]').length).to.equal(2);
  expect([...el.shadowRoot!.querySelectorAll<HTMLElement>('[data-step-id]')].map((step) => step.dataset['stepId']))
    .to.deep.equal(['review', 'submit']);
});
