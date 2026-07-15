import { fixture, expect, html } from '@open-wc/testing';
import './details.js';
import './accordion.js';
import './accordion-item.js';
import type { LyraDetails } from './details.js';

it('renders a disclosure panel and reports its state', async () => {
  const el = (await fixture(html`<lyra-details summary="More">Content</lyra-details>`)) as LyraDetails;
  const summary = el.shadowRoot!.querySelector('[part="summary"]') as HTMLElement;
  expect(summary.getAttribute('aria-expanded')).to.equal('false');
  el.open = true;
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('[part="base"]') as HTMLDetailsElement).open).to.be.true;
  expect(summary.getAttribute('aria-expanded')).to.equal('true');
  await expect(el).to.be.accessible();
});

it('closes sibling panels when multiple is false', async () => {
  const el = await fixture(html`<lyra-accordion>
    <lyra-accordion-item open summary="One">A</lyra-accordion-item>
    <lyra-accordion-item summary="Two">B</lyra-accordion-item>
  </lyra-accordion>`);
  const panels = [...el.querySelectorAll('lyra-accordion-item')] as LyraDetails[];
  panels[1].open = true;
  panels[1].dispatchEvent(new CustomEvent('lyra-toggle', { detail: { open: true }, bubbles: true, composed: true }));
  await Promise.all(panels.map((panel) => panel.updateComplete));
  expect(panels[0].open).to.be.false;
});
