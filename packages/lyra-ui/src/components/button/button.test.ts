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

  it('is accessible', async () => {
    const el = await fixture(html`<lyra-button>Save</lyra-button>`);
    await expect(el).to.be.accessible();
  });

  it('is accessible while loading', async () => {
    const el = await fixture(html`<lyra-button .loading=${true}>Save</lyra-button>`);
    await expect(el).to.be.accessible();
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
});
