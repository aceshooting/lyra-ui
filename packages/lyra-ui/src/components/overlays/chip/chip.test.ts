import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './chip.js';
import type { LyraChip } from './chip.js';
import { styles } from './chip.styles.js';

class ChipLabelForwardWrapper extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const chip = this.ownerDocument.createElement('lr-chip');
    chip.setAttribute('removable', '');
    chip.append(this.ownerDocument.createElement('slot'));
    root.append(chip);
  }
}
customElements.define('chip-label-forward-wrapper', ChipLabelForwardWrapper);

const SERVER_SHADOW = '<template shadowrootmode="open"></template>';

async function mountServerRenderedChip(markup: string): Promise<LyraChip> {
  const container = (await fixture(html`<div></div>`)) as HTMLDivElement & {
    setHTMLUnsafe(value: string): void;
  };
  container.setHTMLUnsafe(markup);
  return container.firstElementChild as LyraChip;
}

/** Resolves a `--lr-*` token to the concrete computed string `getComputedStyle` reports for a
 *  rendered element, via a throwaway probe in the chip's own light DOM (custom properties inherit
 *  into slotted children, so the probe sees the identical cascade the shadow tree does). Reading
 *  the custom property directly reports its substituted token text (`0.375rem`), never the used
 *  value the matching layout property reports (`6px`). */
function resolved(host: HTMLElement, property: string, token: string): string {
  const probe = document.createElement('span');
  probe.style.setProperty(property, `var(${token})`);
  host.append(probe);
  const value = getComputedStyle(probe).getPropertyValue(property);
  probe.remove();
  return value;
}

it('defaults to size="m", variant="neutral", removable=false, pill=false, and value=undefined', async () => {
  const el = (await fixture(html`<lr-chip>Tag</lr-chip>`)) as LyraChip;
  expect(el.size).to.equal('m');
  expect(el.getAttribute('size')).to.equal('m');
  expect(el.variant).to.equal('neutral');
  expect(el.getAttribute('variant')).to.equal('neutral');
  expect(el.removable).to.be.false;
  expect(el.pill).to.be.false;
  expect(el.value).to.be.undefined;
});

// -- pill / corner radius ----------------------------------------------------

describe('pill', () => {
  const radius = (el: LyraChip): string =>
    getComputedStyle(el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).borderRadius;

  it('renders a rounded rectangle by default, visibly distinct from the pill treatment', async () => {
    const plain = (await fixture(html`<lr-chip>Tag</lr-chip>`)) as LyraChip;
    const pill = (await fixture(html`<lr-chip pill>Tag</lr-chip>`)) as LyraChip;
    expect(plain.pill, 'pill defaults to false').to.be.false;
    expect(plain.hasAttribute('pill')).to.be.false;
    expect(pill.pill).to.be.true;
    // The whole point of the property: the two must render differently. Before `pill` existed the
    // chip was unconditionally pill-shaped, so setting it was indistinguishable from omitting it.
    expect(radius(plain), 'default radius must differ from the pill radius').to.not.equal(radius(pill));
    expect(radius(pill)).to.equal(resolved(pill, 'border-radius', '--lr-radius-pill'));
    expect(radius(plain)).to.equal(resolved(plain, 'border-radius', '--lr-radius'));
    expect(Number.parseFloat(radius(plain)), 'default is still rounded, just not a pill').to.be.greaterThan(0);
  });

  it('toggles back to the rounded rectangle when pill is unset again', async () => {
    const el = (await fixture(html`<lr-chip pill>Tag</lr-chip>`)) as LyraChip;
    const pilled = radius(el);
    el.pill = false;
    await el.updateComplete;
    expect(el.hasAttribute('pill')).to.be.false;
    expect(radius(el)).to.not.equal(pilled);
  });

  it('carries the pill radius through to the remove button', async () => {
    const el = (await fixture(html`<lr-chip pill removable>Tag</lr-chip>`)) as LyraChip;
    const remove = el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLElement;
    expect(getComputedStyle(remove).borderRadius).to.equal(resolved(el, 'border-radius', '--lr-radius-pill'));
  });
});

it('keeps size="m" pixel-equivalent to the original chip and scales compact tiers', async () => {
  const render = async (size?: string): Promise<LyraChip> =>
    (await fixture(html`
      <lr-chip size=${size ?? 'm'}><svg slot="icon" viewBox="0 0 10 10"></svg>Tag</lr-chip>
    `)) as LyraChip;
  const metrics = (el: LyraChip) => {
    const base = getComputedStyle(el.shadowRoot!.querySelector('[part="base"]') as HTMLElement);
    const icon = getComputedStyle(el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement);
    return {
      font: Number.parseFloat(base.fontSize),
      paddingBlock: Number.parseFloat(base.paddingBlockStart),
      paddingInline: Number.parseFloat(base.paddingInlineStart),
      gap: Number.parseFloat(base.gap),
      icon: Number.parseFloat(icon.fontSize),
    };
  };

  const defaultChip = (await fixture(html`
    <lr-chip><svg slot="icon" viewBox="0 0 10 10"></svg>Tag</lr-chip>
  `)) as LyraChip;
  const explicitMedium = await render('m');
  expect(metrics(defaultChip)).to.deep.equal(metrics(explicitMedium));
  expect(metrics(defaultChip)).to.deep.equal({ font: 13, paddingBlock: 4, paddingInline: 8, gap: 4, icon: 13 });

  const medium = metrics(explicitMedium);
  for (const size of ['2xs', 'xs', 's']) {
    const compact = metrics(await render(size));
    expect(compact.font, `${size} font`).to.be.lessThan(medium.font);
    expect(compact.paddingBlock, `${size} block padding`).to.be.lessThan(medium.paddingBlock);
    expect(compact.paddingInline, `${size} inline padding`).to.be.lessThan(medium.paddingInline);
    expect(compact.gap, `${size} gap`).to.be.lessThan(medium.gap);
    expect(compact.icon, `${size} icon`).to.be.lessThan(medium.icon);
  }
});

it('3xs is smaller than 2xs on every density metric except the shared gap floor', async () => {
  const render = async (size: '2xs' | '3xs'): Promise<LyraChip> =>
    (await fixture(html`
      <lr-chip size=${size}><svg slot="icon" viewBox="0 0 10 10"></svg>Tag</lr-chip>
    `)) as LyraChip;
  const metrics = (el: LyraChip) => {
    const base = getComputedStyle(el.shadowRoot!.querySelector('[part="base"]') as HTMLElement);
    const icon = getComputedStyle(el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement);
    return {
      font: Number.parseFloat(base.fontSize),
      paddingBlock: Number.parseFloat(base.paddingBlockStart),
      paddingInline: Number.parseFloat(base.paddingInlineStart),
      icon: Number.parseFloat(icon.fontSize),
    };
  };
  const tiny = metrics(await render('3xs'));
  const floor = metrics(await render('2xs'));
  expect(tiny.font, '3xs font').to.be.lessThan(floor.font);
  expect(tiny.paddingBlock, '3xs block padding').to.equal(0);
  expect(tiny.paddingInline, '3xs inline padding').to.be.lessThan(floor.paddingInline);
  expect(tiny.icon, '3xs icon').to.be.lessThan(floor.icon);
});

it('keeps a removable/toggleable 3xs chip at the WCAG 2.5.8 minimum tap target', async () => {
  const removable = (await fixture(html`
    <lr-chip size="3xs" removable><span slot="icon">●</span>Tag</lr-chip>
  `)) as LyraChip;
  const removeButton = removable.shadowRoot!.querySelector('[part="remove-button"]') as HTMLElement;
  expect(Number.parseFloat(getComputedStyle(removeButton).minBlockSize)).to.be.at.least(40);
  await expect(removable).to.be.accessible();

  const toggleable = (await fixture(html`
    <lr-chip size="3xs" toggleable><span slot="icon">●</span>Tag</lr-chip>
  `)) as LyraChip;
  const toggleButton = toggleable.shadowRoot!.querySelector('[part="toggle-button"]') as HTMLElement;
  expect(Number.parseFloat(getComputedStyle(toggleButton).minBlockSize)).to.be.at.least(40);
  expect(toggleButton.localName).to.equal('button');
  await expect(toggleable).to.be.accessible();
});

it('keeps compact removable and toggleable chips keyboard-accessible with adequate targets', async () => {
  for (const size of ['2xs', 'xs', 's', 'm'] as const) {
    const removable = (await fixture(html`
      <lr-chip size=${size} removable><span slot="icon">●</span>Tag</lr-chip>
    `)) as LyraChip;
    const removeButton = removable.shadowRoot!.querySelector('[part="remove-button"]') as HTMLElement;
    expect(Number.parseFloat(getComputedStyle(removeButton).minBlockSize), `${size} remove target`).to.be.at.least(40);
    await expect(removable).to.be.accessible();

    const toggleable = (await fixture(html`
      <lr-chip size=${size} toggleable><span slot="icon">●</span>Tag</lr-chip>
    `)) as LyraChip;
    const toggleButton = toggleable.shadowRoot!.querySelector('[part="toggle-button"]') as HTMLElement;
    expect(Number.parseFloat(getComputedStyle(toggleButton).minBlockSize), `${size} toggle target`).to.be.at.least(40);
    expect(toggleButton.localName).to.equal('button');
    await expect(toggleable).to.be.accessible();
  }
});

it('reflects variant and removable changes onto host attributes', async () => {
  const el = (await fixture(html`<lr-chip>Tag</lr-chip>`)) as LyraChip;
  el.variant = 'danger';
  el.removable = true;
  await el.updateComplete;
  expect(el.getAttribute('variant')).to.equal('danger');
  expect(el.hasAttribute('removable')).to.be.true;
});

it('tints the pill from the shared semantic grid for every non-neutral variant', async () => {
  // The four per-variant blocks this component used to declare are gone; the tint now comes from
  // the shared `variants` sheet's generic slots. Assert the rendered result rather than the
  // stylesheet text: a slot that never resolves would leave the neutral surface in place.
  const neutral = (await fixture(html`<lr-chip>Tag</lr-chip>`)) as LyraChip;
  const neutralBg = getComputedStyle(neutral.shadowRoot!.querySelector('[part="base"]') as HTMLElement).backgroundColor;
  const seen = new Set<string>();
  for (const variant of ['brand', 'success', 'warning', 'danger'] as const) {
    const el = (await fixture(html`<lr-chip variant=${variant}>Tag</lr-chip>`)) as LyraChip;
    const style = getComputedStyle(el.shadowRoot!.querySelector('[part="base"]') as HTMLElement);
    expect(style.backgroundColor, `${variant} background must leave the neutral surface`).to.not.equal(neutralBg);
    // Every non-neutral variant drops the border in favour of the tint.
    expect(style.borderTopColor, `${variant} border`).to.equal('rgba(0, 0, 0, 0)');
    seen.add(`${style.backgroundColor}/${style.color}`);
  }
  expect(seen.size, 'all four variants must resolve to distinct tint/ink pairs').to.equal(4);
});

it('renders the default slot as the label', async () => {
  const el = (await fixture(html`<lr-chip>research</lr-chip>`)) as LyraChip;
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

it('can render every public action-label branch before a browser render root exists', () => {
  for (const mode of ['removable', 'selected', 'toggleable'] as const) {
    const el = document.createElement('lr-chip') as LyraChip;
    el.append('Research');
    el[mode] = true;
    expect(() => el.render(), mode).not.to.throw();
  }
});

it('keeps the server-first remove name during hydration, then adopts the declarative label', async () => {
  const el = await mountServerRenderedChip(
    `<lr-chip removable>${SERVER_SHADOW}Research</lr-chip>`,
  );
  await el.updateComplete;
  expect(
    el.shadowRoot?.querySelector('[part="remove-button"]')?.getAttribute('aria-label'),
  ).to.equal('Remove');

  await el.updateComplete;
  expect(
    el.shadowRoot?.querySelector('[part="remove-button"]')?.getAttribute('aria-label'),
  ).to.equal('Remove Research');
});

it('keeps the server-first icon state during hydration, then adopts the declarative icon', async () => {
  const el = await mountServerRenderedChip(
    `<lr-chip removable>${SERVER_SHADOW}<span slot="icon">●</span>Research</lr-chip>`,
  );
  await el.updateComplete;
  expect(el.shadowRoot?.querySelector('[part="icon"]')?.hasAttribute('hidden')).to.be.true;

  await el.updateComplete;
  expect(el.shadowRoot?.querySelector('[part="icon"]')?.hasAttribute('hidden')).to.be.false;
});

it('derives the removable name before the first paint on a browser-only mount', async () => {
  const el = document.createElement('lr-chip') as LyraChip;
  el.removable = true;
  const icon = document.createElement('span');
  icon.slot = 'icon';
  icon.textContent = '●';
  el.append(icon, 'Research');
  document.body.append(el);
  try {
    await el.updateComplete;
    expect(
      el.shadowRoot?.querySelector('[part="remove-button"]')?.getAttribute('aria-label'),
    ).to.equal('Remove Research');
    expect(el.shadowRoot?.querySelector('[part="icon"]')?.hasAttribute('hidden')).to.be.false;
  } finally {
    el.remove();
  }
});

describe('icon slot', () => {
  it('hides [part="icon"] when nothing is slotted', async () => {
    const el = (await fixture(html`<lr-chip>Tag</lr-chip>`)) as LyraChip;
    const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
    expect(icon.hidden).to.be.true;
  });

  it('shows [part="icon"] once an element is slotted with slot="icon"', async () => {
    const el = (await fixture(html`<lr-chip><span slot="icon">●</span>Tag</lr-chip>`)) as LyraChip;
    const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
    expect(icon.hidden).to.be.false;
  });

  it('reacts to the icon slot being populated after first render', async () => {
    const el = (await fixture(html`<lr-chip>Tag</lr-chip>`)) as LyraChip;
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

describe('end slot', () => {
  it('hides [part="end"] when nothing is slotted', async () => {
    const el = (await fixture(html`<lr-chip>Tag</lr-chip>`)) as LyraChip;
    const end = el.shadowRoot!.querySelector('[part="end"]') as HTMLElement;
    expect(end.hidden).to.be.true;
    expect(getComputedStyle(end).display).to.equal('none');
  });

  it('shows [part="end"] once an element is slotted with slot="end"', async () => {
    const el = (await fixture(html`<lr-chip>Tag<span slot="end">●</span></lr-chip>`)) as LyraChip;
    const end = el.shadowRoot!.querySelector('[part="end"]') as HTMLElement;
    expect(end.hidden).to.be.false;
    expect(getComputedStyle(end).display).to.not.equal('none');
  });

  it('reacts to the end slot being populated after first render', async () => {
    const el = (await fixture(html`<lr-chip>Tag</lr-chip>`)) as LyraChip;
    const end = el.shadowRoot!.querySelector('[part="end"]') as HTMLElement;
    expect(end.hidden).to.be.true;

    const dot = document.createElement('span');
    dot.setAttribute('slot', 'end');
    dot.textContent = '●';
    el.appendChild(dot);
    // slotchange fires asynchronously
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await el.updateComplete;
    expect(end.hidden).to.be.false;
  });
});

describe('remove affordance', () => {
  it('is not rendered by default (removable=false)', async () => {
    const el = (await fixture(html`<lr-chip>Tag</lr-chip>`)) as LyraChip;
    expect(el.shadowRoot!.querySelector('[part="remove-button"]')).to.not.exist;
  });

  it('renders once removable is true', async () => {
    const el = (await fixture(html`<lr-chip removable>Tag</lr-chip>`)) as LyraChip;
    expect(el.shadowRoot!.querySelector('[part="remove-button"]')).to.exist;
  });

  it('has an aria-label of "Remove {label text}" derived from the default slot', async () => {
    const el = (await fixture(html`<lr-chip removable>research</lr-chip>`)) as LyraChip;
    const btn = el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLElement;
    expect(btn.getAttribute('aria-label')).to.equal('Remove research');
  });

  it('renders a per-instance .strings override in the remove button accessible name', async () => {
    const el = (await fixture(html`
      <lr-chip
        removable
        .strings=${{ removeWithContext: 'Retirer {label}' }}
      >research</lr-chip>
    `)) as LyraChip;
    const btn = el.shadowRoot!.querySelector<HTMLElement>(
      '[part="remove-button"]',
    );

    expect(btn !== null).to.be.true;
    expect(btn?.getAttribute('aria-label')).to.equal('Retirer research');
  });

  it('lets a host aria-label override the computed remove-button label', async () => {
    const el = (await fixture(
      html`<lr-chip removable aria-label="Delete research filter">research</lr-chip>`,
    )) as LyraChip;
    const btn = el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLElement;
    expect(btn.getAttribute('aria-label')).to.equal('Delete research filter');
    expect(el.textContent!.trim()).to.equal('research');
  });

  it('excludes icon-slot text from the computed remove-button label', async () => {
    const el = (await fixture(
      html`<lr-chip removable><span slot="icon">●</span>research</lr-chip>`,
    )) as LyraChip;
    const btn = el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLElement;
    expect(btn.getAttribute('aria-label')).to.equal('Remove research');
  });

  it('falls back to the bare "Remove" label when the default slot has no text', async () => {
    const el = (await fixture(html`<lr-chip removable><span slot="icon">●</span></lr-chip>`)) as LyraChip;
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
    const el = (await fixture(html`<lr-chip removable>${label}</lr-chip>`)) as LyraChip;
    const btn = el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLElement;
    expect(btn.getAttribute('aria-label')).to.equal('Remove research');
  });

  it('emits lr-remove with { value: undefined } when value was never set', async () => {
    const el = (await fixture(html`<lr-chip removable>Tag</lr-chip>`)) as LyraChip;
    const btn = el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLButtonElement;
    setTimeout(() => btn.click());
    const ev = await oneEvent(el, 'lr-remove');
    expect(ev.detail).to.deep.equal({ value: undefined });
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });

  it('emits lr-remove with the set value', async () => {
    const el = (await fixture(html`<lr-chip removable value="tag-1">Tag</lr-chip>`)) as LyraChip;
    const btn = el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLButtonElement;
    setTimeout(() => btn.click());
    const ev = await oneEvent(el, 'lr-remove');
    expect(ev.detail).to.deep.equal({ value: 'tag-1' });
  });

  it('does not remove itself from the DOM on click -- it is a controlled component', async () => {
    const el = (await fixture(html`<lr-chip removable>Tag</lr-chip>`)) as LyraChip;
    const btn = el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLButtonElement;
    setTimeout(() => btn.click());
    await oneEvent(el, 'lr-remove');
    expect(el.isConnected).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="remove-button"]')).to.exist;
  });

  it('gives the remove button the shared minimum hit area', async () => {
    const el = (await fixture(html`<lr-chip removable>Tag</lr-chip>`)) as LyraChip;
    const btn = el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLElement;
    expect(getComputedStyle(btn).minInlineSize).to.equal('40px');
    expect(getComputedStyle(btn).minBlockSize).to.equal('40px');
  });
});

it('is accessible in the default (non-removable, no icon) state', async () => {
  const el = (await fixture(html`<lr-chip>Filter: active</lr-chip>`)) as LyraChip;
  await expect(el).to.be.accessible();
});

it('is accessible in a populated removable state with an icon and a non-neutral variant', async () => {
  const el = (await fixture(html`
    <lr-chip variant="danger" removable value="scope-1"><span slot="icon">●</span>Overdue</lr-chip>
  `)) as LyraChip;
  await expect(el).to.be.accessible();
});

describe('selected', () => {
  it('latches toggle mode at assignment time across a same-task true-to-false update', async () => {
    const el = (await fixture(html`<lr-chip>Tag</lr-chip>`)) as LyraChip;

    el.selected = true;
    el.selected = false;
    await el.updateComplete;

    expect(el.toggleable).to.be.true;
    const button = el.shadowRoot!.querySelector('[part="toggle-button"]') as HTMLButtonElement;
    expect((button) != null).to.equal(true);
    expect(button.getAttribute('aria-pressed')).to.equal('false');
  });

  it('is not interactive by default (no role/tabindex on [part=base])', async () => {
    const el = (await fixture(html`<lr-chip>Tag</lr-chip>`)) as LyraChip;
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
    const el = (await fixture(html`<lr-chip selected value="v1">Tag</lr-chip>`)) as LyraChip;
    const button = el.shadowRoot!.querySelector('[part="toggle-button"]') as HTMLButtonElement;
    expect(button.localName).to.equal('button');
    expect(button.getAttribute('aria-pressed')).to.equal('true');

    setTimeout(() => button.click());
    const ev = await oneEvent(el, 'lr-chip-select');
    expect(ev.detail).to.deep.equal({ value: 'v1', selected: false });
    expect(el.selected).to.be.false;
    await el.updateComplete;
    expect(button.getAttribute('aria-pressed')).to.equal('false');
  });

  it('uses native button activation for keyboard and synthetic click paths', async () => {
    const el = (await fixture(html`<lr-chip selected>Tag</lr-chip>`)) as LyraChip;
    const button = el.shadowRoot!.querySelector('[part="toggle-button"]') as HTMLButtonElement;
    setTimeout(() => button.click());
    await oneEvent(el, 'lr-chip-select');
    expect(el.selected).to.be.false;
  });

  it('does not make [part=base] interactive when combined with removable', async () => {
    const el = (await fixture(html`<lr-chip selected removable>Tag</lr-chip>`)) as LyraChip;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('role')).to.be.null;
    expect(base.hasAttribute('tabindex')).to.be.false;
    expect(el.shadowRoot!.querySelectorAll('[part="toggle-button"]').length).to.equal(0);
    await expect(el).to.be.accessible(); // no nested-interactive violation
  });

  it('is accessible when selected and interactive', async () => {
    const el = (await fixture(html`<lr-chip selected>Tag</lr-chip>`)) as LyraChip;
    await expect(el).to.be.accessible();
  });

  it('uses a real button outside an inert label slot so interactive slotted descendants cannot nest or double-toggle', async () => {
    const el = (await fixture(html`
      <lr-chip toggleable><a href="#destination">Nested link</a></lr-chip>
    `)) as LyraChip;
    const button = el.shadowRoot!.querySelector('[part="toggle-button"]') as HTMLButtonElement;
    const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
    expect(button?.localName).to.equal('button');
    expect(button.contains(label)).to.be.false;
    expect(label.hasAttribute('inert')).to.be.true;

    let changes = 0;
    el.addEventListener('lr-chip-select', () => changes++);
    (el.querySelector('a') as HTMLAnchorElement).click();
    expect(changes).to.equal(0);
    button.click();
    expect(changes).to.equal(1);
  });

  it('emits the proposed selection before mutation and honors preventDefault', async () => {
    const el = (await fixture(html`<lr-chip toggleable>Tag</lr-chip>`)) as LyraChip;
    const button = el.shadowRoot!.querySelector('[part="toggle-button"]') as HTMLButtonElement;
    let selectedDuringEvent = true;
    el.addEventListener('lr-chip-select', (event) => {
      selectedDuringEvent = el.selected;
      event.preventDefault();
    });
    button.click();
    expect(selectedDuringEvent).to.be.false;
    expect(el.selected).to.be.false;
  });

  it('keeps action naming live and forwards host focus/blur/click to the primary control', async () => {
    const el = (await fixture(html`<lr-chip toggleable><span>Original</span></lr-chip>`)) as LyraChip;
    const button = el.shadowRoot!.querySelector('[part="toggle-button"]') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).to.equal('Original');
    (el.querySelector('span') as HTMLSpanElement).firstChild!.textContent = 'Updated';
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    await el.updateComplete;
    expect(button.getAttribute('aria-label')).to.equal('Updated');

    el.focus();
    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('toggle-button');
    el.blur();
    expect((el.shadowRoot!.activeElement) === (null)).to.equal(true);
    el.click();
    expect(el.selected).to.be.true;
  });

  it('tracks action names through a forwarding slot and preserves explicit-empty host labels', async () => {
    const wrapper = (await fixture(html`
      <chip-label-forward-wrapper><span data-label>Alpha</span></chip-label-forward-wrapper>
    `)) as ChipLabelForwardWrapper;
    const el = wrapper.shadowRoot!.querySelector('lr-chip') as LyraChip;
    await el.updateComplete;
    const label = wrapper.querySelector<HTMLElement>('[data-label]')!;
    const remove = el.shadowRoot!.querySelector<HTMLElement>('[part="remove-button"]')!;
    expect(remove.getAttribute('aria-label')).to.equal('Remove Alpha');

    label.textContent = 'Beta';
    await Promise.resolve();
    await el.updateComplete;
    expect(remove.getAttribute('aria-label')).to.equal('Remove Beta');

    label.setAttribute('aria-label', 'Gamma');
    await Promise.resolve();
    await el.updateComplete;
    expect(remove.getAttribute('aria-label')).to.equal('Remove Gamma');

    el.setAttribute('aria-label', '');
    await Promise.resolve();
    await el.updateComplete;
    expect(remove.getAttribute('aria-label')).to.equal('');

    el.removeAttribute('aria-label');
    el.removable = false;
    el.toggleable = true;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector<HTMLElement>('[part="toggle-button"]')!;
    expect(toggle.getAttribute('aria-label')).to.equal('Gamma');

    const replacement = wrapper.ownerDocument.createElement('span');
    replacement.textContent = 'Delta';
    const reassigned = oneEvent(el.querySelector('slot')!, 'slotchange');
    label.replaceWith(replacement);
    await reassigned;
    await el.updateComplete;
    expect(toggle.getAttribute('aria-label')).to.equal('Delta');
  });

  it('keeps visibility-overridden descendant text after a forwarded-label mutation', async () => {
    const wrapper = (await fixture(html`
      <chip-label-forward-wrapper><span data-label>Alpha</span></chip-label-forward-wrapper>
    `)) as ChipLabelForwardWrapper;
    const el = wrapper.shadowRoot!.querySelector('lr-chip') as LyraChip;
    await el.updateComplete;
    const label = wrapper.querySelector<HTMLElement>('[data-label]')!;
    const remove = el.shadowRoot!.querySelector<HTMLElement>('[part="remove-button"]')!;

    label.textContent = 'Excluded parent text ';
    const visibleChild = wrapper.ownerDocument.createElement('span');
    visibleChild.style.visibility = 'visible';
    visibleChild.textContent = 'Visible child';
    label.append(visibleChild);
    label.style.visibility = 'hidden';
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await el.updateComplete;

    expect(remove.getAttribute('aria-label')).to.equal('Remove Visible child');
  });

  it('constructs its live-label observer in the adopted owner realm', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const frameWindow = frame.contentWindow!;
    const frameDocument = frame.contentDocument!;
    const descriptor = Object.getOwnPropertyDescriptor(frameWindow, 'MutationObserver');
    const NativeMutationObserver = frameWindow.MutationObserver;
    let constructions = 0;
    class TrackingMutationObserver extends NativeMutationObserver {
      constructor(callback: MutationCallback) {
        super(callback);
        constructions += 1;
      }
    }
    Object.defineProperty(frameWindow, 'MutationObserver', {
      configurable: true,
      value: TrackingMutationObserver,
    });
    const el = (await fixture(html`<lr-chip removable>Alpha</lr-chip>`)) as LyraChip;
    el.remove();
    try {
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;
      expect(constructions, 'base and label observers use the adopted window').to.be.greaterThan(1);
    } finally {
      el.remove();
      if (descriptor) Object.defineProperty(frameWindow, 'MutationObserver', descriptor);
      else delete (frameWindow as Window & { MutationObserver?: typeof MutationObserver }).MutationObserver;
      frame.remove();
    }
  });

  it('refreshes a cached action name after the label changes while disconnected', async () => {
    const el = (await fixture(html`<lr-chip toggleable>Alpha</lr-chip>`)) as LyraChip;
    el.remove();
    el.textContent = 'Beta';
    document.body.append(el);
    try {
      await el.updateComplete;
      expect(
        el.shadowRoot?.querySelector('[part="toggle-button"]')?.getAttribute('aria-label'),
      ).to.equal('Beta');
    } finally {
      el.remove();
    }
  });

  it('refreshes icon presence after an icon is added while disconnected', async () => {
    const el = (await fixture(html`<lr-chip toggleable>Alpha</lr-chip>`)) as LyraChip;
    el.remove();
    const icon = document.createElement('span');
    icon.slot = 'icon';
    icon.textContent = '●';
    el.append(icon);
    document.body.append(el);
    try {
      await el.updateComplete;
      expect(el.shadowRoot?.querySelector('[part="icon"]')?.hasAttribute('hidden')).to.be.false;
    } finally {
      el.remove();
    }
  });

  it('stays clickable after toggling off -- a second click flips selected back to true', async () => {
    // Regression test: [part=base]'s interactive semantics used to be gated on the *current*
    // live value of `selected`, so the very first click (which flips selected to false) stripped
    // role/tabindex/handlers on the next render and the chip could never be clicked again.
    const el = (await fixture(html`<lr-chip selected value="v1">Tag</lr-chip>`)) as LyraChip;
    const button = el.shadowRoot!.querySelector('[part="toggle-button"]') as HTMLButtonElement;

    setTimeout(() => button.click());
    const off = await oneEvent(el, 'lr-chip-select');
    expect(off.detail).to.deep.equal({ value: 'v1', selected: false });
    expect(el.selected).to.be.false;
    await el.updateComplete;

    // Still focusable/clickable even though the live value is now false.
    expect(button.localName).to.equal('button');

    setTimeout(() => button.click());
    const on = await oneEvent(el, 'lr-chip-select');
    expect(on.detail).to.deep.equal({ value: 'v1', selected: true });
    expect(el.selected).to.be.true;
    await el.updateComplete;
    expect(button.getAttribute('aria-pressed')).to.equal('true');
  });

  it('supports opting into toggle mode while starting unselected via the toggleable property', async () => {
    // A category-filter chip typically starts inactive (selected=false) but must still be
    // clickable from the outset -- `selected` alone can't signal that (its own default is also
    // false), so `toggleable` is the explicit opt-in for this starting state.
    const el = (await fixture(html`<lr-chip toggleable value="v1">Tag</lr-chip>`)) as LyraChip;
    const button = el.shadowRoot!.querySelector('[part="toggle-button"]') as HTMLButtonElement;
    expect(button.localName).to.equal('button');
    expect(el.selected).to.be.false;

    setTimeout(() => button.click());
    const ev = await oneEvent(el, 'lr-chip-select');
    expect(ev.detail).to.deep.equal({ value: 'v1', selected: true });
    expect(el.selected).to.be.true;
  });

  it('is accessible once toggled off (still interactive, now unselected)', async () => {
    const el = (await fixture(html`<lr-chip selected>Tag</lr-chip>`)) as LyraChip;
    const button = el.shadowRoot!.querySelector('[part="toggle-button"]') as HTMLButtonElement;
    setTimeout(() => button.click());
    await oneEvent(el, 'lr-chip-select');
    await el.updateComplete;
    expect(button.localName).to.equal('button');
    await expect(el).to.be.accessible();
  });
});

describe('pressed-border override', () => {
  it('pressed border-color falls back to --lr-chip-accent by default', async () => {
    const el = (await fixture(html`<lr-chip selected>Tag</lr-chip>`)) as LyraChip;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const style = getComputedStyle(base);
    expect(style.borderColor).to.equal(style.color);
  });

  it('uses --lr-chip-pressed-border when set, independent of --lr-chip-accent (label color)', async () => {
    const el = (await fixture(
      html`<lr-chip selected style="--lr-chip-pressed-border: rgb(1, 2, 3);">Tag</lr-chip>`,
    )) as LyraChip;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const style = getComputedStyle(base);
    expect(style.borderColor).to.equal('rgb(1, 2, 3)');
    expect(style.color).to.not.equal('rgb(1, 2, 3)');
  });

  it('does not affect the resting (unpressed) border of a non-selected chip', async () => {
    const el = (await fixture(
      html`<lr-chip style="--lr-chip-pressed-border: rgb(1, 2, 3);">Tag</lr-chip>`,
    )) as LyraChip;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).borderColor).to.not.equal('rgb(1, 2, 3)');
  });
});

describe('pressed-background override', () => {
  it('pressed background falls back to --lr-chip-bg by default', async () => {
    const el = (await fixture(html`<lr-chip selected>Tag</lr-chip>`)) as LyraChip;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const restingBg = getComputedStyle(base).backgroundColor;
    el.selected = false;
    await el.updateComplete;
    expect(getComputedStyle(base).backgroundColor).to.equal(restingBg);
  });

  it('uses --lr-chip-pressed-bg when set, independent of the resting background', async () => {
    const el = (await fixture(
      html`<lr-chip selected style="--lr-chip-pressed-bg: rgb(4, 5, 6);">Tag</lr-chip>`,
    )) as LyraChip;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).backgroundColor).to.equal('rgb(4, 5, 6)');
  });
});

describe('aria-pressed', () => {
  it('is omitted entirely when the chip is not in toggle mode', async () => {
    const el = (await fixture(html`<lr-chip>Tag</lr-chip>`)) as LyraChip;
    expect(el.shadowRoot!.querySelectorAll('[part="toggle-button"]').length).to.equal(0);
  });

  it('is explicitly "false" (not omitted) for a toggleable-but-unpressed chip', async () => {
    const el = (await fixture(html`<lr-chip toggleable>Tag</lr-chip>`)) as LyraChip;
    const button = el.shadowRoot!.querySelector('[part="toggle-button"]') as HTMLElement;
    expect(button.getAttribute('aria-pressed')).to.equal('false');
  });

  it('is "true" once pressed', async () => {
    const el = (await fixture(html`<lr-chip selected>Tag</lr-chip>`)) as LyraChip;
    const button = el.shadowRoot!.querySelector('[part="toggle-button"]') as HTMLElement;
    expect(button.getAttribute('aria-pressed')).to.equal('true');
  });
});

describe('per-tier min-height and exact-height hatch', () => {
  const base = (el: LyraChip): HTMLElement =>
    el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  it('does NOT declare the --lr-chip-height sentinel (guards the lr-select trap)', async () => {
    const el = (await fixture(html`<lr-chip toggleable>Tag</lr-chip>`)) as LyraChip;
    await el.updateComplete;
    expect(getComputedStyle(el).getPropertyValue('--lr-chip-height').trim()).to.equal('');
  });

  it('wires --lr-chip-min-height per tier onto interactive chips (rendered min-block-size)', async () => {
    // Toggle controls all use the shared 40px icon-button target floor.
    const expected: Record<string, string> = {
      '2xs': '40px',
      xs: '40px',
      s: '40px',
      m: '40px',
      l: '40px',
      xl: '40px',
    };
    for (const [size, px] of Object.entries(expected)) {
      const el = (await fixture(html`<lr-chip size=${size} toggleable>Tag</lr-chip>`)) as LyraChip;
      await el.updateComplete;
      expect(getComputedStyle(base(el)).minBlockSize, `size=${size}`).to.equal(px);
    }
  });

  it('keeps every interactive tier at or above the shared 40px target', async () => {
    for (const size of ['2xs', 'xs', 's', 'm', 'l', 'xl'] as const) {
      const el = (await fixture(html`<lr-chip size=${size} toggleable>Tag</lr-chip>`)) as LyraChip;
      await el.updateComplete;
      expect(
        Number.parseFloat(getComputedStyle(base(el)).minBlockSize),
        `size=${size}`,
      ).to.be.at.least(40);
    }
  });

  it('leaves the interactive height content-driven when --lr-chip-height is unset, and pins it when set', async () => {
    const el = (await fixture(html`<lr-chip size="l" toggleable>Tag</lr-chip>`)) as LyraChip;
    await el.updateComplete;
    const b = base(el);
    const natural = getComputedStyle(b).blockSize;
    expect(Number.parseFloat(natural)).to.be.at.least(40);
    el.style.setProperty('--lr-chip-height', '52px');
    await el.updateComplete;
    expect(getComputedStyle(b).blockSize).to.equal('52px');
    expect(getComputedStyle(b).minBlockSize).to.equal('52px');
    el.style.removeProperty('--lr-chip-height');
    await el.updateComplete;
    expect(getComputedStyle(b).blockSize, 'restores byte-identical').to.equal(natural);
  });

  it('pins a non-interactive chip height via --lr-chip-height without adding a floor', async () => {
    const el = (await fixture(html`<lr-chip>Tag</lr-chip>`)) as LyraChip;
    await el.updateComplete;
    const b = base(el);
    const natural = getComputedStyle(b).blockSize;
    el.style.setProperty('--lr-chip-height', '18px');
    await el.updateComplete;
    expect(getComputedStyle(b).blockSize).to.equal('18px');
    el.style.removeProperty('--lr-chip-height');
    await el.updateComplete;
    expect(getComputedStyle(b).blockSize).to.equal(natural);
  });

  it('exposes --lr-chip-radius, defaulting to the shared rounded-rectangle token on both base and remove-button', async () => {
    const el = (await fixture(html`<lr-chip removable>Tag</lr-chip>`)) as LyraChip;
    const baseCs = getComputedStyle(base(el));
    const removeCs = getComputedStyle(
      el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLElement,
    );
    expect(baseCs.borderRadius).to.equal(resolved(el, 'border-radius', '--lr-radius'));
    expect(removeCs.borderRadius).to.equal(resolved(el, 'border-radius', '--lr-radius'));
  });

  it('retunes the base and remove-button corner radius together with no ::part() rule', async () => {
    const el = (await fixture(html`<lr-chip removable>Tag</lr-chip>`)) as LyraChip;
    el.style.setProperty('--lr-chip-radius', '3px');
    await el.updateComplete;
    const baseCs = getComputedStyle(base(el));
    const removeCs = getComputedStyle(
      el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLElement,
    );
    expect(baseCs.borderRadius).to.equal('3px');
    expect(removeCs.borderRadius).to.equal('3px');
  });

  it('declares --lr-chip-radius on :host and consumes it once on [part="base"] and [part="remove-button"]', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/:host \{[^}]*--lr-chip-radius: var\(--lr-radius\);/);
    expect(css).to.match(/\[part='base'\] \{[^}]*border-radius: var\(--lr-chip-radius\);/);
    expect(css).to.match(/\[part='remove-button'\] \{[^}]*border-radius: var\(--lr-chip-radius\);/);
  });

  it('lets a consumer raise --lr-chip-min-height so an interactive chip grows past its content', async () => {
    const el = (await fixture(html`<lr-chip toggleable>Tag</lr-chip>`)) as LyraChip;
    await el.updateComplete;
    const b = base(el);
    const natural = Number.parseFloat(getComputedStyle(b).blockSize);
    // 60px is comfortably above the ~27px content height, so the raised floor drives the box.
    el.style.setProperty('--lr-chip-min-height', '60px');
    await el.updateComplete;
    expect(natural).to.be.lessThan(60);
    expect(getComputedStyle(b).blockSize).to.equal('60px');
  });

  it('stays accessible with a pinned exact height', async () => {
    const el = (await fixture(
      html`<lr-chip toggleable style="--lr-chip-height: 30px;">Tag</lr-chip>`,
    )) as LyraChip;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});
