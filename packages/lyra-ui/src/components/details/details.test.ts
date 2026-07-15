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

it('suppresses the localized "Details" fallback once rich content is slotted into summary', async () => {
  const el = (await fixture(
    html`<lyra-details><span slot="summary">Custom Label</span>Content</lyra-details>`,
  )) as LyraDetails;
  const summary = el.shadowRoot!.querySelector('[part="summary"]') as HTMLElement;
  // Slotted light-DOM content isn't reparented into the shadow tree, so `textContent` on the
  // shadow part only ever reflects the shadow-side fallback text node -- it must be empty once a
  // slot="summary" child exists, or the fallback renders ahead of the real label.
  expect(summary.textContent?.trim()).to.equal('');
  expect(el.textContent?.trim()).to.equal('Custom LabelContent');
});
