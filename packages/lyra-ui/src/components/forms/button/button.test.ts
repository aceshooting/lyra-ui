import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './button.js';
import type { LyraButton } from './button.class.js';
import { styles } from './button.styles.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

describe('lr-button', () => {
  it('bridges a host invalid check to one non-cancelable lr-invalid alias', async () => {
    const el = (await fixture(html`<lr-button>Save</lr-button>`)) as LyraButton;
    const aliases: CustomEvent[] = [];
    el.addEventListener('lr-invalid', (event) => aliases.push(event as CustomEvent));

    el.dispatchEvent(new Event('invalid', { cancelable: true }));

    expect(aliases).to.have.lengthOf(1);
    expect(aliases[0].target).to.equal(el);
    expect(aliases[0].bubbles && aliases[0].composed).to.be.true;
    expect(aliases[0].cancelable).to.be.false;
  });

  it('defaults to neutral/accent/m/button with a slotted label', async () => {
    const el = (await fixture(html`<lr-button>Save</lr-button>`)) as LyraButton;
    expect(el.variant).to.equal('neutral');
    expect(el.getAttribute('variant')).to.equal('neutral');
    expect(el.appearance).to.equal('accent');
    expect(el.size).to.equal('m');
    expect(el.type).to.equal('button');
    expect(el.loading).to.equal(false);
    expect(el.disabled).to.equal(false);
    const button = el.shadowRoot!.querySelector('button[part~="base"]') as HTMLButtonElement;
    expect(button.type).to.equal('button');
  });

  it('reflects variant/appearance/size/disabled as host attributes', async () => {
    const el = (await fixture(
      html`<lr-button variant="danger" appearance="outlined" size="l" disabled>Delete</lr-button>`,
    )) as LyraButton;
    expect(el.getAttribute('variant')).to.equal('danger');
    expect(el.getAttribute('appearance')).to.equal('outlined');
    expect(el.getAttribute('size')).to.equal('l');
    const button = el.shadowRoot!.querySelector('button[part~="base"]') as HTMLButtonElement;
    expect(button.disabled).to.be.true;
  });

  it('reflects the pinned Web Awesome href and submitter value properties', async () => {
    const el = (await fixture(html`<lr-button>Save</lr-button>`)) as LyraButton;
    el.href = '/account';
    el.value = 'save-account';
    await el.updateComplete;

    expect(el.getAttribute('href')).to.equal('/account');
    expect(el.getAttribute('value')).to.equal('save-account');

    el.href = undefined;
    await el.updateComplete;
    expect(el.hasAttribute('href')).to.be.false;
  });

  it('fires a native click that bubbles and composes through the shadow boundary when enabled', async () => {
    const el = (await fixture(html`<lr-button>Save</lr-button>`)) as LyraButton;
    const button = el.shadowRoot!.querySelector('button[part~="base"]') as HTMLButtonElement;
    setTimeout(() => button.click());
    const ev = await oneEvent(el, 'click');
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });

  it('relays exactly one native focus/blur pair plus one prefixed alias pair', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div><lr-button>Save</lr-button></div>`);
    const el = wrapper.querySelector('lr-button') as LyraButton;
    const nativeEvents: FocusEvent[] = [];
    const aliases: string[] = [];
    wrapper.addEventListener('focus', (event) => nativeEvents.push(event as FocusEvent));
    wrapper.addEventListener('blur', (event) => nativeEvents.push(event as FocusEvent));
    wrapper.addEventListener('lr-focus', () => aliases.push('lr-focus'));
    wrapper.addEventListener('lr-blur', () => aliases.push('lr-blur'));

    el.focus();
    el.blur();

    expect(nativeEvents.map((event) => event.type)).to.deep.equal(['focus', 'blur']);
    expect(nativeEvents.every((event) => event instanceof FocusEvent)).to.be.true;
    expect(nativeEvents.every((event) => event.target === el && event.bubbles && event.composed)).to.be.true;
    expect(aliases).to.deep.equal(['lr-focus', 'lr-blur']);
  });

  it('never fires click while disabled or loading (native disabled button semantics)', async () => {
    const disabledEl = (await fixture(html`<lr-button disabled>Save</lr-button>`)) as LyraButton;
    let calls = 0;
    disabledEl.addEventListener('click', () => calls++);
    (disabledEl.shadowRoot!.querySelector('button[part~="base"]') as HTMLButtonElement).click();

    const loadingEl = (await fixture(html`<lr-button .loading=${true}>Save</lr-button>`)) as LyraButton;
    loadingEl.addEventListener('click', () => calls++);
    (loadingEl.shadowRoot!.querySelector('button[part~="base"]') as HTMLButtonElement).click();

    expect(calls).to.equal(0);
  });

  it('renders a spinner part only while loading, and sets aria-busy', async () => {
    const el = (await fixture(html`<lr-button>Save</lr-button>`)) as LyraButton;
    expect(el.shadowRoot!.querySelector('[part="spinner"]')).to.be.null;
    el.loading = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="spinner"]')).to.not.be.null;
    const button = el.shadowRoot!.querySelector('button[part~="base"]') as HTMLButtonElement;
    expect(button.getAttribute('aria-busy')).to.equal('true');
  });

  it('forwards a host aria-label onto the internal button as a literal string', async () => {
    const el = (await fixture(
      html`<lr-button aria-label="Close dialog" appearance="plain"><svg slot="start"></svg></lr-button>`,
    )) as LyraButton;
    const button = el.shadowRoot!.querySelector('button[part~="base"]') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).to.equal('Close dialog');
  });

  it('reacts when a mounted host aria-label changes or is removed', async () => {
    const el = (await fixture(
      html`<lr-button aria-label="Close dialog" appearance="plain"><svg slot="start"></svg></lr-button>`,
    )) as LyraButton;
    const button = el.shadowRoot!.querySelector('button[part~="base"]') as HTMLButtonElement;
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
    const anchor = el.shadowRoot!.querySelector('a[part~="base"]') as HTMLAnchorElement;
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
    (el.shadowRoot!.querySelector('button[part~="base"]') as HTMLButtonElement).click();
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
    (el.shadowRoot!.querySelector('button[part~="base"]') as HTMLButtonElement).click();
    expect(input.value).to.equal('');
  });

  it('submits and resets through an external form owner, including submitter overrides', async () => {
    const root = await fixture(html`
      <div>
        <form id="external-button-owner"><input name="field" value="initial" /></form>
        <lr-button
          form="external-button-owner"
          type="submit"
          name="action"
          value="save"
          formmethod="post"
        >Save</lr-button>
      </div>
    `);
    const form = root.querySelector('form') as HTMLFormElement;
    const input = form.querySelector('input') as HTMLInputElement;
    const el = root.querySelector('lr-button') as LyraButton;
    const seen: { action: FormDataEntryValue | null; method: string } = { action: null, method: '' };
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      seen.action = new FormData(form, event.submitter).get('action');
      seen.method = (event.submitter as HTMLButtonElement).formMethod;
    });

    el.click();
    expect(seen.action).to.equal('save');
    expect(seen.method).to.equal('post');
    expect(form.querySelectorAll('button').length, 'transient submitter is removed').to.equal(0);

    input.value = 'changed';
    el.type = 'reset';
    el.click();
    expect(input.value).to.equal('initial');
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

  it('supports appearance="quiet": muted border/text tokens, transparent until hover', async () => {
    // Rendered results, not stylesheet text: a selector that never matches reads identically in
    // the source, and the hover half of this pair shipped for two majors resolving to the page
    // surface -- i.e. no hover at all -- while a source assertion on it stayed green.
    const el = (await fixture(html`<lr-button appearance="quiet">Save</lr-button>`)) as LyraButton;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    const computed = getComputedStyle(base);
    expect(computed.backgroundColor, 'quiet is transparent at rest').to.equal('rgba(0, 0, 0, 0)');
    expect(computed.color, 'quiet text is the muted token, not the body text').to.not.equal(
      getComputedStyle(el).color,
    );
    // The two quiet knobs reach the rendered box: re-point each and watch the box follow.
    const retuned = (await fixture(html`
      <lr-button appearance="quiet" style="--lr-button-quiet-text: rgb(1, 2, 3); --lr-button-quiet-border: rgb(4, 5, 6);"
        >Save</lr-button
      >
    `)) as LyraButton;
    await retuned.updateComplete;
    const retunedBase = getComputedStyle(retuned.shadowRoot!.querySelector('[part~="base"]') as HTMLElement);
    expect(retunedBase.color).to.equal('rgb(1, 2, 3)');
    expect(retunedBase.borderTopColor).to.equal('rgb(4, 5, 6)');
  });

  it('keeps appearance="quiet"\'s text/border independent of variant (unlike outlined)', async () => {
    const neutralEl = (await fixture(
      html`<lr-button appearance="quiet" variant="neutral">Save</lr-button>`,
    )) as LyraButton;
    const dangerEl = (await fixture(
      html`<lr-button appearance="quiet" variant="danger">Save</lr-button>`,
    )) as LyraButton;
    expect(dangerEl.getAttribute('appearance')).to.equal('quiet');
    const neutralBase = neutralEl.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    const dangerBase = dangerEl.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    expect(getComputedStyle(neutralBase).color).to.equal(getComputedStyle(dangerBase).color);
    expect(getComputedStyle(neutralBase).borderColor).to.equal(getComputedStyle(dangerBase).borderColor);
  });

  it('ships a default :hover/:active treatment on [part~="base"], disabled under reduced motion', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    // The hover/press COLOURS are asserted as rendered results in the hover-and-press-feedback
    // block below -- a stylesheet-text match cannot tell a fill that moves from one that resolves
    // to the page surface, which is exactly how the quiet hover shipped broken. What is left here
    // is the reduced-motion contract, which is a media-query shape rather than a colour.
    expect(css).to.match(/\[part~='base'\]:not\(:disabled\):active\s*\{[^}]*transform:\s*scale\(/);
    expect(css).to.match(
      /@media \(prefers-reduced-motion: reduce\) \{[^]*\[part~='base'\]:not\(:disabled\):active\s*\{[^}]*transform:\s*none[^}]*\}[^]*\}/,
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
    const button = el.shadowRoot!.querySelector('button[part~="base"]') as HTMLButtonElement;
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
    const filledBase = filledEl.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    const accentBase = accentEl.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    expect(getComputedStyle(accentBase).backgroundColor).to.not.equal(
      getComputedStyle(filledBase).backgroundColor,
    );
  });

  it('reads the standard medium tier from the shared ladder and keeps the floor rethemeable', async () => {
    const el = (await fixture(html`<lr-button>Go</lr-button>`)) as LyraButton;
    const baseEl = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    expect(getComputedStyle(baseEl).fontSize).to.equal('16px');
    expect(getComputedStyle(baseEl).minBlockSize).to.equal('40px');
    // The per-tier floor still reaches min-block-size through --lr-button-size-*, so overriding one
    // tier for buttons alone stays a one-property change rather than a ::part(base) rule.
    el.style.setProperty('--lr-button-size-m', '52px');
    await el.updateComplete;
    expect(getComputedStyle(baseEl).minBlockSize).to.equal('52px');
  });

  it("matches lr-input's/lr-select's shared control height at every size tier so a button never sits shorter than its row neighbors", async () => {
    // The one form-control ladder, measured rather than grepped: these are the same six values
    // lr-input's and lr-select's own tier tests assert.
    const expected: Record<string, string> = {
      '2xs': '20px', xs: '24px', s: '30px', m: '40px', l: '48px', xl: '56px',
    };
    for (const [size, px] of Object.entries(expected)) {
      const el = (await fixture(html`<lr-button size=${size}>Go</lr-button>`)) as LyraButton;
      const baseEl = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
      expect(getComputedStyle(baseEl).minBlockSize, `size=${size}`).to.equal(px);
    }
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
    const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
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
    const linkBase = linkEl.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    const plainBase = plainEl.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    expect(getComputedStyle(linkBase).color).to.equal(getComputedStyle(plainBase).color);
  });

  it('inherits the ambient font-size for appearance="link" instead of forcing a per-size font-size', async () => {
    const el = (await fixture(html`
      <div style="font-size: 21px;">
        <lr-button appearance="link" size="m">Retry</lr-button>
      </div>
    `)) as HTMLElement;
    const button = el.querySelector('lr-button') as LyraButton;
    const base = button.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    expect(getComputedStyle(base).fontSize).to.equal('21px');
  });

  it('declares the underline offset and keeps a focus-visible outline for appearance="link"', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/:host\(\[appearance='link'\]\) \[part~='base'\][^}]*text-decoration: underline/);
    expect(css).to.match(
      /:host\(\[appearance='link'\]\) \[part~='base'\][^}]*text-underline-offset: var\(--lr-size-0-15rem\)/,
    );
    // The generic focus-visible rule still applies to the link appearance (it is not overridden).
    expect(css).to.match(/\[part~='base'\]:focus-visible\s*\{[^}]*outline:/);
  });

  it('is accessible as an inline link', async () => {
    const el = await fixture(html`<lr-button appearance="link" variant="brand">Retry</lr-button>`);
    await expect(el).to.be.accessible();
  });

  it('supports size="2xs": tighter than xs, with the ladder\'s tightest floor', async () => {
    const el = (await fixture(html`<lr-button size="2xs">Go</lr-button>`)) as LyraButton;
    const xsEl = (await fixture(html`<lr-button size="xs">Go</lr-button>`)) as LyraButton;
    const cs = getComputedStyle(el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement);
    const xsCs = getComputedStyle(xsEl.shadowRoot!.querySelector('[part~="base"]') as HTMLElement);
    expect(cs.minBlockSize).to.equal('20px');
    expect(parseFloat(cs.fontSize)).to.be.lessThan(parseFloat(xsCs.fontSize));
    expect(parseFloat(cs.paddingInlineStart)).to.be.lessThan(parseFloat(xsCs.paddingInlineStart));
  });

  it('reflects size="2xs" as a host attribute', async () => {
    const el = (await fixture(html`<lr-button size="2xs">Go</lr-button>`)) as LyraButton;
    expect(el.size).to.equal('2xs');
    expect(el.getAttribute('size')).to.equal('2xs');
  });

  describe('sizing custom properties', () => {
    // The geometry each tier renders, hardcoded in px (root font-size is 16px) rather than
    // re-derived from the same tokens the stylesheet uses, so a token edit cannot make this test
    // agree with itself. Since 8.0.0 every value comes from the one shared form-control ladder
    // (internal/sizes.styles.ts): the min-heights are unchanged tier for tier, while padding and
    // font-size moved onto the ladder's own steps.
    const tiers = [
      { size: '2xs', padInline: '2px', padBlock: '0px', fontSize: '10px', minHeight: '20px' },
      { size: 'xs', padInline: '4px', padBlock: '0px', fontSize: '12px', minHeight: '24px' },
      { size: 's', padInline: '8px', padBlock: '2px', fontSize: '13px', minHeight: '30px' },
      { size: 'm', padInline: '12px', padBlock: '4px', fontSize: '16px', minHeight: '40px' },
      { size: 'l', padInline: '16px', padBlock: '8px', fontSize: '18px', minHeight: '48px' },
      { size: 'xl', padInline: '16px', padBlock: '8px', fontSize: '20px', minHeight: '56px' },
    ];

    const base = (el: LyraButton) => el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;

    it('renders the ladder\'s padding/font-size/min-height at all six tiers when the properties are untouched', async () => {
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

    it('takes every tier\'s geometry from the shared ladder, with no per-tier rule on [part~="base"]', () => {
      const css = styles.cssText.replace(/\s+/g, ' ');
      // The knobs read the ladder rather than restating a scale of their own.
      expect(css).to.match(
        /:host \{[^}]*--lr-button-padding-block: var\(--lr-form-control-padding-block\);[^}]*--lr-button-padding-inline: var\(--lr-form-control-padding-inline\);[^}]*--lr-button-font-size: var\(--lr-form-control-font-size\);/,
      );
      expect(css, 'no tier may restate a padding or font-size value of its own').to.not.match(
        /:host\(\[size='[^']+'\]\)[^{]*\{[^}]*--lr-button-(?:padding|font-size)/,
      );
      expect(css).to.match(
        /\[part~='base'\] \{[^}]*padding-inline: var\(--lr-button-padding-inline\);[^}]*padding-block: var\(--lr-button-padding-block\);/,
      );
      // A per-tier rule may only re-assign a cssprop -- never declare a property on the part.
      for (const size of ['2xs', 'xs', 's', 'l', 'xl']) {
        expect(css, `size=${size} must not restyle [part~='base'] directly`).to.not.include(
          `:host([size='${size}']) [part~='base']`,
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

    it('keeps the gap constant across tiers while the radius follows the shared ladder', async () => {
      const mEl = (await fixture(html`<lr-button>Go</lr-button>`)) as LyraButton;
      const xsEl = (await fixture(html`<lr-button size="xs">Go</lr-button>`)) as LyraButton;
      expect(getComputedStyle(base(mEl)).gap).to.equal('2px');
      expect(getComputedStyle(base(xsEl)).gap).to.equal('2px');
      // The radius does vary: a 6px corner on a 24px-tall button reads as a lozenge.
      expect(getComputedStyle(base(mEl)).borderTopLeftRadius).to.equal('6px');
      expect(getComputedStyle(base(xsEl)).borderTopLeftRadius).to.equal('2px');
    });

    it('leaves --lr-button-height genuinely undeclared so its var() fallback arm can fire', () => {
      const css = styles.cssText.replace(/\s+/g, ' ');
      // A declared value -- even `auto` -- is a *defined* value that wins, so the fallback arm
      // would never run and every tier's floor would be dead code (see select.styles.ts:37-49).
      expect(css, '--lr-button-height must never be declared, only read').to.not.match(
        /--lr-button-height:/,
      );
      expect(css).to.match(
        /\[part~='base'\] \{[^}]*min-block-size: var\(--lr-button-height, var\(--lr-button-min-height\)\);[^}]*block-size: var\(--lr-button-height, auto\);/,
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
      const startWrapper = el.shadowRoot!.querySelector('[part~="start"]') as HTMLElement;
      const endWrapper = el.shadowRoot!.querySelector('[part~="end"]') as HTMLElement;
      // Assert the *rendered* result, not the stylesheet text: a silently-inert :empty rule
      // (a <slot> is an element child, so :empty never matched) is invisible to CSS-text asserts.
      expect(getComputedStyle(startWrapper).display).to.equal('none');
      expect(getComputedStyle(endWrapper).display).to.equal('none');
    });

    it('keeps the start wrapper visible when content is slotted into start', async () => {
      const el = (await fixture(
        html`<lr-button><span slot="start">*</span>Label</lr-button>`,
      )) as LyraButton;
      const startWrapper = el.shadowRoot!.querySelector('[part~="start"]') as HTMLElement;
      const endWrapper = el.shadowRoot!.querySelector('[part~="end"]') as HTMLElement;
      expect(getComputedStyle(startWrapper).display).to.not.equal('none');
      // The unused end wrapper still collapses.
      expect(getComputedStyle(endWrapper).display).to.equal('none');
    });
  });

  describe('appearance="outlined" fill', () => {
    it('stays transparent when --lr-button-outlined-fill is unset', async () => {
      const el = (await fixture(html`<lr-button appearance="outlined">Save</lr-button>`)) as LyraButton;
      const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
      expect(getComputedStyle(base).backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    });

    it('tints an outlined button through --lr-button-outlined-fill with no ::part() rule', async () => {
      const el = (await fixture(html`<lr-button appearance="outlined">Save</lr-button>`)) as LyraButton;
      el.style.setProperty('--lr-button-outlined-fill', 'rgb(12, 34, 56)');
      await el.updateComplete;
      const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
      expect(getComputedStyle(base).backgroundColor).to.equal('rgb(12, 34, 56)');
    });

    it('declares --lr-button-outlined-fill beside --lr-button-outlined-border and consumes it', () => {
      const css = styles.cssText.replace(/\s+/g, ' ');
      expect(css).to.include('--lr-button-outlined-fill: transparent;');
      expect(css).to.match(
        /:host\(\[appearance='outlined'\]\) \[part~='base'\] \{[^}]*background: var\(--lr-button-outlined-fill\);/,
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
      const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
      const probe = document.createElement('span');
      probe.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
      document.body.appendChild(probe);
      const expected = getComputedStyle(probe).boxShadow;
      document.body.removeChild(probe);
      expect(getComputedStyle(base).boxShadow).to.equal(expected);
    });

    it('renders no box-shadow when the token is unset (regression)', async () => {
      const el = (await fixture(html`<lr-button>Save</lr-button>`)) as LyraButton;
      const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
      expect(getComputedStyle(base).boxShadow).to.equal('none');
    });
  });

  describe('anchor mode (href/target/download)', () => {
    it('renders a real <a> when href is set', async () => {
      const el = (await fixture(
        html`<lr-button href="https://example.com">Go</lr-button>`,
      )) as LyraButton;
      const anchor = el.shadowRoot!.querySelector('a[part~="base"]') as HTMLAnchorElement;
      expect(anchor).to.exist;
      expect(anchor.getAttribute('href')).to.equal('https://example.com');
      expect(el.shadowRoot!.querySelector('button[part~="base"]')).to.not.exist;
    });

    it('still renders the label/start/end/spinner content inside the anchor', async () => {
      const el = (await fixture(
        html`<lr-button href="https://example.com"><span slot="start">*</span>Go</lr-button>`,
      )) as LyraButton;
      const anchor = el.shadowRoot!.querySelector('a[part~="base"]') as HTMLAnchorElement;
      expect(anchor.querySelector('[part="label"]')).to.exist;
      expect(anchor.querySelector('[part~="start"]')).to.exist;
      expect(anchor.querySelector('[part~="end"]')).to.exist;
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
      const anchor = el.shadowRoot!.querySelector('a[part~="base"]') as HTMLAnchorElement;
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
      expect(el.shadowRoot!.querySelector('[part~="base"]')!.localName).to.equal('button');
    });

    it('ignores an unsafe href scheme, falling back to the native button', async () => {
      const el = (await fixture(
        html`<lr-button href="javascript:alert(1)">Go</lr-button>`,
      )) as LyraButton;
      expect(el.shadowRoot!.querySelector('a[part~="base"]')).to.not.exist;
      expect(el.shadowRoot!.querySelector('button[part~="base"]')).to.exist;
    });

    it('forwards a host aria-label onto the internal anchor as a literal string', async () => {
      const el = (await fixture(
        html`<lr-button href="https://example.com" aria-label="Open the site">Go</lr-button>`,
      )) as LyraButton;
      const anchor = el.shadowRoot!.querySelector('a[part~="base"]') as HTMLAnchorElement;
      expect(anchor.getAttribute('aria-label')).to.equal('Open the site');
    });

    it('forwards host click()/focus()/blur() to the internal anchor', async () => {
      const el = (await fixture(
        html`<lr-button href="https://example.com">Go</lr-button>`,
      )) as LyraButton;
      const anchor = el.shadowRoot!.querySelector('a[part~="base"]') as HTMLAnchorElement;
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
        const anchor = el.shadowRoot!.querySelector('a[part~="base"]') as HTMLAnchorElement;
        expect(anchor).to.exist;
        expect(anchor.hasAttribute('href'), 'a disabled link button must not carry href').to.be
          .false;
        expect(anchor.getAttribute('aria-disabled')).to.equal('true');
      });

      it('does not navigate on click while disabled (an anchor with no href is not activatable)', async () => {
        const el = (await fixture(
          html`<lr-button disabled href="https://example.com">Go</lr-button>`,
        )) as LyraButton;
        const anchor = el.shadowRoot!.querySelector('a[part~="base"]') as HTMLAnchorElement;
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
        const anchor = el.shadowRoot!.querySelector('a[part~="base"]') as HTMLAnchorElement;
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
        const anchor = el.shadowRoot!.querySelector('a[part~="base"]') as HTMLAnchorElement;
        expect(anchor.hasAttribute('href')).to.be.false;
        expect(anchor.getAttribute('aria-disabled')).to.equal('true');
      });
    });

    describe('unset-regression: href unset renders the native button unchanged', () => {
      it('still renders a native <button> and honors variant/appearance/size when href is unset', async () => {
        const el = (await fixture(
          html`<lr-button variant="brand" appearance="outlined" size="l">Go</lr-button>`,
        )) as LyraButton;
        expect(el.shadowRoot!.querySelector('button[part~="base"]')).to.exist;
        expect(el.shadowRoot!.querySelector('a[part~="base"]')).to.not.exist;
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
        (el.shadowRoot!.querySelector('button[part~="base"]') as HTMLButtonElement).click();
        expect(submitted).to.be.true;
      });
    });
  });
});

it('makes a loading anchor busy and fully inoperable', async () => {
  const el = (await fixture(
    html`<lr-button href="https://example.com" loading>Save</lr-button>`,
  )) as LyraButton;
  const anchor = el.shadowRoot!.querySelector('a[part~="base"]') as HTMLAnchorElement;
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

it('tracks slotted end content through slotchange', async () => {
  const el = (await fixture(html`
    <lr-button>Save<span slot="end">&rarr;</span></lr-button>
  `)) as LyraButton;
  await el.updateComplete;
  const flags = el as unknown as { hasEndSlot: boolean };
  expect(flags.hasEndSlot).to.be.true;
  el.querySelector('[slot="end"]')!.remove();
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await el.updateComplete;
  expect(flags.hasEndSlot).to.be.false;
});

describe('lr-button: pill', () => {
  it('rounds the base to the pill radius token', async () => {
    const el = (await fixture(html`<lr-button pill>Save</lr-button>`)) as LyraButton;
    expect(el.pill).to.be.true;
    expect(el.getAttribute('pill')).to.equal('');
    const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    // Rendered result, not stylesheet text: --lr-radius-pill resolves to 999px by default.
    expect(getComputedStyle(base).borderRadius).to.equal('999px');
  });

  it('rounds a pill link button’s anchor the same way', async () => {
    const el = (await fixture(
      html`<lr-button pill href="https://example.com">Go</lr-button>`,
    )) as LyraButton;
    const base = el.shadowRoot!.querySelector('a[part~="base"]') as HTMLElement;
    expect(getComputedStyle(base).borderRadius).to.equal('999px');
  });

  it('leaves the corner radius on --lr-button-radius when pill is unset (regression)', async () => {
    const el = (await fixture(html`<lr-button>Save</lr-button>`)) as LyraButton;
    expect(el.pill).to.be.false;
    expect(el.hasAttribute('pill')).to.be.false;
    const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    // --lr-radius (0.375rem) at the default 16px root font size, exactly as before pill existed.
    expect(getComputedStyle(base).borderRadius).to.equal('6px');
  });

  it('drops back to the default radius when pill is turned off again', async () => {
    const el = (await fixture(html`<lr-button pill>Save</lr-button>`)) as LyraButton;
    el.pill = false;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    expect(getComputedStyle(base).borderRadius).to.equal('6px');
  });

  it('keeps appearance="link" at zero radius even while pill is set', async () => {
    const el = (await fixture(
      html`<lr-button pill appearance="link">Retry</lr-button>`,
    )) as LyraButton;
    const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    expect(getComputedStyle(base).borderRadius).to.equal('0px');
  });

  it('is accessible as a pill button', async () => {
    const el = await fixture(html`<lr-button pill variant="brand">Save</lr-button>`);
    await expect(el).to.be.accessible();
  });
});

describe('lr-button: with-caret', () => {
  it('renders no caret part by default (regression)', async () => {
    const el = (await fixture(html`<lr-button>Menu</lr-button>`)) as LyraButton;
    expect(el.withCaret).to.be.false;
    expect(el.shadowRoot!.querySelectorAll('[part="caret"]').length).to.equal(0);
  });

  it('renders a decorative caret glyph when with-caret is set', async () => {
    const el = (await fixture(html`<lr-button with-caret>Menu</lr-button>`)) as LyraButton;
    expect(el.withCaret).to.be.true;
    expect(el.getAttribute('with-caret')).to.equal('');
    const caret = el.shadowRoot!.querySelector('[part="caret"]') as HTMLElement;
    // The glyph carries no accessible name: the label already names the trigger.
    expect(caret.getAttribute('aria-hidden')).to.equal('true');
    expect(el.shadowRoot!.querySelectorAll('[part="caret"] svg').length).to.equal(1);
  });

  it('points the caret down by rotating the wrapping part’s glyph', async () => {
    const el = (await fixture(html`<lr-button with-caret>Menu</lr-button>`)) as LyraButton;
    const glyph = el.shadowRoot!.querySelector('[part="caret"] svg') as unknown as HTMLElement;
    // rotate(90deg) on the shared right-pointing chevron == matrix(0, 1, -1, 0, 0, 0).
    expect(getComputedStyle(glyph).transform).to.equal('matrix(0, 1, -1, 0, 0, 0)');
  });

  it('renders the caret in anchor mode too', async () => {
    const el = (await fixture(
      html`<lr-button with-caret href="https://example.com">Menu</lr-button>`,
    )) as LyraButton;
    expect(el.shadowRoot!.querySelectorAll('a[part~="base"] [part="caret"]').length).to.equal(1);
  });

  it('hides the caret behind the loading spinner, like the label and adornments', async () => {
    const el = (await fixture(
      html`<lr-button with-caret .loading=${true}>Menu</lr-button>`,
    )) as LyraButton;
    const caret = el.shadowRoot!.querySelector('[part="caret"]') as HTMLElement;
    expect(getComputedStyle(caret).opacity).to.equal('0');
  });

  it('removes the caret again when with-caret is turned off', async () => {
    const el = (await fixture(html`<lr-button with-caret>Menu</lr-button>`)) as LyraButton;
    el.withCaret = false;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="caret"]').length).to.equal(0);
    expect(el.hasAttribute('with-caret')).to.be.false;
  });

  it('keeps the caret at the inline end under RTL, with the glyph un-mirrored', async () => {
    const el = (await fixture(
      html`<lr-button dir="rtl" with-caret>القائمة</lr-button>`,
    )) as LyraButton;
    const caret = el.shadowRoot!.querySelector('[part="caret"]') as HTMLElement;
    const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
    // Inline-end under RTL is physically to the left of the label.
    expect(caret.getBoundingClientRect().left).to.be.lessThan(
      label.getBoundingClientRect().left,
    );
    // A downward caret is direction-neutral: it must not flip with the writing direction.
    const glyph = el.shadowRoot!.querySelector('[part="caret"] svg') as unknown as HTMLElement;
    expect(getComputedStyle(glyph).transform).to.equal('matrix(0, 1, -1, 0, 0, 0)');
  });

  it('is accessible as a caret-bearing dropdown trigger', async () => {
    const el = await fixture(
      html`<lr-button with-caret aria-haspopup="menu" aria-expanded="false">Actions</lr-button>`,
    );
    await expect(el).to.be.accessible();
  });
});

describe('lr-button: appearance="filled-outlined"', () => {
  it('combines the filled fill with the outlined border color', async () => {
    const filledEl = (await fixture(
      html`<lr-button appearance="filled" variant="brand">Save</lr-button>`,
    )) as LyraButton;
    const outlinedEl = (await fixture(
      html`<lr-button appearance="outlined" variant="brand">Save</lr-button>`,
    )) as LyraButton;
    const bothEl = (await fixture(
      html`<lr-button appearance="filled-outlined" variant="brand">Save</lr-button>`,
    )) as LyraButton;
    expect(bothEl.appearance).to.equal('filled-outlined');
    expect(bothEl.getAttribute('appearance')).to.equal('filled-outlined');

    const filled = getComputedStyle(filledEl.shadowRoot!.querySelector('[part~="base"]')!);
    const outlined = getComputedStyle(outlinedEl.shadowRoot!.querySelector('[part~="base"]')!);
    const both = getComputedStyle(bothEl.shadowRoot!.querySelector('[part~="base"]')!);

    expect(both.backgroundColor).to.equal(filled.backgroundColor);
    expect(both.color).to.equal(filled.color);
    expect(both.borderTopColor).to.equal(outlined.borderTopColor);
    // The whole point of the tier: a border that reads distinctly against its own fill.
    expect(both.borderTopColor).to.not.equal(filled.borderTopColor);
  });

  it('is accessible', async () => {
    const el = await fixture(
      html`<lr-button appearance="filled-outlined" variant="brand">Save</lr-button>`,
    );
    await expect(el).to.be.accessible();
  });
});

describe('lr-button: named submitter and form-submission overrides', () => {
  it('contributes its name/value pair to the submitted FormData', async () => {
    const form = (await fixture(html`
      <form>
        <input name="q" value="hello" />
        <lr-button type="submit" name="action" value="save">Save</lr-button>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-button') as LyraButton;
    const captured: Record<string, string | null> = {};
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form, event.submitter);
      captured.action = data.get('action') as string | null;
      captured.q = data.get('q') as string | null;
    });
    el.click();
    expect(captured.action).to.equal('save');
    expect(captured.q).to.equal('hello');
  });

  it('contributes an empty value for a named button with no value', async () => {
    const form = (await fixture(html`
      <form><lr-button type="submit" name="action">Save</lr-button></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-button') as LyraButton;
    const captured: Record<string, string | null> = { action: null };
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      captured.action = new FormData(form, event.submitter).get('action') as string | null;
    });
    el.click();
    expect(captured.action).to.equal('');
  });

  it('leaves the submitted FormData and event.submitter untouched when nothing is named (regression)', async () => {
    const form = (await fixture(html`
      <form>
        <input name="q" value="hello" />
        <lr-button type="submit">Save</lr-button>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-button') as LyraButton;
    const seen: { submitterIsNull: boolean; keys: string[] } = { submitterIsNull: false, keys: [] };
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      seen.submitterIsNull = event.submitter === null;
      seen.keys = Array.from(new FormData(form, event.submitter).keys());
    });
    el.click();
    expect(seen.submitterIsNull).to.be.true;
    expect(seen.keys).to.deep.equal(['q']);
  });

  it('leaves no transient submitter behind in the form', async () => {
    const form = (await fixture(html`
      <form><lr-button type="submit" name="action" value="save">Save</lr-button></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-button') as LyraButton;
    const elementCountBefore = form.elements.length;
    form.addEventListener('submit', (event) => event.preventDefault());
    el.click();
    expect(form.querySelectorAll('button').length).to.equal(0);
    expect(form.elements.length).to.equal(elementCountBefore);
  });

  it('runs constraint validation on the real submission, blocking an invalid form', async () => {
    const form = (await fixture(html`
      <form>
        <input name="q" required />
        <lr-button type="submit" name="action" value="save">Save</lr-button>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-button') as LyraButton;
    let submitted = false;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submitted = true;
    });
    el.click();
    expect(submitted).to.be.false;
  });

  it('skips constraint validation when formnovalidate is set', async () => {
    const form = (await fixture(html`
      <form>
        <input name="q" required />
        <lr-button type="submit" name="action" value="save" formnovalidate>Save</lr-button>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-button') as LyraButton;
    expect(el.formNoValidate).to.be.true;
    let submitted = false;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submitted = true;
    });
    el.click();
    expect(submitted).to.be.true;
  });

  it('applies formaction/formenctype/formmethod/formtarget to the element the browser submits with', async () => {
    const form = (await fixture(html`
      <form action="/default-endpoint" method="get">
        <lr-button
          type="submit"
          name="action"
          value="save"
          formaction="/custom-endpoint"
          formenctype="multipart/form-data"
          formmethod="post"
          formtarget="_blank"
          >Save</lr-button
        >
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-button') as LyraButton;
    expect(el.formAction).to.equal('/custom-endpoint');
    expect(el.formEnctype).to.equal('multipart/form-data');
    expect(el.formMethod).to.equal('post');
    expect(el.formTarget).to.equal('_blank');

    const seen: Record<string, string> = {};
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const submitter = event.submitter as HTMLButtonElement;
      Object.assign(seen, {
        tag: submitter.localName,
        type: submitter.type,
        name: submitter.name,
        value: submitter.value,
        action: submitter.formAction,
        enctype: submitter.formEnctype,
        method: submitter.formMethod,
        target: submitter.formTarget,
      });
    });
    el.click();

    expect(seen.tag).to.equal('button');
    expect(seen.type).to.equal('submit');
    expect(seen.name).to.equal('action');
    expect(seen.value).to.equal('save');
    expect(seen.action).to.include('/custom-endpoint');
    expect(seen.enctype).to.equal('multipart/form-data');
    expect(seen.method).to.equal('post');
    expect(seen.target).to.equal('_blank');
  });

  it('closes an ancestor dialog with its value through formmethod="dialog"', async () => {
    const dialog = (await fixture(html`
      <dialog>
        <form>
          <lr-button type="submit" name="action" value="save" formmethod="dialog">Save</lr-button>
        </form>
      </dialog>
    `)) as HTMLDialogElement;
    const el = dialog.querySelector('lr-button') as LyraButton;
    dialog.show();
    expect(dialog.open).to.be.true;
    el.click();
    expect(dialog.open).to.be.false;
    expect(dialog.returnValue).to.equal('save');
  });

  it('reflects name synchronously on assignment, with no await', async () => {
    const el = (await fixture(html`<lr-button type="submit">Save</lr-button>`)) as LyraButton;
    el.name = 'action';
    expect(el.getAttribute('name')).to.equal('action');
    el.name = '';
    expect(el.hasAttribute('name')).to.be.false;
  });

  it('submits with a name assigned in the same tick as the click', async () => {
    const form = (await fixture(html`
      <form><lr-button type="submit">Save</lr-button></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-button') as LyraButton;
    const captured: Record<string, string | null> = { action: null };
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      captured.action = new FormData(form, event.submitter).get('action') as string | null;
    });
    // No `await el.updateComplete` between the two: a rename must reach the submission
    // synchronously, not on Lit's async update cycle.
    el.name = 'action';
    el.value = 'save';
    el.click();
    expect(captured.action).to.equal('save');
  });

  it('exposes the submitter overrides as unset by default (regression)', async () => {
    const el = (await fixture(html`<lr-button type="submit">Save</lr-button>`)) as LyraButton;
    expect(el.name).to.equal('');
    expect(el.value).to.equal('');
    expect(el.formAction).to.be.undefined;
    expect(el.formEnctype).to.be.undefined;
    expect(el.formMethod).to.be.undefined;
    expect(el.formTarget).to.be.undefined;
    expect(el.formNoValidate).to.be.false;
  });

  it('never submits from a named button whose type is not submit', async () => {
    const form = (await fixture(html`
      <form><lr-button name="action" value="save">Save</lr-button></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-button') as LyraButton;
    let submitted = false;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submitted = true;
    });
    el.click();
    expect(submitted).to.be.false;
    expect(form.querySelectorAll('button').length).to.equal(0);
  });

  it('still resets from a named type="reset" button, with no transient submitter', async () => {
    const form = (await fixture(html`
      <form>
        <input name="q" />
        <lr-button type="reset" name="action" value="clear">Reset</lr-button>
      </form>
    `)) as HTMLFormElement;
    const input = form.querySelector('input') as HTMLInputElement;
    input.value = 'changed';
    const el = form.querySelector('lr-button') as LyraButton;
    el.click();
    expect(input.value).to.equal('');
    expect(form.querySelectorAll('button').length).to.equal(0);
  });

  it('ignores the submitter surface entirely in anchor mode', async () => {
    const form = (await fixture(html`
      <form>
        <lr-button type="submit" name="action" value="save" href="https://example.com"
          >Go</lr-button
        >
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-button') as LyraButton;
    const anchor = el.shadowRoot!.querySelector('a[part~="base"]') as HTMLAnchorElement;
    let submitted = false;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submitted = true;
    });
    anchor.addEventListener('click', (event) => event.preventDefault());
    el.click();
    expect(submitted).to.be.false;
    expect(form.querySelectorAll('button').length).to.equal(0);
  });
});

describe('lr-button — the shared styling vocabulary', () => {
  const base = (el: LyraButton) => el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  const height = (el: LyraButton) => base(el).getBoundingClientRect().height;

  it('defaults appearance to the loud accent tier, matching the upstream default', async () => {
    const el = (await fixture(html`<lr-button>Save</lr-button>`)) as LyraButton;
    expect(el.appearance).to.equal('accent');
    expect(el.getAttribute('appearance')).to.equal('accent');
  });

  // A migrating consumer keeps `size="small"` from wa-*/sl-* markup; it has to land on exactly the
  // same tier `size="s"` does, geometry included, or the rename is only half a migration.
  it('renders the Web Awesome size spellings at the same height as the canonical steps', async () => {
    for (const [alias, step] of [['small', 's'], ['medium', 'm'], ['large', 'l']] as const) {
      const aliasEl = (await fixture(html`<lr-button size=${alias}>Go</lr-button>`)) as LyraButton;
      const stepEl = (await fixture(html`<lr-button size=${step}>Go</lr-button>`)) as LyraButton;
      expect(height(aliasEl), `size=${alias} height`).to.equal(height(stepEl));
      expect(getComputedStyle(base(aliasEl)).fontSize, `size=${alias} font-size`).to.equal(
        getComputedStyle(base(stepEl)).fontSize,
      );
      expect(getComputedStyle(base(aliasEl)).paddingLeft, `size=${alias} padding-inline`).to.equal(
        getComputedStyle(base(stepEl)).paddingLeft,
      );
    }
  });

  it('reads its control height from the shared form-control ladder at every tier', async () => {
    const expected: Record<string, number> = { '2xs': 20, xs: 24, s: 30, m: 40, l: 48, xl: 56 };
    for (const [size, px] of Object.entries(expected)) {
      const el = (await fixture(html`<lr-button size=${size}>Go</lr-button>`)) as LyraButton;
      expect(height(el), `size=${size}`).to.equal(px);
    }
  });

  // Before 8.0.0 both tiers resolved to the same loud token for the four chromatic variants, so
  // `accent` and `filled` painted identically and the distinction existed only in the docs.
  it('paints appearance="accent" differently from appearance="filled" for every variant', async () => {
    for (const variant of ['neutral', 'brand', 'success', 'warning', 'danger'] as const) {
      const filledEl = (await fixture(
        html`<lr-button appearance="filled" variant=${variant}>Save</lr-button>`,
      )) as LyraButton;
      const accentEl = (await fixture(
        html`<lr-button appearance="accent" variant=${variant}>Save</lr-button>`,
      )) as LyraButton;
      const filled = getComputedStyle(base(filledEl));
      const accent = getComputedStyle(base(accentEl));
      expect(accent.backgroundColor, `variant=${variant} background`).to.not.equal(filled.backgroundColor);
      expect(accent.color, `variant=${variant} foreground`).to.not.equal(filled.color);
      // ...and neither tier may fall back to "no fill at all" on the page surface.
      expect(filled.backgroundColor, `variant=${variant} filled must not be transparent`).to.not.equal(
        'rgba(0, 0, 0, 0)',
      );
    }
  });

  // The grid's shape is identical in both modes -- only which ramp step each slot points at moves --
  // so the accent/filled split must survive the theme switch rather than being a light-mode accident.
  it('keeps accent and filled apart in dark mode too', async () => {
    for (const variant of ['neutral', 'brand', 'danger'] as const) {
      const wrapper = (await fixture(html`
        <div data-lr-theme="dark">
          <lr-button appearance="filled" variant=${variant}>Save</lr-button>
          <lr-button appearance="accent" variant=${variant}>Save</lr-button>
        </div>
      `)) as HTMLElement;
      const [filledEl, accentEl] = Array.from(wrapper.querySelectorAll('lr-button')) as LyraButton[];
      const filled = getComputedStyle(base(filledEl!));
      const accent = getComputedStyle(base(accentEl!));
      expect(accent.backgroundColor, `dark variant=${variant} background`).to.not.equal(
        filled.backgroundColor,
      );
      expect(filled.backgroundColor, `dark variant=${variant} filled must not be transparent`).to.not.equal(
        'rgba(0, 0, 0, 0)',
      );
    }
  });

  it('is accessible in its new default appearance, and as a pill textarea-adjacent control', async () => {
    await expect(await fixture(html`<lr-button>Save</lr-button>`)).to.be.accessible();
    await expect(
      await fixture(html`<lr-button pill variant="danger" appearance="filled">Delete</lr-button>`),
    ).to.be.accessible();
  });
});

describe('lr-button hover and press feedback', () => {
  // Every fixture below zeroes --lr-transition-fast: [part~='base'] transitions its background, so
  // reading getComputedStyle one frame after the pointer arrives would otherwise catch the
  // INTERPOLATED colour -- still the resting one at t=0 -- and report a working hover as broken.
  // The colour a fill has to differ FROM, resolved through the same token cascade the component
  // itself reads. Painted onto a throwaway node inside the button's own shadow root so the value
  // comes back as a normalised rgb()/color() string -- reading the custom property directly would
  // hand back the raw token text, which is not comparable to a computed background-color, and
  // hardcoding a hex would go stale the moment the generated palette moves.
  function surfaceColor(el: LyraButton): string {
    const probe = document.createElement('div');
    probe.style.background = 'var(--lr-color-surface)';
    el.shadowRoot!.appendChild(probe);
    const painted = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return painted;
  }

  const center = (node: Element): [number, number] => {
    const rect = node.getBoundingClientRect();
    return [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)];
  };

  for (const appearance of ['quiet', 'plain'] as const) {
    it(`paints a hovered appearance="${appearance}" button something other than the page surface`, async () => {
      const el = (await fixture(
        html`<lr-button appearance=${appearance} style="--lr-transition-fast: 0s">Save</lr-button>`,
      )) as LyraButton;
      await el.updateComplete;
      const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
      const surface = surfaceColor(el);
      const resting = getComputedStyle(base).backgroundColor;
      try {
        await sendMouse({ type: 'move', position: center(base) });
        const hovered = getComputedStyle(base).backgroundColor;
        // Both hover defaults used to resolve to --lr-color-surface itself, i.e. the page
        // background, so hovering changed nothing at all on a default page.
        expect(hovered, `${appearance} hover vs page surface`).to.not.equal(surface);
        expect(hovered, `${appearance} hover vs resting`).to.not.equal(resting);
      } finally {
        await resetMouse();
      }
    });
  }

  it('presses a quiet button to a background stronger than -- and different from -- its hover', async () => {
    const el = (await fixture(
      html`<lr-button appearance="quiet" style="--lr-transition-fast: 0s">Save</lr-button>`,
    )) as LyraButton;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    try {
      await sendMouse({ type: 'move', position: center(base) });
      const hovered = getComputedStyle(base).backgroundColor;
      await sendMouse({ type: 'down' });
      const pressed = getComputedStyle(base).backgroundColor;
      expect(pressed, 'pressed vs hovered').to.not.equal(hovered);
      expect(pressed, 'pressed vs page surface').to.not.equal(surfaceColor(el));
    } finally {
      await sendMouse({ type: 'up' });
      await resetMouse();
    }
  });

  it('moves an accent button away from its own fill on hover, without the pre-8.0.0 filter', async () => {
    const el = (await fixture(
      html`<lr-button appearance="accent" variant="brand" style="--lr-transition-fast: 0s">Save</lr-button>`,
    )) as LyraButton;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    const resting = getComputedStyle(base).backgroundColor;
    try {
      await sendMouse({ type: 'move', position: center(base) });
      const hovered = getComputedStyle(base);
      expect(hovered.backgroundColor, 'accent hover vs resting').to.not.equal(resting);
      // A filter applies to the whole subtree, so the old brightness lift dimmed the label with
      // the box. A background mix leaves everything but the background alone.
      expect(hovered.filter).to.equal('none');
    } finally {
      await resetMouse();
    }
  });
});

describe('lr-button — mapped Shoelace and Web Awesome surface', () => {
  it('keeps Lyra defaults while accepting Shoelace variant spellings', async () => {
    const defaultEl = (await fixture(html`<lr-button variant="default">Default</lr-button>`)) as LyraButton;
    const primaryEl = (await fixture(html`<lr-button variant="primary">Primary</lr-button>`)) as LyraButton;
    const textEl = (await fixture(html`<lr-button variant="text">Text</lr-button>`)) as LyraButton;

    expect(defaultEl.variant).to.equal('neutral');
    expect(defaultEl.appearance).to.equal('accent');
    expect(primaryEl.variant).to.equal('brand');
    expect(textEl.variant).to.equal('neutral');
    expect(textEl.appearance).to.equal('plain');
  });

  it('maps caret, outline, and circle without replacing their Lyra counterparts', async () => {
    const caret = (await fixture(html`<lr-button caret>Menu</lr-button>`)) as LyraButton;
    expect(caret.caret).to.be.true;
    expect(caret.withCaret).to.be.true;
    expect(caret.shadowRoot!.querySelectorAll('[part="caret"]').length).to.equal(1);

    const outlined = (await fixture(html`<lr-button outline>Outlined</lr-button>`)) as LyraButton;
    const outlinedBase = outlined.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    expect(outlined.outline).to.be.true;
    expect(getComputedStyle(outlinedBase).backgroundColor).to.equal('rgba(0, 0, 0, 0)');

    const circle = (await fixture(
      html`<lr-button circle aria-label="Settings"><svg aria-hidden="true"></svg></lr-button>`,
    )) as LyraButton;
    const circleBase = circle.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    const box = circleBase.getBoundingClientRect();
    expect(circle.circle).to.be.true;
    expect(box.width).to.be.closeTo(box.height, 1);
    expect(Number.parseFloat(getComputedStyle(circleBase).borderRadius)).to.be.at.least(box.height / 2);
  });

  it('projects prefix/suffix aliases through the same start/end wrappers and parts', async () => {
    const el = (await fixture(html`
      <lr-button>
        <span slot="prefix">Before</span>
        Save
        <span slot="suffix">After</span>
      </lr-button>
    `)) as LyraButton;
    await el.updateComplete;

    const start = el.shadowRoot!.querySelector('[part~="start"]') as HTMLElement;
    const prefix = el.shadowRoot!.querySelector('[part~="prefix"]') as HTMLElement;
    const end = el.shadowRoot!.querySelector('[part~="end"]') as HTMLElement;
    const suffix = el.shadowRoot!.querySelector('[part~="suffix"]') as HTMLElement;
    expect(start.isSameNode(prefix)).to.be.true;
    expect(end.isSameNode(suffix)).to.be.true;
    expect(start.hidden).to.be.false;
    expect(end.hidden).to.be.false;
    expect(start.querySelector('slot[name="prefix"]')).to.exist;
    expect(end.querySelector('slot[name="suffix"]')).to.exist;
  });

  it('honors with-start/with-end as SSR presence hints without requiring assigned content', async () => {
    const el = (await fixture(html`<lr-button with-start with-end>Save</lr-button>`)) as LyraButton;
    expect(el.withStart).to.be.true;
    expect(el.withEnd).to.be.true;
    expect((el.shadowRoot!.querySelector('[part~="start"]') as HTMLElement).hidden).to.be.false;
    expect((el.shadowRoot!.querySelector('[part~="end"]') as HTMLElement).hidden).to.be.false;
  });

  it('maps Shoelace hyphenated form overrides onto the canonical native override properties', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div>
        <form id="mapped-button-owner"></form>
        <lr-button
          form="mapped-button-owner"
          form-action="/mapped"
          form-enctype="multipart/form-data"
          form-method="post"
          form-no-validate
          form-target="mapped-result"
          type="submit"
        >Submit</lr-button>
      </div>
    `);
    const form = wrapper.querySelector('form')!;
    const el = wrapper.querySelector('lr-button') as LyraButton;

    expect(el.form === form).to.be.true;
    expect(el.formAction).to.equal('/mapped');
    expect(el.formEnctype).to.equal('multipart/form-data');
    expect(el.formMethod).to.equal('post');
    expect(el.formNoValidate).to.be.true;
    expect(el.formTarget).to.equal('mapped-result');
  });

  it('exposes synchronous required/custom validity and state restoration without changing submitter semantics', async () => {
    const el = (await fixture(html`<lr-button required>Submit</lr-button>`)) as LyraButton;
    el.strings = { fieldRequired: 'Choose a submit action.' };
    el.value = '';
    expect(el.required).to.be.true;
    expect(el.validity.valueMissing).to.be.true;
    expect(el.checkValidity()).to.be.false;
    expect(el.validationMessage).to.equal('Choose a submit action.');

    el.value = 'publish';
    expect(el.checkValidity()).to.be.true;

    el.setCustomValidity('Approval is required');
    expect(el.customError).to.equal('Approval is required');
    expect(el.getAttribute('custom-error')).to.equal('Approval is required');
    expect(el.validity.customError).to.be.true;
    expect(el.reportValidity()).to.be.false;

    el.resetValidity();
    expect(el.customError).to.equal(null);
    expect(el.validity.valid).to.be.true;

    el.formStateRestoreCallback('restored', 'restore');
    expect(el.value).to.equal('restored');
  });

  it('publishes disabled/loading/link/icon-button custom states as live rendered facts', async () => {
    const el = (await fixture(html`
      <lr-button href="https://example.com" aria-label="Settings"><svg aria-hidden="true"></svg></lr-button>
    `)) as LyraButton;
    const states = (el as unknown as { internals: ElementInternals }).internals.states;
    expect(states.has('link')).to.be.true;
    expect(states.has('icon-button')).to.be.true;
    expect(states.has('disabled')).to.be.false;
    expect(states.has('loading')).to.be.false;

    el.loading = true;
    await el.updateComplete;
    expect(states.has('loading')).to.be.true;
    expect(states.has('disabled')).to.be.true;

    el.loading = false;
    el.disabled = true;
    await el.updateComplete;
    expect(states.has('loading')).to.be.false;
    expect(states.has('disabled')).to.be.true;
  });

  it('exposes rel as a target-derived compatibility surface and ignores an unsafe author value', async () => {
    const el = (await fixture(html`
      <lr-button href="https://example.com" target="_blank" rel="opener">Open</lr-button>
    `)) as LyraButton;
    const anchor = el.shadowRoot!.querySelector('a[part~="base"]') as HTMLAnchorElement;
    expect(el.rel).to.equal('noopener noreferrer');
    expect(anchor.rel).to.equal('noopener noreferrer');

    el.target = undefined;
    await el.updateComplete;
    expect(el.rel).to.be.undefined;
    expect(anchor.hasAttribute('rel')).to.be.false;
  });
});
