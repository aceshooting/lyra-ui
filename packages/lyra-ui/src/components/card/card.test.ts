import { fixture, expect, html } from '@open-wc/testing';
import './card.js';
import type { LyraCard } from './card.js';

describe('lyra-card', () => {
  it('renders as a div by default, an <a> when href is set', async () => {
    const plain = (await fixture(html`<lyra-card>body</lyra-card>`)) as LyraCard;
    expect(plain.shadowRoot!.querySelector('a[part="base"]')).to.not.exist;
    expect(plain.shadowRoot!.querySelector('div[part="base"]')).to.exist;

    const linked = (await fixture(html`<lyra-card href="/x">body</lyra-card>`)) as LyraCard;
    const anchor = linked.shadowRoot!.querySelector('a[part="base"]') as HTMLAnchorElement;
    expect(anchor).to.exist;
    expect(anchor.getAttribute('href')).to.equal('/x');
  });

  it('defaults appearance to outlined, interactive to false', async () => {
    const el = (await fixture(html`<lyra-card>body</lyra-card>`)) as LyraCard;
    expect(el.appearance).to.equal('outlined');
    expect(el.interactive).to.be.false;
    expect(el.hasAttribute('interactive')).to.be.false;
  });

  it('renders header/media/footer/actions slots only when populated', async () => {
    const el = (await fixture(html`
      <lyra-card>
        <span slot="header">Title</span>
        <span slot="media">img</span>
        body
        <span slot="footer">Footer</span>
        <span slot="actions">Actions</span>
      </lyra-card>
    `)) as LyraCard;
    const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
    const media = el.shadowRoot!.querySelector('[part="media"]') as HTMLElement;
    const footer = el.shadowRoot!.querySelector('[part="footer"]') as HTMLElement;
    expect(header.hasAttribute('hidden')).to.be.false;
    expect(media.hasAttribute('hidden')).to.be.false;
    expect(footer.hasAttribute('hidden')).to.be.false;
  });

  it('hides header/media/footer when nothing is slotted into them (unpopulated default)', async () => {
    const el = (await fixture(html`<lyra-card>body only</lyra-card>`)) as LyraCard;
    const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
    const media = el.shadowRoot!.querySelector('[part="media"]') as HTMLElement;
    const footer = el.shadowRoot!.querySelector('[part="footer"]') as HTMLElement;
    expect(header.hasAttribute('hidden')).to.be.true;
    expect(media.hasAttribute('hidden')).to.be.true;
    expect(footer.hasAttribute('hidden')).to.be.true;
  });

  it('reflects appearance/interactive as attributes for CSS selectors', async () => {
    const el = (await fixture(html`<lyra-card appearance="filled" interactive>body</lyra-card>`)) as LyraCard;
    expect(el.getAttribute('appearance')).to.equal('filled');
    expect(el.hasAttribute('interactive')).to.be.true;
  });

  it('wraps a long header and its actions without overflowing a narrow allocation', async () => {
    const el = (await fixture(html`
      <lyra-card style="inline-size: 320px; max-inline-size: 100%;">
        <span slot="header">QuarterlyGenerationForecastWithAnIntentionallyLongUnbrokenTitle</span>
        <span slot="actions"><button type="button">Review</button><button type="button">Share</button></span>
        Body
      </lyra-card>
    `)) as LyraCard;
    const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
    const title = el.querySelector('[slot="header"]') as HTMLElement;

    expect(getComputedStyle(header).flexWrap).to.equal('wrap');
    expect(getComputedStyle(title).minInlineSize).to.equal('0px');
    expect(header.scrollWidth).to.be.at.most(header.clientWidth);
  });

  it('is accessible', async () => {
    const el = (await fixture(html`<lyra-card href="/x"><span slot="header">Title</span>body</lyra-card>`)) as LyraCard;
    await expect(el).to.be.accessible();
  });
});
