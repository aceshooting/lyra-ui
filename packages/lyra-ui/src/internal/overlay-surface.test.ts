import { expect, fixture, waitUntil } from '@open-wc/testing';
import { html, type TemplateResult } from 'lit';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../test/wtr-mouse.js';
import '../components/overlays/overlay/popover.js';
import '../components/overlays/overlay/dropdown.js';
import '../components/overlays/dialog/dialog.js';
import '../components/layout/menu/menu.js';
import '../components/layout/menu/menu-item.js';
import '../components/forms/select/select.js';
import '../components/forms/combobox/option.js';
import '../components/forms/combobox/combobox.js';
import '../components/forms/locale-picker/locale-picker.js';
import '../components/utility/mention-popover/mention-popover.js';

/**
 * Decision 1's contract: ONE overlay token family every floating surface reads.
 *
 * Every assertion here reads a RENDERED result through `getComputedStyle`, never stylesheet text —
 * a `var()` chain that never resolves is silently inert, and inert CSS is invisible to every other
 * tool in the repo. The values are also deliberately read off the surfaces of six different
 * components in one test, because "they all read the same family" is the claim, and six separate
 * per-component tests could each pass against six different families.
 */

const SURFACE = 'rgb(1, 2, 3)';
const BORDER = 'rgb(4, 5, 6)';
const RADIUS = '11px';

type UpdatingElement = HTMLElement & { updateComplete: Promise<unknown> };

interface Surface {
  /** Human-readable name, used only in assertion messages — never a DOM node. */
  readonly name: string;
  readonly host: HTMLElement;
  /** The element that actually paints the floating surface. */
  readonly box: HTMLElement;
}

function required<T>(value: T | null | undefined, description: string): T {
  if (value === null || value === undefined) throw new Error(`Missing ${description}.`);
  return value;
}

function settle(el: HTMLElement): Promise<unknown> {
  return (el as UpdatingElement).updateComplete;
}

function shadowPart(host: HTMLElement, selector: string, description: string): HTMLElement {
  return required(
    required(host.shadowRoot, `${description} shadow root`).querySelector<HTMLElement>(selector),
    `${description} ${selector}`,
  );
}

/**
 * A colour token's value as the engine will paint it.
 *
 * `getPropertyValue('--lr-color-surface')` hands back the authored token text (`#2b3038`), while
 * `backgroundColor` hands back the resolved `rgb(...)` form. Comparing the two directly would fail
 * on formatting alone, on every engine, for a perfectly correct implementation.
 */
function resolveColor(value: string): string {
  const probe = document.createElement('div');
  probe.style.color = value.trim();
  document.body.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}

function token(el: HTMLElement, name: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

function paint(box: HTMLElement): { fill: string; edge: string; corner: string } {
  const computed = getComputedStyle(box);
  return {
    fill: computed.backgroundColor,
    edge: computed.borderTopColor,
    corner: computed.getPropertyValue('border-top-left-radius').trim(),
  };
}

/** Land every running transition so a mid-fade opacity never reaches an assertion or axe. */
function finishAnimations(box: HTMLElement): void {
  for (const animation of box.getAnimations()) animation.finish();
}

/**
 * Dark mode through the attribute route (`:host([data-lr-theme='dark'])`), which every engine
 * supports. The `:host-context()` route is Chromium-only and `prefers-color-scheme` has no
 * emulation seam in this runner, so the attribute has to land on every `lr-*` host in the tree —
 * a dark menu surface holding light-token menu items is a contrast failure that only appears off
 * Chromium.
 *
 * The PAGE switches with the components, and that half is not optional. Dark mode is a page-wide
 * state; the runner's page is white. A form control paints its own `[part='label']` in
 * `--lr-color-text` over a transparent background, so darkening only the custom elements made axe
 * composite the dark text against the white runner page and report 1.11:1 on `lr-select` — the
 * fixture lying about the arrangement, not the palette failing. Against the tokens the component
 * itself resolves, the same pair is 15.5:1 on the page surface and 11.8:1 on the overlay surface.
 * The wrapper therefore takes the surface/text pair read back off the already-darkened host rather
 * than a literal hex, so a palette retune cannot silently re-break it.
 */
function applyDarkTheme(root: HTMLElement): void {
  const hosts = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];
  for (const el of hosts) {
    if (el.localName.includes('-')) el.setAttribute('data-lr-theme', 'dark');
  }
  const page = root.parentElement;
  if (page === null) return;
  page.setAttribute('data-lr-theme', 'dark');
  page.style.colorScheme = 'dark';
  page.style.backgroundColor = token(root, '--lr-color-surface');
  page.style.color = token(root, '--lr-color-text');
  // The fixture's own trigger/menu-item scaffolding is bare native `<button>`, and `color-scheme:
  // dark` hands its painting to the UA: WebKit's headless build then draws white label text on a
  // light `buttonface` (1.81:1) where Chromium and Firefox do not. That is UA chrome belonging to
  // the fixture, not a surface this file has any claim about, so the scaffolding stops being
  // painted at all — transparent over whichever surface it really sits on, inheriting that
  // surface's own text colour.
  for (const button of Array.from(root.querySelectorAll('button'))) {
    button.style.background = 'transparent';
    button.style.color = 'inherit';
    button.style.border = '0';
  }
}

function mountIn(wrapperStyle: string, content: TemplateResult): Promise<HTMLElement> {
  return fixture<HTMLElement>(html`<div style=${wrapperStyle}>${content}</div>`);
}

async function hostIn(
  wrapperStyle: string,
  tagName: string,
  content: TemplateResult,
): Promise<HTMLElement> {
  const wrapper = await mountIn(wrapperStyle, content);
  const host = required(wrapper.querySelector<HTMLElement>(tagName), tagName);
  await settle(host);
  return host;
}

async function mountPopover(wrapperStyle = ''): Promise<Surface> {
  const host = await hostIn(
    wrapperStyle,
    'lr-popover',
    html`<lr-popover style="--show-duration: 0ms; --hide-duration: 0ms"
      ><button slot="trigger">Open</button>
      <p>Details</p></lr-popover
    >`,
  );
  return { name: 'lr-popover popup', host, box: shadowPart(host, '[part~="popup"]', 'lr-popover') };
}

async function mountDropdown(wrapperStyle = ''): Promise<Surface> {
  const host = await hostIn(
    wrapperStyle,
    'lr-dropdown',
    html`<lr-dropdown style="--show-duration: 0ms; --hide-duration: 0ms"
      ><button slot="trigger">Actions</button>
      <button role="menuitem">Rename</button></lr-dropdown
    >`,
  );
  return { name: 'lr-dropdown popup', host, box: shadowPart(host, '[part~="popup"]', 'lr-dropdown') };
}

async function mountSelect(wrapperStyle = ''): Promise<Surface> {
  const host = await hostIn(
    wrapperStyle,
    'lr-select',
    html`<lr-select label="Fruit"
      ><lr-option value="a">Apple</lr-option>
      <lr-option value="b">Banana</lr-option></lr-select
    >`,
  );
  return { name: 'lr-select listbox', host, box: shadowPart(host, '[part~="listbox"]', 'lr-select') };
}

async function mountCombobox(wrapperStyle = ''): Promise<Surface> {
  const host = await hostIn(
    wrapperStyle,
    'lr-combobox',
    html`<lr-combobox label="Fruit"
      ><lr-option value="a">Apple</lr-option>
      <lr-option value="b">Banana</lr-option></lr-combobox
    >`,
  );
  return {
    name: 'lr-combobox listbox',
    host,
    box: shadowPart(host, '[part~="listbox"]', 'lr-combobox'),
  };
}

async function mountMenu(wrapperStyle = ''): Promise<Surface> {
  const host = await hostIn(
    wrapperStyle,
    'lr-menu',
    html`<lr-menu label="Actions"
      ><lr-menu-item value="rename">Rename</lr-menu-item>
      <lr-menu-item value="share">Share</lr-menu-item></lr-menu
    >`,
  );
  // A standalone menu paints its surface on the host itself, not on an inner part.
  return { name: 'lr-menu surface', host, box: host };
}

async function mountDialog(wrapperStyle = ''): Promise<Surface> {
  const host = await hostIn(
    wrapperStyle,
    'lr-dialog',
    html`<lr-dialog label="Untitled" open style="--lr-duration-base: 0ms">Body</lr-dialog>`,
  );
  return { name: 'lr-dialog panel', host, box: shadowPart(host, '[part~="panel"]', 'lr-dialog') };
}

async function mountLocalePicker(wrapperStyle = ''): Promise<Surface> {
  const host = await hostIn(
    wrapperStyle,
    'lr-locale-picker',
    html`<lr-locale-picker label="Language"></lr-locale-picker>`,
  );
  return {
    name: 'lr-locale-picker listbox',
    host,
    box: shadowPart(host, '[part~="listbox"]', 'lr-locale-picker'),
  };
}

/** Every floating surface decision 1 names, each in its own fixture. */
const OVERLAY_BUILDERS: ReadonlyArray<(wrapperStyle?: string) => Promise<Surface>> = [
  mountPopover,
  mountDropdown,
  mountSelect,
  mountCombobox,
  mountMenu,
  mountDialog,
];

const FAMILY_OVERRIDE = `--lr-overlay-surface: ${SURFACE}; --lr-overlay-border: ${BORDER}; --lr-overlay-radius: ${RADIUS};`;

function setRootFamily(): void {
  document.documentElement.style.setProperty('--lr-overlay-surface', SURFACE);
  document.documentElement.style.setProperty('--lr-overlay-border', BORDER);
  document.documentElement.style.setProperty('--lr-overlay-radius', RADIUS);
}

function clearRootFamily(): void {
  document.documentElement.style.removeProperty('--lr-overlay-surface');
  document.documentElement.style.removeProperty('--lr-overlay-border');
  document.documentElement.style.removeProperty('--lr-overlay-radius');
  document.documentElement.style.removeProperty('--lr-overlay-shadow-anchored');
  document.documentElement.style.removeProperty('--lr-overlay-shadow-modal');
}

it('repaints every floating surface from one :root declaration of the overlay family', async () => {
  setRootFamily();
  try {
    const wrong: string[] = [];
    for (const build of OVERLAY_BUILDERS) {
      const surface = await build();
      const { fill, edge, corner } = paint(surface.box);
      if (fill !== SURFACE) wrong.push(`${surface.name} fill is ${fill}`);
      if (edge !== BORDER) wrong.push(`${surface.name} edge is ${edge}`);
      if (corner !== RADIUS) wrong.push(`${surface.name} corner is ${corner}`);
    }
    expect(wrong.join('\n'), 'surfaces that ignored the :root overlay family').to.equal('');
  } finally {
    clearRootFamily();
  }
});

it('scopes an overlay-family override to the ancestor it is declared on', async () => {
  // The discriminating half of the contract. `tokens.styles.ts` declares its colour tokens on every
  // component's own `:host`, so an ancestor's `--lr-color-surface` never reaches a popup at all —
  // the family is only a real cascade point while nothing declares it on `:host`. A sibling outside
  // the styled subtree proves the override is inherited rather than global.
  const scoped = await mountSelect(FAMILY_OVERRIDE);
  const untouched = await mountSelect();

  const scopedPaint = paint(scoped.box);
  const untouchedPaint = paint(untouched.box);
  const expectedDefault = resolveColor(token(untouched.host, '--lr-color-surface-overlay'));

  expect(scopedPaint.fill, 'listbox inside the styled ancestor').to.equal(SURFACE);
  expect(scopedPaint.edge, 'listbox edge inside the styled ancestor').to.equal(BORDER);
  expect(scopedPaint.corner, 'listbox corner inside the styled ancestor').to.equal(RADIUS);
  expect(untouchedPaint.fill, 'sibling listbox outside the styled ancestor').to.equal(
    expectedDefault,
  );
  expect(untouchedPaint.corner, 'sibling listbox corner outside the styled ancestor').to.not.equal(
    RADIUS,
  );
});

it('routes anchored popups onto the overlay surface in dark mode', async () => {
  // The visible dark-mode change decision 1 accepts. Before it, an anchored popup painted
  // `--lr-color-surface` — in dark mode the same near-black as the page behind it, so the popup
  // read as a hole rather than a raised object. Asserted against the two tokens read off the host
  // rather than against literal hex values, so a palette retune cannot silently invert the test.
  const anchored = [mountPopover, mountSelect, mountCombobox, mountMenu];
  const wrong: string[] = [];
  for (const build of anchored) {
    const surface = await build();
    applyDarkTheme(surface.host);
    await settle(surface.host);
    const page = resolveColor(token(surface.host, '--lr-color-surface'));
    const overlay = resolveColor(token(surface.host, '--lr-color-surface-overlay'));
    // Without this the test would pass in light mode, where both tokens resolve to the page
    // surface and "reads the overlay token" is indistinguishable from "reads the page token".
    if (page === overlay) wrong.push(`${surface.name}: dark mode never took effect (${page})`);
    const { fill } = paint(surface.box);
    if (fill !== overlay) wrong.push(`${surface.name} fill is ${fill}, expected ${overlay}`);
    if (fill === page) wrong.push(`${surface.name} still paints the page surface ${page}`);
  }
  expect(wrong.join('\n'), 'anchored surfaces in dark mode').to.equal('');
});

it('keeps the anchored and modal elevation tiers on separate names', async () => {
  try {
    document.documentElement.style.setProperty(
      '--lr-overlay-shadow-anchored',
      `0 0 0 1px ${SURFACE}`,
    );
    const anchored = await mountPopover();
    const modal = await mountDialog();
    expect(getComputedStyle(anchored.box).boxShadow, 'popup under the anchored tier').to.contain(
      SURFACE,
    );
    expect(getComputedStyle(modal.box).boxShadow, 'dialog under the anchored tier').to.not.contain(
      SURFACE,
    );

    document.documentElement.style.setProperty('--lr-overlay-shadow-modal', `0 0 0 1px ${BORDER}`);
    expect(getComputedStyle(modal.box).boxShadow, 'dialog under the modal tier').to.contain(BORDER);
    expect(getComputedStyle(anchored.box).boxShadow, 'popup under the modal tier').to.not.contain(
      BORDER,
    );
  } finally {
    clearRootFamily();
  }
});

it('lets a component-scoped radius outrank the shared overlay radius', async () => {
  // The alias-not-rename rule applied to Lyra's own prior spelling: adopting the family must not
  // demote a hook a consumer already ships against.
  const familyOnly = await mountLocalePicker(`--lr-overlay-radius: ${RADIUS};`);
  expect(paint(familyOnly.box).corner, 'listbox corner with only the family set').to.equal(RADIUS);

  const componentWins = await mountLocalePicker(
    `--lr-overlay-radius: ${RADIUS}; --lr-locale-picker-radius: 7px;`,
  );
  expect(paint(componentWins.box).corner, 'listbox corner with the component hook set').to.equal(
    '7px',
  );
});

it('reaches an anchored surface outside the six components decision 1 names', async () => {
  // The sweep half of the contract. `lr-mention-popover`'s listbox carries the library's own
  // "Anchored overlay: a positioner-placed listbox" marker and had the identical rule — a family
  // that stops at the six named components is not "one place every popup reads".
  const wrapper = await mountIn(
    FAMILY_OVERRIDE,
    html`<lr-mention-popover></lr-mention-popover>`,
  );
  const host = required(
    wrapper.querySelector<HTMLElement>('lr-mention-popover'),
    'lr-mention-popover',
  );
  await settle(host);
  const { fill, edge, corner } = paint(
    shadowPart(host, '[part~="listbox"]', 'lr-mention-popover'),
  );
  expect(fill, 'mention-popover listbox fill').to.equal(SURFACE);
  expect(edge, 'mention-popover listbox edge').to.equal(BORDER);
  expect(corner, 'mention-popover listbox corner').to.equal(RADIUS);
});

it('paints the overlay family identically under dir="rtl"', async () => {
  const surface = await mountPopover(FAMILY_OVERRIDE);
  surface.host.setAttribute('dir', 'rtl');
  await settle(surface.host);
  const { fill, edge, corner } = paint(surface.box);
  expect(fill, 'RTL popup fill').to.equal(SURFACE);
  expect(edge, 'RTL popup edge').to.equal(BORDER);
  expect(corner, 'RTL popup corner').to.equal(RADIUS);
});

it('keeps reading the overlay family after a disconnect and reconnect', async () => {
  const surface = await mountSelect(FAMILY_OVERRIDE);
  const parent = required(surface.host.parentNode, 'select parent');
  const marker = document.createComment('overlay-surface-reconnect');
  parent.insertBefore(marker, surface.host);
  surface.host.remove();
  parent.insertBefore(surface.host, marker);
  marker.remove();
  await settle(surface.host);

  const box = shadowPart(surface.host, '[part~="listbox"]', 'lr-select');
  const { fill, edge, corner } = paint(box);
  expect(fill, 'reconnected listbox fill').to.equal(SURFACE);
  expect(edge, 'reconnected listbox edge').to.equal(BORDER);
  expect(corner, 'reconnected listbox corner').to.equal(RADIUS);
});

it('is accessible with every overlay surface open and populated in dark mode', async () => {
  const popover = await mountPopover();
  applyDarkTheme(popover.host);
  required(popover.host.querySelector<HTMLButtonElement>('button'), 'popover trigger').click();
  await settle(popover.host);
  finishAnimations(popover.box);
  await expect(popover.host).to.be.accessible();

  const dropdown = await mountDropdown();
  applyDarkTheme(dropdown.host);
  required(dropdown.host.querySelector<HTMLButtonElement>('button'), 'dropdown trigger').click();
  await settle(dropdown.host);
  finishAnimations(dropdown.box);
  await expect(dropdown.host).to.be.accessible();

  for (const build of [mountSelect, mountCombobox]) {
    const surface = await build();
    applyDarkTheme(surface.host);
    (surface.host as HTMLElement & { open: boolean }).open = true;
    await settle(surface.host);
    finishAnimations(surface.box);
    await expect(surface.host).to.be.accessible();
  }

  const menu = await mountMenu();
  applyDarkTheme(menu.host);
  await settle(menu.host);
  await expect(menu.host).to.be.accessible();

  const dialog = await mountDialog();
  applyDarkTheme(dialog.host);
  await settle(dialog.host);
  finishAnimations(dialog.box);
  await expect(dialog.host).to.be.accessible();
});

// --- lr-menu-item row-chrome hooks (the sibling gap filed alongside decision 1) ---------------

async function mountMenuItem(itemStyle = ''): Promise<{ host: HTMLElement; base: HTMLElement; icon: HTMLElement }> {
  const wrapper = await mountIn(
    '',
    html`<lr-menu label="Actions"
      ><lr-menu-item value="rename" style=${itemStyle}
        ><span slot="icon">*</span>Rename</lr-menu-item
      ></lr-menu
    >`,
  );
  const host = required(wrapper.querySelector<HTMLElement>('lr-menu-item'), 'lr-menu-item');
  await settle(host);
  return {
    host,
    base: shadowPart(host, '[part~="base"]', 'lr-menu-item'),
    icon: shadowPart(host, '[part~="icon"]', 'lr-menu-item'),
  };
}

it('floors an unset menu-item row at the shared ladder height and honours the new hook', async () => {
  const unset = await mountMenuItem();
  const resting = getComputedStyle(unset.base).getPropertyValue('min-block-size').trim();
  // Unset-regression: the hook's fallback arm must still resolve to the ladder expression. A
  // mis-parenthesised `var()` chain resolves to nothing, which computes as `auto`/`0px` and
  // silently drops the WCAG 2.2 SC 2.5.8 floor the row has always carried. Compared as a boolean
  // rather than by shape, because engines are free to serialize a resolved `max()` either way.
  expect(
    resting === '' || resting === 'auto' || resting === '0px',
    `unset menu-item min-block-size resolved to nothing usable (${resting})`,
  ).to.equal(false);
  expect(unset.base.getBoundingClientRect().height, 'unset rendered row height').to.be.at.least(24);

  const tuned = await mountMenuItem('--lr-menu-item-min-height: 44px;');
  expect(
    getComputedStyle(tuned.base).getPropertyValue('min-block-size').trim(),
    'menu-item min-block-size with the hook set',
  ).to.equal('44px');
  expect(tuned.base.getBoundingClientRect().height, 'rendered row height').to.be.at.least(44);
});

it('recolours only the menu-item icon, and inherits the row colour while unset', async () => {
  const unset = await mountMenuItem();
  expect(getComputedStyle(unset.icon).color, 'unset icon colour').to.equal(
    getComputedStyle(unset.base).color,
  );

  const tuned = await mountMenuItem(`--lr-menu-item-icon-color: ${SURFACE};`);
  expect(getComputedStyle(tuned.icon).color, 'icon colour with the hook set').to.equal(SURFACE);
  expect(getComputedStyle(tuned.base).color, 'row colour with the icon hook set').to.not.equal(
    SURFACE,
  );
});

it('paints a hovered menu-item row from the new hover hook', async () => {
  const tuned = await mountMenuItem(
    `--lr-menu-item-hover-bg: ${SURFACE}; --lr-transition-fast: 0s;`,
  );
  try {
    // `sendMouse` resolves when the synthesized command completes, which is not when the engine has
    // processed the resulting pointer event — re-dispatch until `:hover` actually matches.
    await hoverUntilMatched(tuned.base, 'menu-item row under the pointer');
    expect(getComputedStyle(tuned.base).backgroundColor, 'hovered row fill').to.equal(SURFACE);
  } finally {
    await resetMouse();
  }
});

it('falls back to the shared brand-quiet fill while the hover hook is unset', async () => {
  // Unset-regression for the hook. The set arm above passes just as happily against a
  // mis-parenthesised fallback that resolves to nothing, because the authored value wins either
  // way — only the unset arm proves the fallback arm still names the token this row has always
  // painted. The one existing assertion nearby covers the CHECKED row, so the plain row was
  // covered by accident rather than by design.
  const unset = await mountMenuItem('--lr-transition-fast: 0s;');
  try {
    await hoverUntilMatched(unset.base, 'unset menu-item row under the pointer');
    expect(getComputedStyle(unset.base).backgroundColor, 'unset hovered row fill').to.equal(
      resolveColor(token(unset.host, '--lr-color-brand-quiet')),
    );
  } finally {
    await resetMouse();
  }
});

it('steps a pressed menu-item row past the hover fill it was retuned to', async () => {
  // `[part='base']:active` now mixes from `--lr-menu-item-hover-bg` rather than from the literal
  // brand token, so a consumer who retunes hover keeps a pressed step instead of the row snapping
  // back to brand under the pointer. Polled rather than read straight after the press: `sendMouse`
  // resolving does not mean the engine has processed the pointer event it synthesized.
  const tuned = await mountMenuItem(
    `--lr-menu-item-hover-bg: ${SURFACE}; --lr-transition-fast: 0s;`,
  );
  try {
    await hoverUntilMatched(tuned.base, 'menu-item row under the pointer');
    await sendMouse({ type: 'down' });
    await waitUntil(
      () => getComputedStyle(tuned.base).backgroundColor !== SURFACE,
      'pressed row never stepped past its retuned hover fill',
    );
    const pressed = getComputedStyle(tuned.base).backgroundColor;
    // Compared against the values a broken `color-mix()` collapses to, never against a literal
    // expected colour: engines are free to serialize an oklab mix as `oklab(…)` or `rgb(…)`, and
    // Chromium already returns the former here.
    const inert = ['', 'transparent', 'rgba(0, 0, 0, 0)'];
    expect(
      !inert.includes(pressed) && pressed !== SURFACE,
      `pressed row fill did not resolve to a colour past the hover fill (${pressed})`,
    ).to.equal(true);
  } finally {
    await sendMouse({ type: 'up' });
    await resetMouse();
  }
});
