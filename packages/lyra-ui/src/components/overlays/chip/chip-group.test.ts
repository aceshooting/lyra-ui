import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import { LitElement, html as litHtml } from 'lit';
import './chip-group.js';
import './chip.js';
import type { LyraChipGroup } from './chip-group.js';

// A minimal host that re-projects its own light-DOM children into a
// `<lr-chip-group>` living in its shadow DOM via a forwarding `<slot>` --
// this is the "slot forwarding" scenario `firstUpdated()`'s fallback
// reconciliation exists for: `this.children` (the forwarding `<slot>` itself,
// one element) under-counts what the group's own default slot actually
// flattens to (the real projected `<lr-chip>`s).
class ChipGroupForwarder extends LitElement {
  protected createRenderRoot() {
    return this.attachShadow({ mode: 'open' });
  }
  protected render() {
    return litHtml`<lr-chip-group max-visible="2"><slot></slot></lr-chip-group>`;
  }
}
customElements.define('chip-group-forwarder-test', ChipGroupForwarder);

function fiveChips() {
  return html`
    <lr-chip-group>
      <lr-chip>one</lr-chip>
      <lr-chip>two</lr-chip>
      <lr-chip>three</lr-chip>
      <lr-chip>four</lr-chip>
      <lr-chip>five</lr-chip>
    </lr-chip-group>
  `;
}

it('defaults max-visible to unset, showing every child and no overflow indicator', async () => {
  const el = (await fixture(fiveChips())) as LyraChipGroup;
  expect(el.maxVisible).to.be.undefined;
  expect(el.shadowRoot!.querySelector('[part="overflow-indicator"]')).to.not.exist;
  const chips = Array.from(el.querySelectorAll('lr-chip')) as HTMLElement[];
  expect(chips.every((c) => !c.hidden)).to.be.true;
});

it('preserves author-owned hidden state across collapse, expansion, and disconnect', async () => {
  const el = (await fixture(html`
    <lr-chip-group max-visible="1">
      <lr-chip>one</lr-chip>
      <lr-chip hidden>author hidden</lr-chip>
      <lr-chip>three</lr-chip>
    </lr-chip-group>
  `)) as LyraChipGroup;
  const chips = Array.from(el.querySelectorAll('lr-chip')) as HTMLElement[];
  expect(chips.map((chip) => chip.hidden)).to.deep.equal([false, true, true]);

  (el.shadowRoot!.querySelector('[part="overflow-indicator"]') as HTMLButtonElement).click();
  await el.updateComplete;
  expect(chips.map((chip) => chip.hidden)).to.deep.equal([false, true, false]);

  el.remove();
  expect(chips.map((chip) => chip.hidden)).to.deep.equal([false, true, false]);
});

it('sanitizes a NaN/negative maxVisible to a finite non-negative integer instead of poisoning overflow math with NaN', async () => {
  const el = (await fixture(fiveChips())) as LyraChipGroup;

  el.maxVisible = NaN;
  expect(el.maxVisible).to.equal(0); // finiteCount's own fallback of 0 for a NaN input
  await el.updateComplete;
  const chips = Array.from(el.querySelectorAll('lr-chip')) as HTMLElement[];
  expect(chips.every((c) => c.hidden)).to.be.true; // 0 visible, all 5 collapse behind the indicator
  expect(el.shadowRoot!.querySelector('[part="overflow-indicator"]')).to.exist;

  el.maxVisible = -5;
  expect(el.maxVisible).to.equal(0); // clamped to the non-negative floor

  el.maxVisible = undefined;
  expect(el.maxVisible).to.be.undefined; // explicitly unsetting still means "no limit"
});

it('shows every child when max-visible is greater than or equal to the child count', async () => {
  const el = (await fixture(html`
    <lr-chip-group max-visible="10">
      <lr-chip>one</lr-chip>
      <lr-chip>two</lr-chip>
    </lr-chip-group>
  `)) as LyraChipGroup;
  expect(el.shadowRoot!.querySelector('[part="overflow-indicator"]')).to.not.exist;
  const chips = Array.from(el.querySelectorAll('lr-chip')) as HTMLElement[];
  expect(chips.every((c) => !c.hidden)).to.be.true;
});

describe('overflow behavior', () => {
  it('hides children beyond max-visible and renders a "+N" indicator', async () => {
    const el = (await fixture(html`
      <lr-chip-group max-visible="3">
        <lr-chip>one</lr-chip>
        <lr-chip>two</lr-chip>
        <lr-chip>three</lr-chip>
        <lr-chip>four</lr-chip>
        <lr-chip>five</lr-chip>
      </lr-chip-group>
    `)) as LyraChipGroup;
    const chips = Array.from(el.querySelectorAll('lr-chip')) as HTMLElement[];
    expect(chips.map((c) => c.hidden)).to.deep.equal([false, false, false, true, true]);

    const indicator = el.shadowRoot!.querySelector('[part="overflow-indicator"]') as HTMLElement;
    expect(indicator).to.exist;
    expect(indicator.textContent!.trim()).to.equal('+2');
    expect(indicator.getAttribute('aria-expanded')).to.equal('false');
  });

  it('reveals the rest and relabels to "Show less" on click, firing lr-overflow-toggle', async () => {
    const el = (await fixture(fiveChips())) as LyraChipGroup;
    el.maxVisible = 3;
    await el.updateComplete;

    const indicator = el.shadowRoot!.querySelector('[part="overflow-indicator"]') as HTMLButtonElement;
    setTimeout(() => indicator.click());
    const ev = await oneEvent(el, 'lr-overflow-toggle');
    expect(ev.detail).to.deep.equal({ expanded: true });
    await el.updateComplete;

    const chips = Array.from(el.querySelectorAll('lr-chip')) as HTMLElement[];
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
    await oneEvent(el, 'lr-overflow-toggle');
    await el.updateComplete;

    setTimeout(() => indicator().click());
    const ev = await oneEvent(el, 'lr-overflow-toggle');
    expect(ev.detail).to.deep.equal({ expanded: false });
    await el.updateComplete;

    const chips = Array.from(el.querySelectorAll('lr-chip')) as HTMLElement[];
    expect(chips.map((c) => c.hidden)).to.deep.equal([false, false, false, true, true]);
  });

  it('never fires lr-overflow-toggle just from max-visible/children changing on their own', async () => {
    const el = (await fixture(fiveChips())) as LyraChipGroup;
    let fired = false;
    el.addEventListener('lr-overflow-toggle', () => {
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
    await oneEvent(el, 'lr-overflow-toggle');
    await el.updateComplete;

    let fired = false;
    el.addEventListener('lr-overflow-toggle', () => {
      fired = true;
    });
    el.maxVisible = 10; // no longer overflowing
    await el.updateComplete;

    expect(fired).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="overflow-indicator"]')).to.not.exist;
    const chips = Array.from(el.querySelectorAll('lr-chip')) as HTMLElement[];
    expect(chips.every((c) => !c.hidden)).to.be.true;
  });
});

describe('dynamic children', () => {
  it('recomputes overflow when a chip is appended after first render', async () => {
    const el = (await fixture(html`
      <lr-chip-group max-visible="2">
        <lr-chip>one</lr-chip>
        <lr-chip>two</lr-chip>
      </lr-chip-group>
    `)) as LyraChipGroup;
    expect(el.shadowRoot!.querySelector('[part="overflow-indicator"]')).to.not.exist;

    const extra = document.createElement('lr-chip');
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

it('reconciles childCount correctly through a forwarding <slot> (children.length under-counts), without a redundant explicit resync alongside it', async () => {
  // Reset Lit's own dedupe set first so this doesn't silently pass just
  // because an earlier test already tripped (and thus suppressed) the exact
  // same warning string -- same guard `<lr-toast-item>`'s equivalent test
  // uses.
  const globalWarnings = (globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings;
  if (globalWarnings) {
    [...globalWarnings].filter((w) => w.includes('scheduled an update')).forEach((w) => globalWarnings.delete(w));
  }

  const originalWarn = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  let host: ChipGroupForwarder;
  try {
    host = (await fixture(html`
      <chip-group-forwarder-test>
        <lr-chip>one</lr-chip>
        <lr-chip>two</lr-chip>
        <lr-chip>three</lr-chip>
      </chip-group-forwarder-test>
    `)) as ChipGroupForwarder;
    await host.updateComplete;
    const group = host.shadowRoot!.querySelector('lr-chip-group') as LyraChipGroup;
    // The childCount correction inside firstUpdated() schedules a second,
    // separate update cycle (that's the whole warning this test is about) --
    // a single `await updateComplete` only guarantees the *current* cycle
    // finished, per Lit's own documented `while (!(await el.updateComplete))`
    // idiom, so loop until nothing more is pending.
    while (!(await group.updateComplete)) {
      /* keep draining until settled */
    }

    // The corrected count (3, not the under-counted 1 `this.children.length`
    // sees through the forwarding `<slot>`) must actually reach rendered
    // output -- confirming `updated()`'s own resync (which runs regardless)
    // is the only thing doing that work now that the redundant explicit
    // `syncChildVisibility()` call is gone from `firstUpdated()`. The
    // childCount reassignment causing exactly one extra render pass here is
    // the accepted structural trade-off noted in `firstUpdated()`'s comment.
    const indicator = group.shadowRoot!.querySelector('[part="overflow-indicator"]') as HTMLElement;
    expect(indicator).to.exist;
    expect(indicator.textContent!.trim()).to.equal('+1');
    const forwardedChips = Array.from(host.querySelectorAll('lr-chip')) as HTMLElement[];
    expect(forwardedChips.map((chip) => chip.hidden)).to.deep.equal([false, false, true]);
  } finally {
    console.warn = originalWarn;
  }

  const messages = calls.flat().map(String);
  expect(messages.some((m) => m.includes('scheduled an update'))).to.be.true;
});

it('localizes the overflow-toggle aria-label and collapsed text via this.localize(), not hardcoded English', async () => {
  const el = (await fixture(html`
    <lr-chip-group max-visible="1" .strings=${{ showMoreCount: '{count} de plus', showLess: 'Voir moins' }}>
      <lr-chip>A</lr-chip>
      <lr-chip>B</lr-chip>
      <lr-chip>C</lr-chip>
    </lr-chip-group>
  `)) as LyraChipGroup;
  const toggle = el.shadowRoot!.querySelector('[part="overflow-indicator"]') as HTMLButtonElement;
  expect(toggle.getAttribute('aria-label')).to.equal('2 de plus');
  toggle.click();
  await el.updateComplete;
  expect(toggle.getAttribute('aria-label')).to.equal('Voir moins');
  expect(toggle.textContent!.trim()).to.equal('Voir moins');
});

it('localizes the collapsed overflow-indicator visible text via this.localize(), not a hardcoded "+N"', async () => {
  const el = (await fixture(html`
    <lr-chip-group max-visible="1" .strings=${{ showMoreCollapsed: '{count} de plus' }}>
      <lr-chip>A</lr-chip>
      <lr-chip>B</lr-chip>
      <lr-chip>C</lr-chip>
    </lr-chip-group>
  `)) as LyraChipGroup;
  const toggle = el.shadowRoot!.querySelector('[part="overflow-indicator"]') as HTMLButtonElement;
  expect(toggle.textContent!.trim()).to.equal('2 de plus');
});

it('defaults to a plain "+N" when no strings override is set', async () => {
  const el = (await fixture(html`
    <lr-chip-group max-visible="1">
      <lr-chip>A</lr-chip>
      <lr-chip>B</lr-chip>
      <lr-chip>C</lr-chip>
    </lr-chip-group>
  `)) as LyraChipGroup;
  const toggle = el.shadowRoot!.querySelector('[part="overflow-indicator"]') as HTMLButtonElement;
  expect(toggle.textContent!.trim()).to.equal('+2');
});

it('defaults to English "Show N more"/"Show less" when no strings override is set', async () => {
  const el = (await fixture(html`
    <lr-chip-group max-visible="1">
      <lr-chip>A</lr-chip>
      <lr-chip>B</lr-chip>
      <lr-chip>C</lr-chip>
    </lr-chip-group>
  `)) as LyraChipGroup;
  const toggle = el.shadowRoot!.querySelector('[part="overflow-indicator"]') as HTMLButtonElement;
  expect(toggle.getAttribute('aria-label')).to.equal('Show 2 more');
});

it('is accessible with no overflow', async () => {
  const el = (await fixture(html`
    <lr-chip-group>
      <lr-chip>one</lr-chip>
      <lr-chip removable>two</lr-chip>
    </lr-chip-group>
  `)) as LyraChipGroup;
  await expect(el).to.be.accessible();
});

it('is accessible in an overflowing, collapsed state', async () => {
  const el = (await fixture(html`
    <lr-chip-group max-visible="2">
      <lr-chip>one</lr-chip>
      <lr-chip>two</lr-chip>
      <lr-chip>three</lr-chip>
    </lr-chip-group>
  `)) as LyraChipGroup;
  await expect(el).to.be.accessible();
});
