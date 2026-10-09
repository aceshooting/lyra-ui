import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './mention-popover.js';
import type { LyraMentionPopover } from './mention-popover.class.js';

const listboxOf = (el: Element): HTMLElement => el.shadowRoot!.querySelector('[part="listbox"]') as HTMLElement;

/** Mirrors lr-select/lr-combobox: a settled-closed
 *  `<lr-mention-popover>` listbox must leave the scrollable layout entirely, not merely fade to
 *  invisible, or a `position:relative; overflow:auto` ancestor keeps unexplained scroll room. The
 *  listbox's own live auto-sizing (`--lr-positioner-available-inline-size`) already keeps it
 *  within the container's bounds while open, so -- mirroring `select-closed-layout.test.ts`'s own
 *  "closed after resize" phase -- the regression only surfaces once the popover is closed (its
 *  geometry goes stale) and the container is then resized smaller. This component defaults to
 *  `position:fixed`, honouring only the cascading `--lr-positioning-strategy` custom property (no
 *  instance-level override), so the container sets it to `absolute` to resolve to the same CSS
 *  containing block. */
it('keeps a settled-closed lr-mention-popover listbox out of the scrollable layout after a resize', async () => {
  const container = await fixture<HTMLDivElement>(html`
    <div style="position: relative; width: 320px; height: 200px; overflow: auto; display: flex; justify-content: end; align-items: start; --lr-positioning-strategy: absolute">
      <input aria-label="Message" style="inline-size: 40px">
      <lr-mention-popover style="--lr-transition-fast: 0s"></lr-mention-popover>
    </div>
  `);
  const input = container.querySelector('input')!;
  const popover = container.querySelector<LyraMentionPopover>('lr-mention-popover')!;
  popover.anchor = input;
  popover.items = [{ suggestionId: 'a', label: 'An unbreakable suggestion label wide enough to overflow a shrunken container' }];
  await popover.updateComplete;
  const listbox = listboxOf(popover);
  listbox.style.whiteSpace = 'nowrap';
  popover.open = true;
  await waitUntil(() => getComputedStyle(listbox).visibility === 'visible', 'the listbox opens');
  popover.open = false;
  await waitUntil(() => listbox.hasAttribute('hidden'), 'the settled-closed listbox leaves layout');
  container.style.width = '240px';
  expect(container.scrollWidth).to.equal(container.clientWidth);
});

it('preserves the listbox opacity transition while removing the settled closed layout', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`
    <div>
      <input aria-label="Message">
      <lr-mention-popover style="--lr-transition-fast: 120ms"></lr-mention-popover>
    </div>
  `);
  const control = wrapper.querySelector<LyraMentionPopover>('lr-mention-popover')!;
  const input = wrapper.querySelector('input')!;
  control.anchor = input;
  control.items = [{ suggestionId: 'a', label: 'Suggestion' }];
  const listbox = listboxOf(control);
  for (let cycle = 0; cycle < 2; cycle++) {
    control.open = true;
    await waitUntil(() => getComputedStyle(listbox).visibility === 'visible', `opening completes on cycle ${cycle}`);
    expect(listbox.hasAttribute('hidden')).to.be.false;
    control.open = false;
    // The exit fade is a plain CSS transition (no host lifecycle event), so it must still be
    // mid-flight immediately after `open` flips -- proving `hidden` was not applied instantly.
    expect(listbox.hasAttribute('hidden')).to.be.false;
    expect(listbox.getBoundingClientRect().width).to.be.greaterThan(0);
    await waitUntil(() => listbox.hasAttribute('hidden'), 'the settled-closed listbox leaves layout');
  }
});
