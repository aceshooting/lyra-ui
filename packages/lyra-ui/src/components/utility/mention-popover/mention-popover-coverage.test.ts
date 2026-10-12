import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './mention-popover.js';
import type { LyraMentionPopover } from './mention-popover.js';

async function focusedPopover(textarea = false) {
  const root = await fixture<HTMLDivElement>(html`<div>
    ${textarea ? html`<textarea aria-label="Message">Hello</textarea>` : html`<input aria-label="Message">`}
    <lr-mention-popover style="--lr-transition-fast:0s"></lr-mention-popover>
  </div>`);
  const anchor = root.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')!;
  const viewer = root.querySelector<LyraMentionPopover>('lr-mention-popover')!;
  await focusByKeyboard(anchor);
  viewer.anchor = anchor;
  viewer.items = [{ label: 'Ada', suggestionId: 'ada' }];
  viewer.open = true;
  await viewer.updateComplete;
  await waitUntil(() => getComputedStyle(viewer.activeDescendantElement!).visibility === 'visible');
  expect(await viewer.focusActiveOption()).to.equal(true);
  return { anchor, viewer };
}

it('returns focus to the live anchor when every retained suggestion becomes disabled', async () => {
  const { anchor, viewer } = await focusedPopover();
  viewer.items = [{ label: 'Unavailable', suggestionId: 'ada', disabled: true }];
  await viewer.updateComplete;
  await waitUntil(() => document.activeElement === anchor);
  expect(viewer.open).to.equal(true);
  expect(viewer.activeDescendantId).to.equal(null);
  expect(viewer.shadowRoot!.querySelector('[part="listbox"]')?.getAttribute('tabindex')).to.equal('-1');
  expect(viewer.handleKeyDown(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }))).to.equal(false);
});

it('keeps focus in the listbox when disabled suggestions remain after the anchor is detached', async () => {
  const { anchor, viewer } = await focusedPopover();
  anchor.remove();
  viewer.items = [{ label: 'Unavailable', suggestionId: 'ada', disabled: true }];
  await viewer.updateComplete;
  await waitUntil(() => viewer.shadowRoot!.activeElement?.getAttribute('part') === 'listbox');
  expect(viewer.open).to.equal(true);
  expect(viewer.shadowRoot!.querySelectorAll('[part="option"]').length).to.equal(1);
  expect(viewer.activeDescendantId).to.equal(null);
});

it('finishes closing when a native editor rejects caret restoration', async () => {
  const { anchor, viewer } = await focusedPopover(true);
  const original = Object.getOwnPropertyDescriptor(anchor, 'setSelectionRange');
  let attempted = 0;
  Object.defineProperty(anchor, 'setSelectionRange', {
    configurable: true,
    value: () => { attempted += 1; throw new DOMException('Selection unavailable', 'InvalidStateError'); },
  });
  try {
    viewer.open = false;
    await viewer.updateComplete;
    expect(attempted).to.be.greaterThan(0);
    expect(document.activeElement === anchor).to.equal(true);
    expect(viewer.open).to.equal(false);
    expect(anchor.getAttribute('aria-autocomplete')).to.equal(null);
    expect(await viewer.focusActiveOption()).to.equal(false);
  } finally {
    if (original) Object.defineProperty(anchor, 'setSelectionRange', original);
    else Reflect.deleteProperty(anchor, 'setSelectionRange');
  }
});

it('closes safely when a caller-provided non-editor anchor rejects focus restoration', async () => {
  const root = await fixture<HTMLDivElement>(html`<div><button>Message</button><lr-mention-popover></lr-mention-popover></div>`);
  const anchor = root.querySelector('button')!;
  const viewer = root.querySelector<LyraMentionPopover>('lr-mention-popover')!;
  await focusByKeyboard(anchor);
  viewer.anchor = anchor;
  viewer.items = [{ label: 'Ada', suggestionId: 'ada' }];
  viewer.open = true;
  await viewer.updateComplete;
  expect(await viewer.focusActiveOption()).to.equal(true);
  let attempted = 0;
  Object.defineProperty(anchor, 'focus', {
    configurable: true,
    value: () => { attempted += 1; throw new Error('Anchor no longer accepts focus'); },
  });
  try {
    viewer.open = false;
    await viewer.updateComplete;
    expect(attempted).to.equal(1);
    expect(viewer.open).to.equal(false);
    expect(await viewer.focusActiveOption()).to.equal(false);
  } finally {
    Reflect.deleteProperty(anchor, 'focus');
  }
});
