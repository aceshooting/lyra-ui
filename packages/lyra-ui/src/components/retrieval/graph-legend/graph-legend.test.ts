import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './graph-legend.js';
import type { LyraGraphLegend } from './graph-legend.js';

const types = [
  { id: 'person', label: 'Person' },
  { id: 'org', label: 'Organization', color: '#7c3aed', shape: 'square' as const },
];

it('defaults to empty types/counts/hiddenTypes, interactive=true, empty label', async () => {
  const el = (await fixture(html`<lr-graph-legend></lr-graph-legend>`)) as LyraGraphLegend;
  expect(el.types).to.deep.equal([]);
  expect(el.counts).to.equal(undefined);
  expect(el.hiddenTypes).to.deep.equal([]);
  expect(el.interactive).to.be.true;
  expect(el.label).to.equal('');
});

it('renders one [part="item"] button per type, with visible text = label (+ count when given)', async () => {
  const el = (await fixture(html`<lr-graph-legend></lr-graph-legend>`)) as LyraGraphLegend;
  el.types = types;
  el.counts = { person: 3 };
  await el.updateComplete;
  const items = el.shadowRoot!.querySelectorAll('[part~="item"]');
  expect(items.length).to.equal(2);
  expect(items[0]!.textContent).to.include('Person');
  expect(items[0]!.textContent).to.include('3');
  expect(items[1]!.textContent).to.include('Organization');
  expect(items[1]!.textContent).to.not.match(/\d/); // no count entry for 'org'
});

it("uses a type's own color for its swatch when set, and a palette fallback otherwise", async () => {
  const el = (await fixture(html`<lr-graph-legend></lr-graph-legend>`)) as LyraGraphLegend;
  el.types = types;
  await el.updateComplete;
  const swatches = el.shadowRoot!.querySelectorAll('[part~="swatch"]');
  expect(swatches[1]!.getAttribute('fill') ?? swatches[1]!.querySelector('[fill]')?.getAttribute('fill')).to.equal(
    '#7c3aed',
  );
  // 'person' has no explicit color -- falls back to the categorical palette. The design tokens
  // define `--lr-graph-cat-1` (tokens.styles.ts), so the computed style resolves to that real
  // token value rather than this component's own hardcoded FALLBACK_PALETTE[0].
  const personFill = swatches[0]!.getAttribute('fill') ?? swatches[0]!.querySelector('[fill]')?.getAttribute('fill');
  expect(personFill).to.equal('#8250df');
});

it('toggles hiddenTypes and emits lr-visibility-change with the full updated array on click', async () => {
  const el = (await fixture(html`<lr-graph-legend></lr-graph-legend>`)) as LyraGraphLegend;
  el.types = types;
  await el.updateComplete;
  const button = el.shadowRoot!.querySelectorAll('[part~="item"]')[0] as HTMLButtonElement;
  expect(button.getAttribute('aria-pressed')).to.equal('true');

  const listener = oneEvent(el, 'lr-visibility-change');
  button.click();
  const event = await listener;
  expect(event.detail.hiddenTypes).to.deep.equal(['person']);
  expect(el.hiddenTypes).to.deep.equal(['person']);
  await el.updateComplete;
  expect(button.getAttribute('aria-pressed')).to.equal('false');

  const listener2 = oneEvent(el, 'lr-visibility-change');
  button.click();
  const event2 = await listener2;
  expect(event2.detail.hiddenTypes).to.deep.equal([]);
});

it('announces the toggle through the internal live region', async () => {
  const el = (await fixture(html`<lr-graph-legend></lr-graph-legend>`)) as LyraGraphLegend;
  el.types = types;
  await el.updateComplete;
  const button = el.shadowRoot!.querySelectorAll('[part~="item"]')[0] as HTMLButtonElement;
  button.click();
  await el.updateComplete;
  const live = el.shadowRoot!.querySelector('[part="live-region"]')!;
  expect(live.textContent).to.equal('Person hidden');
});

it('renders plain (non-interactive) items with no button and no toggling when interactive=false', async () => {
  const el = (await fixture(html`<lr-graph-legend></lr-graph-legend>`)) as LyraGraphLegend;
  el.types = types;
  el.interactive = false;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('button[part~="item"]').length).to.equal(0);
  expect(el.shadowRoot!.querySelectorAll('[part~="item"]').length).to.equal(2);
});

it('names the group from label, falling back to the localized default', async () => {
  const el = (await fixture(html`<lr-graph-legend></lr-graph-legend>`)) as LyraGraphLegend;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Graph legend');
  el.label = 'Entity types';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Entity types');
});

it('is accessible with types, counts, and a hidden type', async () => {
  const el = (await fixture(html`<lr-graph-legend></lr-graph-legend>`)) as LyraGraphLegend;
  el.types = types;
  el.counts = { person: 3 };
  el.hiddenTypes = ['org'];
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('honors a .strings override of graphLegendLabel on the group aria-label', async () => {
  const el = (await fixture(html`<lr-graph-legend></lr-graph-legend>`)) as LyraGraphLegend;
  el.strings = { graphLegendLabel: 'Étiquette du graphe' };
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Étiquette du graphe');
});

it('honors a .strings override of legendTypeHidden/legendTypeShown in the live-region announcement', async () => {
  const el = (await fixture(html`<lr-graph-legend></lr-graph-legend>`)) as LyraGraphLegend;
  el.strings = { legendTypeHidden: '{label} masqué', legendTypeShown: '{label} affiché' };
  el.types = types;
  await el.updateComplete;
  const button = el.shadowRoot!.querySelectorAll('[part~="item"]')[0] as HTMLButtonElement;
  const live = el.shadowRoot!.querySelector('[part="live-region"]')!;

  button.click();
  await el.updateComplete;
  expect(live.textContent).to.equal('Person masqué');

  button.click();
  await el.updateComplete;
  expect(live.textContent).to.equal('Person affiché');
});

it('interactive="false" (plain HTML attribute) renders a read-only legend, matching the .interactive=false property path', async () => {
  const el = (await fixture(html`<lr-graph-legend interactive="false"></lr-graph-legend>`)) as LyraGraphLegend;
  expect(el.interactive).to.be.false;
  el.types = types;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('button[part~="item"]').length).to.equal(0);
  expect(el.shadowRoot!.querySelectorAll('[part~="item"]').length).to.equal(2);
});

it('declares a --lr-graph-legend-hidden-color cssprop indirection layer for a hidden row, independent of the shared quiet-text token', async () => {
  const el = (await fixture(html`<lr-graph-legend></lr-graph-legend>`)) as LyraGraphLegend;
  el.types = types;
  el.hiddenTypes = ['person'];
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector('[part~="item"][data-hidden] [part="label"]') as HTMLElement;

  const unset = getComputedStyle(label).color;
  el.style.setProperty('--lr-graph-legend-hidden-color', 'rgb(10, 20, 30)');
  expect(getComputedStyle(label).color).to.equal('rgb(10, 20, 30)');

  el.style.setProperty('--lr-graph-legend-hidden-color', 'var(--lr-color-text-quiet)');
  expect(getComputedStyle(label).color).to.equal(unset);
});
