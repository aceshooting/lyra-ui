import { expect } from '@open-wc/testing';
import { loadLyraLocale } from './locale-loader.js';
import { getLyraLocale, getLyraLocaleDirection, getRegisteredLyraLocaleKeys, getRegisteredLyraLocales, LYRA_DEFAULT_STRINGS } from './localization.js';

it('keeps catalogs absent until an exact supported locale is requested', async () => {
  expect(getRegisteredLyraLocales()).to.deep.equal(['en']);
  const previous = getLyraLocale();
  await loadLyraLocale('en');
  expect(getRegisteredLyraLocales()).to.deep.equal(['en']);
  const first = loadLyraLocale('FR');
  expect(first === loadLyraLocale('fr')).to.equal(true);
  await first;
  expect(getRegisteredLyraLocaleKeys('fr')).to.have.length(Object.keys(LYRA_DEFAULT_STRINGS).length);
  expect(getRegisteredLyraLocaleKeys('de')).to.have.length(0);
  expect(getLyraLocale()).to.equal(previous);
});

it('rejects an unshipped regional catalog without advertising it as translated', async () => {
  let rejected = false;
  await loadLyraLocale('fr-BE').catch(() => { rejected = true; });
  expect(rejected).to.equal(true);
  expect(getRegisteredLyraLocales()).not.to.include('fr-BE');
});


for (const [sourceTag, canonical] of [['tl', 'fil'], ['pnb', 'lah']] as const) {
  it(`shares the authored ${sourceTag} catalog with its canonical ${canonical} alias`, async () => {
    const first = loadLyraLocale(sourceTag);
    expect(first === loadLyraLocale(canonical)).to.equal(true);
    await first;
    expect(getRegisteredLyraLocaleKeys(sourceTag)).to.have.length(Object.keys(LYRA_DEFAULT_STRINGS).length);
    expect(getRegisteredLyraLocales().filter((tag) => tag === sourceTag || tag === canonical)).to.deep.equal([canonical]);
    if (sourceTag === 'pnb') expect(getLyraLocaleDirection(sourceTag)).to.equal('rtl');
  });
}

for (const [tag, parent, sample] of [
  ['en-GB', undefined, 'colorPicker'],
  ['es-419', 'es', 'contactViewerTypeCell'],
  ['fr-CA', 'fr', 'contactViewerEmailLabel'],
  ['zh-HK', 'zh-TW', 'browserFrameControllerUser'],
] as const) {
  it(`loads the ${tag} difference catalog and resolves the rest through ${parent ?? 'the built-in English'}`, async () => {
    await loadLyraLocale(tag);
    const own = getRegisteredLyraLocaleKeys(tag);
    expect(own.length).to.be.greaterThan(0);
    expect(own.length).to.be.lessThan(150);
    expect(own).to.include(sample);
    expect(getRegisteredLyraLocales()).to.include(tag);
    if (parent) expect(getRegisteredLyraLocaleKeys(parent)).to.have.length(Object.keys(LYRA_DEFAULT_STRINGS).length);
    expect(getLyraLocaleDirection(tag)).to.equal('ltr');
  });
}
