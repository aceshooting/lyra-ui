import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import { LitElement, html as litHtml } from 'lit';
import './chip-group.js';
import './chip.js';
import type { LyraChipGroup } from './chip-group.js';
import { styles } from './chip-group.styles.js';

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

it("wraps the internal [aria-expanded='true'] rule in :where() so a consumer ::part(overflow-indicator) override can win (regression)", () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='overflow-indicator'\]:where\(\[aria-expanded='true'\]\)/);
  // The old, over-specific unwrapped shape must be gone, not merely joined by the new one.
  expect(css).to.not.include("[part='overflow-indicator'][aria-expanded='true']");
});

it('lets a consumer retint the expanded overflow-indicator via the scoped --lr-chip-group-overflow-expanded-color cssprop (regression)', async () => {
  const el = (await fixture(fiveChips())) as LyraChipGroup;
  el.maxVisible = 3;
  el.style.setProperty('--lr-chip-group-overflow-expanded-color', 'rgb(1, 2, 3)');
  await el.updateComplete;
  const indicator = el.shadowRoot!.querySelector('[part="overflow-indicator"]') as HTMLButtonElement;
  indicator.click();
  await el.updateComplete;
  expect(indicator.getAttribute('aria-expanded')).to.equal('true');
  expect(getComputedStyle(indicator).color).to.equal('rgb(1, 2, 3)');
});

it('lets a consumer retune only the expanded overflow-indicator border style while the resting marker stays dashed', async () => {
  const el = (await fixture(fiveChips())) as LyraChipGroup;
  el.maxVisible = 3;
  el.style.setProperty('--lr-chip-group-overflow-expanded-border-style', 'dotted');
  await el.updateComplete;

  const collapsed = el.shadowRoot!.querySelector('[part="overflow-indicator"]') as HTMLButtonElement;
  expect(collapsed.getAttribute('aria-expanded')).to.equal('false');
  expect(getComputedStyle(collapsed).borderStyle).to.equal('dashed');

  collapsed.click();
  await el.updateComplete;
  const expanded = el.shadowRoot!.querySelector('[part="overflow-indicator"]') as HTMLButtonElement;
  expect(expanded.getAttribute('aria-expanded')).to.equal('true');
  expect(getComputedStyle(expanded).borderStyle).to.equal('dotted');
});

it('keeps long removable chips contained through collapsed and expanded overflow states in a 320px RTL allocation', async () => {
  const longLabel = 'مرشحبحثدوليمطولجداًبدونمسافاتللتأكدمنأنالترتيبالمنطقييبقىداخلالمساحة';
  const wrapper = await fixture<HTMLElement>(html`
    <div dir="rtl" style="inline-size: 320px; max-inline-size: 100%;">
      <lr-chip-group max-visible="2">
        <lr-chip removable>${longLabel}</lr-chip>
        <lr-chip removable>${longLabel}</lr-chip>
        <lr-chip removable>${longLabel}</lr-chip>
        <lr-chip removable>${longLabel}</lr-chip>
      </lr-chip-group>
    </div>
  `);
  const el = wrapper.querySelector('lr-chip-group') as LyraChipGroup;
  await el.updateComplete;

  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const chips = Array.from(el.querySelectorAll<HTMLElement>('lr-chip'));
  const collapsed = el.shadowRoot!.querySelector('[part="overflow-indicator"]') as HTMLButtonElement;
  expect(getComputedStyle(base).direction).to.equal('rtl');
  expect(base.scrollWidth, 'the collapsed group must stay inside its 320px allocation').to.be.at.most(base.clientWidth);
  expect(chips.filter((chip) => chip.hidden)).to.have.lengthOf(2);

  collapsed.click();
  await el.updateComplete;
  const expanded = el.shadowRoot!.querySelector('[part="overflow-indicator"]') as HTMLButtonElement;
  expect(expanded.getAttribute('aria-expanded')).to.equal('true');
  expect(chips.filter((chip) => chip.hidden)).to.have.lengthOf(0);
  expect(base.scrollWidth, 'the expanded group must stay inside its 320px allocation').to.be.at.most(base.clientWidth);
});

it('defaults max-visible to unset, showing every child and no overflow indicator', async () => {
  const el = (await fixture(fiveChips())) as LyraChipGroup;
  expect(el.maxVisible).to.be.undefined;
  expect((el.shadowRoot!.querySelector('[part="overflow-indicator"]')) == null).to.be.true;
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

it('reapplies collapsed visibility after disconnect and reconnect', async () => {
  const el = (await fixture(html`
    <lr-chip-group max-visible="1">
      <lr-chip>one</lr-chip><lr-chip>two</lr-chip><lr-chip>three</lr-chip>
    </lr-chip-group>
  `)) as LyraChipGroup;
  const parent = el.parentElement!;
  const chips = Array.from(el.querySelectorAll('lr-chip')) as HTMLElement[];
  expect(chips.map((chip) => chip.hidden)).to.deep.equal([false, true, true]);

  el.remove();
  expect(chips.map((chip) => chip.hidden)).to.deep.equal([false, false, false]);
  parent.append(el);
  await el.updateComplete;

  expect(chips.map((chip) => chip.hidden)).to.deep.equal([false, true, true]);
});

it('recreates its hidden-state observer in the adopted owner realm', async () => {
  const el = (await fixture(html`
    <lr-chip-group max-visible="1"><lr-chip>one</lr-chip><lr-chip>two</lr-chip></lr-chip-group>
  `)) as LyraChipGroup;
  await el.updateComplete;
  const chips = Array.from(el.querySelectorAll<HTMLElement>('lr-chip'));
  el.remove();
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const frameDocument = iframe.contentDocument;
  const frameWindow = iframe.contentWindow;
  if (!frameDocument || !frameWindow) {
    iframe.remove();
    throw new Error('The iframe realm was unavailable.');
  }
  const originalMutationObserver = frameWindow.MutationObserver;
  let observations = 0;
  let disconnects = 0;
  class OwnerMutationObserver implements MutationObserver {
    private observesChip = false;
    constructor(_callback: MutationCallback) {}
    observe(target: Node, options?: MutationObserverInit): void {
      if (
        chips.includes(target as HTMLElement) &&
        options?.attributeFilter?.includes('hidden') &&
        options.attributeOldValue
      ) {
        this.observesChip = true;
        observations += 1;
      }
    }
    takeRecords(): MutationRecord[] { return []; }
    disconnect(): void { if (this.observesChip) disconnects += 1; }
  }
  frameWindow.MutationObserver = OwnerMutationObserver;

  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    expect(observations, 'the destination window observes assigned chips').to.equal(2);
    document.adoptNode(el);
    expect(disconnects, 'adoption disconnects the previous owner observer').to.be.greaterThan(0);
  } finally {
    frameWindow.MutationObserver = originalMutationObserver;
    if (el.ownerDocument !== document) document.adoptNode(el);
    el.remove();
    iframe.remove();
  }
});

it('tracks live author hidden edits instead of restoring the initial snapshot', async () => {
  const el = (await fixture(html`
    <lr-chip-group max-visible="1">
      <lr-chip>one</lr-chip><lr-chip>two</lr-chip><lr-chip>three</lr-chip>
    </lr-chip-group>
  `)) as LyraChipGroup;
  const second = el.querySelectorAll<HTMLElement>('lr-chip')[1]!;

  second.hidden = false;
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  expect(second.hidden, 'the group must continue enforcing collapse after an author removal').to.be.true;

  (el.shadowRoot!.querySelector('[part="overflow-indicator"]') as HTMLButtonElement).click();
  await el.updateComplete;
  expect(second.hidden).to.be.false;

  second.hidden = true;
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  el.remove();
  expect(second.hidden, 'disconnect must restore the latest authored hidden state').to.be.true;
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
  expect((el.shadowRoot!.querySelector('[part="overflow-indicator"]')) == null).to.be.true;
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
    expect((indicator) != null).to.equal(true);
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
    expect((el.shadowRoot!.querySelector('[part="overflow-indicator"]')) == null).to.be.true;
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
    expect((el.shadowRoot!.querySelector('[part="overflow-indicator"]')) == null).to.be.true;

    const extra = document.createElement('lr-chip');
    extra.textContent = 'three';
    el.appendChild(extra);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await el.updateComplete;

    const indicator = el.shadowRoot!.querySelector('[part="overflow-indicator"]') as HTMLElement;
    expect((indicator) != null).to.equal(true);
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
    expect((indicator) != null).to.equal(true);
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

it('formats overflow counts with the effective locale in visible and accessible labels', async () => {
  const el = (await fixture(html`
    <lr-chip-group lang="ar-EG" max-visible="3">
      <lr-chip>one</lr-chip><lr-chip>two</lr-chip><lr-chip>three</lr-chip>
      <lr-chip>four</lr-chip><lr-chip>five</lr-chip>
    </lr-chip-group>
  `)) as LyraChipGroup;
  const indicator = el.shadowRoot!.querySelector('[part="overflow-indicator"]')!;
  const formatted = new Intl.NumberFormat('ar-EG').format(2);
  expect(indicator.textContent).to.include(formatted);
  expect(indicator.getAttribute('aria-label')).to.include(formatted);
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
