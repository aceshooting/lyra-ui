import { expect } from '@open-wc/testing';
import { canonicalizeLocaleTag } from './locale-tag.js';
import { getLyraLocale, getRegisteredLyraLocaleKeys, getRegisteredLyraLocales, registerLyraLocale, setLyraLocale } from './localization-runtime.js';

it('canonicalizes the two shipped primary aliases while preserving script, region and extensions', () => {
  expect(canonicalizeLocaleTag('tl-Latn-PH-u-nu-latn')).to.equal('fil-Latn-PH-u-nu-latn');
  expect(canonicalizeLocaleTag('pnb-Arab-PK-u-nu-arab')).to.equal('lah-Arab-PK-u-nu-arab');
  expect(canonicalizeLocaleTag('fil-PH')).to.equal('fil-PH');
  expect(canonicalizeLocaleTag('lah-PK')).to.equal('lah-PK');
  expect(canonicalizeLocaleTag('pt-BR')).to.equal('pt-BR');
});

it('keeps one regional registry identity for authored and canonical alias spellings', () => {
  registerLyraLocale('tl-PH', { cancel: 'Authored tag message' });
  registerLyraLocale('fil-PH', { retry: 'Canonical tag message' });
  expect(getRegisteredLyraLocaleKeys('tl-PH')).to.deep.equal(['cancel', 'retry']);
  expect(getRegisteredLyraLocales().filter((locale) => locale === 'tl-PH' || locale === 'fil-PH')).to.deep.equal(['fil-PH']);
});

it('returns the canonical alias through active locale selection with extensions', () => {
  const previous = getLyraLocale();
  try {
    setLyraLocale('PNB_Arab_PK_u_nu_arab');
    expect(getLyraLocale()).to.equal('lah-Arab-PK-u-nu-arab');
  } finally {
    setLyraLocale(previous);
  }
});
