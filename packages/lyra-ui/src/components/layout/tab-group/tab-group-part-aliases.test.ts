import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-tab-group.js';
import type { LyraTabGroup } from '../../lr-tab-group.js';

it('exposes the upstream scroll-button__button part on both scroll controls and styles it through ::part', async () => {
  const host = await fixture<HTMLElement>(html`
    <div>
      <style>
        lr-tab-group.aliased::part(scroll-button__button) {
          padding-inline-start: 11px;
        }
      </style>
      <lr-tab-group class="aliased"></lr-tab-group>
    </div>
  `);
  const group = host.querySelector('lr-tab-group') as LyraTabGroup;
  await group.updateComplete;
  const controls = [...group.shadowRoot!.querySelectorAll<HTMLElement>('[part~="scroll-button__button"]')];
  expect(controls).to.have.length(2);
  for (const control of controls) {
    expect(control.part.contains('scroll-button')).to.equal(true);
    expect(getComputedStyle(control).paddingInlineStart).to.equal('11px');
  }
});
