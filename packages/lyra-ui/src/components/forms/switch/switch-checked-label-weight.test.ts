import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-switch.js';
import type { LyraSwitch } from '../../lr-switch.js';

it('weights the checked label from --lr-switch-checked-label-font-weight, inheriting while unset and unchecked', async () => {
  const el = await fixture<LyraSwitch>(html`<lr-switch style="font-weight: 400; --lr-switch-checked-label-font-weight: 600">Alerts</lr-switch>`);
  const label = el.shadowRoot!.querySelector<HTMLElement>('[part="label"]')!;
  expect(getComputedStyle(label).fontWeight).to.equal('400');
  el.checked = true;
  await el.updateComplete;
  expect(getComputedStyle(label).fontWeight).to.equal('600');
  el.style.removeProperty('--lr-switch-checked-label-font-weight');
  expect(getComputedStyle(label).fontWeight).to.equal('400');
});
