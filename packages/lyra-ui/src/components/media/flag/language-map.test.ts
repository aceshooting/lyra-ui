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

  it('degrades to the tag when a formatter returns no display name', () => {
    const original = Intl.DisplayNames.prototype.of;
    Intl.DisplayNames.prototype.of = function (this: Intl.DisplayNames, tag: string) {
      return tag === 'qaa' ? (undefined as unknown as string) : original.call(this, tag);
    };
    try {
      expect(localeNativeName('qaa')).to.equal('qaa');
    } finally {
      Intl.DisplayNames.prototype.of = original;
    }
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
    expect(LANGUAGE_TO_COUNTRY['fr']).to.equal('fr');
    expect(localeNativeName('pt-BR')).to.contain('Brasil');
  });

  it('does not mistake Unicode-extension or private-use tokens for regions', () => {
    expect(languageToCountry('en-u-ca-gregory')).to.equal('gb');
    // `nu` is a Unicode-extension key, not Niue; the script still selects Taiwan's flag.
    expect(languageToCountry('zh-Hant-u-nu-hanidec')).to.equal('tw');
    expect(languageToCountry('en-x-ca')).to.equal('gb');
    expect(languageToCountry('x-ca')).to.equal(undefined);
  });

  it('keeps extension tokens out of the structural fallback when Intl.Locale is unavailable', () => {
    const descriptor = Object.getOwnPropertyDescriptor(Intl, 'Locale');
    Object.defineProperty(Intl, 'Locale', {
      configurable: true,
      value: function UnsupportedLocale(): never {
        throw new RangeError('Intl.Locale unavailable');
      },
    });
    try {
      expect(languageToCountry('en-u-ca-gregory')).to.equal('gb');
      expect(languageToCountry('en-x-ca')).to.equal('gb');
      expect(languageToCountry('es-419')).to.equal(undefined);
      expect(languageToCountry('x-ca')).to.equal(undefined);
      expect(languageToCountry(42 as never)).to.equal(undefined);
      // Without likely-subtags data only the base-language default remains.
      expect(languageToCountry('zh-Hant')).to.equal('cn');
    } finally {
      if (descriptor) Object.defineProperty(Intl, 'Locale', descriptor);
      else delete (Intl as { Locale?: typeof Intl.Locale }).Locale;
    }
  });

  it('supports script, explicit region, underscore, and malformed inputs deterministically', () => {
    expect(languageToCountry('zh-Hant-TW')).to.equal('tw');
    expect(languageToCountry('pt_BR')).to.equal('br');
    expect(languageToCountry('sr-Cyrl')).to.equal('rs');
    expect(languageToCountry('')).to.equal(undefined);
    expect(languageToCountry('not a locale')).to.equal(undefined);
    expect(languageToCountry('en-..-ca')).to.equal('gb');
  });

  it('follows a script subtag to the region it implies when that differs from the base language', () => {
    // Traditional Chinese is not written in mainland China, so the `zh` default of `cn` is wrong
    // for a region-less Traditional tag, and `zh-Hans`/`zh-Hant` rows must not share one flag.
    expect(languageToCountry('zh-Hant')).to.equal('tw');
    expect(languageToCountry('zh-Hans')).to.equal('cn');
    expect(languageToCountry('zh')).to.equal('cn');
    // An explicit region still wins over the script.
    expect(languageToCountry('zh-Hant-HK')).to.equal('hk');
    expect(languageToCountry('zh-Hans-SG')).to.equal('sg');
    // A script that implies the language's own likely region keeps the table's convention.
    expect(languageToCountry('en-Latn')).to.equal('gb');
    expect(languageToCountry('sr-Latn')).to.equal('rs');
    // Punjabi's table default is India, but its Arabic-script likely region is Pakistan. An
    // unlisted language still stays unresolved because script inference only adjusts table entries.
    expect(languageToCountry('pa-Arab')).to.equal('pk');
    expect(languageToCountry('zz-Arab')).to.equal(undefined);
  });

  it('applies the script-implied region to every table language, not only Chinese', () => {
    // Kazakh written in Arabic script is the Kazakh of China, not of Kazakhstan.
    expect(languageToCountry('kk-Arab')).to.equal('cn');
    expect(languageToCountry('kk-Cyrl')).to.equal('kz');
    expect(languageToCountry('kk')).to.equal('kz');
    // Han with Bopomofo, and Bopomofo itself, are written in Taiwan.
    expect(languageToCountry('zh-Hanb')).to.equal('tw');
    expect(languageToCountry('zh-Bopo')).to.equal('tw');
    // Shavian's likely region (GB) differs from bare English's (US) but equals the table's own `gb`.
    expect(languageToCountry('en-Shaw')).to.equal('gb');
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

  it('maps the expanded translation locales to representative flag countries', () => {
    const mappings: ReadonlyArray<readonly [string, string]> = [
      ['am', 'et'],
      ['bho', 'in'],
      ['gu', 'in'],
      ['ha', 'ng'],
      ['ig', 'ng'],
      ['jv', 'id'],
      ['kn', 'in'],
      ['lah', 'pk'],
      ['ln', 'cd'],
      ['ml', 'in'],
      ['mr', 'in'],
      ['my', 'mm'],
      ['ne', 'np'],
      ['om', 'et'],
      ['or', 'in'],
      ['pa', 'in'],
      ['pcm', 'ng'],
      ['pnb', 'pk'],
      ['ps', 'af'],
      ['sd', 'pk'],
      ['su', 'id'],
      ['sw', 'tz'],
      ['te', 'in'],
      ['tl', 'ph'],
      ['uz', 'uz'],
      ['yo', 'ng'],
      ['zu', 'za'],
    ];

    for (const [locale, country] of mappings) {
      expect(languageToCountry(locale), locale).to.equal(country);
    }
    // The regional tag derives its Afghan flag from the explicit region subtag; the base Persian
    // entry remains mapped to Iran.
    expect(languageToCountry('fa-AF')).to.equal('af');
  });

  it('maps the bare region-less Norwegian Nynorsk and Kazakh locale tags to a flag country', () => {
    expect(languageToCountry('nn')).to.equal('no');
    expect(languageToCountry('kk')).to.equal('kz');
    expect(languageToCountry('kk-KZ')).to.equal('kz');
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

it('does not assign a country flag to numeric language regions', () => {
  expect(languageToCountry('es-419')).to.equal(undefined);
  expect(languageToCountry('en-001')).to.equal(undefined);
  expect(languageToCountry('es-419-u-nu-latn')).to.equal(undefined);
  expect(languageToCountry('es-MX')).to.equal('mx');
});

it('supports representative flags for Luxembourgish and Filipino', () => {
  expect(languageToCountry('lb')).to.equal('lu');
  expect(languageToCountry('fil')).to.equal('ph');
  expect(languageToCountry('lb-BE')).to.equal('be');
});
