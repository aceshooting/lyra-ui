import { expect } from '@open-wc/testing';
import {
  canonicalizeLyraLocale,
  getLyraLocaleDirection,
  registerLyraLocale,
  resolveLocalizedParts,
  resolveLyraString,
} from './localization-runtime.js';

// Most of localization-runtime.ts is already exercised indirectly, at high volume, through every
// component that extends LyraElement (src/internal/lyra-element.test.ts) and through the public
// wrapper's own extensive suites (src/internal/localization.test.ts,
// src/internal/localization-reactivity.test.ts). This file targets the defensive/adversarial-scale
// branches those realistic call sites never reach: resolveLocalizedParts()'s marker-exhaustion
// fallbacks, the catalog message cap, and the bounded identity/candidate caches under pressure.

function localeHost(locale: string): HTMLElement {
  const host = document.createElement('div');
  host.setAttribute('locale', locale);
  return host;
}

it('splits interpolated text around the caller-selected rich value', () => {
  const template = 'Confirm {value}';
  const parts = resolveLocalizedParts(template, (marker) => `Confirm ${marker}!!`);
  expect(parts).to.deep.equal(['Confirm ', '!!']);
});

it('falls back to a general BMP code point when the template exhausts the private-use area', () => {
  // Every private-use code point (0xE000-0xF8FF) is present, so the first marker-selection loop
  // never finds a gap and the function must fall through to the wider 65,536-entry scan.
  const template = Array.from(
    { length: 0xf8ff - 0xe000 + 1 },
    (_, index) => String.fromCharCode(0xe000 + index),
  ).join('');

  const parts = resolveLocalizedParts(template, (marker) => `left${marker}right`);
  expect(parts).to.deep.equal(['left', 'right']);
});

it('falls back to a least-frequent code unit and follower pair when the template exhausts every BMP code unit', () => {
  // Every UTF-16 code unit 0..65535 appears exactly once, so even the wider single-code-point scan
  // finds nothing free and the function must fall back to a two-code-unit least-frequent pair.
  const template = Array.from({ length: 65_536 }, (_, code) => String.fromCharCode(code)).join('');

  const parts = resolveLocalizedParts(template, (marker) => `before☃${marker}after☃`);
  expect(parts).to.deep.equal(['before☃', 'after☃']);
});

it('resolves direction from Intl.Locale text info when no catalog meta declares it', () => {
  // This test file never registers or imports a catalog for 'ar', so getLyraLocaleDirection()
  // cannot take the registered-meta shortcut and must fall through to the Intl.Locale text-info
  // lookup — the one branch every other suite's pre-registered he/fa/ar catalogs short-circuit.
  expect(getLyraLocaleDirection('ar')).to.equal('rtl');
  expect(getLyraLocaleDirection('en')).to.equal('ltr');
});

it('resolves ltr for a structurally invalid tag instead of throwing', () => {
  expect(getLyraLocaleDirection('not a locale !!')).to.equal('ltr');
  expect(getLyraLocaleDirection('')).to.equal('ltr');
});

it('bounds a registered catalog to the maximum retained message count', () => {
  const locale = 'zz-catalog-message-cap';
  const strings: Record<string, string> = {};
  for (let index = 0; index < 4_100; index += 1) strings[`key${index}`] = `value${index}`;
  registerLyraLocale(locale, strings);

  const host = localeHost(locale);
  expect(resolveLyraString(host, 'key0')).to.equal('value0');
  // Well past the 4,096-entry cap: never copied into the snapshot, so lookup falls through to the
  // raw key (no fallback/defaults were supplied).
  expect(resolveLyraString(host, 'key4099')).to.equal('key4099');
});

it('clears the bounded identity/candidate caches under sustained unique-locale pressure without breaking resolution', () => {
  for (let index = 0; index < 140; index += 1) {
    const tag = `zz-cache-pressure-${index}`;
    getLyraLocaleDirection(tag);
  }
  // Re-resolving an early tag after the cache has cleared and refilled several times over must
  // still produce the correct, stable identity.
  expect(canonicalizeLyraLocale('zz-cache-pressure-0')).to.equal('zz-cache-pressure-0');
  expect(canonicalizeLyraLocale('zz-cache-pressure-139')).to.equal('zz-cache-pressure-139');
});
