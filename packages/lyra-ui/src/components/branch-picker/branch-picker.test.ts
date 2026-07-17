import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './branch-picker.js';
import type { LyraBranchPicker } from './branch-picker.js';

it('defaults to index 0, count 1, and renders nothing while count < 2', async () => {
  const el = (await fixture(html`<lyra-branch-picker></lyra-branch-picker>`)) as LyraBranchPicker;
  expect(el.index).to.equal(0);
  expect(el.count).to.equal(1);
  expect(el.shadowRoot!.querySelector('[part="base"]')).to.not.exist;
});

it('renders the 1-based position for a 0-based index', async () => {
  const el = (await fixture(
    html`<lyra-branch-picker index="1" count="3"></lyra-branch-picker>`,
  )) as LyraBranchPicker;
  const position = el.shadowRoot!.querySelector('[part="position"]')!;
  expect(position.textContent).to.include('2');
  expect(position.textContent).to.include('3');
});

it('disables previous at index 0 and next at the last index, without hiding either button', async () => {
  const el = (await fixture(
    html`<lyra-branch-picker index="0" count="3"></lyra-branch-picker>`,
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

it('emits lyra-branch-change with the requested index and never mutates index itself', async () => {
  const el = (await fixture(
    html`<lyra-branch-picker index="1" count="3"></lyra-branch-picker>`,
  )) as LyraBranchPicker;
  const next = el.shadowRoot!.querySelector('[part="next-button"]') as HTMLButtonElement;

  const eventPromise = oneEvent(el, 'lyra-branch-change');
  next.click();
  const ev = await eventPromise;
  expect(ev.detail).to.deep.equal({ index: 2 });
  expect(el.index).to.equal(1); // unchanged -- the host applies it
});

it('never fires lyra-branch-change past either bound', async () => {
  const el = (await fixture(
    html`<lyra-branch-picker index="0" count="3"></lyra-branch-picker>`,
  )) as LyraBranchPicker;
  const previous = el.shadowRoot!.querySelector('[part="previous-button"]') as HTMLButtonElement;
  let fired = false;
  el.addEventListener('lyra-branch-change', () => (fired = true));
  previous.click(); // disabled -- a real click on a disabled button fires no click event at all
  expect(fired).to.be.false;
});

it('labels the group and announces the position via an internal live region after mount', async () => {
  const el = (await fixture(
    html`<lyra-branch-picker index="0" count="3"></lyra-branch-picker>`,
  )) as LyraBranchPicker;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(base.getAttribute('role')).to.equal('group');
  expect(base.getAttribute('aria-label')).to.equal('Response versions');

  const liveRegion = el.shadowRoot!.querySelector('lyra-live-region')!;
  const regionText = () => liveRegion.shadowRoot!.querySelector('[part="region"]')!.textContent ?? '';
  expect(regionText()).to.equal(''); // not on first paint

  el.index = 1;
  await el.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  expect(regionText()).to.include('2');
});

it('respects a custom label override', async () => {
  const el = (await fixture(
    html`<lyra-branch-picker index="0" count="2" label="Edits"></lyra-branch-picker>`,
  )) as LyraBranchPicker;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Edits');
});

it('focus() delegates to the enabled chevron button', async () => {
  const el = (await fixture(
    html`<lyra-branch-picker index="0" count="3"></lyra-branch-picker>`,
  )) as LyraBranchPicker;
  el.focus();
  const next = el.shadowRoot!.querySelector('[part="next-button"]');
  expect(el.shadowRoot!.activeElement).to.equal(next);
});

it('is accessible', async () => {
  const el = (await fixture(
    html`<lyra-branch-picker index="1" count="3"></lyra-branch-picker>`,
  )) as LyraBranchPicker;
  await expect(el).to.be.accessible();
});
