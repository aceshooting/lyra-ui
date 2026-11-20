import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { LitElement, type PropertyValues } from 'lit';
import { hoverUntilMatched, resetMouse, sendMouse, settlePointer } from '../../../../test/wtr-mouse.js';
import '../../lr-branch-picker.js';
import type { LyraBranchPicker } from '../../lr-branch-picker.js';

// These locale-formatting fixtures intentionally retain English messages.
expectLocaleFallback('ar-EG', [
  'branchPickerLabel',
  'branchPrevious',
  'branchNext',
]);
it('defaults to index 0, count 1, and renders nothing while count < 2', async () => {
  const el = (await fixture(html`<lr-branch-picker></lr-branch-picker>`)) as LyraBranchPicker;
  expect(el.index).to.equal(0);
  expect(el.count).to.equal(1);
  expect((el.shadowRoot!.querySelector('[part="base"]')) == null).to.be.true;
});

it('exposes no toolbar actions and keeps imperative focus/click inert for zero branches', async () => {
  const el = (await fixture(html`<lr-branch-picker count="0"></lr-branch-picker>`)) as LyraBranchPicker;
  let changes = 0;
  el.addEventListener('lr-branch-change', () => changes++);

  expect(el.getToolbarActions()).to.deep.equal([]);
  expect(() => {
    el.focus();
    el.click();
  }).to.not.throw();
  expect(el.shadowRoot!.activeElement === null).to.equal(true);
  expect(changes).to.equal(0);
});

it('renders the 1-based position for a 0-based index', async () => {
  const el = (await fixture(
    html`<lr-branch-picker index="1" count="3"></lr-branch-picker>`,
  )) as LyraBranchPicker;
  const position = el.shadowRoot!.querySelector('[part="position"]')!;
  expect(position.textContent).to.include('2');
  expect(position.textContent).to.include('3');
});

it('disables previous at index 0 and next at the last index, without hiding either button', async () => {
  const el = (await fixture(
    html`<lr-branch-picker index="0" count="3"></lr-branch-picker>`,
  )) as LyraBranchPicker;
  const previous = el.shadowRoot!.querySelector('[part="previous-button"]') as HTMLButtonElement;
  const next = el.shadowRoot!.querySelector('[part="next-button"]') as HTMLButtonElement;
  expect(previous.disabled).to.be.true;
  expect(next.disabled).to.be.false;

  el.index = 2;
  await el.updateComplete;
  expect(previous.disabled).to.be.false;
  expect(next.disabled).to.be.true;
});

it('emits lr-branch-change with the requested index and never mutates index itself', async () => {
  const el = (await fixture(
    html`<lr-branch-picker index="1" count="3"></lr-branch-picker>`,
  )) as LyraBranchPicker;
  const next = el.shadowRoot!.querySelector('[part="next-button"]') as HTMLButtonElement;

  const eventPromise = oneEvent(el, 'lr-branch-change');
  next.click();
  const ev = await eventPromise;
  expect(ev.detail).to.deep.equal({ index: 2 });
  expect(el.index).to.equal(1); // unchanged -- the host applies it
});

it('never fires lr-branch-change past either bound', async () => {
  const el = (await fixture(
    html`<lr-branch-picker index="0" count="3"></lr-branch-picker>`,
  )) as LyraBranchPicker;
  const previous = el.shadowRoot!.querySelector('[part="previous-button"]') as HTMLButtonElement;
  let fired = false;
  el.addEventListener('lr-branch-change', () => (fired = true));
  previous.click(); // disabled -- a real click on a disabled button fires no click event at all
  expect(fired).to.be.false;
});

it('labels the group and announces the position via an internal live region after mount', async () => {
  const el = (await fixture(
    html`<lr-branch-picker index="0" count="3"></lr-branch-picker>`,
  )) as LyraBranchPicker;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(base.getAttribute('role')).to.equal('group');
  expect(base.getAttribute('aria-label')).to.equal('Response versions');

  const liveRegion = el.shadowRoot!.querySelector('lr-live-region')!;
  const regionText = () => liveRegion.shadowRoot!.querySelector('[part="region"]')!.textContent ?? '';
  expect(regionText()).to.equal(''); // not on first paint

  el.index = 1;
  await el.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  expect(regionText()).to.include('2');
});

it('respects a custom label override', async () => {
  const el = (await fixture(
    html`<lr-branch-picker index="0" count="2" label="Edits"></lr-branch-picker>`,
  )) as LyraBranchPicker;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Edits');
});

it('preserves an explicitly empty host aria-label on the semantic group', async () => {
  const el = (await fixture(
    html`<lr-branch-picker count="2" aria-label=""></lr-branch-picker>`,
  )) as LyraBranchPicker;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('');
});

it('uses the localized default label when label is omitted', async () => {
  const el = (await fixture(
    html`<lr-branch-picker index="0" count="2"></lr-branch-picker>`,
  )) as LyraBranchPicker;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
    'Response versions',
  );
});

it('reads back an omitted label as undefined, not the empty string', async () => {
  const el = (await fixture(
    html`<lr-branch-picker index="0" count="2"></lr-branch-picker>`,
  )) as LyraBranchPicker;
  expect(el.label).to.equal(undefined);
});

it('suppresses the localized default label when label is explicitly empty', async () => {
  const el = (await fixture(
    html`<lr-branch-picker index="0" count="2" label=""></lr-branch-picker>`,
  )) as LyraBranchPicker;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('');
});

it('focus() delegates to the enabled chevron button', async () => {
  const el = (await fixture(
    html`<lr-branch-picker index="0" count="3"></lr-branch-picker>`,
  )) as LyraBranchPicker;
  el.focus();
  const next = el.shadowRoot!.querySelector('[part="next-button"]');
  expect((el.shadowRoot!.activeElement) === (next)).to.equal(true);
});

it('click() delegates to the enabled chevron button', async () => {
  const el = (await fixture(
    html`<lr-branch-picker index="0" count="3"></lr-branch-picker>`,
  )) as LyraBranchPicker;
  const eventPromise = oneEvent(el, 'lr-branch-change');
  el.click();
  const event = await eventPromise;
  expect(event.detail).to.deep.equal({ index: 1 });
});

it('formats and localizes the complete visible position and live announcement', async () => {
  const el = (await fixture(html`
    <lr-branch-picker
      index="0"
      count="3"
      lang="ar-EG"
      .strings=${{ branchPosition: 'الموضع {index} من {total}' }}
    ></lr-branch-picker>
  `)) as LyraBranchPicker;
  const position = el.shadowRoot!.querySelector('[part="position"]')!.textContent!.trim();
  expect(position).to.equal('الموضع ١ من ٣');

  el.index = 1;
  await el.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const region = el.shadowRoot!
    .querySelector('lr-live-region')!
    .shadowRoot!.querySelector('[part="region"]')!;
  expect(region.textContent).to.equal('الموضع ٢ من ٣');
});

it('keeps both chevron actions at the shared icon-button hit-area floor', async () => {
  const el = (await fixture(
    html`<lr-branch-picker index="1" count="3"></lr-branch-picker>`,
  )) as LyraBranchPicker;
  const buttons = Array.from(el.shadowRoot!.querySelectorAll('button'));
  for (const button of buttons) {
    const rect = button.getBoundingClientRect();
    expect(rect.width).to.be.at.least(36);
    expect(rect.height).to.be.at.least(36);
  }
});

it('inherits a 20px host font for both chevrons and their one-em glyphs', async () => {
  const el = (await fixture(
    html`<lr-branch-picker style="font-size: 20px" index="1" count="3"></lr-branch-picker>`,
  )) as LyraBranchPicker;
  const buttons = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('button')];

  for (const button of buttons) {
    expect(getComputedStyle(button).fontSize).to.equal('20px');
    expect(getComputedStyle(button.querySelector('svg')!).width).to.equal('20px');
  }
});

it('compare-restores branch action tab stops on consumer takeover, disappearance, and disconnect', async () => {
  const el = (await fixture(
    html`<lr-branch-picker index="1" count="3"></lr-branch-picker>`,
  )) as LyraBranchPicker;
  const previous = el.shadowRoot!.querySelector(
    '[part="previous-button"]',
  ) as HTMLButtonElement;
  const action = el.getToolbarActions()[0]!;
  previous.setAttribute('tabindex', '7');
  action.setTabIndex(-1);
  action.releaseTabIndex?.();
  expect(previous.getAttribute('tabindex')).to.equal('7');

  action.setTabIndex(-1);
  previous.setAttribute('tabindex', '5');
  action.releaseTabIndex?.();
  expect(previous.getAttribute('tabindex')).to.equal('5');

  action.setTabIndex(-1);
  el.count = 1;
  await el.updateComplete;
  expect(previous.getAttribute('tabindex')).to.equal('5');

  el.count = 3;
  await el.updateComplete;
  const readded = el.shadowRoot!.querySelector(
    '[part="previous-button"]',
  ) as HTMLButtonElement;
  const readdedAction = el.getToolbarActions()[0]!;
  readdedAction.setTabIndex(-1);
  el.remove();
  expect(readded.hasAttribute('tabindex')).to.be.false;
});

it('is accessible', async () => {
  const el = (await fixture(
    html`<lr-branch-picker index="1" count="3"></lr-branch-picker>`,
  )) as LyraBranchPicker;
  await expect(el).to.be.accessible();
});

it('renders nothing for a NaN or negative count instead of throwing or showing NaN', async () => {
  const el = (await fixture(
    html`<lr-branch-picker index="0" count="3"></lr-branch-picker>`,
  )) as LyraBranchPicker;
  expect(el.shadowRoot!.querySelector('[part="base"]')).to.exist;

  el.count = NaN;
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('[part="base"]')) == null).to.be.true;

  el.count = -5;
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('[part="base"]')) == null).to.be.true;
});

it('clamps a NaN, negative, or oversized index to a valid branch instead of NaN/out-of-range', async () => {
  const el = (await fixture(
    html`<lr-branch-picker index="1" count="3"></lr-branch-picker>`,
  )) as LyraBranchPicker;
  const position = () => el.shadowRoot!.querySelector('[part="position"]')!.textContent!.trim();

  el.index = NaN;
  await el.updateComplete;
  expect(position()).to.include('1'); // non-finite falls back to the first branch

  el.index = -5;
  await el.updateComplete;
  expect(position()).to.include('1'); // clamped to the first branch

  el.index = 999;
  await el.updateComplete;
  expect(position()).to.include('3'); // clamped to the last branch
});

it('never fires lr-branch-change past either bound when count is non-finite', async () => {
  const el = (await fixture(
    html`<lr-branch-picker index="0" count="3"></lr-branch-picker>`,
  )) as LyraBranchPicker;
  el.count = NaN; // renders nothing at all, but requestIndex() must still stay bound-safe
  await el.updateComplete;
  let fired = false;
  el.addEventListener('lr-branch-change', () => (fired = true));

  (el as unknown as { requestIndex(next: number): void }).requestIndex(5);
  expect(fired).to.be.false;
});

it('chains updated() to super.updated() so a mixin layered under LyraElement would still run', async () => {
  // No shared mixin actually overrides updated() today, so the only way to prove the chain is live
  // (rather than grepping source text for the call) is to patch the base-class hook itself -- the
  // exact hook a future mixin would extend -- and confirm it actually fires.
  const hadOwn = Object.prototype.hasOwnProperty.call(LitElement.prototype, 'updated');
  const original = (LitElement.prototype as unknown as { updated?: (changed: PropertyValues) => void }).updated;
  let called = false;
  (LitElement.prototype as unknown as { updated: (changed: PropertyValues) => void }).updated = function (
    this: LitElement,
    changed: PropertyValues,
  ) {
    called = true;
    original?.call(this, changed);
  };
  try {
    const el = (await fixture(html`<lr-branch-picker index="0" count="3"></lr-branch-picker>`)) as LyraBranchPicker;
    await el.updateComplete;
    expect(called).to.be.true;
  } finally {
    if (hadOwn) {
      (LitElement.prototype as unknown as { updated: unknown }).updated = original;
    } else {
      delete (LitElement.prototype as unknown as { updated?: unknown }).updated;
    }
  }
});

it('renders hover feedback on enabled chevrons without repainting disabled controls', async () => {
  const el = (await fixture(html`<lr-branch-picker count="3" index="0"></lr-branch-picker>`)) as LyraBranchPicker;
  const previous = el.shadowRoot!.querySelector('[part="previous-button"]') as HTMLButtonElement;
  const next = el.shadowRoot!.querySelector('[part="next-button"]') as HTMLButtonElement;
  try {
    const previousRest = getComputedStyle(previous).backgroundColor;
    // `previous` is disabled at index 0, so :hover never matches it -- there is no rendered state
    // to poll for, and a synchronous read right after the move would pass vacuously whether or not
    // the pointer event had actually been processed yet. Give the browser two frames, then assert
    // nothing repainted.
    const previousRect = previous.getBoundingClientRect();
    await sendMouse({
      type: 'move',
      position: [
        Math.round(previousRect.left + previousRect.width / 2),
        Math.round(previousRect.top + previousRect.height / 2),
      ],
    });
    await settlePointer();
    expect(getComputedStyle(previous).backgroundColor).to.equal(previousRest);

    const nextRest = getComputedStyle(next).backgroundColor;
    // `next` IS hoverable, so land the pointer with hoverUntilMatched() and poll for the repaint
    // instead of reading getComputedStyle() synchronously right after the move -- sendMouse()
    // resolving does not mean the browser has processed the native pointer event yet.
    await hoverUntilMatched(next, 'next chevron never matched :hover');
    await waitUntil(
      () => getComputedStyle(next).backgroundColor !== nextRest,
      'next chevron hover background never repainted',
    );
  } finally {
    await resetMouse();
  }
});

it('does not announce an index transition that happened while detached', async () => {
  const wrapper = (await fixture(html`<div><lr-branch-picker count="3"></lr-branch-picker></div>`)) as HTMLElement;
  const el = wrapper.querySelector('lr-branch-picker') as LyraBranchPicker;
  wrapper.removeChild(el);
  el.index = 1;
  wrapper.appendChild(el);
  await el.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const text = el.shadowRoot!.querySelector('lr-live-region')!.shadowRoot!.querySelector('[part="region"]')!.textContent;
  expect(text).to.equal('');
});

it('blur() releases whichever step button held focus', async () => {
  const el = (await fixture(
    html`<lr-branch-picker count="3" index="1"></lr-branch-picker>`,
  )) as LyraBranchPicker;
  await el.updateComplete;
  el.focus();
  expect((el.shadowRoot!.activeElement) != null).to.equal(true);
  el.blur();
  expect((el.shadowRoot!.activeElement) === null).to.equal(true);
});

for (const [direction, opposite, endpoint] of [
  ['next', 'previous', 2],
  ['previous', 'next', 0],
] as const) {
  it(`moves focus from ${direction} to ${opposite} when the consumer applies the endpoint`, async () => {
    const el = await fixture<LyraBranchPicker>(html`<lr-branch-picker index="1" count="3"></lr-branch-picker>`);
    const button = (part: string) =>
      el.shadowRoot!.querySelector<HTMLButtonElement>(`[part="${part}-button"]`)!;
    await focusByKeyboard(button(direction));
    const change = oneEvent(el, 'lr-branch-change');
    await sendKeys({ press: 'Space' });
    expect((await change).detail.index).to.equal(endpoint);
    expect(el.index).to.equal(1);
    expect(el.shadowRoot!.activeElement === button(direction)).to.equal(true);

    el.index = endpoint;
    await el.updateComplete;
    expect(button(direction).disabled).to.equal(true);
    expect(el.shadowRoot!.activeElement === button(opposite)).to.equal(true);
  });
}

it('preserves focus the consumer moved before applying a branch change', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div><lr-branch-picker index="1" count="3"></lr-branch-picker><button>Outside</button></div>
  `);
  const el = wrapper.querySelector<LyraBranchPicker>('lr-branch-picker')!;
  const outside = wrapper.querySelector('button')!;
  await el.updateComplete;
  await focusByKeyboard(el.shadowRoot!.querySelector<HTMLButtonElement>('[part="next-button"]')!);
  el.addEventListener('lr-branch-change', ({ detail }) => {
    outside.focus();
    el.index = detail.index;
  }, { once: true });
  await sendKeys({ press: 'Enter' });
  await el.updateComplete;
  expect(el.index).to.equal(2);
  expect(document.activeElement === outside).to.equal(true);
});

it('announces the next navigation after a reparent that changed nothing', async () => {
  const wrapper = (await fixture(html`<div><lr-branch-picker count="3"></lr-branch-picker></div>`)) as HTMLElement;
  const el = wrapper.querySelector('lr-branch-picker') as LyraBranchPicker;
  wrapper.removeChild(el);
  wrapper.appendChild(el);
  await el.updateComplete;
  el.index = 1;
  await el.updateComplete;
  const region = el.shadowRoot!.querySelector('lr-live-region')!;
  await waitUntil(() => (region.shadowRoot!.querySelector('[part="region"]')!.textContent ?? '') !== '', 'position never announced');
});

it('uses the localized group name for a whitespace-only label or host name', async () => {
  const el = await fixture<LyraBranchPicker>(html`<lr-branch-picker count="2" label="  "></lr-branch-picker>`);
  const group = el.shadowRoot!.querySelector('[role="group"]')!;
  expect(group.getAttribute('aria-label')).to.equal('Response versions');
  el.label = 'Revision history';
  el.setAttribute('aria-label', '   ');
  await el.updateComplete;
  expect(group.getAttribute('aria-label')).to.equal('Response versions');
});

it('applies the shared icon action border to its buttons', async () => {
  const el = await fixture<LyraBranchPicker>(html`
    <lr-branch-picker count="3" index="1" style="--lr-icon-button-border: 3px dashed rgb(12, 34, 56)"></lr-branch-picker>
  `);
  for (const part of ['previous-button','next-button']) {
    const button = el.shadowRoot!.querySelector(`[part="${part}"]`)!;
    const style = getComputedStyle(button);
    expect([style.borderTopWidth, style.borderTopStyle, style.borderTopColor]).to.deep.equal(['3px', 'dashed', 'rgb(12, 34, 56)']);
  }
});

it('disables both branches and their toolbar stops until re-enabled', async () => {
  const el = await fixture<LyraBranchPicker>(html`<lr-branch-picker count="3" index="1"></lr-branch-picker>`);
  let changes = 0;
  el.addEventListener('lr-branch-change', () => { changes++; });
  el.disabled = true;
  el.click();
  await el.updateComplete;
  expect([...el.shadowRoot!.querySelectorAll('button')].map(b => b.disabled)).to.deep.equal([true, true]);
  expect(el.getToolbarActions().map(action => action.disabled)).to.deep.equal([true, true]);
  el.disabled = false;
  await el.updateComplete;
  expect(el.getToolbarActions().map(action => action.disabled)).to.deep.equal([false, false]);
  el.click();
  expect(changes).to.equal(1);
});
