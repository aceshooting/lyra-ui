import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './usage-badge.js';
import '../../overlays/dialog/dialog.js';
import type { LyraUsageBadge } from './usage-badge.js';
import type { LyraDialog } from '../../overlays/dialog/dialog.js';

async function frame(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}
function tooltip(badge: LyraUsageBadge): HTMLElement {
  return badge.shadowRoot!.querySelector<HTMLElement>('[part="tooltip"]')!;
}
function base(badge: LyraUsageBadge): HTMLElement {
  return badge.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
}
async function enter(badge: LyraUsageBadge): Promise<void> {
  base(badge).dispatchEvent(new Event('mouseenter'));
  await badge.updateComplete;
}

it('retains activation order when a hidden older tooltip resumes below a newer dialog', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div>
    <lr-dialog id="older" label="Older" style="--lr-duration-base:0ms"
      ><button id="other">Other work</button
      ><lr-usage-badge tokens-in="12"></lr-usage-badge
    ></lr-dialog>
    <lr-dialog id="newer" label="Newer" style="--lr-duration-base:0ms"
      ><button>Newer work</button></lr-dialog
    >
  </div>`);
  const older = wrapper.querySelector<LyraDialog>('#older')!;
  const newer = wrapper.querySelector<LyraDialog>('#newer')!;
  const badge = wrapper.querySelector<LyraUsageBadge>('lr-usage-badge')!;
  try {
    await older.show();
    older.querySelector<HTMLButtonElement>('#other')!.focus();
    await enter(badge);
    expect(tooltip(badge).hidden).to.be.false;
    tooltip(badge).style.display = 'none';
    await waitUntil(
      () => badge.style.getPropertyValue('--lr-overlay-stack-index') === '',
      'the older tooltip suspends'
    );
    await newer.show();
    tooltip(badge).style.removeProperty('display');
    await waitUntil(
      () => badge.style.getPropertyValue('--lr-overlay-stack-index') !== '',
      'the older tooltip resumes'
    );
    await sendKeys({ press: 'Escape' });
    await waitUntil(
      () => !newer.open,
      'the newer dialog owns the first Escape'
    );
    expect(older.open).to.be.true;
    expect(tooltip(badge).hidden).to.be.false;
    await sendKeys({ press: 'Escape' });
    await badge.updateComplete;
    expect(tooltip(badge).hidden).to.be.true;
    expect(older.open).to.be.true;
  } finally {
    await newer.close('api');
    await older.close('api');
  }
});

it('does not resurrect a detached hidden tooltip and still allows a fresh reopening', async () => {
  const dialog = await fixture<LyraDialog>(
    html`<lr-dialog label="Usage" style="--lr-duration-base:0ms"
      ><button id="other">Other work</button
      ><lr-usage-badge tokens-in="12"></lr-usage-badge
    ></lr-dialog>`
  );
  const badge = dialog.querySelector<LyraUsageBadge>('lr-usage-badge')!;
  try {
    await dialog.show();
    dialog.querySelector<HTMLButtonElement>('#other')!.focus();
    await enter(badge);
    tooltip(badge).style.display = 'none';
    await waitUntil(
      () => badge.style.getPropertyValue('--lr-overlay-stack-index') === '',
      'the tooltip suspends'
    );
    badge.remove();
    dialog.append(badge);
    await badge.updateComplete;
    tooltip(badge).style.removeProperty('display');
    await frame();
    expect(tooltip(badge).hidden).to.be.true;
    await sendKeys({ press: 'Escape' });
    await waitUntil(() => !dialog.open, 'no stale tooltip consumes Escape');
    await dialog.show();
    dialog.querySelector<HTMLButtonElement>('#other')!.focus();
    await enter(badge);
    await sendKeys({ press: 'Escape' });
    await badge.updateComplete;
    expect(tooltip(badge).hidden).to.be.true;
    expect(dialog.open).to.be.true;
  } finally {
    await dialog.close('api');
  }
});

for (const legacy of [false, true]) {
  it(`preserves ${
    legacy ? 'legacy' : 'modern'
  } composing Escape in a focused tooltip`, async () => {
    const badge = await fixture<LyraUsageBadge>(
      html`<lr-usage-badge tokens-in="12"></lr-usage-badge>`
    );
    base(badge).focus();
    await badge.updateComplete;
    const composing = new KeyboardEvent('keydown', {
      key: 'Escape',
      isComposing: !legacy,
      keyCode: legacy ? 229 : 0,
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    base(badge).dispatchEvent(composing);
    await badge.updateComplete;
    expect(composing.defaultPrevented).to.be.false;
    expect(tooltip(badge).hidden).to.be.false;
    await sendKeys({ press: 'Escape' });
    await badge.updateComplete;
    expect(tooltip(badge).hidden).to.be.true;
  });
}

it('retains hover after focus releases', async () => {
  const badge = await fixture<LyraUsageBadge>(
    html`<lr-usage-badge tokens-in="12"></lr-usage-badge>`
  );
  await enter(badge);
  base(badge).dispatchEvent(new Event('focus'));
  base(badge).dispatchEvent(new Event('blur'));
  await badge.updateComplete;
  expect(tooltip(badge).hidden).to.be.false;
  base(badge).dispatchEvent(new Event('mouseleave'));
  await badge.updateComplete;
  expect(tooltip(badge).hidden).to.be.true;
});
