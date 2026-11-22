import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-tag.js';
import type { LyraTag } from '../../lr-tag.js';

it('exposes the upstream remove-button__button part on the remove button and styles it through ::part', async () => {
  const host = await fixture<HTMLElement>(html`
    <div>
      <style>
        lr-tag.aliased::part(remove-button__button) {
          padding-inline-start: 13px;
        }
      </style>
      <lr-tag class="aliased" with-remove>Removable</lr-tag>
    </div>
  `);
  const tag = host.querySelector('lr-tag') as LyraTag;
  await tag.updateComplete;
  const button = tag.shadowRoot!.querySelector<HTMLButtonElement>('[part~="remove-button"]')!;
  expect(button.getAttribute('part')!.split(' ')).to.include.members([
    'remove-button',
    'remove-button__base',
    'remove-button__button',
  ]);
  expect(getComputedStyle(button).paddingInlineStart).to.equal('13px');
});
