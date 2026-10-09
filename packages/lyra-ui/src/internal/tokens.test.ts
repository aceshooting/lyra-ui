import { fixture, expect, html } from '@open-wc/testing';
import { css } from 'lit';
import { setColorScheme, setForcedColors } from '../../test/wtr-media.js';
import { forceCoarsePointer } from '../../test/coarse-pointer-media.js';
import { tag } from './prefix.js';
// The per-mode records: read as text only, to check the values they mirror.
import { specialistTokens } from './specialist-tokens.styles.js';
import { specialistTokens as specialistHostTokens } from './specialist-host-tokens.styles.js';
import { hostTokens } from './host-tokens.styles.js';
import { LyraElement } from './lyra-element.js';
import { sizes } from './sizes.styles.js';
import { contextualSizes } from './contextual-vocabulary.styles.js';
import { tokens } from './tokens.styles.js';
import { palette } from './tokens/palette.styles.js';
import { glassSurface } from './glass-surface.styles.js';
import { toRgba } from '../../test/color-contrast.js';

// Every probe is a real LyraElement: it adopts the document token layer on connect and carries the
// host remainder, exactly like a shipped component.
class TokenProbe extends LyraElement {
  override render() {
    return html`<div part="probe"></div>`;
  }
}
customElements.define(tag('token-probe'), TokenProbe);

class SpecialistTokenProbe extends LyraElement {
  static override styles = [LyraElement.styles, specialistHostTokens];
  override render() {
    return html`<div part="probe"></div>`;
  }
}
customElements.define(tag('specialist-token-probe'), SpecialistTokenProbe);

// An intervening host: a LyraElement that renders another one inside its own shadow root. With the
// document token layer, neither host re-declares the shared --lr-* outputs; both inherit them from
// the nearest theme scope, and only the host-local names (--lr-icon-button-size and the safe-area
// aliases) are re-declared per element.
class NestedTokenProbe extends LyraElement {
  override render() {
    return html`<lr-token-probe></lr-token-probe>`;
  }
}
customElements.define(tag('nested-token-probe'), NestedTokenProbe);

it('keeps optional shape and row foundations unset until an ancestor supplies them', async () => {
  expect(await probeVar('--lr-radius-container')).to.equal(await probeVar('--lr-radius'));
  expect(await probeVar('--lr-table-row-min-height')).to.equal('0px');
  expect(await probeNestedVar('--lr-radius-container', '--lr-theme-border-radius-container: 19px')).to.equal('19px');
  expect(await probeNestedVar('--lr-radius-button', '--lr-theme-border-radius-button: 21px')).to.equal('21px');
  expect(await probeNestedVar('--lr-table-row-min-height', '--lr-theme-table-row-height: 42px')).to.equal('42px');
});

const SPECIALIST_TOKEN_PATTERN = /^--lr-(?:color-chart-|graph-cat-|terminal-(?:color|bg)-)/;

function needsSpecialistTokens(names: readonly string[]): boolean {
  return names.some((name) => SPECIALIST_TOKEN_PATTERN.test(name));
}

async function probeVar(name: string): Promise<string> {
  const el = (await fixture(
    needsSpecialistTokens([name])
      ? html`<lr-specialist-token-probe></lr-specialist-token-probe>`
      : html`<lr-token-probe></lr-token-probe>`,
  )) as TokenProbe | SpecialistTokenProbe;
  return getComputedStyle(el).getPropertyValue(name).trim();
}

/**
 * Resolve `name` on a probe nested one shadow root below an intervening host. The wrapper carrying
 * `ancestorStyle` is a theme scope, which is what makes its --lr-theme-* inputs re-derive the layer.
 */
async function probeNestedVar(name: string, ancestorStyle = ''): Promise<string> {
  const wrapper = (await fixture(
    html`<div data-lr-theme-scope style=${ancestorStyle}><lr-nested-token-probe></lr-nested-token-probe></div>`,
  )) as HTMLElement;
  const outer = wrapper.querySelector(tag('nested-token-probe')) as NestedTokenProbe;
  await outer.updateComplete;
  const inner = outer.shadowRoot!.querySelector(tag('token-probe')) as TokenProbe;
  await inner.updateComplete;
  return getComputedStyle(inner).getPropertyValue(name).trim();
}

/** Mount a nested probe and hand back the inner host, so a caller can force media rules on it. */
async function nestedProbe(ancestorStyle = '', scope = true): Promise<TokenProbe> {
  const wrapper = (await fixture(
    scope
      ? html`<div data-lr-theme-scope style=${ancestorStyle}><lr-nested-token-probe></lr-nested-token-probe></div>`
      : html`<div style=${ancestorStyle}><lr-nested-token-probe></lr-nested-token-probe></div>`,
  )) as HTMLElement;
  const outer = wrapper.querySelector(tag('nested-token-probe')) as NestedTokenProbe;
  await outer.updateComplete;
  const inner = outer.shadowRoot!.querySelector(tag('token-probe')) as TokenProbe;
  await inner.updateComplete;
  return inner;
}

/**
 * `name` resolved to real pixels on `el`.
 *
 * A custom property's computed value is its token stream after var() substitution, so a token
 * carrying `max(...)` reads back as the unevaluated text `max(2rem, 2.75rem)` — which proves the
 * declaration exists but says nothing about which arm wins, and is whitespace-fragile across
 * engines besides. Borrowing a real length property makes the engine do the arithmetic. Padding is
 * the carrier because its computed value is an absolute length whatever the element's `display` is.
 */
function resolvedPx(el: Element, name: string): number {
  const host = el as HTMLElement;
  const previous = host.style.paddingInlineStart;
  host.style.paddingInlineStart = `var(${name})`;
  const resolved = Number.parseFloat(getComputedStyle(host).paddingInlineStart);
  host.style.paddingInlineStart = previous;
  return resolved;
}

/** `rem` in real pixels, read live — a non-16px root font size is a common accessibility setting. */
function remPx(value: number): number {
  return value * Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
}

/**
 * `name` resolved through a real colour property, so a `color-mix()` is evaluated rather than
 * echoed back as source text the way `getPropertyValue` returns it.
 *
 * Two serializations have to be accepted, which is the whole reason this helper exists: a plain
 * hex or keyword comes back as `rgb(r, g, b)` on 0-255, while anything that went through
 * `color-mix(in srgb, ...)` comes back in CSS Color 4 form as `color(srgb r g b)` on 0-1. Both are
 * normalized to 0-255 here so a caller never has to know which arm of a token's fallback chain won.
 */
function resolvedColor(el: Element, name: string): readonly [number, number, number] {
  const host = el as HTMLElement;
  const previous = host.style.backgroundColor;
  host.style.backgroundColor = `var(${name})`;
  const computed = getComputedStyle(host).backgroundColor;
  host.style.backgroundColor = previous;
  const legacy = /^rgba?\(([^)]*)\)$/.exec(computed)?.[1];
  const modern = /^color\(srgb ([^)]*)\)$/.exec(computed)?.[1];
  expect(
    legacy ?? modern,
    `${name} resolved to "${computed}", which is neither an rgb() nor a color(srgb) colour`,
  ).to.not.equal(undefined);
  const scale = legacy === undefined ? 255 : 1;
  const [red, green, blue] = (legacy ?? modern)!
    .split(/[\s,/]+/)
    .filter(Boolean)
    .map((channel) => Number(channel) * scale);
  return [red!, green!, blue!];
}

const toHex = (channels: readonly number[]) =>
  `#${channels.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;

type PaletteMode = 'light' | 'dark';

/** The palette's light grid lives on `:host`, its dark grid on `:host([data-lr-theme='dark'])`. */
function paletteBlock(mode: PaletteMode): string {
  const text = palette.cssText;
  const darkAt = text.indexOf(":host([data-lr-theme='dark'])");
  expect(darkAt, 'palette must declare a dark grid block').to.be.greaterThan(-1);
  return mode === 'light' ? text.slice(0, darkAt) : text.slice(darkAt);
}

/**
 * The standalone value a token resolves to with no consumer theme loaded.
 *
 * A semantic colour names a grid slot whose literal fallback is resolved from canonical ramp
 * data by the palette generator. Follow that bridge rather than assuming a separate flat value.
 */
function fallbackHex(name: string, mode: PaletteMode): string {
  const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tokenCssText = needsSpecialistTokens([name]) ? specialistTokens.cssText : tokens.cssText;

  const bridged = tokenCssText.match(new RegExp(`${escaped(name)}:\\s*var\\((--lr-color-[a-z0-9-]+)\\)`, 'i'));
  if (bridged) {
    const block = paletteBlock(mode);
    const slot = block.match(new RegExp(`${escaped(bridged[1]!)}:\\s*var\\([^,]+,\\s*(#[0-9a-f]{6}|rgb\\([^)]+\\))\\)`, 'i'));
    expect(slot, `${name} bridges to ${bridged[1]}, which the ${mode} grid does not declare`).to.not.equal(null);
    const value = slot![1]!;
    return value.startsWith('#') ? value : toHex([...value.matchAll(/\d+/g)].slice(0, 3).map(([channel]) => Number(channel)));
  }

  // The light value is declared once, on `:host`; the dark one is composed into each of the three
  // dark selectors (OS preference, `data-lr-theme="dark"`, dark ancestor), so it appears more than
  // once here. All of those copies MUST be the same colour -- dark meaning one thing when the OS
  // asked for it and another when the attribute did is the bug this shape exists to prevent.
  const values = [
    ...tokenCssText.matchAll(new RegExp(`${escaped(name)}:\\s*var\\([^,]+,\\s*(#[0-9a-f]{3,8})\\s*\\)`, 'gi')),
  ].map((match) => match[1]!);
  expect(values.length, `${name} must define a light and at least one dark standalone fallback`).to.be.greaterThan(1);
  const [light, ...dark] = values;
  expect(new Set(dark).size, `${name}'s dark fallbacks disagree: ${dark.join(' | ')}`).to.equal(1);
  return mode === 'light' ? light! : dark[0]!;
}

function relativeLuminance(hex: string): number {
  const compact = hex.slice(1);
  const expanded = compact.length === 3 ? [...compact].map((digit) => digit + digit).join('') : compact;
  const [red, green, blue] = expanded.match(/.{2}/g)!.map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (lighter! + 0.05) / (darker! + 0.05);
}

async function expectPaletteContrast(mode: PaletteMode): Promise<void> {
  const probe = await fixture<TokenProbe>(html`<lr-token-probe data-lr-theme=${mode}></lr-token-probe>`);
  const color = (name: string): string => '#' + resolvedColor(probe, name)
    .map(channel => Math.round(channel).toString(16).padStart(2, '0')).join('');
  const surface = color('--lr-color-surface');
  const pairs: Array<[label: string, foreground: string, background: string, minimum: number]> = [
    ['text / surface', color('--lr-color-text'), surface, 4.5],
    ['quiet text / surface', color('--lr-color-text-quiet'), surface, 4.5],
    ['border / surface', color('--lr-color-border'), surface, 3],
    ['border / raised surface', color('--lr-color-border'), color('--lr-color-surface-raised'), 3],
    ['border / overlay surface', color('--lr-color-border'), color('--lr-color-surface-overlay'), 3],
    ['neutral text / normal fill', color('--lr-color-neutral-on-normal'), color('--lr-color-neutral-fill-normal'), 4.5],
  ];

  for (const tone of ['brand', 'success', 'warning', 'danger'] as const) {
    const loud = color(`--lr-color-${tone}`);
    pairs.push(
      [`${tone} / surface`, loud, surface, 4.5],
      [`${tone} / ${tone}-quiet`, loud, color(`--lr-color-${tone}-quiet`), 4.5],
      [`on-${tone} / ${tone}`, color(`--lr-color-on-${tone}`), loud, 4.5],
    );
  }

  // Neutral ships the same loud/on-loud semantic pair as the other tones, but deliberately has
  // no `--lr-color-neutral-quiet` convenience alias: quiet neutral surfaces use the complete
  // palette token (`--lr-color-neutral-fill-quiet`) through the contextual vocabulary instead.
  const neutral = color('--lr-color-neutral');
  pairs.push(
    ['neutral / surface', neutral, surface, 4.5],
    ['on-neutral / neutral', color('--lr-color-on-neutral'), neutral, 4.5],
  );

  const failures = pairs.flatMap(([label, foreground, background, minimum]) => {
    const actual = contrastRatio(foreground, background);
    return actual + Number.EPSILON < minimum
      ? [`${mode} ${label}: ${actual.toFixed(3)}:1 < ${minimum}:1 (${foreground} on ${background})`]
      : [];
  });
  expect(failures.join('\n')).to.equal('');
}

/** The elevation scale, smallest to largest. `--lr-shadow` is an alias for the `m` step. */
const ELEVATION_STEPS = ['xs', 's', 'm', 'l', 'xl'] as const;

const squash = (value: string) => value.trim().replace(/\s+/g, ' ');

it('defines the new motion tokens with the documented fallback values', async () => {
  expect(await probeVar('--lr-transition-fast')).to.equal('120ms ease-out');
  expect(await probeVar('--lr-transition-base')).to.equal('180ms ease-out');
});

it('derives the shared interactive transition from the fast transition token', async () => {
  // The three properties a control repaints under the pointer, resolved rather than quoted: the
  // token substitutes --lr-transition-fast at computed-value time, which is precisely why the
  // reduced-motion block below needs no entry of its own to flatten it.
  expect(squash(await probeVar('--lr-transition-interactive'))).to.equal(
    'background-color 120ms ease-out, color 120ms ease-out, border-color 120ms ease-out',
  );
});

it('retunes the interactive transition through the same --lr-theme-transition-fast input', async () => {
  expect(squash(await probeNestedVar('--lr-transition-interactive', '--lr-theme-transition-fast: 5ms linear'))).to.equal(
    'background-color 5ms linear, color 5ms linear, border-color 5ms linear',
  );
});

it('maps logical safe-area insets to the mirrored physical edges in RTL, per host', () => {
  const cssText = hostTokens.cssText.replace(/\s+/g, ' ');
  expect(cssText).to.include(
    ':host(:dir(rtl)){--lr-safe-area-inline-start:env(safe-area-inset-right, 0px);' +
      '--lr-safe-area-inline-end:env(safe-area-inset-left, 0px)}',
  );
});

it('defines a single disabled-opacity token', async () => {
  expect(await probeVar('--lr-opacity-disabled')).to.equal('0.5');
});

it('defines a single hover-brightness token, themeable via --lr-theme-hover-brightness', async () => {
  expect(await probeVar('--lr-hover-brightness')).to.equal('1.08');
  expect(await probeNestedVar('--lr-hover-brightness', '--lr-theme-hover-brightness: 1.2')).to.equal('1.2');
});

it('defines a single popover viewport-clamp token, themeable via --lr-theme-popover-viewport-clamp', async () => {
  expect(await probeVar('--lr-popover-viewport-clamp')).to.equal('92vw');
  expect(await probeNestedVar('--lr-popover-viewport-clamp', '--lr-theme-popover-viewport-clamp: 88vw')).to.equal(
    '88vw',
  );
});

it('defines an otp-input-segment-size token, themeable via --lr-theme-otp-input-segment-size', async () => {
  expect(await probeVar('--lr-otp-input-segment-size')).to.equal('2.5em');
  expect(await probeNestedVar('--lr-otp-input-segment-size', '--lr-theme-otp-input-segment-size: 3em')).to.equal(
    '3em',
  );
});

it('defines the Shadcn focus ring with the Emerald focus role', async () => {
  expect(resolvedPx(await nestedProbe(), '--lr-focus-ring-width')).to.equal(3);
  expect(await probeVar('--lr-focus-ring-offset')).to.equal('0px');
  expect(resolvedColor(await nestedProbe(), '--lr-focus-ring-color')).to.deep.equal([31, 127, 92]);
});

it('defines a composite --lr-focus-ring shorthand built from the three parts', async () => {
  const composite = await probeVar('--lr-focus-ring');
  expect(composite, 'a ready-made outline value, like Web Awesome exposes').to.equal(
    `${await probeVar('--lr-focus-ring-width')} solid ${await probeVar('--lr-focus-ring-color')}`,
  );
});

it('tracks the --lr-theme-focus-ring-* inputs through the composite shorthand', async () => {
  expect(
    await probeNestedVar('--lr-focus-ring', '--lr-theme-focus-ring-width: 4px'),
  ).to.contain('4px');
});

it('defines an icon-button-size token', async () => {
  expect(await probeVar('--lr-icon-button-size')).to.equal('2.25rem');
});

it('keeps the focus-ring, icon-button, otp-input, and popover-clamp defaults inside a nested shadow root with no override', async () => {
  expect(await probeNestedVar('--lr-icon-button-size')).to.equal('2.25rem');
  expect(resolvedPx(await nestedProbe(), '--lr-focus-ring-width')).to.equal(3);
  expect(await probeNestedVar('--lr-focus-ring-offset')).to.equal('0px');
  expect(await probeNestedVar('--lr-otp-input-segment-size')).to.equal('2.5em');
  expect(await probeNestedVar('--lr-popover-viewport-clamp')).to.equal('92vw');
});

it('lets --lr-theme-icon-button-size and --lr-theme-otp-input-segment-size set on an ancestor reach a component nested below another host', async () => {
  expect(await probeNestedVar('--lr-icon-button-size', '--lr-theme-icon-button-size: 3rem')).to.equal('3rem');
  expect(await probeNestedVar('--lr-otp-input-segment-size', '--lr-theme-otp-input-segment-size: 3em')).to.equal(
    '3em',
  );
});

// --lr-icon-button-size has TWO ancestor-settable inputs, and the split is deliberate rather than
// an inconsistency. --lr-theme-icon-button-size is the application-wide theme hook, matching every
// other --lr-theme-* name. --lr-icon-button-size-scope is the subtree override: a wrapper that
// wants a denser (or roomier) row of icon buttons sets it on itself and leaves the application
// theme alone. Both names are declared nowhere in any component's styles, which is exactly why
// both inherit past an intervening host; --lr-icon-button-size itself IS re-declared on every
// LyraElement's :host, and so cannot — the negative case below pins that.
it('lets --lr-icon-button-size-scope set on an ancestor reach a component nested below another host', async () => {
  expect(await probeNestedVar('--lr-icon-button-size', '--lr-icon-button-size-scope: 2.75rem')).to.equal('2.75rem');
});

// The SCOPE input is read ahead of the theme tier, and that order is load-bearing rather than a
// preference. `design-tokens.css` -- a shipped, exported stylesheet -- sets
// --lr-theme-icon-button-size on :root, and a var() chain only falls through when the referenced
// property is unset EVERYWHERE, not merely shadowed nearer the element. Reading the theme tier
// first therefore made the scope input inert for every consumer of that stylesheet, silently. It
// shipped that way in 18.1.0 and a consumer found it by measuring, not by reading. The
// root-declared case below is the regression guard; this pair only pins the precedence.
it('reads --lr-icon-button-size-scope ahead of the theme-tier input when an ancestor sets both', async () => {
  expect(
    await probeNestedVar(
      '--lr-icon-button-size',
      '--lr-theme-icon-button-size: 3rem; --lr-icon-button-size-scope: 2rem',
    ),
  ).to.equal('2rem');
});

// THE case the 18.1.0 tests missed: every fixture here composes only the base token layer, so
// --lr-theme-icon-button-size was never set at the document root the way a real consumer's
// design-tokens.css sets it. With the theme tier read first, this probe returned the root's value
// and the scope override was dead. Declaring it on :root reproduces the shipped stylesheet.
it('still honours --lr-icon-button-size-scope when the theme tier is declared at the document root', async () => {
  const style = document.createElement('style');
  style.textContent = ':root { --lr-theme-icon-button-size: 2.5rem; }';
  document.head.append(style);
  try {
    expect(
      await probeNestedVar('--lr-icon-button-size', '--lr-icon-button-size-scope: 2rem'),
      'a root-declared theme tier must not make the subtree override inert',
    ).to.equal('2rem');
  } finally {
    style.remove();
  }
});

it('leaves --lr-icon-button-size at its default when neither ancestor input is set', async () => {
  expect(await probeNestedVar('--lr-icon-button-size')).to.equal('2.25rem');
  expect(resolvedPx(await nestedProbe(), '--lr-icon-button-size')).to.be.closeTo(remPx(2.25), 0.5);
});

it('lets the --lr-theme-focus-ring-* inputs set on an ancestor reach a component nested below another host', async () => {
  expect(resolvedPx(await nestedProbe('--lr-theme-focus-ring-width: 4px'), '--lr-focus-ring-width')).to.equal(4);
  expect(await probeNestedVar('--lr-focus-ring-offset', '--lr-theme-focus-ring-offset: 5px')).to.equal('5px');
});

it('lets an ancestor --lr-* output reach nested components until the next theme scope, except the host-local icon-button size', async () => {
  // With the document token layer no component re-declares the shared outputs, so an output set on a
  // plain ancestor now inherits all the way down (a v28 widening). It stops at the next theme scope,
  // which re-derives every output from the inputs it sees. --lr-icon-button-size is the one name
  // here that stays element-scoped: every host re-declares it so the coarse-pointer floor applies
  // per element, and --lr-icon-button-size-scope is its inheriting subtree input.
  expect(await probeNestedVar('--lr-icon-button-size', '--lr-icon-button-size: 3rem')).to.equal('2.25rem');
  const unscoped = (style: string) => nestedProbe(style, false);
  expect(resolvedPx(await unscoped('--lr-focus-ring-width: 4px'), '--lr-focus-ring-width')).to.equal(4);
  expect(getComputedStyle(await unscoped('--lr-focus-ring-offset: 5px')).getPropertyValue('--lr-focus-ring-offset').trim()).to.equal('5px');
  expect(getComputedStyle(await unscoped('--lr-otp-input-segment-size: 4em')).getPropertyValue('--lr-otp-input-segment-size').trim()).to.equal('4em');
  // A scope between the output and the component re-derives it from its inputs.
  expect(await probeNestedVar('--lr-otp-input-segment-size', '--lr-otp-input-segment-size: 4em')).to.equal('4em');
  const wrapper = (await fixture(
    html`<div style="--lr-popover-viewport-clamp: 50vw"><section data-lr-theme-scope><lr-token-probe></lr-token-probe></section></div>`,
  )) as HTMLElement;
  const behindScope = wrapper.querySelector(tag('token-probe')) as TokenProbe;
  await behindScope.updateComplete;
  expect(getComputedStyle(behindScope).getPropertyValue('--lr-popover-viewport-clamp').trim()).to.equal('92vw');
});

// The request's concrete repro: an ancestor wrapper styling
// `.end { --lr-icon-button-size: 2.75rem; --lr-icon-button-radius: 999px; }` around an
// intervening <lr-popover> whose trigger slot holds a nested <lr-icon-button> gets the radius
// applied but not the size. `NestedTokenProbe`/`TokenProbe` stand in for that intervening
// <lr-popover> and nested <lr-icon-button>: neither composes icon-button.styles.ts, but that is
// exactly the point -- --lr-icon-button-radius/-background/-color/-border are never declared on
// any :host anywhere (icon-button.styles.ts reads them with a bare `var(--lr-icon-button-x,
// fallback)`, with no assignment of its own), so they inherit through this fixture exactly as
// they would through the real intervening component. --lr-icon-button-size behaves differently
// only because the SHARED base layer (which every stand-in and every real component includes)
// re-declares it on its own :host, as proven by the negative case above.
//
// The supported answer to that repro is --lr-icon-button-size-scope on the wrapper, covered
// above. Read the two together rather than as a contradiction: the sibling icon-button hooks are
// ancestor-scoped because nothing declares them, --lr-icon-button-size is element-scoped because
// the shared layer must be able to floor it per element (the coarse-pointer rule below cannot
// work any other way), and --lr-icon-button-size-scope exists to give the wrapper case the
// inheriting name it was missing without changing what the published one means.
it('lets an ancestor-set icon-button token that the shared base layer does not re-declare reach a component nested below another host', async () => {
  expect(await probeNestedVar('--lr-icon-button-radius', '--lr-icon-button-radius: 999px')).to.equal('999px');
  expect(await probeNestedVar('--lr-icon-button-bg', '--lr-icon-button-bg: red')).to.equal('red');
});

// `TokenProbe` composes only `[palette, tokens]`, so `forceCoarsePointer` (test/coarse-pointer-
// media.ts) forcing EVERY matching rule -- not just the first -- reduces to forcing the one rule
// tokens.styles.ts's baseTokens declares; see icon-button.test.ts / sizes.styles.test.ts for cases
// that reach more than one.

it('grows --lr-icon-button-size to the platform touch-target floor under a coarse pointer', async () => {
  const el = (await fixture(html`<lr-token-probe></lr-token-probe>`)) as TokenProbe;
  const restore = forceCoarsePointer(el);
  try {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(getComputedStyle(el).getPropertyValue('--lr-icon-button-size').trim()).to.equal(
      'max(2.25rem, 2.75rem)',
    );
  } finally {
    restore();
  }
});

it('leaves an explicit --lr-theme-icon-button-size at or above the touch floor untouched under a coarse pointer', async () => {
  const el = (await fixture(
    html`<lr-token-probe style="--lr-theme-icon-button-size: 3rem"></lr-token-probe>`,
  )) as TokenProbe;
  const restore = forceCoarsePointer(el);
  try {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(getComputedStyle(el).getPropertyValue('--lr-icon-button-size').trim()).to.equal(
      'max(3rem, 2.75rem)',
    );
  } finally {
    restore();
  }
});

/** The icon-button size an ancestor style resolves to, in pixels, with the touch floor forced on. */
async function coarsePointerNestedIconButtonPx(ancestorStyle: string): Promise<number> {
  const inner = await nestedProbe(ancestorStyle);
  const restore = forceCoarsePointer(inner);
  try {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    return resolvedPx(inner, '--lr-icon-button-size');
  } finally {
    restore();
  }
}

it('still applies the coarse-pointer touch floor to an ancestor --lr-icon-button-size-scope', async () => {
  // The floor is the WCAG 2.2 SC 2.5.8 guarantee, so the new ancestor route must not be a way
  // around it: a wrapper asking for 2rem gets 2.75rem on a touch device, while a wrapper asking
  // for more than the floor keeps what it asked for.
  expect(await coarsePointerNestedIconButtonPx('--lr-icon-button-size-scope: 2rem')).to.be.closeTo(remPx(2.75), 0.5);
  expect(await coarsePointerNestedIconButtonPx('--lr-icon-button-size-scope: 3rem')).to.be.closeTo(remPx(3), 0.5);
});

it('defines the shared typography, chart, layer, and overlay token surface', async () => {
  expect(await probeVar('--lr-font-size-sm')).to.equal('0.8125rem');
  expect(await probeVar('--lr-font-weight-semibold')).to.equal('600');
  expect(await probeVar('--lr-line-height-normal')).to.equal('1.5');
  expect(await probeVar('--lr-border-width-thin')).to.equal('1px');
  expect(await probeVar('--lr-radius-pill')).to.equal('999px');
  expect(await probeVar('--lr-layer-modal')).to.equal('1000');
  expect(await probeVar('--lr-color-overlay')).to.equal('rgb(0 0 0 / 0.5)');
  expect(await probeVar('--lr-color-overlay-strong')).to.equal('rgb(0 0 0 / 0.92)');
});

// --- the overlay surface is its own input, not derived from the page surface ---------------
// Assertions read a RENDERED colour: a custom property's computed value is its unresolved token stream.

/** A probe pinned to dark mode through the shipped `data-lr-theme` route, with optional inline style. */
async function darkProbe(style = ''): Promise<TokenProbe> {
  const el = (await fixture(
    html`<lr-token-probe data-lr-theme="dark" style=${style}></lr-token-probe>`,
  )) as TokenProbe;
  await el.updateComplete;
  return el;
}

it('keeps the default Shadcn dark overlay above its page surface', async () => {
  const overlay = resolvedColor(await darkProbe(), '--lr-color-surface-overlay');
  const expected = [0x17, 0x17, 0x17];
  const drift = Math.max(...overlay.map((channel, index) => Math.abs(channel - expected[index]!)));
  expect(drift, `resolved ${toHex(overlay)}, expected about #171717`).to.be.at.most(2);
});

it('keeps the Shadcn dark panel role independent of a page-surface override', async () => {
  const el = await darkProbe('--lr-theme-color-surface-default: #101820');
  expect(toHex(resolvedColor(el, '--lr-color-surface'))).to.equal('#101820');
  expect(toHex(resolvedColor(el, '--lr-color-surface-overlay'))).to.equal('#171717');
});

it('lets an explicit --lr-theme-color-surface-overlay win outright in dark mode', async () => {
  const el = await darkProbe('--lr-theme-color-surface-overlay: #3f2b56');
  expect(toHex(resolvedColor(el, '--lr-color-surface-overlay'))).to.equal('#3f2b56');
});

it('keeps the light overlay surface white, independent of a page-surface override', async () => {
  const el = (await fixture(html`<lr-token-probe data-lr-theme-scope style="--lr-theme-color-surface-default: #101820"></lr-token-probe>`)) as TokenProbe;
  await el.updateComplete;
  expect(toHex(resolvedColor(el, '--lr-color-surface'))).to.equal('#101820');
  expect(toHex(resolvedColor(el, '--lr-color-surface-overlay'))).to.equal('#ffffff');
});

it('provides central reduced-motion fallbacks on every host', () => {
  const cssText = hostTokens.cssText;
  expect(cssText).to.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  expect(cssText).to.match(/animation-duration:\s*0\.001ms/);
});

// --- forced colors must outrank EVERY route into dark mode ----------------------------
//
// A Windows High Contrast *dark* theme also reports `prefers-color-scheme: dark`, so the ordinary
// HCM case is forced-colors AND dark at the same time. Every dark selector this layer ships is
// more specific than a bare `:host`, so a forced-colors block written as `:host` alone reads
// perfectly correct in `cssText` while losing the cascade outright -- exactly what the
// stylesheet-text assertions these tests replaced could never see. So: real
// `(forced-colors: active)` emulation, and computed values read off a mounted host.
//
// It matters past CSS. The user agent substitutes its own colours for painted CSS, but canvas and
// SVG drawing code gets no such substitution -- `graph.class.ts` resolves --lr-color-text and
// --lr-color-surface through `getComputedStyle` and paints literally what they say, so a dead
// forced-colors override is an unreadable chart, not a cosmetic miss.

const FORCED_COLOR_TOKENS = [
  ['--lr-color-surface', 'Canvas'],
  ['--lr-color-surface-raised', 'Canvas'],
  ['--lr-color-text', 'CanvasText'],
  ['--lr-color-text-quiet', 'CanvasText'],
  ['--lr-color-border', 'ButtonText'],
  // The decorative tier collapses onto the same system colour: a forced-colours theme has exactly
  // one border colour, and a divider must not keep an application's low-contrast grey inside it.
  ['--lr-color-border-subtle', 'ButtonText'],
  ['--lr-color-brand', 'LinkText'],
  ['--lr-color-neutral', 'ButtonText'],
  ['--lr-color-on-brand', 'Canvas'],
  ['--lr-focus-ring-color', 'Highlight'],
  ['--lr-color-chart-1', 'Highlight'],
  ['--lr-graph-cat-1', 'Highlight'],
] as const;

const FORCED_COLOR_TOKEN_NAMES = FORCED_COLOR_TOKENS.map(([name]) => name);

/** Every route into dark mode this token layer answers to, plus the no-signal light default. */
type DarkRoute = 'none' | 'os-preference' | 'attribute' | 'ancestor';


async function probeTokensUnder(names: readonly string[], route: DarkRoute): Promise<Map<string, string>> {
  const probe =
    route === 'attribute'
      ? html`<lr-specialist-token-probe data-lr-theme="dark"></lr-specialist-token-probe>`
      : html`<lr-specialist-token-probe></lr-specialist-token-probe>`;
  const wrapper = (await fixture(
    html`<div class=${route === 'ancestor' ? 'lr-dark' : route === 'os-preference' ? '' : 'lr-light'}>${probe}</div>`,
  )) as HTMLElement;
  const el = wrapper.querySelector(tag('specialist-token-probe')) as SpecialistTokenProbe;
  await el.updateComplete;
  // The OS route is real colour-scheme emulation. The probe sits under a mode-neutral wrapper, so
  // the document root's own mode decides it.
  if (route !== 'os-preference') {
    const computed = getComputedStyle(el);
    return new Map(names.map((name) => [name, squash(computed.getPropertyValue(name))]));
  }
  wrapper.removeAttribute('class');
  await setColorScheme('dark');
  try {
    const computed = getComputedStyle(el);
    return new Map(names.map((name) => [name, squash(computed.getPropertyValue(name))]));
  } finally {
    await setColorScheme('no-preference');
  }
}

/**
 * Enter real forced-colors emulation, reporting whether the engine honoured it. Playwright drives
 * this through `page.emulateMedia({ forcedColors })`; an engine that does not implement
 * forced-colors either rejects the command or leaves the media query unmatched, and the assertion
 * has to skip there rather than redden for an unrelated reason.
 */
async function enterForcedColors(): Promise<boolean> {
  try {
    await setForcedColors('active');
  } catch {
    return false;
  }
  if (matchMedia('(forced-colors: active)').matches) return true;
  await setForcedColors('none');
  return false;
}

function expectSystemColors(values: Map<string, string>, route: DarkRoute): void {
  const failures = FORCED_COLOR_TOKENS.flatMap(([name, expected]) =>
    values.get(name) === expected ? [] : [`${name}: ${values.get(name)} (expected ${expected})`],
  );
  expect(failures.join('\n'), `tokens outranking the forced-colors override on the ${route} route`).to.equal('');
}

it('reaches its dark values through every dark route while forced colors are off', async () => {
  // The premise every forced-colors test below rests on. Without it, "the system colour won" is
  // indistinguishable from "this route never changed anything in the first place".
  const names = ['--lr-color-surface', '--lr-color-chart-1'];
  const light = await probeTokensUnder(names, 'none');
  expect(light.get('--lr-color-surface'), 'the no-signal default must still be the light surface').to.equal('#ffffff');

  // Every engine follows an ancestor mode scope: the document layer resolves it with plain selectors.
  const routes: DarkRoute[] = ['os-preference', 'attribute', 'ancestor'];
  const failures: string[] = [];
  for (const route of routes) {
    const dark = await probeTokensUnder(names, route);
    if (dark.get('--lr-color-surface') !== '#0a0a0a') {
      failures.push(`${route}: surface is ${dark.get('--lr-color-surface')}, expected #0a0a0a`);
    }
    if (dark.get('--lr-color-chart-1') === light.get('--lr-color-chart-1')) {
      failures.push(`${route}: chart-1 never left its light value`);
    }
  }
  expect(failures.join('\n'), 'dark routes that did not reach their dark values').to.equal('');
});

it('substitutes system colours in forced colors with no dark signal', async function () {
  if (!(await enterForcedColors())) this.skip();
  try {
    expectSystemColors(await probeTokensUnder(FORCED_COLOR_TOKEN_NAMES, 'none'), 'none');
  } finally {
    await setForcedColors('none');
  }
});

it('substitutes system colours in forced colors on an OS dark-scheme preference', async function () {
  if (!(await enterForcedColors())) this.skip();
  try {
    expectSystemColors(await probeTokensUnder(FORCED_COLOR_TOKEN_NAMES, 'os-preference'), 'os-preference');
  } finally {
    await setForcedColors('none');
  }
});

it('substitutes system colours in forced colors on a data-lr-theme="dark" host', async function () {
  if (!(await enterForcedColors())) this.skip();
  try {
    expectSystemColors(await probeTokensUnder(FORCED_COLOR_TOKEN_NAMES, 'attribute'), 'attribute');
  } finally {
    await setForcedColors('none');
  }
});

it('substitutes system colours in forced colors under a dark ancestor', async function () {
  if (!(await enterForcedColors())) this.skip();
  try {
    expectSystemColors(await probeTokensUnder(FORCED_COLOR_TOKEN_NAMES, 'ancestor'), 'ancestor');
  } finally {
    await setForcedColors('none');
  }
});

it('darkens the border fallback to clear WCAG 1.4.11 non-text 3:1 contrast against white', async () => {
  expect(await probeVar('--lr-color-border')).to.equal('#919191');
});

// --- the decorative border tier -------------------------------------------------------
//
// Shadcn gives decorative boundaries their own mode-specific role, separate from the
// control boundary. Both remain independently themeable through their documented inputs.

const BORDER_TIERS = ['--lr-color-border', '--lr-color-border-subtle'] as const;

it('keeps the default decorative and control boundary roles distinct on every mode route', async () => {
  // Every engine follows an ancestor mode scope: the document layer resolves it with plain selectors.
  const routes: DarkRoute[] = ['none', 'os-preference', 'attribute', 'ancestor'];
  for (const route of routes) {
    const values = await probeTokensUnder(BORDER_TIERS, route);
    const dark = route !== 'none';
    expect(values.get('--lr-color-border'), route).to.equal(dark ? '#646464' : '#919191');
    expect(toRgba(values.get('--lr-color-border-subtle')!), route).to.deep.equal(
      toRgba(dark ? 'rgb(255 255 255 / 0.1)' : '#e5e5e5'),
    );
  }
});

it('keeps the Shadcn decorative role independent of a control-boundary override', async () => {
  expect(toRgba(
    await probeNestedVar('--lr-color-border-subtle', '--lr-theme-color-surface-border: rgb(7, 8, 9)'),
  )).to.deep.equal([229, 229, 229, 255]);
});

it('lets --lr-theme-color-surface-border-subtle set on an ancestor reach a component nested below another host', async () => {
  const inner = await nestedProbe('--lr-theme-color-surface-border-subtle: rgb(1, 2, 3)');
  const read = (name: string) => getComputedStyle(inner).getPropertyValue(name).trim();
  expect(read('--lr-color-border-subtle')).to.equal('rgb(1, 2, 3)');
  // Decorative only: the control boundary must not move with it.
  expect(read('--lr-color-border')).to.equal('#919191');

  // The dark declaration reads the same input; a literal there would silently ignore the theme.
  inner.setAttribute('data-lr-theme', 'dark');
  expect(read('--lr-color-border-subtle')).to.equal('rgb(1, 2, 3)');
  expect(read('--lr-color-border')).to.equal('#646464');
});

it('replaces a set --lr-theme-color-surface-border-subtle with the system border colour in forced colors', async function () {
  if (!(await enterForcedColors())) this.skip();
  try {
    const inner = await nestedProbe('--lr-theme-color-surface-border-subtle: rgb(1, 2, 3)');
    expect(getComputedStyle(inner).getPropertyValue('--lr-color-border-subtle').trim()).to.equal('ButtonText');
  } finally {
    await setForcedColors('none');
  }
});

it('provides a dark-aware fallback under prefers-color-scheme: dark when no --lr-theme-* value is set', () => {
  const cssText = tokens.cssText;
  expect(cssText).to.match(/@media\s*\(prefers-color-scheme:\s*dark\)/);
  // The dark block must still chain through the same --lr-theme-* token names (a
  // consumer's own theme value must still win over this fallback), only the
  // literal fallback hex changes.
  const darkBlockMatch = /@media\s*\(prefers-color-scheme:\s*dark\)\s*{([\s\S]*?)}\s*}/.exec(cssText);
  expect(darkBlockMatch, 'expected a dark-mode block').to.not.equal(null);
  expect(darkBlockMatch![1]).to.include('--lr-theme-color-surface-default');
  expect(darkBlockMatch![1]).to.include('--lr-theme-color-text-normal');
});

it('provides light and dark categorical chart palette values', () => {
  const cssText = specialistTokens.cssText;
  for (let index = 1; index <= 8; index++) {
    expect(cssText).to.include(`--lr-color-chart-${index}:`);
  }
  const darkBlockMatch = /@media\s*\(prefers-color-scheme:\s*dark\)\s*{([\s\S]*?)}\s*}/.exec(cssText);
  expect(darkBlockMatch, 'expected a dark-mode block').to.not.equal(null);
  expect(darkBlockMatch![1]).to.include('--lr-color-chart-1:');
  // The forced-colors values are asserted as RENDERED values, not stylesheet text -- see the
  // forced-colors block above. A present-but-outranked rule satisfies a `cssText` match forever.
});

it('provides light and dark categorical graph-node-type palette values, independently themeable from --lr-color-chart-*', async () => {
  const light = await probeVar('--lr-graph-cat-1');
  expect(light).to.match(/^#[0-9a-f]{6}$/i);
  const darkBlockMatch = specialistTokens.cssText.match(/@media \(prefers-color-scheme: dark\) \{[\s\S]*?\n {2}\}/);
  expect(darkBlockMatch![0]).to.include('--lr-graph-cat-1:');
  // Independently themeable: overriding the chart bridge alone must not move the graph palette.
  expect(specialistTokens.cssText).to.include('--lr-graph-cat-1: var(--lr-theme-graph-cat-1,');
  expect(specialistTokens.cssText).not.to.include('--lr-graph-cat-1: var(--lr-theme-color-chart-1,');
});

it('keeps chart, graph, and terminal palettes out of the primitive token layer', async () => {
  const base = (await fixture(html`<lr-token-probe></lr-token-probe>`)) as TokenProbe;
  const specialist = (await fixture(
    html`<lr-specialist-token-probe></lr-specialist-token-probe>`,
  )) as SpecialistTokenProbe;
  const names = ['--lr-color-chart-1', '--lr-graph-cat-1', '--lr-terminal-color-red'];
  const baseStyle = getComputedStyle(base);
  const specialistStyle = getComputedStyle(specialist);

  const leaked = names.filter((name) => baseStyle.getPropertyValue(name).trim() !== '');
  expect(leaked.join('\n'), 'specialist tokens parsed by a primitive host').to.equal('');
  const missing = names.filter((name) => specialistStyle.getPropertyValue(name).trim() === '');
  expect(missing.join('\n'), 'specialist tokens absent from an opted-in host').to.equal('');
});

it('keeps every graph-cat-N slot present for both light and dark', () => {
  for (let i = 1; i <= 8; i++) {
    expect(fallbackHex(`--lr-graph-cat-${i}`, 'light')).to.match(/^#[0-9a-f]{6,8}$/i);
    expect(fallbackHex(`--lr-graph-cat-${i}`, 'dark')).to.match(/^#[0-9a-f]{6,8}$/i);
  }
});

it('keeps every standalone light fallback semantic pair at WCAG AA contrast', async () => {
  await expectPaletteContrast('light');
});

it('keeps every standalone dark fallback semantic pair at WCAG AA contrast', async () => {
  await expectPaletteContrast('dark');
});

it('chains filled-content and border tokens through the matching lyra theme-input roles', async () => {
  // Asserted on the RENDERED result, not on the stylesheet text. The chain gained a link when the
  // semantic grid landed -- a flat token now reaches its theme input through its grid slot rather
  // than naming it directly -- and a text assertion would have failed that purely structural change
  // while a broken chain that still *looked* right would have passed.
  // A theme scope: only a scope re-derives the layer from inputs set on it.
  const el = (await fixture(html`<lr-token-probe data-lr-theme-scope></lr-token-probe>`)) as TokenProbe;
  const read = (name: string) => getComputedStyle(el).getPropertyValue(name).trim();
  const cases: Array<[input: string, reaches: string]> = [
    ['--lr-theme-color-surface-border', '--lr-color-border'],
    // The default decorative role has its own independently inherited input.
    ['--lr-theme-color-surface-border-subtle', '--lr-color-border-subtle'],
    ['--lr-theme-color-focus', '--lr-focus-ring-color'],
    ['--lr-theme-color-on-strong-overlay', '--lr-color-on-strong-overlay'],
    // `neutral` belongs here for the same reason as the other four: it declares a real
    // `--lr-theme-color-neutral-on-loud` bridge in both palette modes, and it reaches
    // `--lr-color-on-neutral` through the identical grid slot. Leaving it out meant the one test
    // whose job is to catch that bridge breaking would have stayed green while tooltip, popover,
    // lightbox and the slider's neutral track all lost their themeable foreground.
    ...(['brand', 'success', 'warning', 'danger', 'neutral'] as const).map(
      (tone) => [`--lr-theme-color-${tone}-on-loud`, `--lr-color-on-${tone}`] as [string, string],
    ),
  ];
  const failures: string[] = [];
  for (const [input, reaches] of cases) {
    el.style.setProperty(input, 'rgb(7, 8, 9)');
    if (read(reaches) !== 'rgb(7, 8, 9)') failures.push(`${input} does not reach ${reaches} (got ${read(reaches)})`);
    el.style.removeProperty(input);
  }
  expect(failures.join('\n')).to.equal('');
});

// --- theme.css: the standalone consumer-facing theme-input sheet ---------------------
//
// theme.css is the file a consumer copies to retheme the library, so every token it
// omits is a token they cannot discover. These tests adopt the real sheet into the
// document and assert (a) the documented inputs are all present and (b) importing it
// changes nothing — every bridged token still resolves to the same value it has with no
// theme at all.

let themeSheetPromise: Promise<{ text: string; sheet: CSSStyleSheet }> | undefined;

function loadThemeCss(): Promise<{ text: string; sheet: CSSStyleSheet }> {
  themeSheetPromise ??= fetch(new URL('../theme.css', import.meta.url))
    .then((response) => response.text())
    .then((text) => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(text);
      return { text, sheet };
    });
  return themeSheetPromise;
}

async function withThemeCss<T>(run: () => Promise<T>): Promise<T> {
  const { sheet } = await loadThemeCss();
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  try {
    return await run();
  } finally {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((adopted) => adopted !== sheet);
  }
}

/**
 * Read several tokens off ONE fixture mounted under `themeClass`.
 *
 * A fixture per token is ~200x slower, and — more importantly — reading a whole related set off a
 * single mounted host is what makes "these five values are all different from each other" an
 * assertion about one real rendered element rather than about five unrelated ones.
 */
async function probeVarsUnder(themeClass: string, names: readonly string[]): Promise<Map<string, string>> {
  const specialist = needsSpecialistTokens(names);
  const wrapper = (await fixture(
    specialist
      ? html`<div class=${themeClass}><lr-specialist-token-probe></lr-specialist-token-probe></div>`
      : html`<div class=${themeClass}><lr-token-probe></lr-token-probe></div>`,
  )) as HTMLElement;
  const probe = wrapper.querySelector(
    specialist ? tag('specialist-token-probe') : tag('token-probe'),
  ) as TokenProbe | SpecialistTokenProbe;
  await probe.updateComplete;
  const computed = getComputedStyle(probe);
  return new Map(names.map((name) => [name, squash(computed.getPropertyValue(name))]));
}

async function probeVarUnder(themeClass: string, name: string): Promise<string> {
  const specialist = needsSpecialistTokens([name]);
  const wrapper = (await fixture(
    specialist
      ? html`<div class=${themeClass}><lr-specialist-token-probe></lr-specialist-token-probe></div>`
      : html`<div class=${themeClass}><lr-token-probe></lr-token-probe></div>`,
  )) as HTMLElement;
  const probe = wrapper.querySelector(
    specialist ? tag('specialist-token-probe') : tag('token-probe'),
  ) as TokenProbe | SpecialistTokenProbe;
  await probe.updateComplete;
  return getComputedStyle(probe).getPropertyValue(name).trim();
}

function bridgedThemeInputs(): string[] {
  const layers = `${tokens.cssText}\n${palette.cssText}\n${specialistTokens.cssText}`;
  return [...new Set([...layers.matchAll(/var\((--lr-theme-[\w-]+)/g)].map((match) => match[1]!))].sort();
}

// Optional row minimums remain unset so native tables keep content-driven sizing by default.
const OPTIONAL_THEME_INPUTS: readonly string[] = ['--lr-theme-table-row-height'];

it('declares every bridged theme input in theme.css', async () => {
  const { text } = await loadThemeCss();
  const missing = bridgedThemeInputs().filter(
    (name) => !OPTIONAL_THEME_INPUTS.includes(name) && !new RegExp(`^\\s*${name}:`, 'm').test(text),
  );
  expect(missing.join('\n')).to.equal('');
});

it('keeps the default decorative boundary independent until its own input is overridden', async () => {
  await withThemeCss(async () => {
    const wrapper = await fixture<HTMLElement>(html`<div data-lr-theme-scope style="--lr-theme-color-surface-border: #123456"><lr-token-probe></lr-token-probe></div>`);
    const probe = wrapper.querySelector('lr-token-probe')!;
    expect(resolvedColor(probe, '--lr-color-border')).to.deep.equal([18, 52, 86]);
    expect(resolvedColor(probe, '--lr-color-border-subtle')).to.deep.equal([229, 229, 229]);
    wrapper.style.setProperty('--lr-theme-color-surface-border', '#654321');
    expect(resolvedColor(probe, '--lr-color-border')).to.deep.equal([101, 67, 33]);
    expect(resolvedColor(probe, '--lr-color-border-subtle')).to.deep.equal([229, 229, 229]);
    wrapper.style.setProperty('--lr-theme-color-surface-border-subtle', '#abcdef');
    expect(resolvedColor(probe, '--lr-color-border-subtle')).to.deep.equal([171, 205, 239]);
  });
});

it('names only theme inputs that a component token layer actually reads', async () => {
  const { text } = await loadThemeCss();
  const declared = [...text.matchAll(/^\s*(--lr-theme-[\w-]+):/gm)].map((match) => match[1]);
  // Every shipped component token layer counts. The semantic grid's 45 inputs are read by
  // `palette`, visualization and terminal inputs by the opt-in specialist layer, and the
  // form-control height/radius ladder by the shared control-sizing layers -- `sizes` paints the
  // ladder itself and `contextualSizes` re-reads it for the density-scoped variants.
  const utilityResponse = await fetch(new URL('../styles/utilities.css', import.meta.url));
  expect(utilityResponse.ok).to.equal(true);
  const read = [tokens, palette, specialistTokens, sizes, contextualSizes, glassSurface('[part="probe"]', css`var(--lr-color-surface-overlay)`)]
    .map((sheet) => sheet.cssText)
    .join('\n');
  const consumers = read + await utilityResponse.text();
  // The runtime exposes the requested accent seed independently of its derived palette.
  const unused = declared.filter((name) => name !== '--lr-theme-accent' && !consumers.includes(`var(${name},`));
  expect(unused.join('\n')).to.equal('');
});

it('keeps the neutral Shadcn interaction-mix partner in both modes', async () => {
  await withThemeCss(async () => {
    expect(await probeVarUnder('lr-light', '--lr-color-mix-partner')).to.equal('#737373');
    expect(await probeVarUnder('lr-dark', '--lr-color-mix-partner')).to.equal('#737373');
  });
});

it('leaves every bridged token at its built-in value when theme.css is imported', async () => {
  // The chart and terminal entries below are SPOT SAMPLES of two generated ramps
  // (scripts/generate-chart-palette.mjs, scripts/generate-terminal-palette.mjs). Both generators
  // write theme.css AND specialist-tokens.styles.ts's fallbacks in one pass, which is what actually
  // prevents the drift this test detects; regenerating the ramp therefore means updating these
  // four values from the generator's output, not hand-picking new ones.
  const expected: Array<[name: string, value: string]> = [
    ['--lr-icon-button-size', '2.25rem'],
    ['--lr-focus-ring-offset', '0px'],
    ['--lr-color-surface', '#ffffff'],
    ['--lr-color-surface-raised', '#fafafa'],
    ['--lr-color-overlay', 'rgb(0 0 0 / 0.5)'],
    // The strong overlay must not collapse onto the plain one: both once shared a single
    // --lr-theme-color-overlay input, so defining that input flattened 0.92 down to 0.5.
    ['--lr-color-overlay-strong', 'rgb(0 0 0 / 0.92)'],
    ['--lr-font-size-2xs', '0.625rem'],
    ['--lr-font-size-sm', '0.8125rem'],
    ['--lr-font-size-md-sm', '0.875rem'],
    ['--lr-font-size-3xl', '2rem'],
    ['--lr-space-2xs', '0.125rem'],
    ['--lr-space-m', '0.75rem'],
    ['--lr-space-2xl', '2rem'],
    ['--lr-layer-base', '0'],
    ['--lr-layer-dropdown', '900'],
    ['--lr-layer-toast', '9999'],
    ['--lr-color-chart-1', '#0e006e'],
    ['--lr-color-chart-8', '#8f81d3'],
    ['--lr-terminal-color-red', '#901114'],
    ['--lr-terminal-color-bright-white', '#6c6c6c'],
    // The background ramp is generated in the same pass and drifts the same way, so it needs its
    // own samples; the foreground entries above cannot detect a background gone stale.
    ['--lr-terminal-bg-red', '#d2918a'],
    ['--lr-terminal-bg-bright-white', '#d1d1d1'],
    // Elevation, sampled at both ends. A custom property's computed value is its token stream after
    // var() substitution, not a box-shadow serialization, so the shadow COLOUR appears here already
    // resolved from the --lr-shadow-color triplet.
    ['--lr-shadow-xs', '0 1px 2px 0 rgb(0 0 0 / 0.05)'],
    ['--lr-shadow-xl', '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'],
  ];
  await withThemeCss(async () => {
    expect(resolvedPx(await nestedProbe(), '--lr-focus-ring-width')).to.equal(3);
    const failures: string[] = [];
    for (const [name, value] of expected) {
      const actual = await probeVarUnder('lr-light', name);
      if (actual !== value) failures.push(`${name}: ${actual} !== ${value}`);
    }
    expect(failures.join('\n')).to.equal('');
  });
});

it('mirrors every dark-mode fallback value in theme.css .lr-dark', async () => {
  await withThemeCss(async () => {
    // .lr-dark must not disagree with the prefers-color-scheme: dark fallback blocks in the base
    // and specialist token sheets — a raised surface or chart series left at its light value on a
    // dark page is the visible symptom.
    expect(await probeVarUnder('lr-dark', '--lr-color-surface')).to.equal('#0a0a0a');
    expect(await probeVarUnder('lr-dark', '--lr-color-surface-raised')).to.equal('#171717');
    expect(await probeVarUnder('lr-dark', '--lr-color-chart-1')).to.equal('#bbff94');
    expect(await probeVarUnder('lr-dark', '--lr-color-chart-8')).to.equal('#555de3');
  });
});

it('keeps both default boundary roles when theme.css is imported', async () => {
  await withThemeCss(async () => {
    for (const [themeClass, border, subtle] of [
      ['lr-light', '#919191', '#e5e5e5'],
      ['lr-dark', '#646464', 'rgb(255 255 255 / 0.1)'],
    ] as const) {
      const values = await probeVarsUnder(themeClass, BORDER_TIERS);
      expect(values.get('--lr-color-border'), themeClass).to.equal(border);
      expect(values.get('--lr-color-border-subtle'), themeClass).to.equal(subtle);
    }
  });
});

it('changes no bridged token value anywhere when theme.css is imported', async () => {
  // Exhaustive counterpart to the curated list above: every --lr-* token declared in either
  // opt-in level's light :host block must resolve identically with and without theme.css.
  const hostTokenNames = (cssText: string, label: string): string[] => {
    const hostBlock = /:host\s*{([\s\S]*?)\n {2}}/.exec(cssText)?.[1];
    if (hostBlock === undefined) throw new Error(`expected the ${label} :host token block to be parsed`);
    return [...hostBlock.matchAll(/^\s*(--lr-[\w-]+):/gm)].map((match) => match[1]!);
  };
  const names = [
    ...hostTokenNames(tokens.cssText, 'base'),
    ...hostTokenNames(specialistTokens.cssText, 'specialist'),
  ];
  expect(names.length, 'expected the :host token block to be parsed').to.be.greaterThan(100);

  const normalize = (value: string) =>
    value
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/#([0-9a-f])([0-9a-f])([0-9a-f])\b/gi, '#$1$1$2$2$3$3')
      .toLowerCase();

  // One fixture per phase, read for every token — a fixture per token is ~200x slower.
  async function snapshot(): Promise<Map<string, string>> {
    const wrapper = (await fixture(
      html`<div class="lr-light"><lr-specialist-token-probe></lr-specialist-token-probe></div>`,
    )) as HTMLElement;
    const probe = wrapper.querySelector(tag('specialist-token-probe')) as SpecialistTokenProbe;
    await probe.updateComplete;
    const computed = getComputedStyle(probe);
    return new Map(names.map((name) => {
      const value = normalize(computed.getPropertyValue(name));
      // The optional alias and concrete startup input may serialize differently while painting
      // the same channels and alpha. Other token streams retain their exact parity assertion.
      return [name, name === '--lr-color-border-subtle' ? JSON.stringify(toRgba(value)) : value];
    }));
  }

  const baseline = await snapshot();
  const themed = await withThemeCss(snapshot);
  const failures = names.flatMap((name) =>
    themed.get(name) === baseline.get(name) ? [] : [`${name}: ${themed.get(name)} !== ${baseline.get(name)}`],
  );
  expect(failures.join('\n')).to.equal('');
});

// --- elevation ------------------------------------------------------------------------
//
// One shadow token served the whole library, so a chip, a menu and a dialog all sat at the same
// depth and elevation carried no information. Five steps only mean anything while they stay five
// DIFFERENT values, which is a rendered-result question: each step chains through its own
// --lr-theme-shadow-* input and a shared --lr-shadow-color triplet, and a broken link anywhere in
// that chain collapses a step to the empty string — invisibly to every other gate.

const ELEVATION_TOKENS = ELEVATION_STEPS.map((step) => `--lr-shadow-${step}`);

it('resolves the elevation scale to five distinct, non-empty steps', async () => {
  const values = await probeVarsUnder('lr-light', ELEVATION_TOKENS);
  const resolved = ELEVATION_TOKENS.map((name) => values.get(name)!);

  const empty = ELEVATION_TOKENS.filter((name) => values.get(name) === '');
  expect(empty.join('\n'), 'elevation steps that resolve to nothing').to.equal('');
  expect(new Set(resolved).size, `collapsed elevation steps: ${resolved.join(' | ')}`).to.equal(
    ELEVATION_TOKENS.length,
  );

  // --lr-shadow is the alias every pre-8.0.0 site still uses; it must stay the mid step.
  const alias = await probeVarsUnder('lr-light', ['--lr-shadow', '--lr-shadow-m']);
  expect(alias.get('--lr-shadow'), 'the --lr-shadow alias must resolve to a real value').to.not.equal('');
  expect(alias.get('--lr-shadow')).to.equal(alias.get('--lr-shadow-m'));
});

it('keeps the elevation scale distinct, and visibly heavier than light, under a dark ancestor', async () => {
  await withThemeCss(async () => {
    const dark = await probeVarsUnder('lr-dark', ELEVATION_TOKENS);
    const light = await probeVarsUnder('lr-light', ELEVATION_TOKENS);
    const resolved = ELEVATION_TOKENS.map((name) => dark.get(name)!);

    const empty = ELEVATION_TOKENS.filter((name) => dark.get(name) === '');
    expect(empty.join('\n'), 'dark elevation steps that resolve to nothing').to.equal('');
    expect(new Set(resolved).size, `collapsed dark elevation steps: ${resolved.join(' | ')}`).to.equal(
      ELEVATION_TOKENS.length,
    );

    // Proves the dark ancestor actually reached the host. A step left at its light value would
    // satisfy the distinctness check above while rendering a shadow nobody can see on a dark page.
    const unchanged = ELEVATION_TOKENS.filter((name) => dark.get(name) === light.get(name));
    expect(unchanged.join('\n'), 'elevation steps that did not darken').to.equal('');
  });
});

// --- terminal palette, dark mode ------------------------------------------------------
//
// The 16-colour ANSI ramp once existed only in the light block, so a dark terminal drew light-mode
// colours on a near-black panel. `black` and `white` also shared one hex per mode, which made
// `ESC[30;47m` — black on white — text painted in its own background colour.

it('resolves the terminal ramp to its dark values under a dark ancestor', async () => {
  const sample = ['black', 'white', 'red', 'green', 'blue', 'bright-white'].map(
    (slot) => `--lr-terminal-color-${slot}`,
  );
  await withThemeCss(async () => {
    const dark = await probeVarsUnder('lr-dark', sample);
    const light = await probeVarsUnder('lr-light', sample);

    const empty = sample.filter((name) => dark.get(name) === '');
    expect(empty.join('\n'), 'terminal slots that resolve to nothing in dark').to.equal('');
    // Compared at runtime rather than against hardcoded hexes, so regenerating the ramp
    // (scripts/generate-terminal-palette.mjs) cannot make this test lie.
    const stuck = sample.filter((name) => dark.get(name) === light.get(name));
    expect(stuck.join('\n'), 'terminal slots still showing their light value under .lr-dark').to.equal('');
  });
});

it('keeps terminal black and white apart in both modes, and backgrounds off the foreground ramp', async () => {
  const names = [
    '--lr-terminal-color-black',
    '--lr-terminal-color-white',
    '--lr-terminal-bg-black',
    '--lr-terminal-bg-white',
  ];
  await withThemeCss(async () => {
    const failures: string[] = [];
    for (const mode of ['lr-light', 'lr-dark']) {
      const values = await probeVarsUnder(mode, names);
      const [foregroundBlack, foregroundWhite, backgroundBlack, backgroundWhite] = names.map((n) => values.get(n)!);
      // ESC[30;47m: black text on a white cell. One shared hex per slot made that invisible.
      if (foregroundBlack === foregroundWhite) {
        failures.push(`${mode}: terminal black and white foregrounds are both ${foregroundBlack}`);
      }
      // The background ramp is generated separately so a cell never matches the glyph drawn on it.
      if (backgroundBlack === foregroundBlack) {
        failures.push(`${mode}: bg-black equals color-black (${backgroundBlack})`);
      }
      if (backgroundWhite === foregroundWhite) {
        failures.push(`${mode}: bg-white equals color-white (${backgroundWhite})`);
      }
    }
    expect(failures.join('\n')).to.equal('');
  });
});

// --- data-lr-theme switches the WHOLE token surface, not half of it -------------------
//
// Three layers carry mode-dependent values: `palette` (the 45-slot semantic grid), `tokens`
// (surface / text / border / overlay / shadow), and the opt-in `specialistTokens` (chart / graph /
// terminal). A mode signal honoured by one and ignored by another renders a MIXED state -- a light
// colour grid or chart ramp on dark surfaces, or the reverse -- and no such combination was ever
// contrast-checked. All three layers must answer to the same signal, in both directions.
//
// The OS colour scheme is emulated for real (test/wtr-media.ts `setColorScheme`), so the media
// rules that ship decide, and every assertion reads a computed value off a mounted host.

/** One token from each layer, plus a second base-token entry so a partial fix cannot pass. */
const MODE_SWITCHED_TOKENS = [
  '--lr-color-surface', // document layer, base family
  '--lr-color-text', // document layer, base family
  '--lr-color-brand-fill-loud', // document layer, semantic grid
  '--lr-color-chart-1', // per-host specialist palette, on the inherited switches
] as const;

async function probeUnderScheme(
  prefersDark: boolean,
  themeAttribute?: 'light' | 'dark',
): Promise<Map<string, string>> {
  const el = (await fixture(
    themeAttribute === undefined
      ? html`<lr-specialist-token-probe></lr-specialist-token-probe>`
      : html`<lr-specialist-token-probe data-lr-theme=${themeAttribute}></lr-specialist-token-probe>`,
  )) as SpecialistTokenProbe;
  await el.updateComplete;
  await setColorScheme(prefersDark ? 'dark' : 'light');
  try {
    const computed = getComputedStyle(el);
    return new Map(MODE_SWITCHED_TOKENS.map((name) => [name, squash(computed.getPropertyValue(name))]));
  } finally {
    await setColorScheme('no-preference');
  }
}

it('moves all token layers together when the OS scheme alone decides the mode', async () => {
  // Guards the two tests below from passing vacuously: if forcing the media condition stopped
  // moving anything, "the override held" would be indistinguishable from "nothing ever changes".
  const light = await probeUnderScheme(false);
  const dark = await probeUnderScheme(true);
  const stuck = MODE_SWITCHED_TOKENS.filter((name) => dark.get(name) === light.get(name));
  expect(stuck.join('\n'), 'tokens that did not move under a forced dark scheme').to.equal('');
});

it('honours data-lr-theme="light" in every token layer on a dark-scheme OS', async () => {
  const light = await probeUnderScheme(false);
  const overridden = await probeUnderScheme(true, 'light');
  const failures = MODE_SWITCHED_TOKENS.flatMap((name) =>
    overridden.get(name) === light.get(name) ? [] : [`${name}: ${overridden.get(name)} !== ${light.get(name)}`],
  );
  expect(failures.join('\n'), 'still rendering dark values under data-lr-theme="light"').to.equal('');
});

it('honours data-lr-theme="dark" in every token layer on a light-scheme OS', async () => {
  const light = await probeUnderScheme(false);
  const osDark = await probeUnderScheme(true);
  const overridden = await probeUnderScheme(false, 'dark');

  const stuck = MODE_SWITCHED_TOKENS.filter((name) => overridden.get(name) === light.get(name));
  expect(stuck.join('\n'), 'still rendering light values under data-lr-theme="dark"').to.equal('');
  // The attribute route and the media route must agree on the same dark values, or "dark" means
  // two different palettes depending on how it was asked for.
  const disagree = MODE_SWITCHED_TOKENS.flatMap((name) =>
    overridden.get(name) === osDark.get(name) ? [] : [`${name}: ${overridden.get(name)} !== ${osDark.get(name)}`],
  );
  expect(disagree.join('\n'), 'the attribute route and the OS route disagree').to.equal('');
});
