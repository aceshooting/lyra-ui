import { expect, waitUntil, fixture, html } from '@open-wc/testing';
import { toast } from './toaster.js';
import './toast.js';
import type { LyraToast } from './toast.js';
import type { LyraToastItem } from './toast-item.js';
import { styles } from './toast.styles.js';

it('mounts a singleton region and shows an item', async () => {
  const handle = toast({ message: 'hi', variant: 'success', duration: 0 });
  const region = document.querySelector('lr-toast');
  expect(region).to.exist;

  await waitUntil(() => region!.querySelector('lr-toast-item'));
  expect(document.querySelectorAll('lr-toast').length).to.equal(1);

  handle.dismiss();
  await waitUntil(() => !region!.querySelector('lr-toast-item'), 'item should be removed', {
    timeout: 2000,
  });
});

it('reuses the same region for multiple toasts', async () => {
  toast({ message: 'a', duration: 0 });
  toast({ message: 'b', duration: 0 });
  await waitUntil(() => document.querySelectorAll('lr-toast-item').length >= 2);
  expect(document.querySelectorAll('lr-toast').length).to.equal(1);
});

it('renders an action button when provided', async () => {
  let clicked = false;
  const { item } = toast({
    message: 'undo me',
    duration: 0,
    action: { label: 'Undo', onClick: () => (clicked = true) },
  });
  const el = await item;
  const btn = el.querySelector('button');
  expect(btn).to.exist;
  btn!.click();
  expect(clicked).to.be.true;
});

it('styles the appended action button through the design-token system instead of leaving it browser-default', async () => {
  // toast-item.styles.ts previously had no ::slotted(button) rule at all, so
  // the <button> toaster.ts appends for `action` rendered with completely
  // unstyled UA chrome (a boxed, beveled button) instead of matching the
  // rest of the token-driven design.
  const { item } = toast({
    message: 'undo me',
    duration: 0,
    action: { label: 'Undo', onClick: () => {} },
  });
  const el = await item;
  const btn = el.querySelector('button')!;
  const computed = getComputedStyle(btn);
  expect(computed.borderStyle, 'the default UA button border must be removed').to.equal('none');
  expect(computed.backgroundColor, 'the default UA button background must be removed').to.equal(
    'rgba(0, 0, 0, 0)',
  );
  expect(computed.cursor).to.equal('pointer');

  const messageNode = Array.from(el.childNodes).find((node) => node.nodeType === Node.TEXT_NODE)!;
  const messageRange = document.createRange();
  messageRange.selectNodeContents(messageNode);
  const messageRect = messageRange.getBoundingClientRect();
  const buttonRect = btn.getBoundingClientRect();
  expect(
    buttonRect.left - messageRect.right,
    'the action label must not visually run into the message text',
  ).to.be.at.least(4);
});

it('keeps an English message and action in logical order inside an RTL page', async () => {
  const wrapper = await fixture(html`
    <div dir="rtl"><lr-toast-item duration="0">Item deleted<button>Undo</button></lr-toast-item></div>
  `);
  const el = wrapper.querySelector('lr-toast-item') as LyraToastItem;
  await el.updateComplete;

  const messageNode = Array.from(el.childNodes).find((node) => node.nodeType === Node.TEXT_NODE)!;
  const messageRange = document.createRange();
  messageRange.selectNodeContents(messageNode);
  const messageRect = messageRange.getBoundingClientRect();
  const buttonRect = el.querySelector('button')!.getBoundingClientRect();

  expect(messageRect.left, 'the LTR message must render before its LTR action').to.be.lessThan(buttonRect.left);
  expect(buttonRect.left - messageRect.right).to.be.at.least(4);
});

it('reflects the placement property on <lr-toast>', async () => {
  const region = (await fixture(html`<lr-toast></lr-toast>`)) as LyraToast;
  expect(region.getAttribute('placement')).to.equal('top-end');

  region.placement = 'bottom-center';
  await region.updateComplete;
  expect(region.getAttribute('placement')).to.equal('bottom-center');
});

it('exposes namespaced stack sizing custom properties', () => {
  const cssText = Array.isArray(styles)
    ? styles.map((style) => style.cssText).join('\n')
    : (styles as { cssText: string }).cssText;
  expect(cssText).to.include('--lr-toast-gap');
  expect(cssText).to.include('--lr-toast-width');
  expect(cssText).to.not.include('--gap');
  expect(cssText).to.not.include('--width');
});

it('keeps fixed toast placements clear of display cutouts', () => {
  const cssText = Array.isArray(styles)
    ? styles.map((style) => style.cssText).join('\n')
    : (styles as { cssText: string }).cssText;
  expect(cssText).to.include('var(--lr-safe-area-top)');
  expect(cssText).to.include('var(--lr-safe-area-bottom)');
});

it('does not retroactively move an already-open toast when a later call uses a different placement', async () => {
  const first = toast({ message: 'stay put', placement: 'top-start', duration: 0 });
  await first.item;
  const firstRegion = document.querySelector('lr-toast[placement="top-start"]') as LyraToast | null;
  expect(firstRegion, 'a region for top-start should have been mounted').to.exist;

  toast({ message: 'elsewhere', placement: 'bottom-start', duration: 0 });
  await waitUntil(() => document.querySelector('lr-toast[placement="bottom-start"]'));

  expect(firstRegion!.placement, 'the earlier top-start region must stay at top-start').to.equal('top-start');
  expect(firstRegion!.isConnected).to.be.true;
});

it('create() on the region resolves to the item', async () => {
  const region = (await fixture(html`<lr-toast></lr-toast>`)) as LyraToast;
  const item = await region.create('direct', { variant: 'warning', duration: 0 });
  expect(item.variant).to.equal('warning');
  expect(item.textContent).to.contain('direct');
});

it("create() with no options leaves every field at <lr-toast-item>'s own declared defaults", async () => {
  // create() must not hardcode its own copy of each default -- it should
  // defer entirely to whatever `document.createElement('lr-toast-item')`
  // already sets, so this stays correct even if toast-item.ts's own
  // property defaults ever change.
  const probe = document.createElement('lr-toast-item') as LyraToastItem;
  const region = (await fixture(html`<lr-toast></lr-toast>`)) as LyraToast;
  const item = await region.create('defaults only');

  expect(item.variant).to.equal(probe.variant);
  expect(item.duration).to.equal(probe.duration);
  expect(item.size).to.equal(probe.size);
  expect(item.withIcon).to.equal(probe.withIcon);
});

it('is accessible as a bare region with no toasts open', async () => {
  const region = (await fixture(html`<lr-toast></lr-toast>`)) as LyraToast;
  const stack = region.shadowRoot!.querySelector('[part="stack"]')!;
  expect(stack.hasAttribute('role')).to.be.false;
  expect(stack.hasAttribute('aria-live')).to.be.false;
  await expect(region).to.be.accessible();
});

it('is accessible once a toast item is showing inside it', async () => {
  const region = (await fixture(html`<lr-toast></lr-toast>`)) as LyraToast;
  const item = await region.create('Accessible toast', { duration: 0 });
  await waitUntil(() => item.hasAttribute('data-visible'));
  await expect(region).to.be.accessible();
});

it('does not contain the dead `[part="stack"]::slotted(*)` selector', () => {
  // `::slotted()` must be attached directly to a compound selector matching the
  // <slot> element itself; `[part='stack']` matches the wrapping <div>, not the
  // nested <slot>, so this compound selector can never match anything and is inert.
  const cssText = Array.isArray(styles)
    ? styles.map((s) => s.cssText).join('\n')
    : (styles as { cssText: string }).cssText;
  expect(cssText).to.not.match(/\[part=['"]?stack['"]?\]\s*::slotted/);
  expect(cssText).to.match(/(^|\n)\s*::slotted\(\*\)\s*{/);
});

it('keeps an actionable toast persistent when duration is omitted', async () => {
  const handle = toast({ message: 'Undoable', action: { label: 'Undo', onClick: () => {} } });
  const item = await handle.item;
  expect(item.duration).to.equal(0);
  await item.hide();
});
