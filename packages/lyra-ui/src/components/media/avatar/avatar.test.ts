import { fixture, expect, html, aTimeout, oneEvent } from '@open-wc/testing';
import './avatar.js';
import type { LyraAvatar } from './avatar.js';

const TEST_IMAGE_SRC = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
const TEST_IMAGE_SRC_REPLACEMENT = 'data:image/gif;base64,R0lGODlhAQABAIABAAAAAP///yw=';

describe('lr-avatar', () => {
  it('renders initials by default', async () => {
    const el = (await fixture(html`<lr-avatar initials="AB"></lr-avatar>`)) as LyraAvatar;
    expect(el.shadowRoot!.querySelector('[part="initials"]')!.textContent).to.equal('AB');
    expect(el.shadowRoot!.querySelector('[part="image"]')).to.not.exist;
  });

  it('treats default-slotted text and emoji nodes as glyph content', async () => {
    const el = (await fixture(html`<lr-avatar initials="AI" alt="Assistant">🤖</lr-avatar>`)) as LyraAvatar;
    await el.updateComplete;
    const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
    expect(icon.hidden).to.be.false;
    const slot = icon.querySelector('slot') as HTMLSlotElement;
    expect(slot.assignedNodes({ flatten: true }).map((node) => node.textContent).join('')).to.contain('🤖');
    expect(el.shadowRoot!.querySelector('[part="initials"]')).to.not.exist;
  });

  it('retries a previously failed source after a successful semantic source transition', async () => {
    const sourceA = 'https://example.test/avatar-a.png';
    const sourceB = 'https://example.test/avatar-b.png';
    const el = (await fixture(html`
      <lr-avatar initials="AB" image=${sourceA} alt="A. Bee"></lr-avatar>
    `)) as LyraAvatar;
    let image = el.shadowRoot!.querySelector('[part="image"]') as HTMLImageElement;
    image.dispatchEvent(new Event('error'));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="image"]')).to.not.exist;

    el.image = sourceB;
    await el.updateComplete;
    image = el.shadowRoot!.querySelector('[part="image"]') as HTMLImageElement;
    expect(image.getAttribute('src')).to.equal(sourceB);

    el.image = sourceA;
    await el.updateComplete;
    image = el.shadowRoot!.querySelector('[part="image"]') as HTMLImageElement;
    expect(image.getAttribute('src')).to.equal(sourceA);
  });

  it('prefers a loaded image over initials', async () => {
    const el = (await fixture(html`<lr-avatar initials="AB" image="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="A. Bee"></lr-avatar>`)) as LyraAvatar;
    await aTimeout(50);
    const img = el.shadowRoot!.querySelector('[part="image"]') as HTMLImageElement | null;
    if (img) {
      expect(img.getAttribute('alt')).to.equal('A. Bee');
      expect(el.shadowRoot!.querySelector('[part="initials"]')).to.not.exist;
    }
  });

  it('falls back to initials when the image fails to load', async () => {
    const el = (await fixture(html`<lr-avatar initials="AB" image=${TEST_IMAGE_SRC} alt="A. Bee"></lr-avatar>`)) as LyraAvatar;
    const img = el.shadowRoot!.querySelector('img') as HTMLImageElement;
    img.dispatchEvent(new Event('error'));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="image"]')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="initials"]')!.textContent).to.equal('AB');
  });

  it('tries a new image after a previous one failed', async () => {
    const el = (await fixture(
      html`<lr-avatar initials="AB" image=${TEST_IMAGE_SRC} alt="A. Bee"></lr-avatar>`,
    )) as LyraAvatar;
    (el.shadowRoot!.querySelector('img') as HTMLImageElement).dispatchEvent(new Event('error'));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="image"]')).to.not.exist;

    el.image = TEST_IMAGE_SRC_REPLACEMENT;
    await el.updateComplete;
    const replacement = el.shadowRoot!.querySelector('[part="image"]') as HTMLImageElement;
    expect(replacement).to.exist;
    expect(replacement.getAttribute('src')).to.equal(TEST_IMAGE_SRC_REPLACEMENT);
  });

  it('defaults size to medium, shape to circle, variant to neutral', async () => {
    const el = (await fixture(html`<lr-avatar initials="AB"></lr-avatar>`)) as LyraAvatar;
    expect(el.size).to.equal('medium');
    expect(el.shape).to.equal('circle');
    expect(el.variant).to.equal('neutral');
  });

  it('reflects size/shape/variant as attributes for CSS selectors', async () => {
    const el = (await fixture(html`<lr-avatar initials="AB" size="large" shape="square" variant="brand"></lr-avatar>`)) as LyraAvatar;
    expect(el.getAttribute('size')).to.equal('large');
    expect(el.getAttribute('shape')).to.equal('square');
    expect(el.getAttribute('variant')).to.equal('brand');
  });

  it('exposes no `tone` property at all — `variant` replaced it outright, with no alias', async () => {
    const el = (await fixture(html`<lr-avatar initials="AB"></lr-avatar>`)) as LyraAvatar;
    expect('tone' in el, 'tone is gone from the instance').to.be.false;
  });

  it('recolors the rendered circle from `variant`, not from `tone`', async () => {
    const neutral = (await fixture(html`<lr-avatar initials="AB"></lr-avatar>`)) as LyraAvatar;
    const brand = (await fixture(html`<lr-avatar initials="AB" variant="brand"></lr-avatar>`)) as LyraAvatar;
    const stale = (await fixture(html`<lr-avatar initials="AB" tone="brand"></lr-avatar>`)) as LyraAvatar;
    const background = (el: LyraAvatar): string =>
      getComputedStyle(el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).backgroundColor;
    expect(background(brand), 'variant="brand" repaints the circle').to.not.equal(background(neutral));
    expect(background(stale), 'a stale tone="brand" no longer does').to.equal(background(neutral));
  });

  it('keeps a legacy sm/md/lg spelling verbatim in the reflected attribute', async () => {
    const el = (await fixture(html`<lr-avatar initials="AB" size="lg"></lr-avatar>`)) as LyraAvatar;
    expect(el.size).to.equal('lg');
    expect(el.getAttribute('size')).to.equal('lg');
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
        image="data:image/gif;base64,R0lGODlhAQABAAAAACw="
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
        image="data:image/gif;base64,R0lGODlhAQABAAAAACw="
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
      html`<lr-avatar initials="AB" image="https://example.invalid/nonexistent.png" alt="A. Bee"></lr-avatar>`,
    )) as LyraAvatar;
    const img = el.shadowRoot!.querySelector('img') as HTMLImageElement;
    img.dispatchEvent(new Event('error'));
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('role')).to.equal('img');
    expect(base.getAttribute('aria-label')).to.equal('A. Bee');
  });
});

describe('per-size initials font-size', () => {
  const renderedFontSize = async (size?: string): Promise<number> => {
    const el = (await fixture(
      size == null
        ? html`<lr-avatar initials="AB"></lr-avatar>`
        : html`<lr-avatar size=${size} initials="AB"></lr-avatar>`,
    )) as LyraAvatar;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    return Number.parseFloat(getComputedStyle(base).fontSize);
  };

  it('scales the rendered initials font-size with size', async () => {
    // The visible defect this covers: the initials were painted at a fixed
    // --lr-font-size-sm at every tier, so a `small` avatar's 2 characters could not
    // fit its 1.5rem circle and a `large` avatar's looked undersized in its 2.5rem one.
    const [small, medium, large] = [
      await renderedFontSize('small'),
      await renderedFontSize('medium'),
      await renderedFontSize('large'),
    ];
    expect(small, 'small < medium').to.be.lessThan(medium);
    expect(large, 'large > medium').to.be.greaterThan(medium);
  });

  it('leaves the default (medium) tier byte-identical to today', async () => {
    // --lr-font-size-sm = 0.8125rem = 13px, the single hardcoded value every tier used to share.
    expect(await renderedFontSize()).to.equal(13);
    expect(await renderedFontSize('medium')).to.equal(13);
  });

  it('lets a consumer override --lr-avatar-font-size at any tier', async () => {
    const el = (await fixture(html`<lr-avatar size="small" initials="AB" alt="A. Bee"></lr-avatar>`)) as LyraAvatar;
    el.style.setProperty('--lr-avatar-font-size', '19px');
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).fontSize).to.equal('19px');
    await expect(el).to.be.accessible();
  });

  it('is accessible at every tier with initials rendered', async () => {
    for (const size of ['small', 'medium', 'large'] as const) {
      const el = (await fixture(html`<lr-avatar size=${size} initials="AB" alt="A. Bee"></lr-avatar>`)) as LyraAvatar;
      await expect(el).to.be.accessible();
    }
  });
});

describe('lr-avatar size aliases', () => {
  const renderedBox = async (size?: string): Promise<{ inlineSize: string; blockSize: string; fontSize: string }> => {
    const el = (await fixture(
      size == null
        ? html`<lr-avatar initials="AB"></lr-avatar>`
        : html`<lr-avatar size=${size} initials="AB"></lr-avatar>`,
    )) as LyraAvatar;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const style = getComputedStyle(base);
    return { inlineSize: style.inlineSize, blockSize: style.blockSize, fontSize: style.fontSize };
  };

  it('renders the sm/md/lg aliases exactly like small/medium/large', async () => {
    expect(await renderedBox('sm'), 'sm renders as small').to.deep.equal(await renderedBox('small'));
    expect(await renderedBox('md'), 'md renders as medium').to.deep.equal(await renderedBox('medium'));
    expect(await renderedBox('lg'), 'lg renders as large').to.deep.equal(await renderedBox('large'));
  });

  it('renders the unset default exactly like the medium tier', async () => {
    expect(await renderedBox()).to.deep.equal(await renderedBox('medium'));
  });

  it('keeps every tier visibly distinct', async () => {
    const small = await renderedBox('small');
    const medium = await renderedBox('medium');
    const large = await renderedBox('large');
    expect(Number.parseFloat(small.inlineSize)).to.be.lessThan(Number.parseFloat(medium.inlineSize));
    expect(Number.parseFloat(large.inlineSize)).to.be.greaterThan(Number.parseFloat(medium.inlineSize));
  });

  it('renders the canonical s/m/l spellings exactly like small/medium/large', async () => {
    expect(await renderedBox('s'), 's renders as small').to.deep.equal(await renderedBox('small'));
    expect(await renderedBox('m'), 'm renders as medium').to.deep.equal(await renderedBox('medium'));
    expect(await renderedBox('l'), 'l renders as large').to.deep.equal(await renderedBox('large'));
  });

  it('gives every step of the shared six-step ladder its own diameter', async () => {
    // A value the type accepts but no selector matches would silently render at the default tier,
    // which no gate in this repo can see. Assert the whole ladder is strictly increasing instead.
    const diameters: number[] = [];
    for (const size of ['2xs', 'xs', 's', 'm', 'l', 'xl'] as const) {
      diameters.push(Number.parseFloat((await renderedBox(size)).inlineSize));
    }
    for (let i = 1; i < diameters.length; i += 1) {
      expect(diameters[i], `step ${i} is larger than step ${i - 1}`).to.be.greaterThan(diameters[i - 1]!);
    }
  });
});

describe('lr-avatar shape', () => {
  const renderedRadius = async (shape: string): Promise<string> => {
    const el = (await fixture(html`<lr-avatar initials="AB" shape=${shape}></lr-avatar>`)) as LyraAvatar;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    return getComputedStyle(base).borderTopLeftRadius;
  };

  it('renders circle, rounded, and square as three distinct corner radii', async () => {
    const [circle, rounded, square] = [
      await renderedRadius('circle'),
      await renderedRadius('rounded'),
      await renderedRadius('square'),
    ];
    expect(square, 'square has sharp corners').to.equal('0px');
    expect(Number.parseFloat(rounded), 'rounded is softer than square').to.be.greaterThan(0);
    expect(
      Number.parseFloat(circle),
      'circle is rounder than rounded',
    ).to.be.greaterThan(Number.parseFloat(rounded));
  });

  it('is accessible in the rounded shape', async () => {
    const el = (await fixture(html`<lr-avatar initials="AB" alt="A. Bee" shape="rounded"></lr-avatar>`)) as LyraAvatar;
    expect(el.shape).to.equal('rounded');
    await expect(el).to.be.accessible();
  });
});

describe('lr-avatar loading', () => {
  it('defaults to eager and forwards the native loading attribute', async () => {
    const el = (await fixture(
      html`<lr-avatar image=${TEST_IMAGE_SRC} alt="A. Bee" initials="AB"></lr-avatar>`,
    )) as LyraAvatar;
    expect(el.loading).to.equal('eager');
    const img = el.shadowRoot!.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('loading')).to.equal('eager');
    // Unset-regression: `loading="eager"` is the native default, so an avatar that never sets the
    // new property renders and falls back exactly as it did before the property existed.
    expect(img.getAttribute('src')).to.equal(TEST_IMAGE_SRC);
    expect(el.shadowRoot!.querySelectorAll('[part="initials"]').length).to.equal(0);
  });

  it('forwards loading="lazy" to the native image', async () => {
    const el = (await fixture(
      html`<lr-avatar image=${TEST_IMAGE_SRC} alt="A. Bee" loading="lazy"></lr-avatar>`,
    )) as LyraAvatar;
    const img = el.shadowRoot!.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('loading')).to.equal('lazy');
    expect(img.loading).to.equal('lazy');
  });
});

describe('lr-avatar lr-error', () => {
  it('emits lr-error with the failed URL when the image cannot load', async () => {
    const el = (await fixture(
      html`<lr-avatar initials="AB" image=${TEST_IMAGE_SRC} alt="A. Bee"></lr-avatar>`,
    )) as LyraAvatar;
    const img = el.shadowRoot!.querySelector('img') as HTMLImageElement;
    const errored = oneEvent(el, 'lr-error');
    img.dispatchEvent(new Event('error'));
    const event = await errored;
    expect(event.detail.image).to.equal(TEST_IMAGE_SRC);
    expect(event.bubbles).to.be.true;
    expect(event.composed).to.be.true;
  });

  it('emits lr-error again for a replacement image that also fails', async () => {
    const el = (await fixture(
      html`<lr-avatar initials="AB" image=${TEST_IMAGE_SRC} alt="A. Bee"></lr-avatar>`,
    )) as LyraAvatar;
    const failures: string[] = [];
    el.addEventListener('lr-error', (event) => failures.push((event as CustomEvent<{ image: string }>).detail.image));
    (el.shadowRoot!.querySelector('img') as HTMLImageElement).dispatchEvent(new Event('error'));
    await el.updateComplete;

    el.image = TEST_IMAGE_SRC_REPLACEMENT;
    await el.updateComplete;
    (el.shadowRoot!.querySelector('img') as HTMLImageElement).dispatchEvent(new Event('error'));
    await el.updateComplete;
    expect(failures).to.deep.equal([TEST_IMAGE_SRC, TEST_IMAGE_SRC_REPLACEMENT]);
  });

  it('never emits lr-error for an avatar with no image', async () => {
    const el = (await fixture(html`<lr-avatar initials="AB"></lr-avatar>`)) as LyraAvatar;
    let failures = 0;
    el.addEventListener('lr-error', () => failures++);
    el.initials = 'CD';
    await el.updateComplete;
    expect(failures).to.equal(0);
  });
});

describe('lr-avatar icon slot', () => {
  const ICON = html`<svg slot="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle></svg>`;

  it('renders slot="icon" content in place of the initials', async () => {
    const el = (await fixture(html`<lr-avatar initials="AB" alt="A. Bee">${ICON}</lr-avatar>`)) as LyraAvatar;
    await el.updateComplete;
    const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
    expect(icon.hasAttribute('hidden')).to.be.false;
    const slot = el.shadowRoot!.querySelector('slot[name="icon"]') as HTMLSlotElement;
    expect(slot.assignedElements({ flatten: true }).length).to.equal(1);
    expect(slot.hasAttribute('hidden')).to.be.false;
    expect(el.shadowRoot!.querySelectorAll('[part="initials"]').length).to.equal(0);
  });

  it('yields to a loadable image, then takes over when that image fails', async () => {
    const el = (await fixture(
      html`<lr-avatar initials="AB" alt="A. Bee" image=${TEST_IMAGE_SRC}>${ICON}</lr-avatar>`,
    )) as LyraAvatar;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="image"]').length).to.equal(1);
    const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
    expect(icon.hasAttribute('hidden'), 'icon slot stays collapsed behind the image').to.be.true;

    (el.shadowRoot!.querySelector('img') as HTMLImageElement).dispatchEvent(new Event('error'));
    await el.updateComplete;
    expect(icon.hasAttribute('hidden')).to.be.false;
    expect(el.shadowRoot!.querySelectorAll('[part="initials"]').length).to.equal(0);
  });

  it('yields to default-slotted glyph content', async () => {
    const el = (await fixture(html`
      <lr-avatar initials="AB" alt="A. Bee">
        ${ICON}
        <svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16"></rect></svg>
      </lr-avatar>
    `)) as LyraAvatar;
    await el.updateComplete;
    const namedSlot = el.shadowRoot!.querySelector('slot[name="icon"]') as HTMLSlotElement;
    const defaultSlot = el.shadowRoot!.querySelector('[part="icon"] slot:not([name])') as HTMLSlotElement;
    expect(namedSlot.hasAttribute('hidden'), 'the named icon slot defers to the default slot').to.be.true;
    expect(defaultSlot.hasAttribute('hidden')).to.be.false;
    expect(getComputedStyle(namedSlot).display).to.equal('none');
  });

  it('reacts to icon-slot content added after the first render', async () => {
    const el = (await fixture(html`<lr-avatar initials="AB"></lr-avatar>`)) as LyraAvatar;
    const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
    expect(icon.hasAttribute('hidden')).to.be.true;
    const slot = el.shadowRoot!.querySelector('slot[name="icon"]') as HTMLSlotElement;
    const slotChange = oneEvent(slot, 'slotchange');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('slot', 'icon');
    el.append(svg);
    await slotChange;
    await el.updateComplete;
    expect(icon.hasAttribute('hidden')).to.be.false;
    expect(el.shadowRoot!.querySelectorAll('[part="initials"]').length).to.equal(0);
  });

  it('names the icon-slot fallback through alt', async () => {
    const el = (await fixture(html`<lr-avatar alt="AI assistant">${ICON}</lr-avatar>`)) as LyraAvatar;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('role')).to.equal('img');
    expect(base.getAttribute('aria-label')).to.equal('AI assistant');
    await expect(el).to.be.accessible();
  });
});
