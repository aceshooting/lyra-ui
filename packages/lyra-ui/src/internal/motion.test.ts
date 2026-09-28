import { expect, fixture, html } from '@open-wc/testing';
import { prefersReducedMotion } from './motion.js';

function mediaQueryList(query: string, matches: boolean): MediaQueryList {
  return {
    matches,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  };
}

describe('prefersReducedMotion', () => {
  it('follows slot inheritance, permits a nested system reset, and retains the OS floor', async () => {
    const original = window.matchMedia;
    let reduced = false;
    window.matchMedia = query => mediaQueryList(query, reduced);
    try {
      const host = await fixture<HTMLElement>(html`<div data-lr-motion="reduce"><span></span></div>`);
      const root = host.attachShadow({ mode: 'open' });
      const section = document.createElement('section');
      section.setAttribute('data-lr-motion', 'system');
      section.append(document.createElement('slot'));
      root.append(section);
      const child = host.firstElementChild!;
      expect(prefersReducedMotion(child)).to.equal(false);
      section.removeAttribute('data-lr-motion');
      expect(prefersReducedMotion(child)).to.equal(true);
      section.setAttribute('data-lr-motion', 'invalid');
      expect(prefersReducedMotion(child)).to.equal(true);
      section.setAttribute('data-lr-motion', 'system');
      reduced = true;
      expect(prefersReducedMotion(child)).to.equal(true);
    } finally {
      window.matchMedia = original;
    }
  });

  it('queries the element’s own iframe even when the top-level window differs', async () => {
    const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
    const owner = frame.contentWindow!;
    const outer = window.matchMedia;
    const inner = owner.matchMedia;
    window.matchMedia = query => mediaQueryList(query, false);
    owner.matchMedia = query => mediaQueryList(query, true);
    try {
      const child = owner.document.createElement('div');
      child.setAttribute('data-lr-motion', 'system');
      owner.document.body.append(child);
      expect(prefersReducedMotion(child)).to.equal(true);
      expect(prefersReducedMotion(window)).to.equal(false);
    } finally {
      window.matchMedia = outer;
      owner.matchMedia = inner;
    }
  });

  it('returns false when the media query does not match', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = (query: string) => mediaQueryList(query, false);

    try {
      expect(prefersReducedMotion()).to.be.false;
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('returns true when the user has requested prefers-reduced-motion: reduce', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = (query: string) =>
      mediaQueryList(query, query === '(prefers-reduced-motion: reduce)');

    try {
      expect(prefersReducedMotion()).to.be.true;
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});
