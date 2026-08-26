import { expect } from '@open-wc/testing';
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
