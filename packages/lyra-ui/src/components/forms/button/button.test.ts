import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './button.js';
import type { LyraButton } from './button.class.js';
import { styles } from './button.styles.js';

describe('lr-button', () => {
  it('defaults to neutral/filled/m/button with a slotted label', async () => {
    const el = (await fixture(html`<lr-button>Save</lr-button>`)) as LyraButton;
    expect(el.variant).to.equal('neutral');
    expect(el.appearance).to.equal('filled');
    expect(el.size).to.equal('m');
    expect(el.type).to.equal('button');
    expect(el.loading).to.equal(false);
    expect(el.disabled).to.equal(false);
    const button = el.shadowRoot!.querySelector('button[part="base"]') as HTMLButtonElement;
    expect(button.type).to.equal('button');
  });

  it('reflects variant/appearance/size/disabled as host attributes', async () => {
    const el = (await fixture(
      html`<lr-button variant="danger" appearance="outlined" size="l" disabled>Delete</lr-button>`,
    )) as LyraButton;
    expect(el.getAttribute('variant')).to.equal('danger');
    expect(el.getAttribute('appearance')).to.equal('outlined');
    expect(el.getAttribute('size')).to.equal('l');
    const button = el.shadowRoot!.querySelector('button[part="base"]') as HTMLButtonElement;
    expect(button.disabled).to.be.true;
  });

  it('fires a native click that bubbles and composes through the shadow boundary when enabled', async () => {
    const el = (await fixture(html`<lr-button>Save</lr-button>`)) as LyraButton;
    const button = el.shadowRoot!.querySelector('button[part="base"]') as HTMLButtonElement;
    setTimeout(() => button.click());
    const ev = await oneEvent(el, 'click');
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });

  it('never fires click while disabled or loading (native disabled button semantics)', async () => {
    const disabledEl = (await fixture(html`<lr-button disabled>Save</lr-button>`)) as LyraButton;
    let calls = 0;
    disabledEl.addEventListener('click', () => calls++);
    (disabledEl.shadowRoot!.querySelector('button[part="base"]') as HTMLButtonElement).click();

    const loadingEl = (await fixture(html`<lr-button .loading=${true}>Save</lr-button>`)) as LyraButton;
    loadingEl.addEventListener('click', () => calls++);
    (loadingEl.shadowRoot!.querySelector('button[part="base"]') as HTMLButtonElement).click();

    expect(calls).to.equal(0);
  });

  it('renders a spinner part only while loading, and sets aria-busy', async () => {
    const el = (await fixture(html`<lr-button>Save</lr-button>`)) as LyraButton;
    expect(el.shadowRoot!.querySelector('[part="spinner"]')).to.be.null;
    el.loading = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="spinner"]')).to.not.be.null;
    const button = el.shadowRoot!.querySelector('button[part="base"]') as HTMLButtonElement;
    expect(button.getAttribute('aria-busy')).to.equal('true');
  });

  it('forwards a host aria-label onto the internal button as a literal string', async () => {
    const el = (await fixture(
      html`<lr-button aria-label="Close dialog" appearance="plain"><svg slot="start"></svg></lr-button>`,
    )) as LyraButton;
    const button = el.shadowRoot!.querySelector('button[part="base"]') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).to.equal('Close dialog');
  });

  it('reacts when a mounted host aria-label changes or is removed', async () => {
    const el = (await fixture(
      html`<lr-button aria-label="Close dialog" appearance="plain"><svg slot="start"></svg></lr-button>`,
    )) as LyraButton;
    const button = el.shadowRoot!.querySelector('button[part="base"]') as HTMLButtonElement;
    expect(el.accessibleLabel).to.equal('Close dialog');

    el.setAttribute('aria-label', 'Dismiss dialog');
    await el.updateComplete;
    expect(el.accessibleLabel).to.equal('Dismiss dialog');
    expect(button.getAttribute('aria-label')).to.equal('Dismiss dialog');

    el.removeAttribute('aria-label');
    await el.updateComplete;
    expect(el.accessibleLabel).to.equal(null);
    expect(button.hasAttribute('aria-label')).to.be.false;
  });

  it('keeps accessibleLabel reactive in anchor mode too', async () => {
    const el = (await fixture(
      html`<lr-button href="/settings" aria-label="Open settings">Settings</lr-button>`,
    )) as LyraButton;
    const anchor = el.shadowRoot!.querySelector('a[part="base"]') as HTMLAnchorElement;
    expect(anchor.getAttribute('aria-label')).to.equal('Open settings');

    el.accessibleLabel = 'Manage settings';
    await el.updateComplete;
    expect(anchor.getAttribute('aria-label')).to.equal('Manage settings');
  });

  it('type="submit" requests submit on the closest ancestor form (a shadow-internal button cannot do this on its own)', async () => {
    const form = (await fixture(html`
      <form>
        <lr-button type="submit">Save</lr-button>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-button') as LyraButton;
    let submitted = false;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submitted = true;
    });
    (el.shadowRoot!.querySelector('button[part="base"]') as HTMLButtonElement).click();
    expect(submitted).to.be.true;
  });

  it('type="reset" resets the closest ancestor form', async () => {
    const form = (await fixture(html`
      <form>
        <input name="field" />
        <lr-button type="reset">Reset</lr-button>
      </form>
    `)) as HTMLFormElement;
    const input = form.querySelector('input') as HTMLInputElement;
    input.value = 'changed';
    const el = form.querySelector('lr-button') as LyraButton;
    (el.shadowRoot!.querySelector('button[part="base"]') as HTMLButtonElement).click();
    expect(input.value).to.equal('');
  });

  it('forwards host click() to the internal native button', async () => {
    const form = (await fixture(html`<form><lr-button type="submit">Save</lr-button></form>`)) as HTMLFormElement;
    const el = form.querySelector('lr-button') as LyraButton;
    let submitted = false;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submitted = true;
    });
    el.click();
    expect(submitted).to.be.true;
  });

  describe('ElementInternals availability', () => {
    it('does not throw when constructed in an environment without a real ElementInternals implementation (e.g. a downstream Vitest + happy-dom suite)', () => {
      const original = HTMLElement.prototype.attachInternals;
      // @ts-expect-error -- simulating an environment that lacks ElementInternals entirely
      delete HTMLElement.prototype.attachInternals;
      try {
        let el: LyraButton | undefined;
        expect(() => {
          el = document.createElement('lr-button') as LyraButton;
        }).to.not.throw();
        // Confirm the fallback keeps the rest of the public surface usable rather than merely
        // swallowing the constructor error.
        expect(el!.disabled).to.be.false;
      } finally {
        HTMLElement.prototype.attachInternals = original;
      }
    });
  });

  it('is accessible', async () => {
    const el = await fixture(html`<lr-button>Save</lr-button>`);
    await expect(el).to.be.accessible();
  });

  it('is accessible while loading', async () => {
    const el = await fixture(html`<lr-button .loading=${true}>Save</lr-button>`);
    await expect(el).to.be.accessible();
  });

  it('exposes the loading spinner timing as an override layered over the shared ambient token', async () => {
    const el = (await fixture(html`<lr-button .loading=${true}>Save</lr-button>`)) as LyraButton;
    const spinner = el.shadowRoot!.querySelector('[part="spinner"]') as HTMLElement;
    expect(getComputedStyle(spinner).animationDuration).to.equal('1.8s');

    el.style.setProperty('--lr-button-spinner-duration', '2.4s');
    await el.updateComplete;
    expect(getComputedStyle(spinner).animationDuration).to.equal('2.4s');
  });

  it('keeps the label space while loading and centers the spinner', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/:host\(\[loading\]\) \[part='label'\][^}]*opacity: 0/);
    expect(css).to.match(/\[part='spinner'\][^}]*position: absolute/);
    expect(css).to.match(/\[part='spinner'\][^}]*inset: 0/);
  });

  it('uses a strong border for outlined buttons', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.include('border-color: var(--lr-button-outlined-border);');
    expect(css).to.include('--lr-button-outlined-border: var(--lr-color-border-strong);');
  });

  it('supports appearance="quiet": muted border/text tokens, transparent until hover', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.include("--lr-button-quiet-border: var(--lr-color-border);");
    expect(css).to.include("--lr-button-quiet-text: var(--lr-color-text-quiet);");
    expect(css).to.match(
      /:host\(\[appearance='quiet'\]\) \[part='base'\]\s*\{[^}]*background:\s*transparent;[^}]*color:\s*var\(--lr-button-quiet-text\);[^}]*border-color:\s*var\(--lr-button-quiet-border\);/,
    );
    expect(css).to.match(
      /:host\(\[appearance='quiet'\]\) \[part='base'\]:not\(:disabled\):hover\s*\{[^}]*background:\s*var\(--lr-color-surface\);/,
    );
  });

  it('keeps appearance="quiet"\'s text/border independent of variant (unlike outlined)', async () => {
    const neutralEl = (await fixture(
      html`<lr-button appearance="quiet" variant="neutral">Save</lr-button>`,
    )) as LyraButton;
    const dangerEl = (await fixture(
      html`<lr-button appearance="quiet" variant="danger">Save</lr-button>`,
    )) as LyraButton;
    expect(dangerEl.getAttribute('appearance')).to.equal('quiet');
    const neutralBase = neutralEl.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const dangerBase = dangerEl.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(neutralBase).color).to.equal(getComputedStyle(dangerBase).color);
    expect(getComputedStyle(neutralBase).borderColor).to.equal(getComputedStyle(dangerBase).borderColor);
  });

  it('ships a default :hover/:active treatment on [part="base"], disabled under reduced motion', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='base'\]:not\(:disabled\):hover\s*\{[^}]*filter:/);
    expect(css).to.match(/\[part='base'\]:not\(:disabled\):active\s*\{[^}]*transform:\s*scale\(/);
    expect(css).to.match(
      /@media \(prefers-reduced-motion: reduce\) \{[^]*\[part='base'\]:not\(:disabled\):active\s*\{[^}]*transform:\s*none[^}]*\}[^]*\}/,
    );
  });

  it('is form-associated, participating in an ancestor form.elements the same way wa-button does', async () => {
    const form = (await fixture(html`
      <form>
        <lr-button type="submit">Save</lr-button>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-button') as LyraButton;
    expect(Array.from(form.elements)).to.include(el);
  });

  it('reflects disabled synchronously on assignment, with no await', async () => {
    const el = (await fixture(html`<lr-button>Save</lr-button>`)) as LyraButton;
    expect(el.hasAttribute('disabled')).to.be.false;

    // No `await`: the `disabled` setter must synchronously reflect the host attribute before any
    // same-tick native form API (e.g. a `<fieldset>` toggle or `:disabled` check) runs.
    el.disabled = true;
    expect(el.hasAttribute('disabled'), 'the host attribute must be set synchronously').to.be.true;
    expect(el.effectiveDisabled).to.be.true;

    el.disabled = false;
    expect(el.hasAttribute('disabled')).to.be.false;
    expect(el.effectiveDisabled).to.be.false;
  });

  it('cascades disabled state from an ancestor fieldset without mutating the disabled property', async () => {
    const form = (await fixture(html`
      <form>
        <fieldset>
          <lr-button>Save</lr-button>
        </fieldset>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-button') as LyraButton;
    const fieldset = form.querySelector('fieldset') as HTMLFieldSetElement;
    await el.updateComplete;
    expect(el.effectiveDisabled).to.be.false;

    // No `await` before these assertions: `formDisabledCallback` fires synchronously when the
    // fieldset's `disabled` property is set, and it must never mutate the button's own `disabled`
    // property/attribute -- mirrors `<lr-checkbox>`'s/`<lr-token-input>`'s identical tests.
    fieldset.disabled = true;
    expect(el.disabled, 'fieldset state must not mutate the public property').to.be.false;
    expect(el.hasAttribute('disabled'), 'fieldset state must not mutate the host attribute either').to.be.false;
    expect(el.effectiveDisabled, 'the button reflects inherited fieldset state').to.be.true;

    await el.updateComplete;
    const button = el.shadowRoot!.querySelector('button[part="base"]') as HTMLButtonElement;
    expect(button.disabled, 'the internal native button reflects the inherited state').to.be.true;

    fieldset.disabled = false;
    await el.updateComplete;
    expect(el.effectiveDisabled).to.be.false;
    expect(button.disabled).to.be.false;
  });

  it('supports appearance="accent" as a loud filled tier distinct from "filled" for variant="neutral"', async () => {
    const filledEl = (await fixture(
      html`<lr-button appearance="filled" variant="neutral">Save</lr-button>`,
    )) as LyraButton;
    const accentEl = (await fixture(
      html`<lr-button appearance="accent" variant="neutral">Save</lr-button>`,
    )) as LyraButton;
    expect(accentEl.appearance).to.equal('accent');
    expect(accentEl.getAttribute('appearance')).to.equal('accent');
    const filledBase = filledEl.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const accentBase = accentEl.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(accentBase).backgroundColor).to.not.equal(
      getComputedStyle(filledBase).backgroundColor,
    );
  });

  it('uses the standard medium size token and exposes a rethemeable size scale', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.include("font-size: var(--lr-font-size-m);");
    // Matches lr-input/lr-select/lr-combobox's own size="s" control-min-height token, so a
    // default-row button lines up with its neighbors (size-tier-height-inconsistent-across-controls).
    expect(css).to.include('--lr-button-size-s: var(--lr-size-1-875rem);');
    // The per-tier floor now reaches min-block-size through --lr-button-min-height (re-assigned per
    // size tier) so a consumer-set --lr-button-height can cap it; the size scale itself is unchanged.
    expect(css).to.include('--lr-button-min-height: var(--lr-button-size-s);');
    expect(css).to.include('min-block-size: var(--lr-button-height, var(--lr-button-min-height));');
  });

  it("matches lr-input/lr-select/lr-combobox's shared min-height scale at every size tier so a button never sits shorter than its row neighbors", () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    // Same token values as input.styles.ts's :host([size='…']) --lr-input-control-min-height scale.
    expect(css).to.include('--lr-button-size-2xs: var(--lr-size-1-25rem);');
    expect(css).to.include('--lr-button-size-xs: var(--lr-size-1-5rem);');
    expect(css).to.include('--lr-button-size-s: var(--lr-size-1-875rem);');
    expect(css).to.include('--lr-button-size-m: var(--lr-size-2-5rem);');
    expect(css).to.include('--lr-button-size-l: var(--lr-size-3rem);');
    expect(css).to.include('--lr-button-size-xl: var(--lr-size-3-5rem);');
  });

  it('propagates a consumer width from the host to the internal button', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.include('inline-size: var(--lr-button-width);');
    expect(css).to.include('--lr-button-width: 100%;');
  });

  it('renders appearance="link" as zero-chrome underlined inline text (no border, no padding, no min-height floor)', async () => {
    const el = (await fixture(
      html`<lr-button appearance="link" variant="brand">Retry</lr-button>`,
    )) as LyraButton;
    expect(el.getAttribute('appearance')).to.equal('link');
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const cs = getComputedStyle(base);
    // No border (the base rule's transparent-but-present border is dropped entirely).
    expect(cs.borderTopWidth).to.equal('0px');
    expect(cs.borderInlineStartWidth).to.equal('0px');
    // Zero padding on every side, unlike every real "size".
    expect(cs.paddingTop).to.equal('0px');
    expect(cs.paddingBottom).to.equal('0px');
    expect(cs.paddingLeft).to.equal('0px');
    expect(cs.paddingRight).to.equal('0px');
    // No enforced min-height floor.
    expect(cs.minHeight).to.equal('0px');
    // Transparent background and an underline.
    expect(cs.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    expect(cs.textDecorationLine).to.include('underline');
  });

  it('colors appearance="link" from the same accent token appearance="plain" uses', async () => {
    const linkEl = (await fixture(
      html`<lr-button appearance="link" variant="brand">Retry</lr-button>`,
    )) as LyraButton;
    const plainEl = (await fixture(
      html`<lr-button appearance="plain" variant="brand">Retry</lr-button>`,
    )) as LyraButton;
    const linkBase = linkEl.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const plainBase = plainEl.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(linkBase).color).to.equal(getComputedStyle(plainBase).color);
  });

  it('inherits the ambient font-size for appearance="link" instead of forcing a per-size font-size', async () => {
    const el = (await fixture(html`
      <div style="font-size: 21px;">
        <lr-button appearance="link" size="m">Retry</lr-button>
      </div>
    `)) as HTMLElement;
    const button = el.querySelector('lr-button') as LyraButton;
    const base = button.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).fontSize).to.equal('21px');
  });

  it('declares the underline offset and keeps a focus-visible outline for appearance="link"', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/:host\(\[appearance='link'\]\) \[part='base'\][^}]*text-decoration: underline/);
    expect(css).to.match(
      /:host\(\[appearance='link'\]\) \[part='base'\][^}]*text-underline-offset: var\(--lr-size-0-15rem\)/,
    );
    // The generic focus-visible rule still applies to the link appearance (it is not overridden).
    expect(css).to.match(/\[part='base'\]:focus-visible\s*\{[^}]*outline:/);
  });

  it('is accessible as an inline link', async () => {
    const el = await fixture(html`<lr-button appearance="link" variant="brand">Retry</lr-button>`);
    await expect(el).to.be.accessible();
  });

  it('supports size="2xs": tighter than xs, with its own min-block-size token', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.include('--lr-button-size-2xs: var(--lr-size-1-25rem);');
    // The tier's geometry now lives in cssprop re-assignment on :host([size='2xs']) rather than in
    // property declarations on [part='base'] -- the values themselves are unchanged.
    expect(css).to.match(
      /:host\(\[size='2xs'\]\)\s*\{[^}]*--lr-button-padding-block:\s*var\(--lr-space-2xs\);[^}]*--lr-button-padding-inline:\s*var\(--lr-space-2xs\);[^}]*--lr-button-font-size:\s*var\(--lr-font-size-2xs\);[^}]*--lr-button-min-height:\s*var\(--lr-button-size-2xs\);/,
    );
  });

  it('reflects size="2xs" as a host attribute', async () => {
    const el = (await fixture(html`<lr-button size="2xs">Go</lr-button>`)) as LyraButton;
    expect(el.size).to.equal('2xs');
    expect(el.getAttribute('size')).to.equal('2xs');
  });

  describe('sizing custom properties', () => {
    // The computed geometry each tier rendered *before* --lr-button-padding-block/-padding-inline/
    // -font-size existed. An unset consumer must stay byte-identical, so these are hardcoded px
    // (root font-size is 16px) rather than re-derived from the same tokens the stylesheet uses.
    // minHeight now matches lr-input/lr-select/lr-combobox's shared control-min-height scale tier
    // for tier (size-tier-height-inconsistent-across-controls) -- padding/font-size are unchanged.
    const tiers = [
      { size: '2xs', padInline: '2px', padBlock: '2px', fontSize: '10px', minHeight: '20px' },
      { size: 'xs', padInline: '4px', padBlock: '2px', fontSize: '12px', minHeight: '24px' },
      { size: 's', padInline: '8px', padBlock: '2px', fontSize: '13px', minHeight: '30px' },
      { size: 'm', padInline: '12px', padBlock: '4px', fontSize: '16px', minHeight: '40px' },
      { size: 'l', padInline: '16px', padBlock: '8px', fontSize: '16px', minHeight: '48px' },
      { size: 'xl', padInline: '32px', padBlock: '12px', fontSize: '18px', minHeight: '56px' },
    ];

    const base = (el: LyraButton) => el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

    it('renders byte-identical padding/font-size/min-height at all six tiers when the properties are untouched', async () => {
      for (const tier of tiers) {
        const el = (await fixture(html`<lr-button size=${tier.size}>Go</lr-button>`)) as LyraButton;
        const cs = getComputedStyle(base(el));
        expect(cs.paddingLeft, `size=${tier.size} padding-inline`).to.equal(tier.padInline);
        expect(cs.paddingRight, `size=${tier.size} padding-inline`).to.equal(tier.padInline);
        expect(cs.paddingTop, `size=${tier.size} padding-block`).to.equal(tier.padBlock);
        expect(cs.paddingBottom, `size=${tier.size} padding-block`).to.equal(tier.padBlock);
        expect(cs.fontSize, `size=${tier.size} font-size`).to.equal(tier.fontSize);
        expect(cs.minHeight, `size=${tier.size} min-block-size`).to.equal(tier.minHeight);
      }
    });

    it('lets a consumer pin a size="s" button to a compact toolbar tier with no ::part(base) rule', async () => {
      const el = (await fixture(html`<lr-button size="s">Go</lr-button>`)) as LyraButton;
      el.style.setProperty('--lr-button-padding-block', '1px');
      el.style.setProperty('--lr-button-padding-inline', '6px');
      el.style.setProperty('--lr-button-font-size', '11px');
      await el.updateComplete;
      const cs = getComputedStyle(base(el));
      expect(cs.paddingTop).to.equal('1px');
      expect(cs.paddingBottom).to.equal('1px');
      expect(cs.paddingLeft).to.equal('6px');
      expect(cs.paddingRight).to.equal('6px');
      expect(cs.fontSize).to.equal('11px');
    });

    it('declares the geometry knobs on :host (the "m" tier) and consumes them once on [part="base"]', () => {
      const css = styles.cssText.replace(/\s+/g, ' ');
      expect(css).to.match(
        /:host \{[^}]*--lr-button-padding-block: var\(--lr-space-xs\);[^}]*--lr-button-padding-inline: var\(--lr-space-m\);[^}]*--lr-button-font-size: var\(--lr-font-size-m\);/,
      );
      // `size` reflects and defaults to 'm', so the ':host' declarations above *are* the m tier --
      // a separate :host([size='m']) block would be dead weight.
      expect(css, "a :host([size='m']) rule would only restate the :host defaults").to.not.match(
        /:host\(\[size='m'\]\)[^;{]*\{/,
      );
      expect(css).to.match(
        /\[part='base'\] \{[^}]*padding-inline: var\(--lr-button-padding-inline\);[^}]*padding-block: var\(--lr-button-padding-block\);/,
      );
      // Per-tier blocks only re-assign the same knobs -- no property declarations of their own.
      for (const size of ['2xs', 'xs', 's', 'l', 'xl']) {
        expect(css, `size=${size}`).to.match(
          new RegExp(`:host\\(\\[size='${size}'\\]\\) \\{[^}]*--lr-button-padding-block:`),
        );
        expect(css, `size=${size} must not restyle [part='base'] directly`).to.not.include(
          `:host([size='${size}']) [part='base']`,
        );
      }
    });

    it('keeps appearance="link" winning over the geometry knobs (zero padding, inherited font)', async () => {
      const wrapper = (await fixture(html`
        <div style="font-size: 21px;">
          <lr-button appearance="link" size="xl">Retry</lr-button>
        </div>
      `)) as HTMLElement;
      const el = wrapper.querySelector('lr-button') as LyraButton;
      el.style.setProperty('--lr-button-padding-block', '20px');
      el.style.setProperty('--lr-button-padding-inline', '20px');
      el.style.setProperty('--lr-button-font-size', '40px');
      await el.updateComplete;
      const cs = getComputedStyle(base(el));
      expect(cs.paddingTop).to.equal('0px');
      expect(cs.paddingBottom).to.equal('0px');
      expect(cs.paddingLeft).to.equal('0px');
      expect(cs.paddingRight).to.equal('0px');
      expect(cs.fontSize).to.equal('21px');
    });

    it('pins every tier to an exact height via --lr-button-height', async () => {
      for (const tier of tiers) {
        const el = (await fixture(html`<lr-button size=${tier.size}>Go</lr-button>`)) as LyraButton;
        el.style.setProperty('--lr-button-height', '44px');
        await el.updateComplete;
        const cs = getComputedStyle(base(el));
        expect(cs.blockSize, `size=${tier.size} block-size`).to.equal('44px');
        expect(cs.minHeight, `size=${tier.size} min-block-size`).to.equal('44px');
      }
    });

    it('exposes --lr-button-gap and --lr-button-radius, defaulting to the pre-existing literals', async () => {
      const el = (await fixture(html`<lr-button>Go</lr-button>`)) as LyraButton;
      const cs = getComputedStyle(base(el));
      expect(cs.gap).to.equal('2px');
      expect(cs.borderRadius).to.equal('6px');
    });

    it('retunes the icon/label gap and corner radius with no ::part(base) rule', async () => {
      const el = (await fixture(html`<lr-button>Go</lr-button>`)) as LyraButton;
      el.style.setProperty('--lr-button-gap', '12px');
      el.style.setProperty('--lr-button-radius', '3px');
      await el.updateComplete;
      const cs = getComputedStyle(base(el));
      expect(cs.gap).to.equal('12px');
      expect(cs.borderRadius).to.equal('3px');
    });

    it('keeps appearance="link" winning over --lr-button-radius (zero radius)', async () => {
      const el = (await fixture(html`<lr-button appearance="link">Retry</lr-button>`)) as LyraButton;
      el.style.setProperty('--lr-button-radius', '20px');
      await el.updateComplete;
      expect(getComputedStyle(base(el)).borderRadius).to.equal('0px');
    });

    it('declares --lr-button-gap/--lr-button-radius on :host and consumes them once on [part="base"]', () => {
      const css = styles.cssText.replace(/\s+/g, ' ');
      expect(css).to.match(/:host \{[^}]*--lr-button-gap: var\(--lr-space-2xs\);/);
      expect(css).to.match(/:host \{[^}]*--lr-button-radius: var\(--lr-radius\);/);
      expect(css).to.include('gap: var(--lr-button-gap);');
      expect(css).to.include('border-radius: var(--lr-button-radius);');
    });

    it('leaves --lr-button-height genuinely undeclared so its var() fallback arm can fire', () => {
      const css = styles.cssText.replace(/\s+/g, ' ');
      // A declared value -- even `auto` -- is a *defined* value that wins, so the fallback arm
      // would never run and every tier's floor would be dead code (see select.styles.ts:37-49).
      expect(css, '--lr-button-height must never be declared, only read').to.not.match(
        /--lr-button-height:/,
      );
      expect(css).to.match(
        /\[part='base'\] \{[^}]*min-block-size: var\(--lr-button-height, var\(--lr-button-min-height\)\);[^}]*block-size: var\(--lr-button-height, auto\);/,
      );
    });

    it('leaves appearance="link" unaffected by a pinned --lr-button-height', async () => {
      const el = (await fixture(html`<lr-button appearance="link">Retry</lr-button>`)) as LyraButton;
      el.style.setProperty('--lr-button-height', '44px');
      await el.updateComplete;
      const cs = getComputedStyle(base(el));
      expect(cs.minHeight).to.equal('0px');
      expect(cs.blockSize).to.not.equal('44px');
    });
  });

  describe('start/end adornment wrappers collapse when unslotted', () => {
    it('collapses both adornment wrappers (display:none) when nothing is slotted into start/end', async () => {
      const el = (await fixture(html`<lr-button>Label</lr-button>`)) as LyraButton;
      const startWrapper = el.shadowRoot!.querySelector('[part="start"]') as HTMLElement;
      const endWrapper = el.shadowRoot!.querySelector('[part="end"]') as HTMLElement;
      // Assert the *rendered* result, not the stylesheet text: a silently-inert :empty rule
      // (a <slot> is an element child, so :empty never matched) is invisible to CSS-text asserts.
      expect(getComputedStyle(startWrapper).display).to.equal('none');
      expect(getComputedStyle(endWrapper).display).to.equal('none');
    });

    it('keeps the start wrapper visible when content is slotted into start', async () => {
      const el = (await fixture(
        html`<lr-button><span slot="start">*</span>Label</lr-button>`,
      )) as LyraButton;
      const startWrapper = el.shadowRoot!.querySelector('[part="start"]') as HTMLElement;
      const endWrapper = el.shadowRoot!.querySelector('[part="end"]') as HTMLElement;
      expect(getComputedStyle(startWrapper).display).to.not.equal('none');
      // The unused end wrapper still collapses.
      expect(getComputedStyle(endWrapper).display).to.equal('none');
    });
  });

  describe('appearance="outlined" fill', () => {
    it('stays transparent when --lr-button-outlined-fill is unset', async () => {
      const el = (await fixture(html`<lr-button appearance="outlined">Save</lr-button>`)) as LyraButton;
      const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
      expect(getComputedStyle(base).backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    });

    it('tints an outlined button through --lr-button-outlined-fill with no ::part() rule', async () => {
      const el = (await fixture(html`<lr-button appearance="outlined">Save</lr-button>`)) as LyraButton;
      el.style.setProperty('--lr-button-outlined-fill', 'rgb(12, 34, 56)');
      await el.updateComplete;
      const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
      expect(getComputedStyle(base).backgroundColor).to.equal('rgb(12, 34, 56)');
    });

    it('declares --lr-button-outlined-fill beside --lr-button-outlined-border and consumes it', () => {
      const css = styles.cssText.replace(/\s+/g, ' ');
      expect(css).to.include('--lr-button-outlined-fill: transparent;');
      expect(css).to.match(
        /:host\(\[appearance='outlined'\]\) \[part='base'\] \{[^}]*background: var\(--lr-button-outlined-fill\);/,
      );
    });

    it('is accessible with a tinted outlined fill and a pinned height', async () => {
      const el = (await fixture(html`
        <lr-button
          appearance="outlined"
          size="s"
          style="--lr-button-outlined-fill: #f1f5f9; --lr-button-height: 28px; --lr-button-padding-inline: 6px;"
          >Save</lr-button
        >
      `)) as LyraButton;
      await el.updateComplete;
      await expect(el).to.be.accessible();
    });
  });

  describe('--lr-button-shadow', () => {
    it('applies a box-shadow through the token', async () => {
      const el = (await fixture(html`<lr-button>Save</lr-button>`)) as LyraButton;
      el.style.setProperty('--lr-button-shadow', '0 4px 8px rgba(0, 0, 0, 0.3)');
      await el.updateComplete;
      const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
      const probe = document.createElement('span');
      probe.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
      document.body.appendChild(probe);
      const expected = getComputedStyle(probe).boxShadow;
      document.body.removeChild(probe);
      expect(getComputedStyle(base).boxShadow).to.equal(expected);
    });

    it('renders no box-shadow when the token is unset (regression)', async () => {
      const el = (await fixture(html`<lr-button>Save</lr-button>`)) as LyraButton;
      const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
      expect(getComputedStyle(base).boxShadow).to.equal('none');
    });
  });

  describe('anchor mode (href/target/download)', () => {
    it('renders a real <a> when href is set', async () => {
      const el = (await fixture(
        html`<lr-button href="https://example.com">Go</lr-button>`,
      )) as LyraButton;
      const anchor = el.shadowRoot!.querySelector('a[part="base"]') as HTMLAnchorElement;
      expect(anchor).to.exist;
      expect(anchor.getAttribute('href')).to.equal('https://example.com');
      expect(el.shadowRoot!.querySelector('button[part="base"]')).to.not.exist;
    });

    it('still renders the label/start/end/spinner content inside the anchor', async () => {
      const el = (await fixture(
        html`<lr-button href="https://example.com"><span slot="start">*</span>Go</lr-button>`,
      )) as LyraButton;
      const anchor = el.shadowRoot!.querySelector('a[part="base"]') as HTMLAnchorElement;
      expect(anchor.querySelector('[part="label"]')).to.exist;
      expect(anchor.querySelector('[part="start"]')).to.exist;
      expect(anchor.querySelector('[part="end"]')).to.exist;
    });

    it('derives rel="noopener noreferrer" when target is set on a link button', async () => {
      const el = (await fixture(
        html`<lr-button href="https://example.com" target="_blank">Go</lr-button>`,
      )) as LyraButton;
      const anchor = el.shadowRoot!.querySelector('a') as HTMLAnchorElement;
      expect(anchor.getAttribute('target')).to.equal('_blank');
      expect(anchor.getAttribute('rel')).to.equal('noopener noreferrer');
    });

    it('omits rel entirely when target is unset (no standalone settable rel)', async () => {
      const el = (await fixture(
        html`<lr-button href="https://example.com">Go</lr-button>`,
      )) as LyraButton;
      const anchor = el.shadowRoot!.querySelector('a') as HTMLAnchorElement;
      expect(anchor.hasAttribute('rel')).to.be.false;
    });

    it('forwards download to the anchor', async () => {
      const el = (await fixture(
        html`<lr-button href="https://example.com/file.zip" download="file.zip">Go</lr-button>`,
      )) as LyraButton;
      const anchor = el.shadowRoot!.querySelector('a') as HTMLAnchorElement;
      expect(anchor.getAttribute('download')).to.equal('file.zip');
    });

    it('allows a mailto: href (anchor-safe link scheme)', async () => {
      const el = (await fixture(
        html`<lr-button href="mailto:hello@example.com">Email</lr-button>`,
      )) as LyraButton;
      const anchor = el.shadowRoot!.querySelector('a[part="base"]') as HTMLAnchorElement;
      expect(anchor).to.exist;
      expect(anchor.getAttribute('href')).to.equal('mailto:hello@example.com');
    });

    // `download` flips the anchor from a navigation sink to a resource sink, and the two have
    // different allowlists: a mail handoff is a legitimate destination but names no retrievable
    // bytes, so it cannot be a download target. Same href, opposite verdict, decided by `download`.
    it('rejects a mailto: href when download is set, falling back to the native button', async () => {
      const el = (await fixture(
        html`<lr-button href="mailto:hello@example.com" download="contact">Email</lr-button>`,
      )) as LyraButton;
      // Assert on the root's tag name rather than node existence: a failing `to.not.exist` on a
      // DOM node hangs the whole file while chai tries to serialize it as `actual`.
      expect(el.shadowRoot!.querySelector('[part="base"]')!.localName).to.equal('button');
    });

    it('ignores an unsafe href scheme, falling back to the native button', async () => {
      const el = (await fixture(
        html`<lr-button href="javascript:alert(1)">Go</lr-button>`,
      )) as LyraButton;
      expect(el.shadowRoot!.querySelector('a[part="base"]')).to.not.exist;
      expect(el.shadowRoot!.querySelector('button[part="base"]')).to.exist;
    });

    it('forwards a host aria-label onto the internal anchor as a literal string', async () => {
      const el = (await fixture(
        html`<lr-button href="https://example.com" aria-label="Open the site">Go</lr-button>`,
      )) as LyraButton;
      const anchor = el.shadowRoot!.querySelector('a[part="base"]') as HTMLAnchorElement;
      expect(anchor.getAttribute('aria-label')).to.equal('Open the site');
    });

    it('forwards host click()/focus()/blur() to the internal anchor', async () => {
      const el = (await fixture(
        html`<lr-button href="https://example.com">Go</lr-button>`,
      )) as LyraButton;
      const anchor = el.shadowRoot!.querySelector('a[part="base"]') as HTMLAnchorElement;
      let clicked = 0;
      // Prevent the default navigation that host click() would otherwise trigger.
      anchor.addEventListener('click', (e) => {
        e.preventDefault();
        clicked++;
      });
      el.click();
      expect(clicked).to.equal(1);
      el.focus();
      // Compare booleans, never DOM nodes, as chai's actual/expected (a failed node comparison
      // hangs the whole file at 180s).
      expect(el.shadowRoot!.activeElement === anchor, 'focus() should focus the anchor').to.be.true;
      el.blur();
      expect(el.shadowRoot!.activeElement === anchor, 'blur() should unfocus the anchor').to.be
        .false;
    });

    it('is accessible as a link button', async () => {
      const el = await fixture(html`<lr-button href="https://example.com">Go</lr-button>`);
      await expect(el).to.be.accessible();
    });

    describe('D8: a disabled link button omits href and cannot navigate', () => {
      it('renders an <a> with NO href attribute when disabled', async () => {
        const el = (await fixture(
          html`<lr-button disabled href="https://example.com">Go</lr-button>`,
        )) as LyraButton;
        const anchor = el.shadowRoot!.querySelector('a[part="base"]') as HTMLAnchorElement;
        expect(anchor).to.exist;
        expect(anchor.hasAttribute('href'), 'a disabled link button must not carry href').to.be
          .false;
        expect(anchor.getAttribute('aria-disabled')).to.equal('true');
      });

      it('does not navigate on click while disabled (an anchor with no href is not activatable)', async () => {
        const el = (await fixture(
          html`<lr-button disabled href="https://example.com">Go</lr-button>`,
        )) as LyraButton;
        const anchor = el.shadowRoot!.querySelector('a[part="base"]') as HTMLAnchorElement;
        let navigations = 0;
        // A default-prevented, href-less anchor fires no navigation; count any that slip through.
        anchor.addEventListener('click', (e) => {
          if (!e.defaultPrevented && anchor.hasAttribute('href')) navigations++;
          e.preventDefault();
        });
        anchor.click();
        expect(navigations).to.equal(0);
        expect(anchor.hasAttribute('href')).to.be.false;
      });

      it('restores href once re-enabled', async () => {
        const el = (await fixture(
          html`<lr-button disabled href="https://example.com">Go</lr-button>`,
        )) as LyraButton;
        el.disabled = false;
        await el.updateComplete;
        const anchor = el.shadowRoot!.querySelector('a[part="base"]') as HTMLAnchorElement;
        expect(anchor.getAttribute('href')).to.equal('https://example.com');
        expect(anchor.hasAttribute('aria-disabled')).to.be.false;
      });

      it('omits href when disabled by an ancestor fieldset', async () => {
        const form = (await fixture(html`
          <form>
            <fieldset>
              <lr-button href="https://example.com">Go</lr-button>
            </fieldset>
          </form>
        `)) as HTMLFormElement;
        const el = form.querySelector('lr-button') as LyraButton;
        const fieldset = form.querySelector('fieldset') as HTMLFieldSetElement;
        fieldset.disabled = true;
        await el.updateComplete;
        const anchor = el.shadowRoot!.querySelector('a[part="base"]') as HTMLAnchorElement;
        expect(anchor.hasAttribute('href')).to.be.false;
        expect(anchor.getAttribute('aria-disabled')).to.equal('true');
      });
    });

    describe('unset-regression: href unset renders the native button unchanged', () => {
      it('still renders a native <button> and honors variant/appearance/size when href is unset', async () => {
        const el = (await fixture(
          html`<lr-button variant="brand" appearance="outlined" size="l">Go</lr-button>`,
        )) as LyraButton;
        expect(el.shadowRoot!.querySelector('button[part="base"]')).to.exist;
        expect(el.shadowRoot!.querySelector('a[part="base"]')).to.not.exist;
      });

      it('exposes href/target/download as undefined by default', async () => {
        const el = (await fixture(html`<lr-button>Go</lr-button>`)) as LyraButton;
        expect(el.href).to.be.undefined;
        expect(el.target).to.be.undefined;
        expect(el.download).to.be.undefined;
      });

      it('type="submit" still submits the ancestor form when href is unset', async () => {
        const form = (await fixture(html`
          <form>
            <lr-button type="submit">Save</lr-button>
          </form>
        `)) as HTMLFormElement;
        const el = form.querySelector('lr-button') as LyraButton;
        let submitted = false;
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          submitted = true;
        });
        (el.shadowRoot!.querySelector('button[part="base"]') as HTMLButtonElement).click();
        expect(submitted).to.be.true;
      });
    });
  });
});

it('makes a loading anchor busy and fully inoperable', async () => {
  const el = (await fixture(
    html`<lr-button href="https://example.com" loading>Save</lr-button>`,
  )) as LyraButton;
  const anchor = el.shadowRoot!.querySelector('a[part="base"]') as HTMLAnchorElement;
  let clicks = 0;
  anchor.addEventListener('click', (event) => {
    clicks++;
    event.preventDefault();
  });

  expect(anchor.hasAttribute('href')).to.be.false;
  expect(anchor.getAttribute('aria-disabled')).to.equal('true');
  expect(anchor.getAttribute('aria-busy')).to.equal('true');
  expect(anchor.tabIndex).to.equal(-1);
  el.click();
  expect(clicks).to.equal(0);
});
