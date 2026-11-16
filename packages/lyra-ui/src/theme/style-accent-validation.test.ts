import { expect } from '@open-wc/testing';
import { getLyraStyle, parseLyraStyleRecord, resetLyraStyle, setLyraStyle, startLyraStyle } from './theme.js';

const brandFill = (): string =>
  document.documentElement.style.getPropertyValue('--lr-theme-color-brand-fill-loud').trim();

let previousRecord: string | null;
let originalSheets: CSSStyleSheet[];
let themeSheet: CSSStyleSheet;

before(async () => {
  const response = await fetch(new URL('../theme.css', import.meta.url));
  if (!response.ok) throw new Error('Missing theme stylesheet fixture');
  themeSheet = new CSSStyleSheet();
  themeSheet.replaceSync(await response.text());
});

beforeEach(() => {
  originalSheets = [...document.adoptedStyleSheets];
  document.adoptedStyleSheets = [...originalSheets, themeSheet];
  previousRecord = localStorage.getItem('lyra-theme');
  resetLyraStyle();
  setLyraStyle({ mode: 'light' });
});

afterEach(() => {
  setLyraStyle({ mode: 'unset', look: null, surface: null, density: null, accent: null, overrides: null, accentBackground: null });
  if (previousRecord === null) localStorage.removeItem('lyra-theme');
  else localStorage.setItem('lyra-theme', previousRecord);
  document.adoptedStyleSheets = originalSheets;
});

describe('runtime accent color validation', () => {
  // Each value passes the persisted-record syntax check but cannot drive a deterministic ramp.
  const rejected: Array<[string, string]> = [
    ['an unbalanced color function', 'rgb(1, 2, 3))'],
    ['a CSS-wide keyword', 'inherit'],
    ['a forced-colors system color', 'Canvas'],
    ['currentcolor', 'currentcolor'],
    ['a var() reference', 'rgb(var(--x))'],
    ['a light-dark() pair', 'color-mix(in srgb, light-dark(red, blue), white)'],
    ['relative color syntax', 'rgb(from red r g b)'],
    ['a word the browser does not parse as a color', 'notacolor'],
  ];
  for (const [label, value] of rejected) {
    it(`drops ${label} and leaves the authored brand ramp in place`, () => {
      setLyraStyle({ accent: '#2255aa' });
      expect(brandFill()).to.not.equal('');
      setLyraStyle({ accent: value });
      expect(getLyraStyle().accent).to.equal(null);
      expect(brandFill()).to.equal('');
    });
  }

  it('collapses a per-role, per-mode accent whose every branch the browser rejects to null', () => {
    // Both branches are syntactically color-like words, so only the browser color parser rejects them.
    setLyraStyle({ accent: { brand: { light: 'notacolor', dark: 'alsonotacolor' }, success: '#118833' } });
    // The unresolvable role is dropped; the valid sibling role still paints.
    expect(getLyraStyle().accent).to.deep.equal({ success: '#118833' });
    expect(brandFill()).to.equal('');
    expect(document.documentElement.style.getPropertyValue('--lr-theme-color-success-fill-loud').trim()).to.not.equal('');
  });

  it('keeps the valid branch of a per-mode accent and paints it only in its own mode', () => {
    setLyraStyle({ accent: { brand: { light: 'notacolor', dark: '#3366cc' } } });
    expect((getLyraStyle().accent as Record<string, unknown>)['brand']).to.deep.equal({ light: null, dark: '#3366cc' });
    expect(brandFill()).to.equal('');
    setLyraStyle({ mode: 'dark' });
    expect(brandFill()).to.not.equal('');
  });

  it('drops an invalid accent background without discarding the accent', () => {
    setLyraStyle({ accent: '#2255aa', accentBackground: 'notacolor' });
    expect(getLyraStyle().accentBackground).to.equal(null);
    expect(getLyraStyle().accent).to.equal('#2255aa');
    expect(brandFill()).to.not.equal('');
  });

  it('revalidates a saved accent background when the runtime starts from storage', () => {
    localStorage.setItem('lyra-theme', JSON.stringify({ version: 2, mode: 'light', accent: '#2255aa', surface: 'notacolor' }));
    const started = startLyraStyle();
    expect(started.accent).to.equal('#2255aa');
    expect(started.accentBackground).to.equal(null);
    localStorage.setItem('lyra-theme', JSON.stringify({ version: 2, mode: 'light', accent: '#2255aa', surface: 'rgb(250, 250, 250)' }));
    expect(startLyraStyle().accentBackground).to.equal('rgb(250, 250, 250)');
  });

  it('restores the default accent for a saved accent map that names no semantic role', () => {
    const fallback = parseLyraStyleRecord({ version: 2 });
    const parsed = parseLyraStyleRecord({ version: 2, accent: { primary: '#123456', unknown: 'red' } });
    expect(parsed.accent).to.deep.equal(fallback.accent);
    expect(parsed.accentName).to.equal(fallback.accentName);
    // A map with one recognized role keeps just that role.
    expect(parseLyraStyleRecord({ version: 2, accent: { brand: '#123456', unknown: 'red' } }).accent)
      .to.deep.equal({ brand: '#123456' });
  });
});
