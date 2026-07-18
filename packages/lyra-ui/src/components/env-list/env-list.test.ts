import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './env-list.js';
import type { LyraEnvList } from './env-list.js';

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
    expect(el.shadowRoot!.querySelector('[part="reveal-button"]')).to.not.exist;
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
});
