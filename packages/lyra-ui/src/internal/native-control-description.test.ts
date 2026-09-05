import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { acquireAriaDescription } from './aria-controls.js';
import type { LyraElement } from './lyra-element.js';
import '../components/forms/button/button.js';
import '../components/forms/combobox/combobox.js';
import '../components/forms/select/select.js';
import '../components/forms/color-picker/color-picker.js';
import '../components/forms/date-picker/date-input.js';
import '../components/forms/locale-picker/locale-picker.js';

const entries = [
  ['lr-button', '[part~="button"]'],
  ['lr-combobox', '[part="combobox-input"]'],
  ['lr-select', '[part="trigger"]'],
  ['lr-color-picker', '[part="trigger"]'],
  ['lr-date-input', 'input'],
  ['lr-locale-picker', '[part="trigger"]'],
] as const;

for (const [tag, selector] of entries) {
  it(`${tag} composes live external/local guidance with independent description owners`, async () => {
    const root = await fixture<HTMLElement>(html`<div><p id="owned-external">External</p><p id="owned-next">Next external</p><p id="generated-first">First generated</p><p id="generated-second">Second generated</p></div>`);
    const element = document.createElement(tag) as LyraElement;
    element.setAttribute('aria-describedby', 'owned-external');
    if (tag === 'lr-locale-picker') element.setAttribute('show-flags', 'false');
    element.setAttribute('hint', 'Local hint');
    element.setAttribute('error-text', 'Local error');
    if (tag === 'lr-button') {
      element.removeAttribute('hint');
      element.removeAttribute('error-text');
    }
    root.append(element);
    await element.updateComplete;
    const target = element.shadowRoot!.querySelector<HTMLElement>(selector);
    if (!target) throw new Error(`Missing semantic target for ${tag}`);
    const refs = () => (target.ariaDescribedByElements ?? []).map(value => value.id);
    const first = root.querySelector<HTMLElement>('#generated-first')!;
    const second = root.querySelector<HTMLElement>('#generated-second')!;
    const firstLease = acquireAriaDescription(target, [first]);
    const secondLease = acquireAriaDescription(target, [second]);
    try {
      expect(refs()[0]).to.equal('owned-external');
      expect(refs().slice(-2)).to.deep.equal(['generated-first', 'generated-second']);
      const local = refs().filter(id => !['owned-external', 'generated-first', 'generated-second'].includes(id));
      if (tag !== 'lr-button') expect(local.length).to.be.greaterThan(0);
      element.setAttribute('aria-describedby', 'owned-next missing owned-next');
      await waitUntil(() => refs()[0] === 'owned-next', 'host changes precede local and generated guidance');
      expect(refs()).to.deep.equal(['owned-next', ...local, 'generated-first', 'generated-second']);
      firstLease.release();
      expect(refs()).to.deep.equal(['owned-next', ...local, 'generated-second']);
      element.removeAttribute('aria-describedby');
      await waitUntil(() => !refs().includes('owned-next'), 'external removal preserves local and generated descriptions');
      expect(refs()).to.deep.equal([...local, 'generated-second']);
      secondLease.release();
      expect(refs()).to.deep.equal(local);
    } finally {
      firstLease.release();
      secondLease.release();
    }
  });
}
