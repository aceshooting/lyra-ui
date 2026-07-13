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
