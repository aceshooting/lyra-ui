import { expect } from '@open-wc/testing';
import {
  ALPHA3_RE,
  LANGUAGE_TO_COUNTRY,
  alpha3ToAlpha2,
  languageToCountry,
  localeNativeName,
} from './language-map.js';

describe('localeNativeName', () => {
  it('names a locale in its own language', () => {
    expect(localeNativeName('fr')).to.equal('français');
    expect(localeNativeName('de')).to.equal('Deutsch');
  });

  it('keeps the region distinction for a regional tag', () => {
    const brazilian = localeNativeName('pt-BR');
    expect(brazilian).to.equal(new Intl.DisplayNames(['pt-BR'], { type: 'language' }).of('pt-BR'));
    expect(brazilian, 'the Brazilian variant must not collapse to plain "português"').to.contain('Brasil');
    expect(brazilian).to.not.equal(localeNativeName('pt'));
  });

  it('degrades to the tag itself for an unknown tag', () => {
    // Structurally valid, but no display name exists for it.
    expect(localeNativeName('zz')).to.equal('zz');
  });

  it('degrades to the tag itself for a structurally invalid tag instead of throwing', () => {
    // `Intl.DisplayNames` throws a RangeError on these rather than returning a fallback.
    expect(localeNativeName('not a locale')).to.equal('not a locale');
    expect(localeNativeName('')).to.equal('');
    expect(localeNativeName('en_US!')).to.equal('en_US!');
  });

  it('stays usable after an invalid tag (a throwing lookup must not poison the shared cache)', () => {
    expect(localeNativeName('¡nope!')).to.equal('¡nope!');
    expect(localeNativeName('fr')).to.equal('français');
  });

  it('reuses the shared Intl cache instead of constructing per call', () => {
    const original = Intl.DisplayNames;
    let constructed = 0;
    const counting = new Proxy(original, {
      construct(target, args) {
        constructed++;
        return new target(...(args as ConstructorParameters<typeof Intl.DisplayNames>));
      },
    });
    (Intl as { DisplayNames: typeof Intl.DisplayNames }).DisplayNames = counting;
    try {
      // A locale no other assertion in this file touches, so the first call is a genuine cache miss.
      localeNativeName('is');
      localeNativeName('is');
      localeNativeName('is');
    } finally {
      (Intl as { DisplayNames: typeof Intl.DisplayNames }).DisplayNames = original;
    }
    expect(constructed, 'repeat lookups must hit the memoized formatter').to.equal(1);
  });

  it('pairs with the flag mapping to describe a locale', () => {
    expect(languageToCountry('pt-BR')).to.equal('br');
    expect(LANGUAGE_TO_COUNTRY.fr).to.equal('fr');
    expect(localeNativeName('pt-BR')).to.contain('Brasil');
  });

  it('does not mistake Unicode-extension or private-use tokens for regions', () => {
    expect(languageToCountry('en-u-ca-gregory')).to.equal('gb');
    expect(languageToCountry('zh-Hant-u-nu-hanidec')).to.equal('cn');
    expect(languageToCountry('en-x-ca')).to.equal('gb');
    expect(languageToCountry('x-ca')).to.equal(undefined);
  });

  it('supports script, explicit region, underscore, and malformed inputs deterministically', () => {
    expect(languageToCountry('zh-Hant-TW')).to.equal('tw');
    expect(languageToCountry('pt_BR')).to.equal('br');
    expect(languageToCountry('sr-Cyrl')).to.equal('rs');
    expect(languageToCountry('')).to.equal(undefined);
    expect(languageToCountry('not a locale')).to.equal(undefined);
    expect(languageToCountry('en-..-ca')).to.equal('gb');
  });

  it('never resolves inherited Object.prototype names as mapping entries', () => {
    expect(typeof languageToCountry('constructor')).to.equal('undefined');
  });

  it('maps Persian and Hebrew base/regional tags to Iran and Israel with native endonyms', () => {
    expect(languageToCountry('fa')).to.equal('ir');
    expect(languageToCountry('fa-IR')).to.equal('ir');
    expect(languageToCountry('he')).to.equal('il');
    expect(languageToCountry('he-IL')).to.equal('il');
    expect(localeNativeName('fa')).to.equal(new Intl.DisplayNames(['fa'], { type: 'language' }).of('fa'));
    expect(localeNativeName('he')).to.equal(new Intl.DisplayNames(['he'], { type: 'language' }).of('he'));
  });
});

describe('alpha3ToAlpha2', () => {
  it('maps the alpha-3 codes statistical datasets key on', () => {
    // World Bank / UN / IMF all key on alpha-3; these are the mappings a consumer would otherwise
    // maintain by hand.
    expect(alpha3ToAlpha2('FRA')).to.equal('fr');
    expect(alpha3ToAlpha2('USA')).to.equal('us');
    expect(alpha3ToAlpha2('DEU')).to.equal('de');
    expect(alpha3ToAlpha2('ZWE')).to.equal('zw');
    expect(alpha3ToAlpha2('CHE')).to.equal('ch');
  });

  it('is case insensitive', () => {
    expect(alpha3ToAlpha2('fra')).to.equal('fr');
    expect(alpha3ToAlpha2('FrA')).to.equal('fr');
  });

  it('rejects anything that is not three ASCII letters', () => {
    expect(alpha3ToAlpha2('fr')).to.equal(undefined);
    expect(alpha3ToAlpha2('frax')).to.equal(undefined);
    expect(alpha3ToAlpha2('f1a')).to.equal(undefined);
    expect(alpha3ToAlpha2('')).to.equal(undefined);
    expect(alpha3ToAlpha2('../')).to.equal(undefined);
  });

  it('returns undefined for a withdrawn or user-assigned code rather than a successor state', () => {
    // A dissolved federation has no current flag; silently mapping it to a successor would be
    // wrong, so it takes the component's unresolved path instead.
    expect(alpha3ToAlpha2('SUN'), 'former Soviet Union').to.equal(undefined);
    expect(alpha3ToAlpha2('YUG'), 'former Yugoslavia').to.equal(undefined);
    expect(alpha3ToAlpha2('ZZZ'), 'user-assigned').to.equal(undefined);
  });

  it('covers the full officially-assigned set exactly once', () => {
    const seen = new Set<string>();
    let mapped = 0;
    for (const code of ['abw', 'zwe', 'fra', 'usa']) {
      expect(ALPHA3_RE.test(code), code).to.be.true;
    }
    // Walk every alpha-3 permutation is too slow; instead assert the packed table's own size via a
    // representative sweep of first letters, and that no alpha-2 result is malformed.
    for (const a of 'abcdefghijklmnopqrstuvwxyz') {
      for (const b of 'abcdefghijklmnopqrstuvwxyz') {
        for (const c of 'abcdefghijklmnopqrstuvwxyz') {
          const result = alpha3ToAlpha2(`${a}${b}${c}`);
          if (result === undefined) continue;
          mapped += 1;
          expect(/^[a-z]{2}$/.test(result), `${a}${b}${c} -> ${result}`).to.be.true;
          seen.add(`${a}${b}${c}`);
        }
      }
    }
    expect(mapped, 'the 249 officially-assigned ISO 3166-1 entries').to.equal(249);
    expect(seen.size, 'each alpha-3 key appears once').to.equal(249);
  });
});
