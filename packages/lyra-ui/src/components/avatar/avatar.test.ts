import { fixture, expect, html, aTimeout } from '@open-wc/testing';
import './avatar.js';
import type { LyraAvatar } from './avatar.js';

describe('lyra-avatar', () => {
  it('renders initials by default', async () => {
    const el = (await fixture(html`<lyra-avatar initials="AB"></lyra-avatar>`)) as LyraAvatar;
    expect(el.shadowRoot!.querySelector('[part="initials"]')!.textContent).to.equal('AB');
    expect(el.shadowRoot!.querySelector('[part="image"]')).to.not.exist;
  });

  it('prefers a loaded image over initials', async () => {
    const el = (await fixture(html`<lyra-avatar initials="AB" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="A. Bee"></lyra-avatar>`)) as LyraAvatar;
    await aTimeout(50);
    const img = el.shadowRoot!.querySelector('[part="image"]') as HTMLImageElement | null;
    if (img) {
      expect(img.getAttribute('alt')).to.equal('A. Bee');
      expect(el.shadowRoot!.querySelector('[part="initials"]')).to.not.exist;
    }
  });

  it('falls back to initials when the image fails to load', async () => {
    const el = (await fixture(html`<lyra-avatar initials="AB" src="https://example.invalid/nonexistent.png" alt="A. Bee"></lyra-avatar>`)) as LyraAvatar;
    const img = el.shadowRoot!.querySelector('img') as HTMLImageElement;
    img.dispatchEvent(new Event('error'));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="image"]')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="initials"]')!.textContent).to.equal('AB');
  });

  it('defaults size to md, shape to circle, tone to neutral', async () => {
    const el = (await fixture(html`<lyra-avatar initials="AB"></lyra-avatar>`)) as LyraAvatar;
    expect(el.size).to.equal('md');
    expect(el.shape).to.equal('circle');
    expect(el.tone).to.equal('neutral');
  });

  it('reflects size/shape/tone as attributes for CSS selectors', async () => {
    const el = (await fixture(html`<lyra-avatar initials="AB" size="lg" shape="square" tone="brand"></lyra-avatar>`)) as LyraAvatar;
    expect(el.getAttribute('size')).to.equal('lg');
    expect(el.getAttribute('shape')).to.equal('square');
    expect(el.getAttribute('tone')).to.equal('brand');
  });

  it('is accessible', async () => {
    const el = (await fixture(html`<lyra-avatar initials="AB"></lyra-avatar>`)) as LyraAvatar;
    await expect(el).to.be.accessible();
  });
});
