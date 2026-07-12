import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './chip-group.js';
import './chip.js';
import type { LyraChipGroup } from './chip-group.js';

function fiveChips() {
  return html`
    <lyra-chip-group>
      <lyra-chip>one</lyra-chip>
      <lyra-chip>two</lyra-chip>
      <lyra-chip>three</lyra-chip>
      <lyra-chip>four</lyra-chip>
      <lyra-chip>five</lyra-chip>
    </lyra-chip-group>
  `;
}

it('defaults max-visible to unset, showing every child and no overflow indicator', async () => {
  const el = (await fixture(fiveChips())) as LyraChipGroup;
  expect(el.maxVisible).to.be.undefined;
  expect(el.shadowRoot!.querySelector('[part="overflow-indicator"]')).to.not.exist;
  const chips = Array.from(el.querySelectorAll('lyra-chip')) as HTMLElement[];
  expect(chips.every((c) => !c.hidden)).to.be.true;
});

it('shows every child when max-visible is greater than or equal to the child count', async () => {
  const el = (await fixture(html`
    <lyra-chip-group max-visible="10">
      <lyra-chip>one</lyra-chip>
      <lyra-chip>two</lyra-chip>
    </lyra-chip-group>
  `)) as LyraChipGroup;
  expect(el.shadowRoot!.querySelector('[part="overflow-indicator"]')).to.not.exist;
  const chips = Array.from(el.querySelectorAll('lyra-chip')) as HTMLElement[];
  expect(chips.every((c) => !c.hidden)).to.be.true;
});

describe('overflow behavior', () => {
  it('hides children beyond max-visible and renders a "+N" indicator', async () => {
    const el = (await fixture(html`
      <lyra-chip-group max-visible="3">
        <lyra-chip>one</lyra-chip>
        <lyra-chip>two</lyra-chip>
        <lyra-chip>three</lyra-chip>
        <lyra-chip>four</lyra-chip>
        <lyra-chip>five</lyra-chip>
      </lyra-chip-group>
    `)) as LyraChipGroup;
    const chips = Array.from(el.querySelectorAll('lyra-chip')) as HTMLElement[];
    expect(chips.map((c) => c.hidden)).to.deep.equal([false, false, false, true, true]);

    const indicator = el.shadowRoot!.querySelector('[part="overflow-indicator"]') as HTMLElement;
    expect(indicator).to.exist;
    expect(indicator.textContent!.trim()).to.equal('+2');
    expect(indicator.getAttribute('aria-expanded')).to.equal('false');
  });

  it('reveals the rest and relabels to "Show less" on click, firing lyra-overflow-toggle', async () => {
    const el = (await fixture(fiveChips())) as LyraChipGroup;
    el.maxVisible = 3;
    await el.updateComplete;

    const indicator = el.shadowRoot!.querySelector('[part="overflow-indicator"]') as HTMLButtonElement;
    setTimeout(() => indicator.click());
    const ev = await oneEvent(el, 'lyra-overflow-toggle');
    expect(ev.detail).to.deep.equal({ expanded: true });
    await el.updateComplete;

    const chips = Array.from(el.querySelectorAll('lyra-chip')) as HTMLElement[];
    expect(chips.every((c) => !c.hidden)).to.be.true;
    const indicatorNow = el.shadowRoot!.querySelector('[part="overflow-indicator"]') as HTMLElement;
    expect(indicatorNow.textContent!.trim()).to.equal('Show less');
    expect(indicatorNow.getAttribute('aria-expanded')).to.equal('true');
  });

  it('re-collapses on a second click, firing expanded: false', async () => {
    const el = (await fixture(fiveChips())) as LyraChipGroup;
    el.maxVisible = 3;
    await el.updateComplete;

    const indicator = () => el.shadowRoot!.querySelector('[part="overflow-indicator"]') as HTMLButtonElement;
    setTimeout(() => indicator().click());
    await oneEvent(el, 'lyra-overflow-toggle');
    await el.updateComplete;

    setTimeout(() => indicator().click());
    const ev = await oneEvent(el, 'lyra-overflow-toggle');
    expect(ev.detail).to.deep.equal({ expanded: false });
    await el.updateComplete;

    const chips = Array.from(el.querySelectorAll('lyra-chip')) as HTMLElement[];
    expect(chips.map((c) => c.hidden)).to.deep.equal([false, false, false, true, true]);
  });

  it('never fires lyra-overflow-toggle just from max-visible/children changing on their own', async () => {
    const el = (await fixture(fiveChips())) as LyraChipGroup;
    let fired = false;
    el.addEventListener('lyra-overflow-toggle', () => {
      fired = true;
    });

    el.maxVisible = 3;
    await el.updateComplete;
    el.maxVisible = 10;
    await el.updateComplete;
    el.maxVisible = undefined;
    await el.updateComplete;

    expect(fired).to.be.false;
  });

  it('auto-collapses expanded state (without firing) once max-visible no longer overflows', async () => {
    const el = (await fixture(fiveChips())) as LyraChipGroup;
    el.maxVisible = 3;
    await el.updateComplete;
    const indicator = el.shadowRoot!.querySelector('[part="overflow-indicator"]') as HTMLButtonElement;
    setTimeout(() => indicator.click());
    await oneEvent(el, 'lyra-overflow-toggle');
    await el.updateComplete;

    let fired = false;
    el.addEventListener('lyra-overflow-toggle', () => {
      fired = true;
    });
    el.maxVisible = 10; // no longer overflowing
    await el.updateComplete;

    expect(fired).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="overflow-indicator"]')).to.not.exist;
    const chips = Array.from(el.querySelectorAll('lyra-chip')) as HTMLElement[];
    expect(chips.every((c) => !c.hidden)).to.be.true;
  });
});

describe('dynamic children', () => {
  it('recomputes overflow when a chip is appended after first render', async () => {
    const el = (await fixture(html`
      <lyra-chip-group max-visible="2">
        <lyra-chip>one</lyra-chip>
        <lyra-chip>two</lyra-chip>
      </lyra-chip-group>
    `)) as LyraChipGroup;
    expect(el.shadowRoot!.querySelector('[part="overflow-indicator"]')).to.not.exist;

    const extra = document.createElement('lyra-chip');
    extra.textContent = 'three';
    el.appendChild(extra);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await el.updateComplete;

    const indicator = el.shadowRoot!.querySelector('[part="overflow-indicator"]') as HTMLElement;
    expect(indicator).to.exist;
    expect(indicator.textContent!.trim()).to.equal('+1');
    expect((extra as HTMLElement).hidden).to.be.true;
  });
});

it('is accessible with no overflow', async () => {
  const el = (await fixture(html`
    <lyra-chip-group>
      <lyra-chip>one</lyra-chip>
      <lyra-chip removable>two</lyra-chip>
    </lyra-chip-group>
  `)) as LyraChipGroup;
  await expect(el).to.be.accessible();
});

it('is accessible in an overflowing, collapsed state', async () => {
  const el = (await fixture(html`
    <lyra-chip-group max-visible="2">
      <lyra-chip>one</lyra-chip>
      <lyra-chip>two</lyra-chip>
      <lyra-chip>three</lyra-chip>
    </lyra-chip-group>
  `)) as LyraChipGroup;
  await expect(el).to.be.accessible();
});
