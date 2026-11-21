import { expect } from '@open-wc/testing';
import { inheritedPreference, preferenceMediaMatches } from './preferences.js';

describe('inherited preferences edges', () => {
  it('walks a shim element without a browser tree through parentElement', () => {
    const parent = { getAttribute: (name: string) => (name === 'data-p' ? 'enhanced' : null), parentElement: null };
    const child = { getAttribute: () => null, parentElement: parent };
    expect(inheritedPreference(child as unknown as Element, 'data-p', 'enhanced')).to.equal('enhanced');
    expect(inheritedPreference({ getAttribute: () => 'bogus', parentElement: null } as unknown as Element, 'data-p', 'enhanced')).to.equal('system');
    expect(inheritedPreference(undefined, 'data-p', 'enhanced')).to.equal('system');
  });

  it('reads the explicit value on the element itself', () => {
    const el = document.createElement('div');
    el.setAttribute('data-p', 'system');
    expect(inheritedPreference(el, 'data-p', 'enhanced')).to.equal('system');
  });

  it('answers media queries only when a view can', () => {
    expect(preferenceMediaMatches(null, '(a)')).to.equal(false);
    expect(preferenceMediaMatches({} as Window, '(a)')).to.equal(false);
    expect(preferenceMediaMatches({ matchMedia: () => ({ matches: true }) } as unknown as Window, '(a)')).to.equal(true);
    expect(preferenceMediaMatches(window, 'all')).to.equal(true);
  });
});
