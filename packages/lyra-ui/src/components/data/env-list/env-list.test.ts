import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './env-list.js';
import type { LyraEnvList } from './env-list.js';
import { styles } from './env-list.styles.js';

describe('lr-env-list', () => {
  it('defaults to revealable=true and copyable=true', async () => {
    const el = (await fixture(html`<lr-env-list></lr-env-list>`)) as LyraEnvList;
    expect(el.revealable).to.be.true;
    expect(el.copyable).to.be.true;
  });

  it('masks a value with a fixed eight-bullet run regardless of value length', async () => {
    const el = (await fixture(
      html`<lr-env-list .entries=${[{ name: 'API_KEY', value: 'x', secret: true }, { name: 'TOKEN', value: 'a-much-longer-secret-value', secret: true }]}></lr-env-list>`,
    )) as LyraEnvList;
    await el.updateComplete;
    const values = [...el.shadowRoot!.querySelectorAll('[part="value"]')] as HTMLElement[];
    expect(values[0].textContent!.trim()).to.equal('•'.repeat(8));
    expect(values[1].textContent!.trim()).to.equal('•'.repeat(8));
    expect(values[0].dataset.masked).to.equal('true');
  });

  it('defaults secret to true when omitted', async () => {
    const el = (await fixture(
      html`<lr-env-list .entries=${[{ name: 'X', value: 'plainish' }]}></lr-env-list>`,
    )) as LyraEnvList;
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="value"]') as HTMLElement).dataset.masked).to.equal('true');
  });

  it('renders a non-secret value in plain text', async () => {
    const el = (await fixture(
      html`<lr-env-list .entries=${[{ name: 'NODE_ENV', value: 'production', secret: false }]}></lr-env-list>`,
    )) as LyraEnvList;
    await el.updateComplete;
    const value = el.shadowRoot!.querySelector('[part="value"]') as HTMLElement;
    expect(value.textContent!.trim()).to.equal('production');
    expect(value.dataset.masked).to.equal('false');
  });

  it('reveal toggle flips masking and emits lr-reveal-change, keyed by name and surviving value-only updates', async () => {
    const el = (await fixture(
      html`<lr-env-list .entries=${[{ name: 'API_KEY', value: 'secret1', secret: true }]}></lr-env-list>`,
    )) as LyraEnvList;
    await el.updateComplete;
    const reveal = el.shadowRoot!.querySelector('[part="reveal-button"]') as HTMLButtonElement;
    const listener = oneEvent(el, 'lr-reveal-change');
    reveal.click();
    const event = (await listener) as CustomEvent<{ name: string; revealed: boolean }>;
    expect(event.detail).to.deep.equal({ name: 'API_KEY', revealed: true });
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="value"]') as HTMLElement).textContent!.trim()).to.equal('secret1');
    el.entries = [{ name: 'API_KEY', value: 'secret2', secret: true }];
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="value"]') as HTMLElement).textContent!.trim()).to.equal('secret2');
  });

  it('revealable=false renders no reveal button', async () => {
    const el = (await fixture(
      html`<lr-env-list .entries=${[{ name: 'X', value: 'y' }]} .revealable=${false}></lr-env-list>`,
    )) as LyraEnvList;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="reveal-button"]').length).to.equal(0);
  });

  it('remasks revealed secrets when revealability is revoked', async () => {
    const el = (await fixture(
      html`<lr-env-list .entries=${[{ name: 'API_KEY', value: 'secret', secret: true }]}></lr-env-list>`,
    )) as LyraEnvList;
    await el.updateComplete;
    (el.shadowRoot!.querySelector('[part="reveal-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="value"]') as HTMLElement).dataset.masked).to.equal('false');

    el.revealable = false;
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="value"]') as HTMLElement).dataset.masked).to.equal('true');
    expect(el.shadowRoot!.querySelectorAll('[part="reveal-button"]').length).to.equal(0);
  });

  it('forwards a host aria-label to the populated list and reacts to late changes', async () => {
    const el = (await fixture(
      html`<lr-env-list
        label="Environment"
        aria-label="Deployment variables"
        .entries=${[{ name: 'NODE_ENV', value: 'production', secret: false }]}
      ></lr-env-list>`,
    )) as LyraEnvList;
    await el.updateComplete;
    const base = () => el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base().getAttribute('aria-label')).to.equal('Deployment variables');

    el.setAttribute('aria-label', 'Runtime variables');
    await el.updateComplete;
    expect(base().getAttribute('aria-label')).to.equal('Runtime variables');

    el.removeAttribute('aria-label');
    await el.updateComplete;
    expect(base().getAttribute('aria-label')).to.equal('Environment');
  });

  it('forwards a host aria-label to an empty-state semantic owner', async () => {
    const el = (await fixture(
      html`<lr-env-list aria-label="Deployment variables"></lr-env-list>`,
    )) as LyraEnvList;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute('role')).to.equal('group');
    expect(base.getAttribute('aria-label')).to.equal('Deployment variables');
  });

  it('accepts revealable="false" and copyable="false" as plain-HTML attribute strings, not just property bindings', async () => {
    const el = (await fixture(
      html`<lr-env-list revealable="false" copyable="false"></lr-env-list>`,
    )) as LyraEnvList;
    expect(el.revealable).to.be.false;
    expect(el.copyable).to.be.false;
    el.entries = [{ name: 'X', value: 'y', secret: true }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="reveal-button"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="copy-button"]').length).to.equal(0);
  });

  it('copy button copies the real value regardless of mask state and emits lr-copy', async () => {
    const el = (await fixture(
      html`<lr-env-list .entries=${[{ name: 'API_KEY', value: 'secretvalue', secret: true }]}></lr-env-list>`,
    )) as LyraEnvList;
    await el.updateComplete;
    const listener = oneEvent(el, 'lr-copy');
    (el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
    const event = (await listener) as CustomEvent<{ text: string }>;
    expect(event.detail.text).to.equal('secretvalue');
  });

  it('prunes reveal state for names no longer present', async () => {
    const el = (await fixture(
      html`<lr-env-list .entries=${[{ name: 'A', value: '1', secret: true }]}></lr-env-list>`,
    )) as LyraEnvList;
    await el.updateComplete;
    (el.shadowRoot!.querySelector('[part="reveal-button"]') as HTMLButtonElement).click();
    el.entries = [{ name: 'B', value: '2', secret: true }, { name: 'A', value: '1', secret: true }];
    await el.updateComplete;
    // A new entry named "A" after "B" got re-added -- pruned reveal state means it's masked again.
    const values = [...el.shadowRoot!.querySelectorAll('[part="value"]')] as HTMLElement[];
    expect(values[1].dataset.masked).to.equal('true');
  });

  it('renders lr-empty when entries is empty', async () => {
    const el = (await fixture(html`<lr-env-list></lr-env-list>`)) as LyraEnvList;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('lr-empty')).to.exist;
  });

  it('is accessible with masked and revealed entries', async () => {
    const el = (await fixture(
      html`<lr-env-list .entries=${[{ name: 'A', value: '1', secret: true }, { name: 'B', value: '2', secret: false }]}></lr-env-list>`,
    )) as LyraEnvList;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  describe('--lr-env-list-reveal-active-bg / -border', () => {
    const pressedFixture = async (): Promise<LyraEnvList> => {
      const el = (await fixture(
        html`<lr-env-list .entries=${[{ name: 'API_KEY', value: 'secret', secret: true }]}></lr-env-list>`,
      )) as LyraEnvList;
      await el.updateComplete;
      (el.shadowRoot!.querySelector('[part="reveal-button"]') as HTMLButtonElement).click();
      await el.updateComplete;
      return el;
    };

    it('retints the pressed reveal button background and border via the cssprops', async () => {
      const el = await pressedFixture();
      el.style.setProperty('--lr-env-list-reveal-active-bg', 'rgb(10, 20, 30)');
      el.style.setProperty('--lr-env-list-reveal-active-border', 'rgb(40, 50, 60)');
      const btn = el.shadowRoot!.querySelector('[part="reveal-button"]') as HTMLElement;
      expect(btn.getAttribute('aria-pressed')).to.equal('true');
      expect(getComputedStyle(btn).backgroundColor).to.equal('rgb(10, 20, 30)');
      expect(getComputedStyle(btn).borderTopColor).to.equal('rgb(40, 50, 60)');
    });

    it('renders byte-identically to the token defaults when unset', async () => {
      const el = await pressedFixture();
      const btn = el.shadowRoot!.querySelector('[part="reveal-button"]') as HTMLElement;
      const bg = getComputedStyle(btn).backgroundColor;
      const border = getComputedStyle(btn).borderTopColor;
      el.style.setProperty('--lr-env-list-reveal-active-bg', 'var(--lr-color-brand-quiet)');
      el.style.setProperty('--lr-env-list-reveal-active-border', 'var(--lr-color-brand)');
      expect(getComputedStyle(btn).backgroundColor).to.equal(bg);
      expect(getComputedStyle(btn).borderTopColor).to.equal(border);
    });
  });

  it('gives reveal-button and copy-button a hover state', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='reveal-button'\]:hover/);
    expect(css).to.match(/\[part='copy-button'\]:hover/);
  });
});
