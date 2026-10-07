import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './usage-badge.js';
import '../../overlays/dialog/dialog.js';
import type { LyraUsageBadge } from './usage-badge.js';
import type { LyraDialog } from '../../overlays/dialog/dialog.js';

describe('usage badge removal and overlay routing', () => {
  for (const [attribute, property, part] of [['cost-text', 'costText', 'cost'], ['summary', 'summary', 'summary']] as const) {
    it(`safely removes ${attribute} and recovers later content`, async () => {
      const badge = await fixture<LyraUsageBadge>(html`<lr-usage-badge><span slot="details">Breakdown</span></lr-usage-badge>`);
      badge.setAttribute(attribute, 'Original');
      await badge.updateComplete;
      expect(badge.shadowRoot!.querySelector(`[part="${part}"]`)?.textContent?.trim()).to.equal('Original');
      badge.removeAttribute(attribute);
      await badge.updateComplete;
      expect(badge[property] === null).to.be.true;
      expect(badge.shadowRoot!.querySelector('[part="base"]')!.hasAttribute('tabindex')).to.be.false;
      badge.setAttribute(attribute, '');
      await badge.updateComplete;
      expect(badge[property]).to.equal('');
      expect(badge.shadowRoot!.querySelector('[part="base"]')!.hasAttribute('tabindex')).to.be.false;
      badge.setAttribute(attribute, 'Restored');
      await badge.updateComplete;
      expect(badge.shadowRoot!.querySelector(`[part="${part}"]`)?.textContent?.trim()).to.equal('Restored');
    });
  }

  it('dismisses the hovered tooltip before its containing dialog while focus is elsewhere', async () => {
    const dialog = await fixture<LyraDialog>(html`<lr-dialog label="Usage" style="--lr-duration-base: 0ms">
      <button id="other">Other work</button><lr-usage-badge tokens-in="12"></lr-usage-badge>
    </lr-dialog>`);
    const badge = dialog.querySelector<LyraUsageBadge>('lr-usage-badge')!;
    const other = dialog.querySelector<HTMLButtonElement>('#other')!;
    try {
      await dialog.show();
      other.focus();
      const base = badge.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
      await hoverUntilMatched(base, 'the badge receives native hover');
      await waitUntil(() => badge.shadowRoot!.querySelector<HTMLElement>('[part="tooltip"]')?.hidden === false, 'the hovered tooltip did not open');
      await sendKeys({ press: 'Escape' });
      await badge.updateComplete;
      expect(badge.shadowRoot!.querySelector<HTMLElement>('[part="tooltip"]')!.hidden).to.be.true;
      expect(dialog.open).to.be.true;
      expect(document.activeElement === other).to.be.true;
      await sendKeys({ press: 'Escape' });
      await waitUntil(() => !dialog.open, 'the second Escape did not dismiss the containing dialog');
    } finally {
      await resetMouse();
      await dialog.close('api');
    }
  });
});

it('yields Escape while its tooltip part is unrendered and resumes without moving focus', async () => {
  const dialog = await fixture<LyraDialog>(html`<lr-dialog label="Usage" style="--lr-duration-base: 0ms">
    <style>lr-usage-badge[data-hide-tooltip]::part(tooltip) { display: none; }</style>
    <button id="other">Other work</button><lr-usage-badge data-hide-tooltip tokens-in="12"></lr-usage-badge>
  </lr-dialog>`);
  const badge = dialog.querySelector<LyraUsageBadge>('lr-usage-badge')!;
  const other = dialog.querySelector<HTMLButtonElement>('#other')!;
  try {
    await dialog.show();
    other.focus();
    const base = badge.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    await hoverUntilMatched(base, 'the badge receives native hover');
    await waitUntil(() => badge.shadowRoot!.querySelector<HTMLElement>('[part="tooltip"]')?.hidden === false, 'the tooltip enters its open state');
    await sendKeys({ press: 'Escape' });
    await waitUntil(() => !dialog.open, 'an unrendered tooltip must yield Escape to its containing dialog');
    await dialog.show();
    other.focus();
    await hoverUntilMatched(base, 'the re-opened badge receives hover');
    await badge.updateComplete;
    badge.removeAttribute('data-hide-tooltip');
    await waitUntil(() => getComputedStyle(badge.shadowRoot!.querySelector('[part="tooltip"]')!).display !== 'none', 'the public tooltip part renders again');
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(document.activeElement === other).to.be.true;
    await sendKeys({ press: 'Escape' });
    await badge.updateComplete;
    expect(dialog.open).to.be.true;
    expect(badge.shadowRoot!.querySelector<HTMLElement>('[part="tooltip"]')!.hidden).to.be.true;
  } finally {
    await resetMouse();
    await dialog.close('api');
  }
});

it('lets document listeners observe the Escape that closes its tooltip', async () => {
  const badge = await fixture<LyraUsageBadge>(html`<lr-usage-badge tokens-in="12"></lr-usage-badge>`);
  const base = badge.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  await focusByKeyboard(base);
  await waitUntil(() => badge.shadowRoot!.querySelector<HTMLElement>('[part="tooltip"]')?.hidden === false, 'the focused tooltip did not open');
  let seen = false;
  const listener = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') seen = true;
  };
  document.addEventListener('keydown', listener);
  try {
    await sendKeys({ press: 'Escape' });
    await badge.updateComplete;
  } finally {
    document.removeEventListener('keydown', listener);
  }
  expect(seen).to.be.true;
  expect(badge.shadowRoot!.querySelector<HTMLElement>('[part="tooltip"]')!.hidden).to.be.true;
});

it('merges a host aria-describedby with its tooltip description', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div>
    <p id="usage-help">Billed monthly</p>
    <lr-usage-badge tokens-in="12" aria-describedby="usage-help"></lr-usage-badge>
  </div>`);
  const badge = wrapper.querySelector<LyraUsageBadge>('lr-usage-badge')!;
  await badge.updateComplete;
  const base = badge.shadowRoot!.querySelector('[part="base"]') as HTMLElement & { ariaDescribedByElements: Element[] | null };
  const ids = (): string[] => (base.ariaDescribedByElements ?? []).map((node) => node.getAttribute('part') ?? node.id);
  expect(ids()).to.deep.equal(['usage-help']);
  await focusByKeyboard(base);
  await badge.updateComplete;
  expect(ids()).to.deep.equal(['usage-help', 'tooltip']);
});
