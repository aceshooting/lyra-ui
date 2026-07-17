import { expect } from '@open-wc/testing';
import { Slugger } from './slugger.js';

describe('Slugger', () => {
  it('lowercases and hyphenates plain text', () => {
    const slugger = new Slugger();
    expect(slugger.slug('Hello World')).to.equal('hello-world');
  });

  it('strips punctuation but keeps letters, marks, numbers, spaces, hyphens, underscores', () => {
    const slugger = new Slugger();
    expect(slugger.slug('Section 2.1: Getting Started!')).to.equal('section-21-getting-started');
    expect(slugger.slug('snake_case-already-hyphenated')).to.equal('snake_case-already-hyphenated');
  });

  it('collapses whitespace runs to a single hyphen', () => {
    const slugger = new Slugger();
    expect(slugger.slug('Too   Many    Spaces')).to.equal('too-many-spaces');
  });

  it('preserves Unicode letters and marks', () => {
    const slugger = new Slugger();
    expect(slugger.slug('Café Résumé')).to.equal('café-résumé');
  });

  it('returns an empty string for an emoji/punctuation-only heading', () => {
    const slugger = new Slugger();
    expect(slugger.slug('🎉🎉🎉')).to.equal('');
    expect(slugger.slug('!!!')).to.equal('');
  });

  it('does not dedupe two independent empty slugs against each other', () => {
    const slugger = new Slugger();
    expect(slugger.slug('🎉')).to.equal('');
    expect(slugger.slug('🎊')).to.equal('');
  });

  it('dedupes repeats within one instance by appending -1, -2, ...', () => {
    const slugger = new Slugger();
    expect(slugger.slug('Overview')).to.equal('overview');
    expect(slugger.slug('Overview')).to.equal('overview-1');
    expect(slugger.slug('Overview')).to.equal('overview-2');
  });

  it('skips a dedupe suffix that collides with a real heading slug', () => {
    const slugger = new Slugger();
    expect(slugger.slug('Overview')).to.equal('overview');
    expect(slugger.slug('Overview 1')).to.equal('overview-1');
    // The next "Overview" repeat can't reuse "overview-1" (already taken by a real heading) --
    // it must skip to "overview-2".
    expect(slugger.slug('Overview')).to.equal('overview-2');
  });

  it('is scoped per instance -- a fresh Slugger does not remember a previous document', () => {
    const first = new Slugger();
    expect(first.slug('Intro')).to.equal('intro');
    const second = new Slugger();
    expect(second.slug('Intro')).to.equal('intro');
  });
});
