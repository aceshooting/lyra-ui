import { expect } from '@open-wc/testing';
import { lockScroll } from './scroll-lock.js';

afterEach(() => {
  document.documentElement.style.overflow = '';
});

it('sets overflow: hidden on the document element while locked', () => {
  const release = lockScroll();
  expect(document.documentElement.style.overflow).to.equal('hidden');
  release();
});

it('restores the previous overflow value once released', () => {
  document.documentElement.style.overflow = 'auto';
  const release = lockScroll();
  expect(document.documentElement.style.overflow).to.equal('hidden');
  release();
  expect(document.documentElement.style.overflow).to.equal('auto');
});

it('only unlocks once every concurrent lock has released', () => {
  const releaseA = lockScroll();
  const releaseB = lockScroll();
  releaseA();
  expect(document.documentElement.style.overflow).to.equal('hidden');
  releaseB();
  expect(document.documentElement.style.overflow).to.equal('');
});

it('is a no-op if the same release function is called twice', () => {
  const releaseA = lockScroll();
  lockScroll();
  releaseA();
  releaseA();
  expect(document.documentElement.style.overflow).to.equal('hidden');
});
