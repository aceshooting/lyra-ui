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

async function settleChipGroup(el: LyraChipGroup): Promise<void> {
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  await el.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await el.updateComplete;
}

function focusedChipPart(chip: HTMLElement): string | null {
  return chip.shadowRoot?.activeElement?.getAttribute('part') ?? null;
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
  el.style.setProperty('--lr-transition-fast', '0ms');
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

  it('repairs focus from a chip hidden by collapse to the nearest enabled visible chip control', async () => {
    const el = (await fixture(html`
      <lr-chip-group max-visible="2">
        <lr-chip toggleable>one</lr-chip>
        <lr-chip toggleable>two</lr-chip>
        <lr-chip toggleable>three</lr-chip>
        <lr-chip toggleable>four</lr-chip>
      </lr-chip-group>
    `)) as LyraChipGroup;
    const chips = Array.from(el.querySelectorAll<HTMLElement>('lr-chip'));
    const indicator = el.shadowRoot!.querySelector('[part="overflow-indicator"]') as HTMLButtonElement;
    indicator.click();
    await el.updateComplete;

    chips[3]!.focus();
    indicator.click();
    await el.updateComplete;

    expect(focusedChipPart(chips[1]!)).to.equal('toggle-button');
  });

  it('skips disabled visible chips and falls back to the overflow disclosure', async () => {
    const el = (await fixture(html`
      <lr-chip-group max-visible="2">
        <lr-chip>passive</lr-chip>
        <lr-chip toggleable disabled>disabled</lr-chip>
        <lr-chip toggleable>three</lr-chip>
      </lr-chip-group>
    `)) as LyraChipGroup;
    const chips = Array.from(el.querySelectorAll<HTMLElement>('lr-chip'));
    const indicator = el.shadowRoot!.querySelector('[part="overflow-indicator"]') as HTMLButtonElement;
    indicator.click();
    await el.updateComplete;

    chips[2]!.focus();
    indicator.click();
    await el.updateComplete;

    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('overflow-indicator');
  });

  it('repairs focus when max-visible directly hides the focused chip', async () => {
    const el = (await fixture(html`
      <lr-chip-group max-visible="4">
        <lr-chip toggleable>one</lr-chip>
        <lr-chip toggleable>two</lr-chip>
        <lr-chip toggleable>three</lr-chip>
        <lr-chip toggleable>four</lr-chip>
      </lr-chip-group>
    `)) as LyraChipGroup;
    const chips = Array.from(el.querySelectorAll<HTMLElement>('lr-chip'));
    chips[3]!.focus();

    el.maxVisible = 2;
    await el.updateComplete;

    expect(focusedChipPart(chips[1]!)).to.equal('toggle-button');
  });

  it('does not steal focus back when max-visible changes after focus moved outside', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div>
        <lr-chip-group max-visible="4">
          <lr-chip toggleable>one</lr-chip>
          <lr-chip toggleable>two</lr-chip>
          <lr-chip toggleable>three</lr-chip>
        </lr-chip-group>
        <button id="newer-chip-focus">Newer focus</button>
      </div>
    `);
    const el = wrapper.querySelector('lr-chip-group') as LyraChipGroup;
    const chips = Array.from(el.querySelectorAll<HTMLElement>('lr-chip'));
    const newer = wrapper.querySelector('#newer-chip-focus') as HTMLButtonElement;
    chips[2]!.focus();

    el.maxVisible = 1;
    newer.focus();
    await el.updateComplete;

    expect(document.activeElement?.id).to.equal('newer-chip-focus');
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

  it('repairs controlled removal to the next chip actual control at the removed index', async () => {
    const el = (await fixture(html`
      <lr-chip-group>
        <lr-chip removable>one</lr-chip>
        <lr-chip removable>two</lr-chip>
        <lr-chip removable>three</lr-chip>
      </lr-chip-group>
    `)) as LyraChipGroup;
    const chips = Array.from(el.querySelectorAll<HTMLElement>('lr-chip'));
    el.addEventListener('lr-remove', (event) => {
      (event.target as HTMLElement).remove();
    });

    chips[1]!.focus();
    chips[1]!.click();
    await settleChipGroup(el);

    expect(focusedChipPart(chips[2]!)).to.equal('remove-button');
  });

  it('repairs removal of the last actionable chip to the group stable owner', async () => {
    const el = (await fixture(html`
      <lr-chip-group><lr-chip removable>only</lr-chip></lr-chip-group>
    `)) as LyraChipGroup;
    const chip = el.querySelector<HTMLElement>('lr-chip')!;
    el.addEventListener('lr-remove', (event) => {
      (event.target as HTMLElement).remove();
    });

    chip.focus();
    chip.click();
    await settleChipGroup(el);

    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base');
    expect((el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).tabIndex).to.equal(-1);
  });
});

it('reconciles childCount through a forwarding <slot> without scheduling state from firstUpdated', async () => {
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
    // Drain the post-update forwarded-slot reconciliation.
    while (!(await group.updateComplete)) {
      /* keep draining until settled */
    }

    // The corrected count (3, not the under-counted forwarding slot) reaches rendered output.
    const indicator = group.shadowRoot!.querySelector('[part="overflow-indicator"]') as HTMLElement;
    expect((indicator) != null).to.equal(true);
    expect(indicator.textContent!.trim()).to.equal('+1');
    const forwardedChips = Array.from(host.querySelectorAll('lr-chip')) as HTMLElement[];
    expect(forwardedChips.map((chip) => chip.hidden)).to.deep.equal([false, false, true]);
  } finally {
    console.warn = originalWarn;
  }

  const messages = calls.flat().map(String);
  expect(messages.some((m) => m.includes('scheduled an update'))).to.be.false;
});

it('does not charge author-hidden or inert children against max-visible capacity', async () => {
  const el = (await fixture(html`
    <lr-chip-group max-visible="2">
      <lr-chip>A</lr-chip>
      <lr-chip hidden>author hidden</lr-chip>
      <lr-chip inert>inert</lr-chip>
      <lr-chip>B</lr-chip>
      <lr-chip>C</lr-chip>
    </lr-chip-group>
  `)) as LyraChipGroup;
  await settleChipGroup(el);
  const children = Array.from(el.children) as HTMLElement[];
  const indicator = el.shadowRoot!.querySelector('[part="overflow-indicator"]') as HTMLButtonElement;

  expect(children.map((child) => child.hidden)).to.deep.equal([false, true, false, false, true]);
  expect(indicator.textContent!.trim()).to.equal('+1');

  children[2]!.removeAttribute('inert');
  await settleChipGroup(el);
  expect(children.map((child) => child.hidden)).to.deep.equal([false, true, false, true, true]);
  expect(indicator.textContent!.trim()).to.equal('+2');
});

it('uses a real hidden attribute for non-HTMLElement assigned children and restores it', async () => {
  const el = (await fixture(html`
    <lr-chip-group max-visible="1">
      <lr-chip>A</lr-chip>
      <svg viewBox="0 0 10 10" aria-label="decorative mark"><circle cx="5" cy="5" r="4"></circle></svg>
    </lr-chip-group>
  `)) as LyraChipGroup;
  await settleChipGroup(el);
  const svg = el.querySelector('svg')!;
  expect(svg.hasAttribute('hidden')).to.be.true;

  el.remove();
  expect(svg.hasAttribute('hidden')).to.be.false;
});

it('keeps the overflow indicator at the shared minimum target size', async () => {
  const el = (await fixture(html`
    <lr-chip-group max-visible="1"><lr-chip>A</lr-chip><lr-chip>B</lr-chip></lr-chip-group>
  `)) as LyraChipGroup;
  const indicator = el.shadowRoot!.querySelector('[part="overflow-indicator"]') as HTMLButtonElement;
  const rect = indicator.getBoundingClientRect();
  expect(rect.width).to.be.at.least(40);
  expect(rect.height).to.be.at.least(40);
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

// A chip group is a group, and every peer grouping primitive in this library already says so:
// lr-radio-group renders role="radiogroup" and forwards a host aria-label to it, lr-segmented does
// the same. lr-chip-group rendered a roleless <div> and read no accessible name at all — and a host
// `aria-label` does not reach a shadow root, so a consumer labelling the host named nothing.
//
// A consumer hit this on a real multi-select filter row and had to hand-write
// `role="group" aria-label="…"` onto the host to get a named group. That workaround is the evidence:
// the capability was wanted, reachable only by reaching around the component.
//
// The role is applied only WITH a name, deliberately. An unnamed group role adds verbosity without
// adding information, and applying it unconditionally would change the accessibility tree for every
// decorative chip row already shipped.
describe('group semantics', () => {
  it('exposes a named group when the host carries aria-label', async () => {
    const el = (await fixture(
      html`<lr-chip-group aria-label="Categories"><lr-chip>a</lr-chip></lr-chip-group>`
    )) as LyraChipGroup;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part~="base"]')!;
    expect(base.getAttribute('role')).to.equal('group');
    expect(base.getAttribute('aria-label')).to.equal('Categories');
  });

  it('stays roleless when no accessible name is supplied (unset regression)', async () => {
    const el = (await fixture(
      html`<lr-chip-group><lr-chip>a</lr-chip></lr-chip-group>`
    )) as LyraChipGroup;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part~="base"]')!;
    expect(base.getAttribute('role') === null, 'an unnamed group role adds no information').to.be
      .true;
    expect(base.getAttribute('aria-label') === null).to.be.true;
  });

  it('accepts the name as a property as well as an attribute', async () => {
    const el = (await fixture(
      html`<lr-chip-group><lr-chip>a</lr-chip></lr-chip-group>`
    )) as LyraChipGroup;
    el.accessibleLabel = 'Tags';
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part~="base"]')!;
    expect(base.getAttribute('role')).to.equal('group');
    expect(base.getAttribute('aria-label')).to.equal('Tags');
  });
});
