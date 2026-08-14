import { expect } from '@open-wc/testing';
import { LANGUAGE_TO_COUNTRY, languageToCountry, localeNativeName } from './language-map.js';

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

  it('maps Persian and Hebrew base/regional tags to Iran and Israel with native endonyms', () => {
    expect(languageToCountry('fa')).to.equal('ir');
    expect(languageToCountry('fa-IR')).to.equal('ir');
    expect(languageToCountry('he')).to.equal('il');
    expect(languageToCountry('he-IL')).to.equal('il');
    expect(localeNativeName('fa')).to.equal(new Intl.DisplayNames(['fa'], { type: 'language' }).of('fa'));
    expect(localeNativeName('he')).to.equal(new Intl.DisplayNames(['he'], { type: 'language' }).of('he'));
  });
});
