import { expect } from '@open-wc/testing';
import { prefersReducedMotion } from './motion.js';

describe('prefersReducedMotion', () => {
  it('returns false when the media query does not match', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as typeof window.matchMedia;

    try {
      expect(prefersReducedMotion()).to.be.false;
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('returns true when the user has requested prefers-reduced-motion: reduce', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as typeof window.matchMedia;

    try {
      expect(prefersReducedMotion()).to.be.true;
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});
