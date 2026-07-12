import { fixture, expect, html } from '@open-wc/testing';
import './widget.js';
import type { LyraWidget } from './widget.js';

it('renders label and sublabel in the header', async () => {
  const el = (await fixture(
    html`<lyra-widget label="Load profile" sublabel="Last 7 days">content</lyra-widget>`,
  )) as LyraWidget;
  expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent).to.equal('Load profile');
  expect(el.shadowRoot!.querySelector('[part="sublabel"]')!.textContent).to.equal('Last 7 days');
});

it('does not render the collapse or fullscreen buttons unless opted in', async () => {
  const el = (await fixture(html`<lyra-widget label="x">content</lyra-widget>`)) as LyraWidget;
  expect(el.shadowRoot!.querySelector('[part="collapse-button"]')).to.not.exist;
  expect(el.shadowRoot!.querySelector('[part="fullscreen-button"]')).to.not.exist;
});

it('toggles collapsed on collapse-button click and emits lyra-collapse-change', async () => {
  const el = (await fixture(html`<lyra-widget label="x" collapsible>content</lyra-widget>`)) as LyraWidget;
  let detail: unknown;
  el.addEventListener('lyra-collapse-change', (e) => (detail = (e as CustomEvent).detail));

  (el.shadowRoot!.querySelector('[part="collapse-button"]') as HTMLButtonElement).click();
  await el.updateComplete;

  expect(el.collapsed).to.be.true;
  expect(detail).to.be.true;
  expect(el.shadowRoot!.querySelector('[part="body"]')!.hasAttribute('hidden')).to.be.true;
});

it('toggles fullscreen on fullscreen-button click, locking scroll and adding a backdrop', async () => {
  const el = (await fixture(html`<lyra-widget label="x" expandable>content</lyra-widget>`)) as LyraWidget;

  (el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement).click();
  await el.updateComplete;

  expect(el.fullscreen).to.be.true;
  expect(el.hasAttribute('fullscreen')).to.be.true;
  expect(document.documentElement.style.overflow).to.equal('hidden');
  expect(el.shadowRoot!.querySelector('[part="backdrop"]')).to.exist;

  (el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement).click();
  await el.updateComplete;

  expect(el.fullscreen).to.be.false;
  expect(document.documentElement.style.overflow).to.equal('');
  expect(el.shadowRoot!.querySelector('[part="backdrop"]')).to.not.exist;
});

it('exits fullscreen on Escape and returns focus to the trigger button', async () => {
  const el = (await fixture(html`<lyra-widget label="x" expandable>content</lyra-widget>`)) as LyraWidget;
  const btn = el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement;
  btn.click();
  await el.updateComplete;
  expect(el.fullscreen).to.be.true;

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await el.updateComplete;

  expect(el.fullscreen).to.be.false;
  expect(el.shadowRoot!.activeElement).to.equal(el.shadowRoot!.querySelector('[part="fullscreen-button"]'));
});

it('exits fullscreen on Escape even when entered by setting the fullscreen property directly (not via the button click)', async () => {
  const el = (await fixture(html`<lyra-widget label="x" expandable>content</lyra-widget>`)) as LyraWidget;
  el.fullscreen = true;
  await el.updateComplete;
  expect(el.fullscreen).to.be.true;

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await el.updateComplete;

  expect(el.fullscreen).to.be.false;
});

it('exits fullscreen on backdrop click', async () => {
  const el = (await fixture(html`<lyra-widget label="x" expandable>content</lyra-widget>`)) as LyraWidget;
  (el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement).click();
  await el.updateComplete;

  (el.shadowRoot!.querySelector('[part="backdrop"]') as HTMLElement).click();
  await el.updateComplete;

  expect(el.fullscreen).to.be.false;
});

it('releases the scroll lock on disconnect while fullscreen', async () => {
  const el = (await fixture(html`<lyra-widget label="x" expandable>content</lyra-widget>`)) as LyraWidget;
  (el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement).click();
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('hidden');

  el.remove();

  expect(document.documentElement.style.overflow).to.equal('');
});

it('is accessible in both default and fullscreen-expandable states', async () => {
  const el = (await fixture(
    html`<lyra-widget label="Load profile" collapsible expandable>content</lyra-widget>`,
  )) as LyraWidget;
  await expect(el).to.be.accessible();

  (el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement).click();
  await el.updateComplete;
  expect(el.fullscreen).to.be.true;

  await expect(el).to.be.accessible();
});
