import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import '../../lr-popover.js';
import '../../lr-button.js';
import '../../lr-dropdown.js';
import '../../lr-dropdown-item.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraPopover } from './popover.class.js';

const ARIA = ['aria-haspopup', 'aria-expanded', 'aria-controls'] as const;

interface Scene {
  root: HTMLElement;
  popover: LyraPopover;
  anchor: HTMLButtonElement;
  target: HTMLButtonElement;
  inner: HTMLButtonElement;
}

async function scene(): Promise<Scene> {
  const root = await fixture<HTMLElement>(html`<div>
    <button id="anchor">Anchor</button>
    <button id="target">Target</button>
    <lr-popover trigger="manual" style="--show-duration: 0ms; --hide-duration: 0ms">
      <button id="inner">Inside</button>
    </lr-popover>
  </div>`);
  const popover = root.querySelector<LyraPopover>('lr-popover')!;
  const anchor = root.querySelector<HTMLButtonElement>('#anchor')!;
  popover.anchor = anchor;
  await popover.updateComplete;
  return {
    root,
    popover,
    anchor,
    target: root.querySelector<HTMLButtonElement>('#target')!,
    inner: root.querySelector<HTMLButtonElement>('#inner')!,
  };
}

async function openAndFocusInside(s: Scene, options?: { returnFocusTo?: HTMLElement | null }): Promise<void> {
  await s.popover.show(options);
  await s.popover.updateComplete;
  expect(s.popover.open).to.equal(true);
  await focusByKeyboard(s.inner, s.root);
  expect(document.activeElement === s.inner, 'focus inside the popover').to.equal(true);
}

function ariaOf(element: Element): (string | null)[] {
  return ARIA.map((name) => element.getAttribute(name));
}

function activeId(): string {
  return (document.activeElement as HTMLElement | null)?.id || (document.activeElement?.localName ?? '');
}

describe('lr-popover returnFocusTo', () => {
  it('returns focus to show({ returnFocusTo }) on Escape without writing ARIA on anchor or target', async () => {
    const s = await scene();
    await openAndFocusInside(s, { returnFocusTo: s.target });
    expect(ariaOf(s.anchor)).to.deep.equal([null, null, null]);
    expect(ariaOf(s.target)).to.deep.equal([null, null, null]);
    await sendKeys({ press: 'Escape' });
    await waitUntil(() => !s.popover.open, 'Escape closes');
    expect(activeId()).to.equal('target');
    expect(ariaOf(s.anchor)).to.deep.equal([null, null, null]);
    expect(ariaOf(s.target)).to.deep.equal([null, null, null]);
  });

  it('returns focus to the target on light dismiss', async () => {
    const s = await scene();
    await openAndFocusInside(s, { returnFocusTo: s.target });
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    await waitUntil(() => !s.popover.open, 'light dismiss closes');
    expect(activeId()).to.equal('target');
  });

  it('returns focus to the target on hide()', async () => {
    const s = await scene();
    await openAndFocusInside(s, { returnFocusTo: s.target });
    await s.popover.hide();
    expect(s.popover.open).to.equal(false);
    expect(activeId()).to.equal('target');
  });

  it('still honours hide({ focusTrigger: false })', async () => {
    const s = await scene();
    await openAndFocusInside(s, { returnFocusTo: s.target });
    await s.popover.hide({ focusTrigger: false });
    expect(activeId()).to.not.equal('target');
  });

  it('clears a per-call target after close so a later bare show() does not reuse it', async () => {
    const s = await scene();
    await openAndFocusInside(s, { returnFocusTo: s.target });
    await s.popover.hide();
    expect(activeId()).to.equal('target');
    await openAndFocusInside(s);
    await s.popover.hide();
    expect(activeId()).to.not.equal('target');
  });

  it('keeps the property across opens, and a per-call option wins over it for that opening only', async () => {
    const s = await scene();
    s.popover.returnFocusTo = s.anchor;
    await openAndFocusInside(s);
    await s.popover.hide();
    expect(activeId()).to.equal('anchor');
    await openAndFocusInside(s, { returnFocusTo: s.target });
    await s.popover.hide();
    expect(activeId()).to.equal('target');
    await openAndFocusInside(s);
    await s.popover.hide();
    expect(activeId()).to.equal('anchor');
    expect(ariaOf(s.anchor)).to.deep.equal([null, null, null]);
  });

  it('applies a property set while open to the pending close', async () => {
    const s = await scene();
    await openAndFocusInside(s);
    s.popover.returnFocusTo = s.target;
    await s.popover.updateComplete;
    await sendKeys({ press: 'Escape' });
    await waitUntil(() => !s.popover.open, 'Escape closes');
    expect(activeId()).to.equal('target');
  });

  it('leaves focus unreturned when unset (unchanged behaviour)', async () => {
    const s = await scene();
    expect(s.popover.returnFocusTo === null).to.equal(true);
    await openAndFocusInside(s);
    await sendKeys({ press: 'Escape' });
    await waitUntil(() => !s.popover.open, 'Escape closes');
    expect(['anchor', 'target']).to.not.include(activeId());
  });

  it('falls back without throwing when the target was removed before close', async () => {
    const s = await scene();
    await openAndFocusInside(s, { returnFocusTo: s.target });
    s.target.remove();
    await sendKeys({ press: 'Escape' });
    await waitUntil(() => !s.popover.open, 'Escape closes');
    // Same as unset: the popover moves focus nowhere (engines differ on body vs the hidden content).
    expect(['body', 'inner']).to.include(activeId());
  });

  it('falls back to the slotted trigger when the target is disabled', async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <button id="target" disabled>Target</button>
      <lr-popover style="--show-duration: 0ms; --hide-duration: 0ms">
        <button slot="trigger" id="owner">Owner</button>
        <button id="inner">Inside</button>
      </lr-popover>
    </div>`);
    const popover = root.querySelector<LyraPopover>('lr-popover')!;
    const target = root.querySelector<HTMLButtonElement>('#target')!;
    await popover.show({ returnFocusTo: target });
    await popover.updateComplete;
    await focusByKeyboard(root.querySelector<HTMLButtonElement>('#inner')!, root);
    await popover.hide();
    expect(activeId()).to.equal('owner');
  });

  it('returns focus to an lr-dropdown trigger without disturbing its menu ARIA', async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <lr-dropdown>
        <lr-button slot="trigger" id="menu-trigger">Actions</lr-button>
        <lr-dropdown-item value="a">A</lr-dropdown-item>
      </lr-dropdown>
      <lr-popover trigger="manual" style="--show-duration: 0ms; --hide-duration: 0ms">
        <button id="inner">Inside</button>
      </lr-popover>
    </div>`);
    const popover = root.querySelector<LyraPopover>('lr-popover')!;
    const menuTrigger = root.querySelector<HTMLElement>('#menu-trigger')!;
    await (menuTrigger as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
    const ariaOwner = (): Element =>
      menuTrigger.shadowRoot?.querySelector('[aria-haspopup]') ?? menuTrigger;
    await waitUntil(() => ariaOwner().getAttribute('aria-haspopup') === 'menu', 'dropdown wires its trigger');
    const before = ariaOf(ariaOwner());
    const hostBefore = ariaOf(menuTrigger);

    popover.anchor = menuTrigger;
    await popover.show({ returnFocusTo: menuTrigger });
    await popover.updateComplete;
    await focusByKeyboard(root.querySelector<HTMLButtonElement>('#inner')!, root);
    expect(ariaOf(ariaOwner())).to.deep.equal(before);
    await sendKeys({ press: 'Escape' });
    await waitUntil(() => !popover.open, 'Escape closes');

    expect(document.activeElement === menuTrigger, 'focus back on the dropdown trigger').to.equal(true);
    expect(ariaOf(ariaOwner())).to.deep.equal(before);
    expect(ariaOf(menuTrigger)).to.deep.equal(hostBefore);
  });

  it('lets the property supply a showAt() focus-return target', async () => {
    const s = await scene();
    s.popover.returnFocusTo = s.target;
    s.popover.showAt({ x: 40, y: 40 });
    await s.popover.updateComplete;
    await focusByKeyboard(s.inner, s.root);
    await sendKeys({ press: 'Escape' });
    await waitUntil(() => !s.popover.open, 'Escape closes');
    expect(activeId()).to.equal('target');
  });
});
