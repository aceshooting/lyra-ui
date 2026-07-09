import { fixture, expect, html } from '@open-wc/testing';
import './flag.js';
import type { LyraFlag } from './flag.js';

it('renders an img for a country code', async () => {
  const el = (await fixture(html`<lyra-flag country="fr"></lyra-flag>`)) as LyraFlag;
  const img = el.shadowRoot!.querySelector('img');
  expect(img).to.exist;
  expect(img!.getAttribute('src')).to.contain('fr.svg');
  expect(img!.getAttribute('alt')).to.equal('FR');
});

it('resolves a language to a representative country flag', async () => {
  const el = (await fixture(html`<lyra-flag language="en"></lyra-flag>`)) as LyraFlag;
  expect(el.shadowRoot!.querySelector('img')!.getAttribute('src')).to.contain('gb.svg');
});

it('resolves a region subtag to its country', async () => {
  const el = (await fixture(html`<lyra-flag language="en-US"></lyra-flag>`)) as LyraFlag;
  expect(el.shadowRoot!.querySelector('img')!.getAttribute('src')).to.contain('us.svg');
});

it('honors a custom label for accessibility', async () => {
  const el = (await fixture(html`<lyra-flag country="fr" label="Français"></lyra-flag>`)) as LyraFlag;
  expect(el.shadowRoot!.querySelector('img')!.getAttribute('alt')).to.equal('Français');
});

it('renders nothing for unknown input', async () => {
  const el = (await fixture(html`<lyra-flag></lyra-flag>`)) as LyraFlag;
  expect(el.shadowRoot!.querySelector('img')).to.not.exist;
});

it('is accessible', async () => {
  const el = (await fixture(html`<lyra-flag country="de" label="Deutsch"></lyra-flag>`)) as LyraFlag;
  await expect(el).to.be.accessible();
});
