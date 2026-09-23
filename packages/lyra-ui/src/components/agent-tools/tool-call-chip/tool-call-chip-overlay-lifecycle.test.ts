import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './tool-call-chip.js';
import '../../overlays/dialog/dialog.js';
import type { LyraToolCallChip } from './tool-call-chip.js';
import type { LyraDialog } from '../../overlays/dialog/dialog.js';

it('registers the open tooltip with the shared overlay stack', async () => {
  const el = (await fixture(
    html`<lr-tool-call-chip name="web_search"><p>Detail</p></lr-tool-call-chip>`,
  )) as LyraToolCallChip;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
  expect(el.style.getPropertyValue('--lr-overlay-stack-index')).to.equal('');
  base.dispatchEvent(new MouseEvent('mouseenter'));
  await el.updateComplete;
  expect(el.style.getPropertyValue('--lr-overlay-stack-index')).to.not.equal('');
  base.dispatchEvent(new MouseEvent('mouseleave'));
  await el.updateComplete;
  expect(el.style.getPropertyValue('--lr-overlay-stack-index')).to.equal('');
});

it('defers Escape to a newer dialog opened on top, instead of closing its own tooltip first', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div>
    <lr-tool-call-chip name="web_search"><p>Detail</p></lr-tool-call-chip>
    <lr-dialog label="Newer" style="--lr-duration-base:0ms"
      ><button>Newer work</button></lr-dialog
    >
  </div>`);
  const chip = wrapper.querySelector<LyraToolCallChip>('lr-tool-call-chip')!;
  const dialog = wrapper.querySelector<LyraDialog>('lr-dialog')!;
  const base = chip.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
  const tooltip = chip.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement;
  try {
    // Hover only -- the chip's own trigger never takes keyboard focus, so any close on the
    // next two Escape presses can only come from the shared overlay stack's own routing, never
    // from the chip's local button-scoped keydown listener.
    base.dispatchEvent(new MouseEvent('mouseenter'));
    await chip.updateComplete;
    expect(tooltip.hidden).to.be.false;

    await dialog.show();
    await sendKeys({ press: 'Escape' });
    await waitUntil(() => !dialog.open, 'the newer dialog owns the first Escape');
    expect(tooltip.hidden, 'the chip tooltip is not topmost and must stay open').to.be.false;

    await sendKeys({ press: 'Escape' });
    await waitUntil(() => tooltip.hidden, 'the chip tooltip owns the second Escape');
  } finally {
    if (dialog.open) await dialog.close('api');
  }
});
