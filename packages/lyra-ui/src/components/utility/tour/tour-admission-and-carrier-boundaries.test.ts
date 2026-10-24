import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraTour } from './tour.class.js';
import './tour.js';

it('omits holes, accessor steps and empty selectors while retaining a detached usable step', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div><button id="tour-admission-target">Target</button><lr-tour></lr-tour></div>`);
  const el = wrapper.querySelector<LyraTour>('lr-tour')!;
  let reads = 0;
  const step = { stepId: 'usable', target: '#tour-admission-target', heading: 'Usable step' };
  const steps: unknown[] = [];
  steps.length = 4;
  Object.defineProperty(steps, '1', { get() { reads += 1; throw new Error('step accessor'); } });
  steps[2] = { stepId: 'empty', target: '', heading: 'Empty selector' };
  steps[3] = step;
  Reflect.set(el, 'steps', steps);
  await el.updateComplete;
  expect(el.steps.map(item => item.stepId)).to.deep.equal(['usable']);
  expect(Object.isFrozen(el.steps)).to.equal(true);
  expect(Object.isFrozen(el.steps[0])).to.equal(true);
  step.heading = 'Changed externally';
  try {
    el.start();
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="popover"]') !== null);
    expect(el.shadowRoot!.querySelector('[part="heading"]')?.textContent).to.equal('Usable step');
    expect(reads).to.equal(0);
  } finally {
    el.end('api');
  }
});

it('normalizes a non-array step binding and can start after a valid replacement', async () => {
  const el = await fixture<LyraTour>(html`<lr-tour></lr-tour>`);
  Reflect.set(el, 'steps', null);
  el.start();
  await el.updateComplete;
  expect(el.steps.length).to.equal(0);
  expect(el.open).to.equal(false);
  el.steps = [{ stepId: 'replacement', target: '#missing-tour-target', heading: 'Replacement' }];
  try {
    el.start();
    await el.updateComplete;
    expect(el.open).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="heading"]')?.textContent).to.equal('Replacement');
  } finally {
    el.end('api');
  }
});

it('restores default spotlight padding after removing its authored length', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div><button>Target</button><lr-tour spotlight-padding="12"></lr-tour></div>`);
  const el = wrapper.querySelector<LyraTour>('lr-tour')!;
  const target = wrapper.querySelector<HTMLButtonElement>('button')!;
  el.steps = [{ stepId: 'padding', target, heading: 'Padded target' }];
  try {
    el.start();
    await el.updateComplete;
    const spotlight = (): HTMLElement | null => el.shadowRoot!.querySelector('[part="spotlight"]');
    await waitUntil(() => spotlight()?.hidden === false && Math.abs(spotlight()!.getBoundingClientRect().width - target.getBoundingClientRect().width - 24) < 1);
    el.removeAttribute('spotlight-padding');
    await el.updateComplete;
    await waitUntil(() => spotlight()?.hidden === false && Math.abs(spotlight()!.getBoundingClientRect().width - target.getBoundingClientRect().width - 8) < 1);
    expect(el.open).to.equal(true);
  } finally {
    el.end('api');
  }
});

for (const veto of [false, true]) {
  it(`${veto ? 'restores' : 'dismisses'} its native carrier after external closure ${veto ? 'when ending is vetoed' : 'through the tour end contract'}`, async () => {
    const wrapper = await fixture<HTMLElement>(html`<div><dialog><button>Existing modal</button></dialog><lr-tour></lr-tour></div>`);
    const outer = wrapper.querySelector<HTMLDialogElement>('dialog')!;
    const el = wrapper.querySelector<LyraTour>('lr-tour')!;
    el.steps = [{ stepId: 'carrier', target: '#missing-carrier-target', heading: 'Carrier step' }];
    const requests: string[] = [];
    const ends: string[] = [];
    el.addEventListener('lr-tour-end-request', event => { requests.push(event.detail.reason); if (veto) event.preventDefault(); });
    el.addEventListener('lr-tour-end', event => { ends.push(event.detail.reason); });
    try {
      outer.showModal();
      el.start();
      await el.updateComplete;
      const carrier = el.shadowRoot!.querySelector<HTMLDialogElement>('dialog[data-native-modal-carrier]')!;
      await waitUntil(() => carrier.matches(':modal'));
      carrier.close();
      await waitUntil(() => requests.length === 1);
      expect(requests).to.deep.equal(['escape']);
      if (veto) {
        await waitUntil(() => carrier.matches(':modal'));
        expect(el.open).to.equal(true);
        expect(ends).to.deep.equal([]);
      } else {
        await waitUntil(() => !el.open);
        expect(carrier.open).to.equal(false);
        expect(ends).to.deep.equal(['escape']);
      }
      expect(outer.open).to.equal(true);
    } finally {
      el.remove();
      outer.close();
    }
  });
}
