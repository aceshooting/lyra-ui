import { fixture, expect, html, aTimeout, oneEvent } from '@open-wc/testing';
import './avatar.js';
import type { LyraAvatar } from './avatar.js';

const TEST_IMAGE_SRC = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

describe('lr-avatar', () => {
  it('renders initials by default', async () => {
    const el = (await fixture(html`<lr-avatar initials="AB"></lr-avatar>`)) as LyraAvatar;
    expect(el.shadowRoot!.querySelector('[part="initials"]')!.textContent).to.equal('AB');
    expect(el.shadowRoot!.querySelector('[part="image"]')).to.not.exist;
  });

  it('prefers a loaded image over initials', async () => {
    const el = (await fixture(html`<lr-avatar initials="AB" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="A. Bee"></lr-avatar>`)) as LyraAvatar;
    await aTimeout(50);
    const img = el.shadowRoot!.querySelector('[part="image"]') as HTMLImageElement | null;
    if (img) {
      expect(img.getAttribute('alt')).to.equal('A. Bee');
      expect(el.shadowRoot!.querySelector('[part="initials"]')).to.not.exist;
    }
  });

  it('falls back to initials when the image fails to load', async () => {
    const el = (await fixture(html`<lr-avatar initials="AB" src="https://example.invalid/nonexistent.png" alt="A. Bee"></lr-avatar>`)) as LyraAvatar;
    const img = el.shadowRoot!.querySelector('img') as HTMLImageElement;
    img.dispatchEvent(new Event('error'));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="image"]')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="initials"]')!.textContent).to.equal('AB');
  });

  it('tries a new image after a previous src failed', async () => {
    const el = (await fixture(
      html`<lr-avatar initials="AB" src=${TEST_IMAGE_SRC} alt="A. Bee"></lr-avatar>`,
    )) as LyraAvatar;
    (el.shadowRoot!.querySelector('img') as HTMLImageElement).dispatchEvent(new Event('error'));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="image"]')).to.not.exist;

    el.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
    await el.updateComplete;
    const replacement = el.shadowRoot!.querySelector('[part="image"]') as HTMLImageElement;
    expect(replacement).to.exist;
    expect(replacement.getAttribute('src')).to.equal('data:image/gif;base64,R0lGODlhAQABAAAAACw=');
  });

  it('defaults size to md, shape to circle, tone to neutral', async () => {
    const el = (await fixture(html`<lr-avatar initials="AB"></lr-avatar>`)) as LyraAvatar;
    expect(el.size).to.equal('md');
    expect(el.shape).to.equal('circle');
    expect(el.tone).to.equal('neutral');
  });

  it('reflects size/shape/tone as attributes for CSS selectors', async () => {
    const el = (await fixture(html`<lr-avatar initials="AB" size="lg" shape="square" tone="brand"></lr-avatar>`)) as LyraAvatar;
    expect(el.getAttribute('size')).to.equal('lg');
    expect(el.getAttribute('shape')).to.equal('square');
    expect(el.getAttribute('tone')).to.equal('brand');
  });

  it('is accessible', async () => {
    const el = (await fixture(html`<lr-avatar initials="AB"></lr-avatar>`)) as LyraAvatar;
    await expect(el).to.be.accessible();
  });

  it('renders slotted content instead of initials when no image is set', async () => {
    const el = (await fixture(
      html`<lr-avatar initials="AB"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle></svg></lr-avatar>`,
    )) as LyraAvatar;
    const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
    expect(icon.hasAttribute('hidden')).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="initials"]')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="image"]')).to.not.exist;
  });

  it('prefers slotted content over a set src (slotted > src > initials)', async () => {
    const el = (await fixture(
      html`<lr-avatar
        initials="AB"
        src="data:image/gif;base64,R0lGODlhAQABAAAAACw="
        alt="A. Bee"
        ><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle></svg
      ></lr-avatar>`,
    )) as LyraAvatar;
    await el.updateComplete;
    const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
    expect(icon.hasAttribute('hidden')).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="image"]')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="initials"]')).to.not.exist;
  });

  it('collapses the icon part when no default-slot content is provided', async () => {
    const el = (await fixture(html`<lr-avatar initials="AB"></lr-avatar>`)) as LyraAvatar;
    const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
    expect(icon.hasAttribute('hidden')).to.be.true;
  });

  it('reacts to slot content added after first render', async () => {
    const el = (await fixture(html`<lr-avatar initials="AB"></lr-avatar>`)) as LyraAvatar;
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
      html`<lr-avatar alt="AI assistant"
        ><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle></svg
      ></lr-avatar>`,
    )) as LyraAvatar;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('role')).to.equal('img');
    expect(base.getAttribute('aria-label')).to.equal('AI assistant');
  });

  it('lets a host aria-label override alt on the element that owns the image semantics', async () => {
    const fallback = (await fixture(html`
      <lr-avatar initials="AB" alt="A. Bee" aria-label="Account owner"></lr-avatar>
    `)) as LyraAvatar;
    const base = fallback.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('role')).to.equal('img');
    expect(base.getAttribute('aria-label')).to.equal('Account owner');

    const image = (await fixture(html`
      <lr-avatar
        src="data:image/gif;base64,R0lGODlhAQABAAAAACw="
        alt="A. Bee"
        aria-label="Account owner"
      ></lr-avatar>
    `)) as LyraAvatar;
    expect(image.shadowRoot!.querySelector('img')!.getAttribute('alt')).to.equal('Account owner');
  });

  it('is accessible with icon-only content and an alt label', async () => {
    const el = (await fixture(
      html`<lr-avatar alt="AI assistant"
        ><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle></svg
      ></lr-avatar>`,
    )) as LyraAvatar;
    await expect(el).to.be.accessible();
  });

  it('exposes alt as an accessible name via role="img" when falling back to initials', async () => {
    const el = (await fixture(html`<lr-avatar initials="AB" alt="A. Bee"></lr-avatar>`)) as LyraAvatar;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('role')).to.equal('img');
    expect(base.getAttribute('aria-label')).to.equal('A. Bee');
  });

  it('exposes alt as an accessible name once an image fails and falls back to initials', async () => {
    const el = (await fixture(
      html`<lr-avatar initials="AB" src="https://example.invalid/nonexistent.png" alt="A. Bee"></lr-avatar>`,
    )) as LyraAvatar;
    const img = el.shadowRoot!.querySelector('img') as HTMLImageElement;
    img.dispatchEvent(new Event('error'));
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('role')).to.equal('img');
    expect(base.getAttribute('aria-label')).to.equal('A. Bee');
  });
});
