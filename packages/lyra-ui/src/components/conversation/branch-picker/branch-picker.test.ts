import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import { LitElement, type PropertyValues } from 'lit';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import './branch-picker.js';
import type { LyraBranchPicker } from './branch-picker.js';

it('defaults to index 0, count 1, and renders nothing while count < 2', async () => {
  const el = (await fixture(html`<lr-branch-picker></lr-branch-picker>`)) as LyraBranchPicker;
  expect(el.index).to.equal(0);
  expect(el.count).to.equal(1);
  expect((el.shadowRoot!.querySelector('[part="base"]')) == null).to.be.true;
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
    expect(rect.width).to.be.at.least(40);
    expect(rect.height).to.be.at.least(40);
  }
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
    let rect = previous.getBoundingClientRect();
    await sendMouse({
      type: 'move',
      position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
    });
    expect(getComputedStyle(previous).backgroundColor).to.equal(previousRest);

    const nextRest = getComputedStyle(next).backgroundColor;
    rect = next.getBoundingClientRect();
    await sendMouse({
      type: 'move',
      position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
    });
    expect(getComputedStyle(next).backgroundColor).to.not.equal(nextRest);
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
