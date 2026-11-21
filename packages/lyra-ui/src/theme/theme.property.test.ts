import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { getLyraStyle, resetLyraStyle, setLyraStyle } from './theme.js';

let sheets: CSSStyleSheet[];
let previousSheets: CSSStyleSheet[];
let previousRecord: string | null;

before(async () => {
  sheets = await Promise.all(['theme.css', 'surfaces/glass.css'].map(async path => {
    const response = await fetch(new URL(`../${path}`, import.meta.url));
    if (!response.ok) throw new Error(`Missing style fixture: ${path}`);
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(await response.text());
    return sheet;
  }));
});
beforeEach(() => {
  previousSheets = document.adoptedStyleSheets;
  previousRecord = localStorage.getItem('lyra-theme');
  document.adoptedStyleSheets = [...previousSheets, ...sheets];
});
afterEach(() => {
  resetLyraStyle();
  setLyraStyle({ mode: 'unset', accent: null });
  document.adoptedStyleSheets = previousSheets;
  if (previousRecord === null) localStorage.removeItem('lyra-theme');
  else localStorage.setItem('lyra-theme', previousRecord);
});

it('stores and paints any finite surfaceOpacity clamped to the 0-1 token scale', () => {
  const opacity = fc.oneof(
    fc.double({ min: -0.5, max: 1.5, noNaN: true }),
    fc.double({ noNaN: true, noDefaultInfinity: true }),
    fc.constantFrom(0, 0.6, 1),
  );
  fc.assert(fc.property(opacity, (value) => {
    const expected = Math.min(1, Math.max(0, value));
    expect(setLyraStyle({ surfaceOpacity: value }).surfaceOpacity, 'returned').to.equal(expected);
    expect(getLyraStyle().surfaceOpacity, 'stored').to.equal(expected);
    const painted = getComputedStyle(document.documentElement).getPropertyValue('--lr-theme-surface-opacity').trim();
    expect(Number(painted), `painted ${painted}`).to.equal(expected);
  }), propertyRuns());
});
