import { expect } from '@open-wc/testing';
import {
  getLyraLocale,
  getLyraLocaleDirection,
  getRegisteredLyraLocaleKeys,
  getRegisteredLyraLocales,
  registerLyraLocale,
  resolveLyraString,
  setLyraLocale,
  subscribeLyraLocale,
} from './localization-runtime.js';
import { LYRA_DEFAULT_STRINGS } from './localization.js';

it('loads the matching parent family before a sparse regional slice and lazily completes both catalogs without selecting either', async () => {
  const active = getLyraLocale();
  const { loadLyraLocale } = await import('../locale-loader.js');
  expect(getRegisteredLyraLocaleKeys('de').length).to.equal(0);
  expect(getRegisteredLyraLocaleKeys('de-CH').length).to.equal(0);
  await import('../translations/de-CH/forms.js');
  const host = Object.assign(document.createElement('div'), { lang: 'de-CH' });
  expect(getRegisteredLyraLocaleKeys('de').includes('openCalendar')).to.equal(true);
  expect(getRegisteredLyraLocaleKeys('de-CH').includes('openCalendar')).to.equal(false);
  expect(resolveLyraString(host, 'openCalendar')).to.equal('Kalender öffnen');
  expect(getRegisteredLyraLocaleKeys('de').includes('close')).to.equal(false);
  const first = loadLyraLocale('de_ch');
  expect(loadLyraLocale('DE-CH') === first).to.equal(true);
  await first;
  expect(getLyraLocale()).to.equal(active);
  expect(getRegisteredLyraLocaleKeys('de').length).to.equal(Object.keys(LYRA_DEFAULT_STRINGS).length);
  expect(getRegisteredLyraLocaleKeys('de-CH').length).to.equal(34);
  expect(resolveLyraString(host, 'close')).to.equal('Schliessen');
  expect(getRegisteredLyraLocales().includes('de-AT')).to.equal(false);
});

it('keeps regional overrides and direction while inherited messages update live through the parent', async () => {
  await import('../translations/de-CH.js');
  const host = Object.assign(document.createElement('div'), { lang: 'de-CH' });
  const parent = Object.assign(document.createElement('div'), { lang: 'de' });
  const saved = { openCalendar: resolveLyraString(parent, 'openCalendar'), close: resolveLyraString(parent, 'close') };
  const direction = getLyraLocaleDirection('de');
  const active = getLyraLocale();
  setLyraLocale('de-CH');
  let updates = 0;
  const stop = subscribeLyraLocale(() => { updates++; });
  try {
    registerLyraLocale('de', { openCalendar: 'Updated parent calendar', close: 'Updated parent close' }, { dir: 'rtl' });
    expect(updates).to.equal(1);
    expect(resolveLyraString(host, 'openCalendar')).to.equal('Updated parent calendar');
    expect(resolveLyraString(host, 'close')).to.equal('Schliessen');
    expect(getLyraLocaleDirection('de-CH')).to.equal('ltr');
    expect(getRegisteredLyraLocaleKeys('de-CH').length).to.equal(34);
  } finally {
    stop();
    registerLyraLocale('de', saved, { dir: direction });
    setLyraLocale(active);
  }
});
