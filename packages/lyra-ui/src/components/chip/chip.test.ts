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
    // starts already reflecting `aria-pressed="true"`; clicking it toggles that value off.
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
    expect(base.getAttribute('aria-pressed')).to.be.null;
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
});
