import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './popover.js';
import './tooltip.js';
import './dropdown.js';
import '../../layout/menu/dropdown-item.js';
import type { LyraPopover } from './popover.class.js';
import type { LyraTooltip } from './tooltip.class.js';
import type { LyraDropdown } from './dropdown.class.js';

type AnchoredOverlay = HTMLElement & {
  show(): Promise<void>;
  hide(options?: object): Promise<void>;
  readonly updateComplete: Promise<unknown>;
};

/** Mirrors lr-select/lr-combobox: a settled-closed anchored popup
 *  must leave the scrollable layout entirely, not merely fade to invisible, or a
 *  `position:relative; overflow:auto` ancestor keeps unexplained scroll room. The popup's own
 *  live auto-sizing (`--lr-positioner-available-inline-size`) already keeps it within the
 *  container's bounds while *open*, so — mirroring `select-closed-layout.test.ts`'s own "closed
 *  after resize" phase — the regression only surfaces once the popup is closed (its geometry goes
 *  stale) and the container is then resized smaller: an unbreakable (`white-space: nowrap`) label
 *  can no longer shrink to fit, so a settled-closed popup still in layout overflows the new bounds
 *  while a properly `display:none`d one does not. lr-tooltip/lr-popup default to
 *  `position:absolute` so this reproduces with no extra configuration; lr-popover/lr-dropdown need
 *  `positioning-strategy="absolute"` (an opt-in for lr-popover, lr-dropdown's own unconditional
 *  default) to resolve to the same CSS containing block as the test's scroll container. */
for (const tag of ['lr-popover', 'lr-tooltip', 'lr-dropdown'] as const) {
  it(`keeps a settled-closed ${tag} popup out of the scrollable layout after a resize`, async () => {
    const container = await fixture<HTMLDivElement>(html`
      <div style="position: relative; width: 320px; height: 200px; overflow: auto; display: flex; justify-content: end; align-items: start">
        ${tag === 'lr-tooltip'
          ? html`<lr-tooltip content="An unbreakable tooltip label wide enough to overflow a shrunken container" style="--lr-transition-fast: 0s; white-space: nowrap"><button>Trigger</button></lr-tooltip>`
          : tag === 'lr-dropdown'
            ? html`<lr-dropdown style="--lr-transition-fast: 0s">
                <button slot="trigger">Trigger</button>
                <lr-dropdown-item style="white-space: nowrap">An unbreakable dropdown item label wide enough to overflow a shrunken container</lr-dropdown-item>
              </lr-dropdown>`
            : html`<lr-popover positioning-strategy="absolute" style="--lr-transition-fast: 0s">
                <button slot="trigger">Trigger</button>
                <span style="white-space: nowrap">An unbreakable popover body label wide enough to overflow a shrunken container</span>
              </lr-popover>`}
      </div>
    `);
    const overlay = container.querySelector<AnchoredOverlay>(tag)!;
    await overlay.updateComplete;
    await overlay.show();
    const popup = overlay.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
    expect(getComputedStyle(popup).visibility).to.equal('visible');
    await overlay.hide();
    container.style.width = '240px';
    expect(container.scrollWidth).to.equal(container.clientWidth);
  });
}

it('preserves lr-popover popup transitions while removing the settled closed layout', async () => {
  const control = await fixture<LyraPopover>(html`
    <lr-popover style="--show-duration: 1s; --hide-duration: 1s">
      <button slot="trigger">Trigger</button>
      <span>Content</span>
    </lr-popover>
  `);
  const popup = control.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
  for (let cycle = 0; cycle < 2; cycle++) {
    const shown = control.show();
    await waitUntil(() => popup.getAnimations().length > 0, `opening transition starts on cycle ${cycle}`);
    popup.getAnimations().forEach((animation) => animation.finish());
    await shown;
    expect(getComputedStyle(popup).visibility).to.equal('visible');
    expect(popup.hasAttribute('hidden')).to.be.false;
    const hidden = control.hide();
    await waitUntil(() => popup.getAnimations().length > 0, 'closing transition starts');
    expect(popup.hasAttribute('hidden')).to.be.false;
    expect(popup.getBoundingClientRect().width).to.be.greaterThan(0);
    popup.getAnimations().forEach((animation) => animation.finish());
    await hidden;
    expect(popup.hasAttribute('hidden')).to.be.true;
  }
});

it('preserves lr-tooltip popup transitions while removing the settled closed layout', async () => {
  const control = await fixture<LyraTooltip>(html`
    <lr-tooltip content="Details" style="--lr-transition-fast: 1s">
      <button>Trigger</button>
    </lr-tooltip>
  `);
  const popup = control.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
  for (let cycle = 0; cycle < 2; cycle++) {
    const shown = control.show();
    await waitUntil(() => popup.getAnimations().length > 0, `opening transition starts on cycle ${cycle}`);
    popup.getAnimations().forEach((animation) => animation.finish());
    await shown;
    expect(getComputedStyle(popup).visibility).to.equal('visible');
    expect(popup.hasAttribute('hidden')).to.be.false;
    const hidden = control.hide();
    await waitUntil(() => popup.getAnimations().length > 0, 'closing transition starts');
    expect(popup.hasAttribute('hidden')).to.be.false;
    expect(popup.getBoundingClientRect().width).to.be.greaterThan(0);
    popup.getAnimations().forEach((animation) => animation.finish());
    await hidden;
    expect(popup.hasAttribute('hidden')).to.be.true;
  }
});

it('reasserts an unhidden lr-dropdown popup after a reconnect while open', async () => {
  const control = await fixture<LyraDropdown>(
    html`<lr-dropdown><button slot="trigger">Trigger</button><lr-dropdown-item>Item</lr-dropdown-item></lr-dropdown>`,
  );
  await control.show();
  const popup = control.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
  expect(popup.hasAttribute('hidden')).to.be.false;
  const parent = control.parentNode!;
  parent.removeChild(control);
  parent.appendChild(control);
  expect(popup.hasAttribute('hidden')).to.be.false;
  await control.hide();
});
