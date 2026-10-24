import { expect } from '@open-wc/testing';
import { accentsEqual, tokensEqual, type LyraThemeAccent, type LyraThemeTokens } from './theme.js';

describe('tokensEqual', () => {
  it('treats empty, null and undefined maps as the same absence of overrides', () => {
    const empty: LyraThemeTokens = {};
    expect(tokensEqual(null, undefined)).to.equal(true);
    expect(tokensEqual(empty, null)).to.equal(true);
    expect(tokensEqual(undefined, empty)).to.equal(true);
    expect(tokensEqual({ '--lr-theme-radius-m': '4px' }, null)).to.equal(false);
    expect(tokensEqual(undefined, { '--lr-theme-radius-m': '4px' })).to.equal(false);
  });

  it('compares plain values by name and content, ignoring key order', () => {
    const left: LyraThemeTokens = { '--lr-theme-radius-m': '4px', '--lr-theme-space-m': '1rem' };
    expect(tokensEqual(left, { '--lr-theme-space-m': '1rem', '--lr-theme-radius-m': '4px' })).to.equal(true);
    expect(tokensEqual(left, { '--lr-theme-radius-m': '4px', '--lr-theme-space-m': '2rem' })).to.equal(false);
    expect(tokensEqual(left, { '--lr-theme-radius-m': '4px' })).to.equal(false);
  });

  it('is false for maps of the same size that name different tokens', () => {
    expect(tokensEqual({ '--lr-theme-radius-m': '4px' }, { '--lr-theme-radius-l': '4px' })).to.equal(false);
    expect(tokensEqual({ '--lr-theme-radius-m': '4px', '--lr-theme-space-m': '1rem' }, { '--lr-theme-radius-m': '4px', '--lr-theme-space-l': '1rem' })).to.equal(false);
  });

  it('compares per-mode values branch by branch, with an absent branch equal to null', () => {
    const pair = (light?: string | null, dark?: string | null): LyraThemeTokens => ({
      '--lr-theme-color-surface-default': { ...(light === undefined ? {} : { light }), ...(dark === undefined ? {} : { dark }) },
    });
    expect(tokensEqual(pair('#fff', '#000'), pair('#fff', '#000'))).to.equal(true);
    expect(tokensEqual(pair('#fff'), pair('#fff', null))).to.equal(true);
    expect(tokensEqual(pair(undefined, '#000'), pair(null, '#000'))).to.equal(true);
    expect(tokensEqual(pair('#fff', '#000'), pair('#eee', '#000'))).to.equal(false);
    expect(tokensEqual(pair('#fff', '#000'), pair('#fff', '#111'))).to.equal(false);
    expect(tokensEqual(pair('#fff'), pair(null, '#000'))).to.equal(false);
  });

  it('never equates a plain value with a per-mode one, nor accepts an entry without a value', () => {
    const plain: LyraThemeTokens = { '--lr-theme-color-surface-default': '#fff' };
    const perMode: LyraThemeTokens = { '--lr-theme-color-surface-default': { light: '#fff', dark: '#fff' } };
    expect(tokensEqual(plain, perMode)).to.equal(false);
    expect(tokensEqual(perMode, plain)).to.equal(false);
    const hollow = { '--lr-theme-color-surface-default': undefined } as unknown as LyraThemeTokens;
    expect(tokensEqual(hollow, perMode)).to.equal(false);
    expect(tokensEqual(perMode, hollow)).to.equal(false);
  });
});

describe('accentsEqual', () => {
  it('compares bare accents and null by identity of value', () => {
    expect(accentsEqual('#e63950', '#e63950')).to.equal(true);
    expect(accentsEqual('#e63950', '#34d399')).to.equal(false);
    expect(accentsEqual(null, null)).to.equal(true);
    expect(accentsEqual(null, '#e63950')).to.equal(false);
    expect(accentsEqual('#e63950', null)).to.equal(false);
    expect(accentsEqual(null, { brand: '#e63950' })).to.equal(false);
    expect(accentsEqual({ brand: '#e63950' }, null)).to.equal(false);
    expect(accentsEqual('#e63950', { brand: '#e63950' }), 'a bare accent is not the same request as a role map').to.equal(false);
  });

  it('compares role maps by their roles and each role value, whatever object holds them', () => {
    const shared: LyraThemeAccent = { brand: '#e63950', danger: { light: '#c00', dark: '#f66' } };
    expect(accentsEqual(shared, shared)).to.equal(true);
    expect(accentsEqual(shared, { brand: '#e63950', danger: { light: '#c00', dark: '#f66' } })).to.equal(true);
    expect(accentsEqual(shared, { brand: '#e63950' })).to.equal(false);
    expect(accentsEqual({ brand: '#e63950' }, shared)).to.equal(false);
    expect(accentsEqual({ brand: '#e63950' }, { brand: '#34d399' })).to.equal(false);
    expect(accentsEqual({ brand: '#e63950' }, { success: '#e63950' })).to.equal(false);
  });

  it('compares per-mode role values branch by branch, with an absent branch equal to null', () => {
    const role = (value: { light?: string | null; dark?: string | null }): LyraThemeAccent => ({ danger: value });
    expect(accentsEqual(role({ light: '#c00' }), role({ light: '#c00', dark: null }))).to.equal(true);
    expect(accentsEqual(role({ dark: '#f66' }), role({ light: null, dark: '#f66' }))).to.equal(true);
    expect(accentsEqual(role({ light: '#c00', dark: '#f66' }), role({ light: '#c01', dark: '#f66' }))).to.equal(false);
    expect(accentsEqual(role({ light: '#c00', dark: '#f66' }), role({ light: '#c00', dark: '#f67' }))).to.equal(false);
  });

  it('never equates a string, null or per-mode value for the same role', () => {
    const perMode = { danger: { light: '#c00', dark: '#c00' } } as const;
    expect(accentsEqual({ danger: '#c00' }, perMode)).to.equal(false);
    expect(accentsEqual(perMode, { danger: '#c00' })).to.equal(false);
    expect(accentsEqual({ danger: null }, perMode)).to.equal(false);
    expect(accentsEqual(perMode, { danger: null })).to.equal(false);
    expect(accentsEqual({ danger: null }, { danger: null })).to.equal(true);
  });
});
