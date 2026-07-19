import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './memory-panel.js';
import type { LyraMemoryPanel, LyraMemoryItem } from './memory-panel.js';

const shortTermItems: LyraMemoryItem[] = [
  { id: 's1', text: 'User is debugging a TypeScript build error.', confidence: 0.9 },
  { id: 's2', text: 'User prefers concise answers.' },
];

const longTermItems: LyraMemoryItem[] = [
  {
    id: 'l1',
    text: "User's name is Alex and they work at Acme Corp.",
    confidence: 0.4,
    provenance: { entities: [{ id: 'e1', label: 'Alex', type: 'person' }] },
  },
  { id: 'l2', text: 'User is allergic to peanuts.', confidence: 0.85 },
];

async function populated(): Promise<LyraMemoryPanel> {
  const el = (await fixture(html`<lr-memory-panel></lr-memory-panel>`)) as LyraMemoryPanel;
  el.shortTerm = shortTermItems;
  el.longTerm = longTermItems;
  await el.updateComplete;
  return el;
}

describe('x', () => {
  it('renders lr-empty and no sections when both shortTerm and longTerm are empty', async () => {
    const el = (await fixture(html`<lr-memory-panel></lr-memory-panel>`)) as LyraMemoryPanel;
    expect(el.shortTerm).to.deep.equal([]);
    expect(el.longTerm).to.deep.equal([]);
    expect(el.shadowRoot!.querySelector('lr-empty')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="section"]')).to.not.exist;
  });

  it('only renders the provenance expand-toggle when an item defines provenance, and toggling reveals lr-provenance-panel', async () => {
    const el = await populated();
    const withProvenance = el.shadowRoot!.querySelector('[part="item"][data-id="l1"]')!;
    const withoutProvenance = el.shadowRoot!.querySelector('[part="item"][data-id="l2"]')!;
    expect(withoutProvenance.querySelector('[part="expand-toggle"]')).to.not.exist;
    expect(withoutProvenance.querySelector('lr-provenance-panel')).to.not.exist;

    const toggle = withProvenance.querySelector('[part="expand-toggle"]') as HTMLButtonElement;
    expect(toggle).to.exist;
    expect(toggle.getAttribute('aria-expanded')).to.equal('false');
    expect(withProvenance.querySelector('lr-provenance-panel')).to.not.exist;

    const listener = oneEvent(el, 'lr-expand');
    toggle.click();
    const event = await listener;
    expect(event.detail).to.deep.equal({ id: 'l1', expanded: true });
    await el.updateComplete;
    expect(toggle.getAttribute('aria-expanded')).to.equal('true');
    const panel = withProvenance.querySelector('lr-provenance-panel') as HTMLElement & { provenance: unknown };
    expect(panel).to.exist;
    expect(panel.provenance).to.deep.equal(longTermItems[0]!.provenance);
  });
});
