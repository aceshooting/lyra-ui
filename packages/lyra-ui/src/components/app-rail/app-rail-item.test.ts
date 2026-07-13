import { fixture, expect, html } from '@open-wc/testing';
import './app-rail-item.js';
import type { LyraAppRailItem } from './app-rail-item.js';

it('renders a labeled link with icon and label parts', async () => {
  const el = (await fixture(html`
    <lyra-app-rail-item href="/inbox" aria-label="Inbox">
      <span slot="icon" aria-hidden="true">📥</span>Inbox
    </lyra-app-rail-item>
  `)) as LyraAppRailItem;

  expect(el.shadowRoot!.querySelector('[part="base"]')!.tagName).to.equal('A');
  expect(el.shadowRoot!.querySelector('[part="icon"]')).to.exist;
  expect(el.textContent).to.include('Inbox');
});

it('renders a disabled button when no href is available', async () => {
  const el = (await fixture(html`<lyra-app-rail-item disabled>Settings</lyra-app-rail-item>`)) as LyraAppRailItem;
  const button = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
  expect(button.tagName).to.equal('BUTTON');
  expect(button.disabled).to.be.true;
});

it('is accessible', async () => {
  const el = (await fixture(html`<lyra-app-rail-item href="/home" aria-label="Home">Home</lyra-app-rail-item>`)) as LyraAppRailItem;
  await expect(el).to.be.accessible();
});

it('marks the base part aria-current="page" when active', async () => {
  const el = (await fixture(html`<lyra-app-rail-item href="/home" active>Home</lyra-app-rail-item>`)) as LyraAppRailItem;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(base.getAttribute('aria-current')).to.equal('page');
});

it('omits aria-current when not active', async () => {
  const el = (await fixture(html`<lyra-app-rail-item href="/home">Home</lyra-app-rail-item>`)) as LyraAppRailItem;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(base.hasAttribute('aria-current')).to.be.false;
});

it('reflects active as a host attribute', async () => {
  const el = (await fixture(html`<lyra-app-rail-item href="/home" active>Home</lyra-app-rail-item>`)) as LyraAppRailItem;
  expect(el.hasAttribute('active')).to.be.true;
  el.active = false;
  await el.updateComplete;
  expect(el.hasAttribute('active')).to.be.false;
});

describe('active', () => {
  it('reflects aria-current="page" onto [part=base] when true', async () => {
    const el = (await fixture(html`<lyra-app-rail-item href="/inbox" active>Inbox</lyra-app-rail-item>`)) as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute('aria-current')).to.equal('page');
  });

  it('defaults to false and omits aria-current entirely', async () => {
    const el = (await fixture(html`<lyra-app-rail-item href="/inbox">Inbox</lyra-app-rail-item>`)) as LyraAppRailItem;
    expect(el.active).to.be.false;
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.hasAttribute('aria-current')).to.be.false;
  });

  it('reflects on the button-rendering path too (no href)', async () => {
    const el = (await fixture(html`<lyra-app-rail-item active>Settings</lyra-app-rail-item>`)) as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.tagName).to.equal('BUTTON');
    expect(base.getAttribute('aria-current')).to.equal('page');
  });
});
