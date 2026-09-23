import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './citation-badge.js';
import '../../overlays/dialog/dialog.js';
import type { LyraCitationBadge } from './citation-badge.js';
import type { LyraDialog } from '../../overlays/dialog/dialog.js';

it('registers the open popover with the shared overlay stack', async () => {
  const el = (await fixture(
    html`<lr-citation-badge index="1"><p>preview</p></lr-citation-badge>`,
  )) as LyraCitationBadge;
  const wrapper = el.shadowRoot!.querySelector('.wrapper') as HTMLElement;
  expect(el.style.getPropertyValue('--lr-overlay-stack-index')).to.equal('');
  wrapper.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
  await el.updateComplete;
  expect(el.style.getPropertyValue('--lr-overlay-stack-index')).to.not.equal('');
  wrapper.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
  await waitUntil(
    () => el.style.getPropertyValue('--lr-overlay-stack-index') === '',
    'the popover unregisters once it hides',
  );
});

it('defers Escape to a newer dialog opened on top, instead of closing its own popover first', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div>
    <lr-citation-badge index="1"><p>preview</p></lr-citation-badge>
    <lr-dialog label="Newer" style="--lr-duration-base:0ms"
      ><button>Newer work</button></lr-dialog
    >
  </div>`);
  const badge = wrapper.querySelector<LyraCitationBadge>('lr-citation-badge')!;
  const dialog = wrapper.querySelector<LyraDialog>('lr-dialog')!;
  const badgeWrapper = badge.shadowRoot!.querySelector('.wrapper') as HTMLElement;
  const popover = badge.shadowRoot!.querySelector('[part="popover"]') as HTMLElement;
  try {
    // Hover only -- the badge's own trigger never takes keyboard focus, so any close on the
    // next two Escape presses can only come from the shared overlay stack's own routing, never
    // from the badge's local wrapper-scoped keydown listener.
    badgeWrapper.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    await badge.updateComplete;
    expect(popover.hidden).to.be.false;

    await dialog.show();
    await sendKeys({ press: 'Escape' });
    await waitUntil(() => !dialog.open, 'the newer dialog owns the first Escape');
    expect(popover.hidden, 'the badge popover is not topmost and must stay open').to.be.false;

    await sendKeys({ press: 'Escape' });
    await waitUntil(() => popover.hidden, 'the badge popover owns the second Escape');
  } finally {
    if (dialog.open) await dialog.close('api');
  }
});
