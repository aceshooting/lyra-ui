import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './export-button.js';
import type { LyraExportButton } from './export-button.js';

/** The positioner writes `position` on the popup itself, so the RENDERED value -- never the
 *  stylesheet text -- is what these assertions read. */
function menu(el: LyraExportButton): HTMLElement {
  return el.shadowRoot!.querySelector('[part="menu"]') as HTMLElement;
}

async function openMenu(wrapper: HTMLElement): Promise<LyraExportButton> {
  const el = wrapper.querySelector('lr-export-button') as LyraExportButton;
  // A single format collapses to a direct-export button with no menu -- willUpdate() forces
  // `open` back to `false` whenever `formats.length <= 1`.
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  el.open = true;
  await el.updateComplete;
  await waitUntil(
    () => el.ownerDocument.defaultView?.getComputedStyle(menu(el)).visibility === 'visible',
    'menu placement did not settle',
  );
  return el;
}

const markup = () => html`<div><lr-export-button></lr-export-button></div>`;

describe('positioning-strategy on lr-export-button', () => {
  it('defaults to fixed, which is what the format menu has always rendered', async () => {
    const wrapper = await fixture<HTMLElement>(markup());
    const el = await openMenu(wrapper);
    expect(getComputedStyle(menu(el)).position).to.equal('fixed');
  });
});

describe('the cascading --lr-positioning-strategy custom property on lr-export-button', () => {
  it('lets an ancestor switch an unset export button to absolute', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="--lr-positioning-strategy: absolute">${markup()}</div>
    `);
    const el = await openMenu(wrapper);
    await waitUntil(
      () => getComputedStyle(menu(el)).position === 'absolute',
      'the ancestor override reaches an unset export button',
    );
  });

  it('ignores an unrecognized ancestor value and keeps the default', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="--lr-positioning-strategy: sticky">${markup()}</div>
    `);
    const el = await openMenu(wrapper);
    expect(getComputedStyle(menu(el)).position).to.equal('fixed');
  });
});
