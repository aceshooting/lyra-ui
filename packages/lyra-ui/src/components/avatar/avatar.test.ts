import { fixture, expect, html, aTimeout, oneEvent } from '@open-wc/testing';
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

  it('renders slotted content instead of initials when no image is set', async () => {
    const el = (await fixture(
      html`<lyra-avatar initials="AB"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle></svg></lyra-avatar>`,
    )) as LyraAvatar;
    const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
    expect(icon.hasAttribute('hidden')).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="initials"]')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="image"]')).to.not.exist;
  });

  it('prefers slotted content over a set src (slotted > src > initials)', async () => {
    const el = (await fixture(
      html`<lyra-avatar
        initials="AB"
        src="data:image/gif;base64,R0lGODlhAQABAAAAACw="
        alt="A. Bee"
        ><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle></svg
      ></lyra-avatar>`,
    )) as LyraAvatar;
    await el.updateComplete;
    const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
    expect(icon.hasAttribute('hidden')).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="image"]')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="initials"]')).to.not.exist;
  });

  it('collapses the icon part when no default-slot content is provided', async () => {
    const el = (await fixture(html`<lyra-avatar initials="AB"></lyra-avatar>`)) as LyraAvatar;
    const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
    expect(icon.hasAttribute('hidden')).to.be.true;
  });

  it('reacts to slot content added after first render', async () => {
    const el = (await fixture(html`<lyra-avatar initials="AB"></lyra-avatar>`)) as LyraAvatar;
    const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
    expect(icon.hasAttribute('hidden')).to.be.true;
    const slot = el.shadowRoot!.querySelector('slot') as HTMLSlotElement;
    const slotChange = oneEvent(slot, 'slotchange');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.append(svg);
    await slotChange;
    await el.updateComplete;
    expect(icon.hasAttribute('hidden')).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="initials"]')).to.not.exist;
  });

  it('exposes alt as an accessible name via role="img" when showing icon-only content', async () => {
    const el = (await fixture(
      html`<lyra-avatar alt="AI assistant"
        ><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle></svg
      ></lyra-avatar>`,
    )) as LyraAvatar;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('role')).to.equal('img');
    expect(base.getAttribute('aria-label')).to.equal('AI assistant');
  });

  it('is accessible with icon-only content and an alt label', async () => {
    const el = (await fixture(
      html`<lyra-avatar alt="AI assistant"
        ><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle></svg
      ></lyra-avatar>`,
    )) as LyraAvatar;
    await expect(el).to.be.accessible();
  });
});
