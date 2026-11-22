import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import '../../lr-icon.js';
import type { LyraIcon } from '../../lr-icon.js';
import {
  getDefaultIconFamily,
  getDefaultIconVariant,
  registerIconLibrary,
  setDefaultIconFamily,
  unregisterIconLibrary,
} from './icon-library.js';
import { resolveSpriteSheetHref } from './icon-sprite.js';

describe('lr-icon default family and variant', () => {
  afterEach(() => {
    setDefaultIconFamily('', '');
    unregisterIconLibrary('dx-lib');
  });

  it('starts empty, keeps the variant when omitted, and feeds unset icons', async () => {
    expect(getDefaultIconFamily()).to.equal('');
    setDefaultIconFamily('sharp', 'thin');
    setDefaultIconFamily('duotone');
    expect(getDefaultIconFamily()).to.equal('duotone');
    expect(getDefaultIconVariant()).to.equal('thin');

    const seen: string[] = [];
    registerIconLibrary('dx-lib', {
      resolver: (name, family, variant) => {
        seen.push(`${name}|${family}|${variant}`);
        return '';
      },
    });
    const own = await fixture<LyraIcon>(html`<lr-icon library="dx-lib" name="a" family="own" variant="bold"></lr-icon>`);
    await fixture<LyraIcon>(html`<lr-icon library="dx-lib" name="b"></lr-icon>`);
    await waitUntil(() => seen.length >= 2);
    expect(seen).to.include('a|own|bold');
    expect(seen).to.include('b|duotone|thin');
    expect(own.family).to.equal('own');
  });

  it('re-resolves rendered icons when the default changes', async () => {
    const seen: string[] = [];
    registerIconLibrary('dx-lib', {
      resolver: (_name, family) => {
        seen.push(family);
        return '';
      },
    });
    await fixture<LyraIcon>(html`<lr-icon library="dx-lib" name="a"></lr-icon>`);
    await waitUntil(() => seen.length >= 1);
    setDefaultIconFamily('late');
    await waitUntil(() => seen.includes('late'));
  });
});

describe('resolveSpriteSheetHref', () => {
  const base = 'https://app.test/dir/page.html';
  it('accepts same-origin sheet fragments, absolute or relative', () => {
    expect(resolveSpriteSheetHref('/s.svg#a', base)).to.equal('https://app.test/s.svg#a');
    expect(resolveSpriteSheetHref('s.svg#a', base)).to.equal('https://app.test/dir/s.svg#a');
    expect(resolveSpriteSheetHref('https://app.test/s.svg#a', base)).to.equal('https://app.test/s.svg#a');
  });
  it('rejects other origins, data/blob/javascript URLs, missing fragments and non-strings', () => {
    for (const value of [
      'https://evil.test/s.svg#a',
      'data:image/svg+xml,<svg/>#a',
      'blob:https://app.test/x#a',
      'javascript:alert(1)#a',
      '/s.svg',
      '/s.svg#',
      '',
      undefined,
      42,
    ]) {
      expect(resolveSpriteSheetHref(value, base), String(value)).to.equal(null);
    }
  });
});

describe('lr-icon spriteSheet libraries', () => {
  afterEach(() => unregisterIconLibrary('dx-sprite'));

  it('renders svg > use for a same-origin sheet without fetching', async () => {
    registerIconLibrary('dx-sprite', { resolver: (name) => `/package.json#${name}`, spriteSheet: true });
    const el = await fixture<LyraIcon>(html`<lr-icon library="dx-sprite" name="star"></lr-icon>`);
    await waitUntil(() => el.shadowRoot?.querySelector('use'));
    const use = el.shadowRoot!.querySelector('use')!;
    expect(use.getAttribute('href')).to.equal(`${location.origin}/package.json#star`);
    expect(use.closest('svg')?.getAttribute('aria-hidden')).to.equal('true');
  });

  it('fails closed with lr-error for a cross-origin sheet', async () => {
    registerIconLibrary('dx-sprite', { resolver: () => 'https://elsewhere.invalid/s.svg#a', spriteSheet: true });
    const el = document.createElement('lr-icon') as LyraIcon;
    el.library = 'dx-sprite';
    el.name = 'star';
    const failed = oneEvent(el, 'lr-error');
    document.body.append(el);
    try {
      await failed;
      await aTimeout(0);
      expect(el.shadowRoot!.querySelector('use') === null).to.equal(true);
    } finally {
      el.remove();
    }
  });
});
