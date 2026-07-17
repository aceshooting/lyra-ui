import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './button.js';
import type { LyraButton } from './button.class.js';
import { styles } from './button.styles.js';

describe('lyra-button', () => {
  it('defaults to neutral/filled/m/button with a slotted label', async () => {
    const el = (await fixture(html`<lyra-button>Save</lyra-button>`)) as LyraButton;
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
      html`<lyra-button variant="danger" appearance="outlined" size="l" disabled>Delete</lyra-button>`,
    )) as LyraButton;
    expect(el.getAttribute('variant')).to.equal('danger');
    expect(el.getAttribute('appearance')).to.equal('outlined');
    expect(el.getAttribute('size')).to.equal('l');
    const button = el.shadowRoot!.querySelector('button[part="base"]') as HTMLButtonElement;
    expect(button.disabled).to.be.true;
  });

  it('fires a native click that bubbles and composes through the shadow boundary when enabled', async () => {
    const el = (await fixture(html`<lyra-button>Save</lyra-button>`)) as LyraButton;
    const button = el.shadowRoot!.querySelector('button[part="base"]') as HTMLButtonElement;
    setTimeout(() => button.click());
    const ev = await oneEvent(el, 'click');
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });

  it('never fires click while disabled or loading (native disabled button semantics)', async () => {
    const disabledEl = (await fixture(html`<lyra-button disabled>Save</lyra-button>`)) as LyraButton;
    let calls = 0;
    disabledEl.addEventListener('click', () => calls++);
    (disabledEl.shadowRoot!.querySelector('button[part="base"]') as HTMLButtonElement).click();

    const loadingEl = (await fixture(html`<lyra-button .loading=${true}>Save</lyra-button>`)) as LyraButton;
    loadingEl.addEventListener('click', () => calls++);
    (loadingEl.shadowRoot!.querySelector('button[part="base"]') as HTMLButtonElement).click();

    expect(calls).to.equal(0);
  });

  it('renders a spinner part only while loading, and sets aria-busy', async () => {
    const el = (await fixture(html`<lyra-button>Save</lyra-button>`)) as LyraButton;
    expect(el.shadowRoot!.querySelector('[part="spinner"]')).to.be.null;
    el.loading = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="spinner"]')).to.not.be.null;
    const button = el.shadowRoot!.querySelector('button[part="base"]') as HTMLButtonElement;
    expect(button.getAttribute('aria-busy')).to.equal('true');
  });

  it('forwards a host aria-label onto the internal button as a literal string', async () => {
    const el = (await fixture(
      html`<lyra-button aria-label="Close dialog" appearance="plain"><svg slot="start"></svg></lyra-button>`,
    )) as LyraButton;
    const button = el.shadowRoot!.querySelector('button[part="base"]') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).to.equal('Close dialog');
  });

  it('type="submit" requests submit on the closest ancestor form (a shadow-internal button cannot do this on its own)', async () => {
    const form = (await fixture(html`
      <form>
        <lyra-button type="submit">Save</lyra-button>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lyra-button') as LyraButton;
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
        <lyra-button type="reset">Reset</lyra-button>
      </form>
    `)) as HTMLFormElement;
    const input = form.querySelector('input') as HTMLInputElement;
    input.value = 'changed';
    const el = form.querySelector('lyra-button') as LyraButton;
    (el.shadowRoot!.querySelector('button[part="base"]') as HTMLButtonElement).click();
    expect(input.value).to.equal('');
  });

  it('forwards host click() to the internal native button', async () => {
    const form = (await fixture(html`<form><lyra-button type="submit">Save</lyra-button></form>`)) as HTMLFormElement;
    const el = form.querySelector('lyra-button') as LyraButton;
    let submitted = false;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submitted = true;
    });
    el.click();
    expect(submitted).to.be.true;
  });

  it('is accessible', async () => {
    const el = await fixture(html`<lyra-button>Save</lyra-button>`);
    await expect(el).to.be.accessible();
  });

  it('is accessible while loading', async () => {
    const el = await fixture(html`<lyra-button .loading=${true}>Save</lyra-button>`);
    await expect(el).to.be.accessible();
  });

  it('exposes the loading spinner rotation period as an overridable custom property, defaulting to 1s', async () => {
    const el = (await fixture(html`<lyra-button .loading=${true}>Save</lyra-button>`)) as LyraButton;
    const spinner = el.shadowRoot!.querySelector('[part="spinner"]') as HTMLElement;
    expect(getComputedStyle(spinner).animationDuration).to.equal('1s');

    el.style.setProperty('--lyra-button-spinner-duration', '2.4s');
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
    expect(css).to.include('border-color: var(--lyra-button-outlined-border);');
    expect(css).to.include('--lyra-button-outlined-border: var(--lyra-color-border-strong);');
  });

  it('supports appearance="quiet": muted border/text tokens, transparent until hover', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.include("--lyra-button-quiet-border: var(--lyra-color-border);");
    expect(css).to.include("--lyra-button-quiet-text: var(--lyra-color-text-quiet);");
    expect(css).to.match(
      /:host\(\[appearance='quiet'\]\) \[part='base'\]\s*\{[^}]*background:\s*transparent;[^}]*color:\s*var\(--lyra-button-quiet-text\);[^}]*border-color:\s*var\(--lyra-button-quiet-border\);/,
    );
    expect(css).to.match(
      /:host\(\[appearance='quiet'\]\) \[part='base'\]:not\(:disabled\):hover\s*\{[^}]*background:\s*var\(--lyra-color-surface\);/,
    );
  });

  it('keeps appearance="quiet"\'s text/border independent of variant (unlike outlined)', async () => {
    const neutralEl = (await fixture(
      html`<lyra-button appearance="quiet" variant="neutral">Save</lyra-button>`,
    )) as LyraButton;
    const dangerEl = (await fixture(
      html`<lyra-button appearance="quiet" variant="danger">Save</lyra-button>`,
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
        <lyra-button type="submit">Save</lyra-button>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lyra-button') as LyraButton;
    expect(Array.from(form.elements)).to.include(el);
  });

  it('supports appearance="accent" as a loud filled tier distinct from "filled" for variant="neutral"', async () => {
    const filledEl = (await fixture(
      html`<lyra-button appearance="filled" variant="neutral">Save</lyra-button>`,
    )) as LyraButton;
    const accentEl = (await fixture(
      html`<lyra-button appearance="accent" variant="neutral">Save</lyra-button>`,
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
    expect(css).to.include("font-size: var(--lyra-font-size-m);");
    expect(css).to.include('--lyra-button-size-s: var(--lyra-size-1-75rem);');
    expect(css).to.include('min-block-size: var(--lyra-button-size-s);');
  });

  it('propagates a consumer width from the host to the internal button', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.include('inline-size: var(--lyra-button-width);');
    expect(css).to.include('--lyra-button-width: 100%;');
  });

  it('renders appearance="link" as zero-chrome underlined inline text (no border, no padding, no min-height floor)', async () => {
    const el = (await fixture(
      html`<lyra-button appearance="link" variant="brand">Retry</lyra-button>`,
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
      html`<lyra-button appearance="link" variant="brand">Retry</lyra-button>`,
    )) as LyraButton;
    const plainEl = (await fixture(
      html`<lyra-button appearance="plain" variant="brand">Retry</lyra-button>`,
    )) as LyraButton;
    const linkBase = linkEl.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const plainBase = plainEl.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(linkBase).color).to.equal(getComputedStyle(plainBase).color);
  });

  it('inherits the ambient font-size for appearance="link" instead of forcing a per-size font-size', async () => {
    const el = (await fixture(html`
      <div style="font-size: 21px;">
        <lyra-button appearance="link" size="m">Retry</lyra-button>
      </div>
    `)) as HTMLElement;
    const button = el.querySelector('lyra-button') as LyraButton;
    const base = button.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).fontSize).to.equal('21px');
  });

  it('declares the underline offset and keeps a focus-visible outline for appearance="link"', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/:host\(\[appearance='link'\]\) \[part='base'\][^}]*text-decoration: underline/);
    expect(css).to.match(
      /:host\(\[appearance='link'\]\) \[part='base'\][^}]*text-underline-offset: var\(--lyra-size-0-15rem\)/,
    );
    // The generic focus-visible rule still applies to the link appearance (it is not overridden).
    expect(css).to.match(/\[part='base'\]:focus-visible\s*\{[^}]*outline:/);
  });

  it('is accessible as an inline link', async () => {
    const el = await fixture(html`<lyra-button appearance="link" variant="brand">Retry</lyra-button>`);
    await expect(el).to.be.accessible();
  });
});
