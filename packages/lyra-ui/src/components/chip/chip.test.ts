import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './chip.js';
import type { LyraChip } from './chip.js';

it('defaults to tone="neutral", removable=false, and value=undefined', async () => {
  const el = (await fixture(html`<lyra-chip>Tag</lyra-chip>`)) as LyraChip;
  expect(el.tone).to.equal('neutral');
  expect(el.getAttribute('tone')).to.equal('neutral');
  expect(el.removable).to.be.false;
  expect(el.value).to.be.undefined;
});

it('reflects tone and removable changes onto host attributes', async () => {
  const el = (await fixture(html`<lyra-chip>Tag</lyra-chip>`)) as LyraChip;
  el.tone = 'danger';
  el.removable = true;
  await el.updateComplete;
  expect(el.getAttribute('tone')).to.equal('danger');
  expect(el.hasAttribute('removable')).to.be.true;
});

it('renders the default slot as the label', async () => {
  const el = (await fixture(html`<lyra-chip>research</lyra-chip>`)) as LyraChip;
  // [part="label"] only wraps a <slot> -- its own shadow-tree textContent
  // never includes the projected light-DOM content, only the slot's own
  // (unused) fallback text. Assert against the slot's assigned nodes instead.
  const slot = el.shadowRoot!.querySelector('[part="label"] slot') as HTMLSlotElement;
  const text = slot
    .assignedNodes({ flatten: true })
    .map((n) => n.textContent ?? '')
    .join('')
    .trim();
  expect(text).to.equal('research');
});

describe('icon slot', () => {
  it('hides [part="icon"] when nothing is slotted', async () => {
    const el = (await fixture(html`<lyra-chip>Tag</lyra-chip>`)) as LyraChip;
    const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
    expect(icon.hidden).to.be.true;
  });

  it('shows [part="icon"] once an element is slotted with slot="icon"', async () => {
    const el = (await fixture(html`<lyra-chip><span slot="icon">●</span>Tag</lyra-chip>`)) as LyraChip;
    const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
    expect(icon.hidden).to.be.false;
  });

  it('reacts to the icon slot being populated after first render', async () => {
    const el = (await fixture(html`<lyra-chip>Tag</lyra-chip>`)) as LyraChip;
    const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
    expect(icon.hidden).to.be.true;

    const dot = document.createElement('span');
    dot.setAttribute('slot', 'icon');
    dot.textContent = '●';
    el.appendChild(dot);
    // slotchange fires asynchronously
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await el.updateComplete;
    expect(icon.hidden).to.be.false;
  });
});

describe('remove affordance', () => {
  it('is not rendered by default (removable=false)', async () => {
    const el = (await fixture(html`<lyra-chip>Tag</lyra-chip>`)) as LyraChip;
    expect(el.shadowRoot!.querySelector('[part="remove-button"]')).to.not.exist;
  });

  it('renders once removable is true', async () => {
    const el = (await fixture(html`<lyra-chip removable>Tag</lyra-chip>`)) as LyraChip;
    expect(el.shadowRoot!.querySelector('[part="remove-button"]')).to.exist;
  });

  it('has an aria-label of "Remove {label text}" derived from the default slot', async () => {
    const el = (await fixture(html`<lyra-chip removable>research</lyra-chip>`)) as LyraChip;
    const btn = el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLElement;
    expect(btn.getAttribute('aria-label')).to.equal('Remove research');
  });

  it('excludes icon-slot text from the computed remove-button label', async () => {
    const el = (await fixture(
      html`<lyra-chip removable><span slot="icon">●</span>research</lyra-chip>`,
    )) as LyraChip;
    const btn = el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLElement;
    expect(btn.getAttribute('aria-label')).to.equal('Remove research');
  });

  it('falls back to the bare "Remove" label when the default slot has no text', async () => {
    const el = (await fixture(html`<lyra-chip removable><span slot="icon">●</span></lyra-chip>`)) as LyraChip;
    const btn = el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLElement;
    expect(btn.getAttribute('aria-label')).to.equal('Remove');
  });

  it('excludes lit-html marker comments from the label when the label is an interpolated expression, not a static string', async () => {
    // A static string child (as every other case in this file uses) never
    // needs a lit-html child-part marker at all, so it can't exercise this --
    // only a real `${expr}` binding (the ordinary way a consumer would
    // interpolate a data-driven label) makes lit-html insert a marker Comment
    // node alongside the Text node in the light DOM.
    const label = 'research';
    const el = (await fixture(html`<lyra-chip removable>${label}</lyra-chip>`)) as LyraChip;
    const btn = el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLElement;
    expect(btn.getAttribute('aria-label')).to.equal('Remove research');
  });

  it('emits lyra-remove with { value: undefined } when value was never set', async () => {
    const el = (await fixture(html`<lyra-chip removable>Tag</lyra-chip>`)) as LyraChip;
    const btn = el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLButtonElement;
    setTimeout(() => btn.click());
    const ev = await oneEvent(el, 'lyra-remove');
    expect(ev.detail).to.deep.equal({ value: undefined });
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });

  it('emits lyra-remove with the set value', async () => {
    const el = (await fixture(html`<lyra-chip removable value="tag-1">Tag</lyra-chip>`)) as LyraChip;
    const btn = el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLButtonElement;
    setTimeout(() => btn.click());
    const ev = await oneEvent(el, 'lyra-remove');
    expect(ev.detail).to.deep.equal({ value: 'tag-1' });
  });

  it('does not remove itself from the DOM on click -- it is a controlled component', async () => {
    const el = (await fixture(html`<lyra-chip removable>Tag</lyra-chip>`)) as LyraChip;
    const btn = el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLButtonElement;
    setTimeout(() => btn.click());
    await oneEvent(el, 'lyra-remove');
    expect(el.isConnected).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="remove-button"]')).to.exist;
  });

  it('gives the remove button the shared minimum hit area', async () => {
    const el = (await fixture(html`<lyra-chip removable>Tag</lyra-chip>`)) as LyraChip;
    const btn = el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLElement;
    expect(getComputedStyle(btn).minInlineSize).to.equal('40px');
    expect(getComputedStyle(btn).minBlockSize).to.equal('40px');
  });
});

it('is accessible in the default (non-removable, no icon) state', async () => {
  const el = (await fixture(html`<lyra-chip>Filter: active</lyra-chip>`)) as LyraChip;
  await expect(el).to.be.accessible();
});

it('is accessible in a populated removable state with an icon and a non-neutral tone', async () => {
  const el = (await fixture(html`
    <lyra-chip tone="danger" removable value="scope-1"><span slot="icon">●</span>Overdue</lyra-chip>
  `)) as LyraChip;
  await expect(el).to.be.accessible();
});

describe('selected', () => {
  it('is not interactive by default (no role/tabindex on [part=base])', async () => {
    const el = (await fixture(html`<lyra-chip>Tag</lyra-chip>`)) as LyraChip;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('role')).to.be.null;
    expect(base.hasAttribute('tabindex')).to.be.false;
  });

  it('becomes keyboard-activatable and toggles on click when selected is opted into', async () => {
    // The fixture opts into selected mode by starting already selected/pressed -- the same
    // boolean both enables `[part='base']`'s interactive semantics and represents its current
    // pressed value (see the property's own doc comment), so a chip that starts `selected`
    // starts already reflecting `aria-pressed="true"`; clicking it toggles that value off. Toggle
    // mode itself is sticky (see `toggleable`'s doc comment), so once opted in via `selected` the
    // chip keeps announcing `aria-pressed="false"` (not omitting it) once unpressed.
    const el = (await fixture(html`<lyra-chip selected value="v1">Tag</lyra-chip>`)) as LyraChip;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('role')).to.equal('button');
    expect(base.getAttribute('tabindex')).to.equal('0');
    expect(base.getAttribute('aria-pressed')).to.equal('true');

    setTimeout(() => base.click());
    const ev = await oneEvent(el, 'lyra-chip-select');
    expect(ev.detail).to.deep.equal({ value: 'v1', selected: false });
    expect(el.selected).to.be.false;
    await el.updateComplete;
    expect(base.getAttribute('aria-pressed')).to.equal('false');
  });

  it('toggles via Enter/Space while focused, preventing default Space page-scroll', async () => {
    const el = (await fixture(html`<lyra-chip selected>Tag</lyra-chip>`)) as LyraChip;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    setTimeout(() => base.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })));
    await oneEvent(el, 'lyra-chip-select');
    expect(el.selected).to.be.false;
  });

  it('does not make [part=base] interactive when combined with removable', async () => {
    const el = (await fixture(html`<lyra-chip selected removable>Tag</lyra-chip>`)) as LyraChip;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('role')).to.be.null;
    expect(base.hasAttribute('tabindex')).to.be.false;
    await expect(el).to.be.accessible(); // no nested-interactive violation
  });

  it('is accessible when selected and interactive', async () => {
    const el = (await fixture(html`<lyra-chip selected>Tag</lyra-chip>`)) as LyraChip;
    await expect(el).to.be.accessible();
  });

  it('stays clickable after toggling off -- a second click flips selected back to true', async () => {
    // Regression test: [part=base]'s interactive semantics used to be gated on the *current*
    // live value of `selected`, so the very first click (which flips selected to false) stripped
    // role/tabindex/handlers on the next render and the chip could never be clicked again.
    const el = (await fixture(html`<lyra-chip selected value="v1">Tag</lyra-chip>`)) as LyraChip;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

    setTimeout(() => base.click());
    const off = await oneEvent(el, 'lyra-chip-select');
    expect(off.detail).to.deep.equal({ value: 'v1', selected: false });
    expect(el.selected).to.be.false;
    await el.updateComplete;

    // Still focusable/clickable even though the live value is now false.
    expect(base.getAttribute('role')).to.equal('button');
    expect(base.getAttribute('tabindex')).to.equal('0');

    setTimeout(() => base.click());
    const on = await oneEvent(el, 'lyra-chip-select');
    expect(on.detail).to.deep.equal({ value: 'v1', selected: true });
    expect(el.selected).to.be.true;
    await el.updateComplete;
    expect(base.getAttribute('aria-pressed')).to.equal('true');
  });

  it('supports opting into toggle mode while starting unselected via the toggleable property', async () => {
    // A category-filter chip typically starts inactive (selected=false) but must still be
    // clickable from the outset -- `selected` alone can't signal that (its own default is also
    // false), so `toggleable` is the explicit opt-in for this starting state.
    const el = (await fixture(html`<lyra-chip toggleable value="v1">Tag</lyra-chip>`)) as LyraChip;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('role')).to.equal('button');
    expect(base.getAttribute('tabindex')).to.equal('0');
    expect(el.selected).to.be.false;

    setTimeout(() => base.click());
    const ev = await oneEvent(el, 'lyra-chip-select');
    expect(ev.detail).to.deep.equal({ value: 'v1', selected: true });
    expect(el.selected).to.be.true;
  });

  it('is accessible once toggled off (still interactive, now unselected)', async () => {
    const el = (await fixture(html`<lyra-chip selected>Tag</lyra-chip>`)) as LyraChip;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    setTimeout(() => base.click());
    await oneEvent(el, 'lyra-chip-select');
    await el.updateComplete;
    expect(base.getAttribute('role')).to.equal('button');
    await expect(el).to.be.accessible();
  });
});

describe('pressed-border override', () => {
  it('pressed border-color falls back to --lyra-chip-accent by default', async () => {
    const el = (await fixture(html`<lyra-chip selected>Tag</lyra-chip>`)) as LyraChip;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const style = getComputedStyle(base);
    expect(style.borderColor).to.equal(style.color);
  });

  it('uses --lyra-chip-pressed-border when set, independent of --lyra-chip-accent (label color)', async () => {
    const el = (await fixture(
      html`<lyra-chip selected style="--lyra-chip-pressed-border: rgb(1, 2, 3);">Tag</lyra-chip>`,
    )) as LyraChip;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const style = getComputedStyle(base);
    expect(style.borderColor).to.equal('rgb(1, 2, 3)');
    expect(style.color).to.not.equal('rgb(1, 2, 3)');
  });

  it('does not affect the resting (unpressed) border of a non-selected chip', async () => {
    const el = (await fixture(
      html`<lyra-chip style="--lyra-chip-pressed-border: rgb(1, 2, 3);">Tag</lyra-chip>`,
    )) as LyraChip;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).borderColor).to.not.equal('rgb(1, 2, 3)');
  });
});

describe('pressed-background override', () => {
  it('pressed background falls back to --lyra-chip-bg by default', async () => {
    const el = (await fixture(html`<lyra-chip selected>Tag</lyra-chip>`)) as LyraChip;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const restingBg = getComputedStyle(base).backgroundColor;
    el.selected = false;
    await el.updateComplete;
    expect(getComputedStyle(base).backgroundColor).to.equal(restingBg);
  });

  it('uses --lyra-chip-pressed-bg when set, independent of the resting background', async () => {
    const el = (await fixture(
      html`<lyra-chip selected style="--lyra-chip-pressed-bg: rgb(4, 5, 6);">Tag</lyra-chip>`,
    )) as LyraChip;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).backgroundColor).to.equal('rgb(4, 5, 6)');
  });
});

describe('aria-pressed', () => {
  it('is omitted entirely when the chip is not in toggle mode', async () => {
    const el = (await fixture(html`<lyra-chip>Tag</lyra-chip>`)) as LyraChip;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.hasAttribute('aria-pressed')).to.be.false;
  });

  it('is explicitly "false" (not omitted) for a toggleable-but-unpressed chip', async () => {
    const el = (await fixture(html`<lyra-chip toggleable>Tag</lyra-chip>`)) as LyraChip;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('aria-pressed')).to.equal('false');
  });

  it('is "true" once pressed', async () => {
    const el = (await fixture(html`<lyra-chip selected>Tag</lyra-chip>`)) as LyraChip;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('aria-pressed')).to.equal('true');
  });
});
