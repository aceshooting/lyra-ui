import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './flag.js';
import type { LyraFlag } from './flag.js';

async function img(el: LyraFlag): Promise<HTMLImageElement> {
  await waitUntil(() => el.shadowRoot!.querySelector('img'), 'flag image should render');
  return el.shadowRoot!.querySelector('img')!;
}

it('shows a loading skeleton and aria-busy while the flag package loads, then swaps to the img', async () => {
  const el = (await fixture(html`<lyra-flag country="fr"></lyra-flag>`)) as LyraFlag;
  expect(el.getAttribute('aria-busy')).to.equal('true');
  expect(el.shadowRoot!.querySelector('lyra-skeleton')).to.exist;
  expect(el.shadowRoot!.querySelector('img')).to.not.exist;

  await img(el);

  expect(el.hasAttribute('aria-busy')).to.be.false;
  expect(el.shadowRoot!.querySelector('lyra-skeleton')).to.not.exist;
});

it('renders an img for a country code', async () => {
  const el = (await fixture(html`<lyra-flag country="fr"></lyra-flag>`)) as LyraFlag;
  const el2 = await img(el);
  expect(el2.getAttribute('src')).to.contain('fr.png');
  expect(el2.getAttribute('alt')).to.equal('FR');
});

it('resolves a language to a representative country flag', async () => {
  const el = (await fixture(html`<lyra-flag language="en"></lyra-flag>`)) as LyraFlag;
  expect((await img(el)).getAttribute('src')).to.contain('gb.png');
});

it('resolves a region subtag to its country', async () => {
  const el = (await fixture(html`<lyra-flag language="en-US"></lyra-flag>`)) as LyraFlag;
  expect((await img(el)).getAttribute('src')).to.contain('us.png');
});

it('honors a custom label for accessibility', async () => {
  const el = (await fixture(html`<lyra-flag country="fr" label="Français"></lyra-flag>`)) as LyraFlag;
  expect((await img(el)).getAttribute('alt')).to.equal('Français');
});

it('renders nothing for unknown input', async () => {
  const el = (await fixture(html`<lyra-flag></lyra-flag>`)) as LyraFlag;
  expect(el.shadowRoot!.querySelector('img')).to.not.exist;
});

it('is accessible', async () => {
  const el = (await fixture(html`<lyra-flag country="de" label="Deutsch"></lyra-flag>`)) as LyraFlag;
  await img(el);
  await expect(el).to.be.accessible();
});
