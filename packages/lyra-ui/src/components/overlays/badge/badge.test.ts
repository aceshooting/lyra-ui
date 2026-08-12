import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './badge.js';
import './tag.js';
import type { LyraBadge } from './badge.js';

const TRANSPARENT = 'rgba(0, 0, 0, 0)';

/** Resolves a `--lr-*` token to the same concrete computed string `getComputedStyle` reports for a
 *  rendered element, by applying it to `property` on a throwaway probe inside the badge's own light
 *  DOM. Custom properties inherit into slotted children, so the probe sees the identical token
 *  cascade the shadow tree does. Reading the custom property directly would not work: an
 *  unregistered custom property computes to its substituted token text (`0.375rem`), never to the
 *  used value the matching layout/paint property reports (`6px`).
 */
function resolved(host: HTMLElement, property: string, token: string): string {
  const probe = document.createElement('span');
  probe.style.setProperty(property, `var(${token})`);
  host.append(probe);
  const value = getComputedStyle(probe).getPropertyValue(property);
  probe.remove();
  return value;
}

const resolvedColor = (host: HTMLElement, property: 'background-color' | 'color', token: string): string =>
  resolved(host, property, token);

function base(el: HTMLElement): HTMLElement {
  return el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
}

it('renders a themed badge and tag alias', async () => {
  const el = await fixture(html`<div><lr-badge variant="success">Ready</lr-badge><lr-tag>Tag</lr-tag></div>`);
  expect(el.querySelector('lr-badge')?.textContent).to.contain('Ready');
  expect(el.querySelectorAll('lr-tag').length).to.equal(1);
  await expect(el.querySelector('lr-badge')!).to.be.accessible();
});

it('defaults size to "m" and offers the same 2xs-xl scale as its sibling lr-chip', async () => {
  const el = (await fixture(html`<lr-badge>Default</lr-badge>`)) as LyraBadge;
  expect(el.size).to.equal('m');
  expect(getComputedStyle(el).getPropertyValue('--lr-badge-font-size').trim()).to.equal(
    getComputedStyle(el).getPropertyValue('--lr-font-size-sm').trim(),
  );
});

it('resizes the badge surface when size is set to a smaller or larger tier', async () => {
  const small = (await fixture(html`<lr-badge size="2xs">S</lr-badge>`)) as LyraBadge;
  const large = (await fixture(html`<lr-badge size="xl">L</lr-badge>`)) as LyraBadge;
  expect(parseFloat(getComputedStyle(base(small)).fontSize)).to.be.lessThan(
    parseFloat(getComputedStyle(base(large)).fontSize),
  );
  expect(parseFloat(getComputedStyle(base(small)).minBlockSize)).to.be.lessThan(
    parseFloat(getComputedStyle(base(large)).minBlockSize),
  );
});

// -- pill / corner radius ----------------------------------------------------

describe('pill', () => {
  it('renders a rounded rectangle by default, not a pill', async () => {
    const el = (await fixture(html`<lr-badge>Go</lr-badge>`)) as LyraBadge;
    expect(el.pill).to.be.false;
    expect(el.hasAttribute('pill')).to.be.false;
    // --lr-radius (the shared rounded-rectangle token) rather than --lr-radius-pill.
    expect(getComputedStyle(base(el)).borderRadius).to.equal(resolved(el, 'border-radius', '--lr-radius'));
    expect(getComputedStyle(base(el)).borderRadius).to.not.equal(
      resolved(el, 'border-radius', '--lr-radius-pill'),
    );
  });

  it('renders fully-rounded ends when pill is set, and reflects the attribute', async () => {
    const el = (await fixture(html`<lr-badge pill>Go</lr-badge>`)) as LyraBadge;
    expect(el.pill).to.be.true;
    expect(getComputedStyle(base(el)).borderRadius).to.equal(resolved(el, 'border-radius', '--lr-radius-pill'));

    el.pill = false;
    await el.updateComplete;
    expect(el.hasAttribute('pill')).to.be.false;
    expect(getComputedStyle(base(el)).borderRadius).to.equal(resolved(el, 'border-radius', '--lr-radius'));
  });

  it('carries pill through to lr-tag', async () => {
    const el = (await fixture(html`<lr-tag pill>Go</lr-tag>`)) as LyraBadge;
    expect(getComputedStyle(base(el)).borderRadius).to.equal(resolved(el, 'border-radius', '--lr-radius-pill'));
  });

  it('retunes the corner radius via --lr-badge-radius with no ::part(base) rule', async () => {
    const el = (await fixture(html`<lr-badge pill>Go</lr-badge>`)) as LyraBadge;
    el.style.setProperty('--lr-badge-radius', '3px');
    await el.updateComplete;
    expect(getComputedStyle(base(el)).borderRadius).to.equal('3px');
  });
});

// -- appearance --------------------------------------------------------------

describe('appearance', () => {
  it('defaults to filled-outlined, reproducing the tint/loud-border/loud-text treatment', async () => {
    const el = (await fixture(html`<lr-badge variant="brand">Brand</lr-badge>`)) as LyraBadge;
    expect(el.appearance).to.equal('filled-outlined');
    expect(el.getAttribute('appearance')).to.equal('filled-outlined');
    const surface = getComputedStyle(base(el));
    expect(surface.backgroundColor).to.equal(
      resolvedColor(el, 'background-color', '--lr-color-brand-quiet'),
    );
    expect(surface.borderTopColor).to.equal(resolvedColor(el, 'color', '--lr-color-brand'));
    expect(surface.color).to.equal(resolvedColor(el, 'color', '--lr-color-brand'));
  });

  it('keeps the neutral default on surface/border/text tokens', async () => {
    const el = (await fixture(html`<lr-badge>Neutral</lr-badge>`)) as LyraBadge;
    const surface = getComputedStyle(base(el));
    expect(surface.backgroundColor).to.equal(resolvedColor(el, 'background-color', '--lr-color-surface'));
    expect(surface.borderTopColor).to.equal(resolvedColor(el, 'color', '--lr-color-border'));
    expect(surface.color).to.equal(resolvedColor(el, 'color', '--lr-color-text'));
  });

  it('fills solidly with on-loud text for appearance="accent"', async () => {
    const el = (await fixture(html`<lr-badge variant="brand" appearance="accent">Brand</lr-badge>`)) as LyraBadge;
    const surface = getComputedStyle(base(el));
    expect(surface.backgroundColor).to.equal(resolvedColor(el, 'background-color', '--lr-color-brand'));
    expect(surface.color).to.equal(resolvedColor(el, 'color', '--lr-color-on-brand'));
  });

  it('drops the border for appearance="filled" and the fill for appearance="outlined"', async () => {
    const filled = (await fixture(html`<lr-badge variant="brand" appearance="filled">B</lr-badge>`)) as LyraBadge;
    expect(getComputedStyle(base(filled)).borderTopColor).to.equal(TRANSPARENT);
    expect(getComputedStyle(base(filled)).backgroundColor).to.equal(
      resolvedColor(filled, 'background-color', '--lr-color-brand-quiet'),
    );

    const outlined = (await fixture(html`<lr-badge variant="brand" appearance="outlined">B</lr-badge>`)) as LyraBadge;
    expect(getComputedStyle(base(outlined)).backgroundColor).to.equal(TRANSPARENT);
    expect(getComputedStyle(base(outlined)).borderTopColor).to.equal(
      resolvedColor(outlined, 'color', '--lr-color-brand'),
    );
  });

  it('drops both fill and border for appearance="plain" while keeping the label color', async () => {
    const el = (await fixture(html`<lr-badge variant="danger" appearance="plain">D</lr-badge>`)) as LyraBadge;
    const surface = getComputedStyle(base(el));
    expect(surface.backgroundColor).to.equal(TRANSPARENT);
    expect(surface.borderTopColor).to.equal(TRANSPARENT);
    expect(surface.color).to.equal(resolvedColor(el, 'color', '--lr-color-danger'));
    // The border box is preserved (transparent, not removed) so switching appearance never
    // shifts the badge's layout size.
    expect(parseFloat(surface.borderTopWidth)).to.be.greaterThan(0);
  });

  it('still lets --lr-badge-background/-border/-color override any appearance', async () => {
    const el = (await fixture(html`<lr-badge appearance="accent">Custom</lr-badge>`)) as LyraBadge;
    el.style.setProperty('--lr-badge-background', 'rgb(1, 2, 3)');
    el.style.setProperty('--lr-badge-border', 'rgb(4, 5, 6)');
    el.style.setProperty('--lr-badge-color', 'rgb(7, 8, 9)');
    await el.updateComplete;
    const surface = getComputedStyle(base(el));
    expect(surface.backgroundColor).to.equal('rgb(1, 2, 3)');
    expect(surface.borderTopColor).to.equal('rgb(4, 5, 6)');
    expect(surface.color).to.equal('rgb(7, 8, 9)');
  });

  it('applies to lr-tag on the same vocabulary', async () => {
    const el = (await fixture(html`<lr-tag variant="success" appearance="accent">T</lr-tag>`)) as LyraBadge;
    expect(getComputedStyle(base(el)).backgroundColor).to.equal(
      resolvedColor(el, 'background-color', '--lr-color-success'),
    );
  });
});

// -- attention ---------------------------------------------------------------

describe('attention', () => {
  const prefersReduced = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Every `@media (prefers-reduced-motion: reduce)` style rule, from every stylesheet the
   *  component actually adopted, that applies to the rendered element. Reading the live CSSOM
   *  (rather than substring-matching the exported source) proves the rule parsed, that its
   *  selector really matches the element, and that the declaration survived -- an invalid
   *  selector or declaration is dropped by the parser and simply never shows up here. */
  function reducedMotionRulesFor(el: HTMLElement, target: HTMLElement): CSSStyleRule[] {
    const found: CSSStyleRule[] = [];
    for (const sheet of el.shadowRoot!.adoptedStyleSheets) {
      for (const rule of Array.from(sheet.cssRules)) {
        if (!(rule instanceof CSSMediaRule)) continue;
        if (!rule.conditionText.includes('prefers-reduced-motion: reduce')) continue;
        for (const inner of Array.from(rule.cssRules)) {
          if (inner instanceof CSSStyleRule && target.matches(inner.selectorText)) found.push(inner);
        }
      }
    }
    return found;
  }

  it('defaults to "none" and animates nothing', async () => {
    const el = (await fixture(html`<lr-badge>Quiet</lr-badge>`)) as LyraBadge;
    expect(el.attention).to.equal('none');
    expect(getComputedStyle(base(el)).animationName).to.equal('none');
  });

  it('runs an infinite pulse for attention="pulse" (full-motion branch)', async function () {
    if (prefersReduced()) this.skip();
    const el = (await fixture(html`<lr-badge attention="pulse">New</lr-badge>`)) as LyraBadge;
    const animation = getComputedStyle(base(el));
    expect(animation.animationName).to.not.equal('none');
    expect(animation.animationIterationCount).to.equal('infinite');
    expect(animation.animationDuration).to.equal(
      resolved(el, 'animation-duration', '--lr-badge-attention-duration'),
    );
  });

  it('runs an infinite bounce for attention="bounce" (full-motion branch)', async function () {
    if (prefersReduced()) this.skip();
    const el = (await fixture(html`<lr-badge attention="bounce">New</lr-badge>`)) as LyraBadge;
    const animation = getComputedStyle(base(el));
    expect(animation.animationName).to.not.equal('none');
    expect(animation.animationIterationCount).to.equal('infinite');
  });

  it('stops the attention animation entirely under prefers-reduced-motion: reduce', async () => {
    const el = (await fixture(html`<lr-badge attention="pulse">New</lr-badge>`)) as LyraBadge;

    if (prefersReduced()) {
      // The runner is already in the reduced branch, so assert the rendered result directly.
      expect(getComputedStyle(base(el)).animationName).to.equal('none');
      return;
    }
    // Otherwise assert the live CSSOM rule that governs the reduced branch: a real, parsed,
    // matching rule that hard-stops the animation. Chromium under @web/test-runner cannot be
    // switched into the reduced branch from inside the page, and this proves more than a
    // stylesheet substring match would.
    const killSwitch = reducedMotionRulesFor(el, base(el)).filter(
      (rule) =>
        rule.style.getPropertyValue('animation-name') === 'none' &&
        rule.style.getPropertyPriority('animation-name') === 'important',
    );
    expect(killSwitch.length, 'a matching reduced-motion rule must set animation: none !important').to.be.greaterThan(0);
  });

  it('carries attention through to lr-tag', async function () {
    if (prefersReduced()) this.skip();
    const el = (await fixture(html`<lr-tag attention="pulse">New</lr-tag>`)) as LyraBadge;
    expect(getComputedStyle(base(el)).animationName).to.not.equal('none');
  });
});

it('supports the mapped pulse boolean and --pulse-color hook', async () => {
  const el = (await fixture(html`
    <lr-badge pulse style="--pulse-color: rgb(1, 2, 3)">New</lr-badge>
  `)) as LyraBadge;
  expect(el.pulse).to.be.true;
  expect(el.hasAttribute('pulse')).to.be.true;
  expect(resolved(el, 'color', '--lr-badge-pulse-color')).to.equal('rgb(1, 2, 3)');
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    expect(getComputedStyle(base(el)).animationName).to.equal('lr-badge-pulse');
  }
});

// -- start/end slots ---------------------------------------------------------

describe('start and end slots', () => {
  it('collapses both wrappers when nothing is slotted', async () => {
    const el = (await fixture(html`<lr-badge>Only</lr-badge>`)) as LyraBadge;
    const start = el.shadowRoot!.querySelector('[part="start"]') as HTMLElement;
    const end = el.shadowRoot!.querySelector('[part="end"]') as HTMLElement;
    expect(start.hidden).to.be.true;
    expect(end.hidden).to.be.true;
    expect(getComputedStyle(start).display).to.equal('none');
    expect(getComputedStyle(end).display).to.equal('none');
  });

  it('reveals each wrapper as soon as content is assigned to it', async () => {
    const el = (await fixture(html`
      <lr-badge><span slot="start">*</span>Label<span slot="end">!</span></lr-badge>
    `)) as LyraBadge;
    const start = el.shadowRoot!.querySelector('[part="start"]') as HTMLElement;
    const end = el.shadowRoot!.querySelector('[part="end"]') as HTMLElement;
    expect(start.hidden).to.be.false;
    expect(end.hidden).to.be.false;
    expect(getComputedStyle(start).display).to.not.equal('none');
  });

  it('updates the wrappers on a later slotchange', async () => {
    const el = (await fixture(html`<lr-badge>Label</lr-badge>`)) as LyraBadge;
    const startHidden = (): boolean =>
      (el.shadowRoot!.querySelector('[part="start"]') as HTMLElement).hidden;

    const icon = document.createElement('span');
    icon.slot = 'start';
    icon.textContent = '*';
    el.append(icon);
    // `slotchange` lands on its own microtask checkpoint, which can trail the update this tick
    // already had in flight -- poll the rendered result rather than assuming one await is enough.
    await waitUntil(() => !startHidden(), 'the start wrapper must reveal itself on slotchange');
    expect(startHidden()).to.be.false;

    icon.remove();
    await waitUntil(startHidden, 'the start wrapper must collapse again once emptied');
    expect(startHidden()).to.be.true;
  });

  it('keeps the default slot content inside its own content part', async () => {
    const el = (await fixture(html`<lr-badge>Label</lr-badge>`)) as LyraBadge;
    const content = el.shadowRoot!.querySelector('[part="content"]') as HTMLElement;
    expect(content.querySelectorAll('slot:not([name])').length).to.equal(1);
  });

  it('truncates a long label inside a narrow allocation without overflowing it', async () => {
    const host = (await fixture(html`
      <div style="inline-size: 160px">
        <lr-badge><span slot="start">*</span>A deliberately very long badge label</lr-badge>
      </div>
    `)) as HTMLElement;
    const el = host.querySelector('lr-badge') as LyraBadge;
    const content = el.shadowRoot!.querySelector('[part="content"]') as HTMLElement;
    expect(content.scrollWidth).to.be.greaterThan(content.clientWidth);
    expect(base(el).getBoundingClientRect().width).to.be.at.most(
      host.getBoundingClientRect().width + 1,
    );
    // The start wrapper must survive the squeeze rather than being the thing that collapses.
    expect((el.shadowRoot!.querySelector('[part="start"]') as HTMLElement).getBoundingClientRect().width)
      .to.be.greaterThan(0);
  });

  it('is accessible with start/end content and an attention animation', async () => {
    const el = (await fixture(html`
      <lr-badge variant="warning" attention="pulse" appearance="accent">
        <span slot="start" aria-hidden="true">*</span>3 alerts<span slot="end" aria-hidden="true">!</span>
      </lr-badge>
    `)) as LyraBadge;
    expect((el.shadowRoot!.querySelector('[part="start"]') as HTMLElement).hidden).to.be.false;
    await expect(el).to.be.accessible();
  });
});

// -- unset regression --------------------------------------------------------

it('leaves the committed badge output unchanged when none of the new properties are set', async () => {
  const el = (await fixture(html`<lr-badge variant="success">Ready</lr-badge>`)) as LyraBadge;
  expect(el.pill).to.be.false;
  expect(el.attention).to.equal('none');
  expect(el.appearance).to.equal('filled-outlined');
  expect(el.shadowRoot!.querySelectorAll('[part~="remove-button"]').length).to.equal(0);
  expect((el.shadowRoot!.querySelector('[part="start"]') as HTMLElement).hidden).to.be.true;
  expect((el.shadowRoot!.querySelector('[part="end"]') as HTMLElement).hidden).to.be.true;
  const surface = getComputedStyle(base(el));
  expect(surface.backgroundColor).to.equal(resolvedColor(el, 'background-color', '--lr-color-success-quiet'));
  expect(surface.borderTopColor).to.equal(resolvedColor(el, 'color', '--lr-color-success'));
  expect(surface.color).to.equal(resolvedColor(el, 'color', '--lr-color-success'));
  expect(surface.animationName).to.equal('none');
});

it('never renders a remove button on lr-badge, even with the tag-only attribute present', async () => {
  const el = (await fixture(html`<lr-badge with-remove>Ready</lr-badge>`)) as LyraBadge;
  expect(el.shadowRoot!.querySelectorAll('button').length).to.equal(0);
});

// -- quiet-tier fill across light and dark mode -------------------------------

/** WCAG relative luminance of a computed `rgb()`/`rgba()` string, so "is this actually the dark
 *  tier?" is asserted on the rendered colour rather than on a memorised hex value that a legitimate
 *  ramp regeneration would churn. */
function relativeLuminance(color: string): number {
  const channels = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/u.exec(color);
  if (!channels) throw new Error(`unparseable computed colour: ${color}`);
  const [r, g, b] = [1, 2, 3].map((index) => {
    const channel = Number(channels[index]) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe('quiet-tier fill in dark mode', () => {
  // The badge never names a variant colour itself: variant="warning" re-points the shared
  // --lr-color-fill-quiet slot, which the semantic grid resolves per mode. Asserting the RENDERED
  // background is what proves the chain has no light-mode literal baked into it anywhere -- reading
  // the stylesheet text would pass just as happily on a hardcoded value.
  const QUIET_VARIANTS = ['brand', 'success', 'warning', 'danger'] as const;

  it('paints a darker quiet fill under data-lr-theme="dark" for every semantic variant', async () => {
    for (const variant of QUIET_VARIANTS) {
      const light = (await fixture(
        html`<lr-badge variant=${variant} appearance="filled">Quiet</lr-badge>`,
      )) as LyraBadge;
      const dark = (await fixture(
        html`<lr-badge variant=${variant} appearance="filled" data-lr-theme="dark">Quiet</lr-badge>`,
      )) as LyraBadge;
      const lightFill = getComputedStyle(base(light)).backgroundColor;
      const darkFill = getComputedStyle(base(dark)).backgroundColor;
      expect(darkFill, `${variant} quiet fill did not move in dark mode`).to.not.equal(lightFill);
      expect(
        relativeLuminance(darkFill),
        `${variant} dark quiet fill (${darkFill}) is not darker than its light value (${lightFill})`,
      ).to.be.lessThan(relativeLuminance(lightFill));
    }
  });

  it('keeps the neutral badge surface mode-aware too, though it reads the ambient surface', async () => {
    // variant="neutral" deliberately keeps the ambient "no signal" surface instead of the grid's
    // grey quiet row, so it needs its own proof that the ambient token is not a light-mode literal.
    const light = (await fixture(
      html`<lr-badge variant="neutral" appearance="filled">Quiet</lr-badge>`,
    )) as LyraBadge;
    const dark = (await fixture(
      html`<lr-badge variant="neutral" appearance="filled" data-lr-theme="dark">Quiet</lr-badge>`,
    )) as LyraBadge;
    const lightFill = getComputedStyle(base(light)).backgroundColor;
    const darkFill = getComputedStyle(base(dark)).backgroundColor;
    expect(darkFill).to.not.equal(lightFill);
    expect(relativeLuminance(darkFill)).to.be.lessThan(relativeLuminance(lightFill));
  });

  it('still resolves the dark quiet fill through its --lr-theme-* input', async () => {
    // A literal in the dark branch would render the same colour whatever the theme input says.
    for (const variant of QUIET_VARIANTS) {
      const el = (await fixture(html`
        <lr-badge
          variant=${variant}
          appearance="filled"
          data-lr-theme="dark"
          style="--lr-theme-color-${variant}-fill-quiet: rgb(3, 5, 7)"
        >Quiet</lr-badge>
      `)) as LyraBadge;
      expect(getComputedStyle(base(el)).backgroundColor, `${variant} ignored its theme input`).to.equal(
        'rgb(3, 5, 7)',
      );
    }
  });
});
