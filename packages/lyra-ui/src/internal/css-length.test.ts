import { expect, fixture, html } from '@open-wc/testing';
import { resolveCssLength } from './css-length.js';

const rootFontSizePx = () => Number.parseFloat(getComputedStyle(document.documentElement).fontSize);

afterEach(() => {
  document.documentElement.style.fontSize = '';
});

it('treats a bare number and an explicit px length as the same pixel value', () => {
  expect(resolveCssLength(900)).to.equal(900);
  expect(resolveCssLength('900')).to.equal(900);
  expect(resolveCssLength('900px')).to.equal(900);
  expect(resolveCssLength(56.25)).to.equal(resolveCssLength('56.25px'));
  expect(resolveCssLength('56.25')).to.equal(resolveCssLength('56.25px'));
});

it('resolves rem against the document root font size', () => {
  expect(resolveCssLength('56.25rem')).to.equal(56.25 * rootFontSizePx());
  expect(resolveCssLength('1rem')).to.equal(rootFontSizePx());
});

it('re-reads the root font size on every call so rem tracks zoom and base-size changes', () => {
  document.documentElement.style.fontSize = '16px';
  const before = resolveCssLength('10rem');
  expect(before).to.equal(160);

  document.documentElement.style.fontSize = '20px';
  const after = resolveCssLength('10rem');

  expect(after).to.equal(200);
  expect(after).to.not.equal(before);
});

it('resolves em against the host element own font size', async () => {
  const host = await fixture<HTMLElement>(html`<div style="font-size: 10px">host</div>`);
  expect(resolveCssLength('3em', host)).to.equal(30);

  host.style.fontSize = '25px';
  expect(resolveCssLength('3em', host)).to.equal(75);
});

it('falls back to the root font size for em when no host is supplied', () => {
  document.documentElement.style.fontSize = '16px';
  expect(resolveCssLength('3em')).to.equal(48);
  expect(resolveCssLength('3em')).to.equal(resolveCssLength('3rem'));
});

it('falls back to the root font size for em when the host has no computed style', () => {
  document.documentElement.style.fontSize = '16px';
  const detached = document.createElement('div');
  expect(resolveCssLength('2em', detached)).to.equal(32);
});

it('tolerates surrounding whitespace and unit casing', () => {
  expect(resolveCssLength('  900px  ')).to.equal(900);
  expect(resolveCssLength('\t56.25rem\n')).to.equal(resolveCssLength('56.25rem'));
  expect(resolveCssLength('900PX')).to.equal(900);
  expect(resolveCssLength('56.25REM')).to.equal(resolveCssLength('56.25rem'));
});

it('returns undefined for unset, empty, and unparseable values', () => {
  expect(resolveCssLength(undefined)).to.be.undefined;
  expect(resolveCssLength('')).to.be.undefined;
  expect(resolveCssLength('   ')).to.be.undefined;
  expect(resolveCssLength('auto')).to.be.undefined;
  expect(resolveCssLength('abc')).to.be.undefined;
  expect(resolveCssLength('NaN')).to.be.undefined;
  expect(resolveCssLength('px')).to.be.undefined;
  expect(resolveCssLength('900 px')).to.be.undefined;
  expect(resolveCssLength('900px 900px')).to.be.undefined;
  // Lit writes `null` back to a property whose attribute was removed, which the
  // declared signature doesn't include but callers really do hit at runtime.
  expect(resolveCssLength(null as unknown as undefined)).to.be.undefined;
});

it('returns undefined for non-finite numbers', () => {
  expect(resolveCssLength(Number.NaN)).to.be.undefined;
  expect(resolveCssLength(Number.POSITIVE_INFINITY)).to.be.undefined;
  expect(resolveCssLength(Number.NEGATIVE_INFINITY)).to.be.undefined;
});

it('returns undefined for units that have no meaning against an element own size', () => {
  expect(resolveCssLength('50%')).to.be.undefined;
  expect(resolveCssLength('80vw')).to.be.undefined;
  expect(resolveCssLength('80vh')).to.be.undefined;
  expect(resolveCssLength('40ch')).to.be.undefined;
  expect(resolveCssLength('12pt')).to.be.undefined;
  expect(resolveCssLength('10cm')).to.be.undefined;
  expect(resolveCssLength('calc(1rem + 2px)')).to.be.undefined;
  expect(resolveCssLength('var(--lr-breakpoint)')).to.be.undefined;
});

it('resolves zero, signed, and fractional lengths faithfully', () => {
  document.documentElement.style.fontSize = '16px';
  expect(resolveCssLength(0)).to.equal(0);
  expect(resolveCssLength('0')).to.equal(0);
  expect(resolveCssLength('0px')).to.equal(0);
  expect(resolveCssLength('0rem')).to.equal(0);
  expect(resolveCssLength('+900px')).to.equal(900);
  expect(resolveCssLength('.5rem')).to.equal(8);
  // Negative lengths are resolved, not rejected: the helper reports what the
  // value means in pixels and leaves range policy to the caller.
  expect(resolveCssLength(-5)).to.equal(-5);
  expect(resolveCssLength('-5px')).to.equal(-5);
  expect(resolveCssLength('-2rem')).to.equal(-32);
});
