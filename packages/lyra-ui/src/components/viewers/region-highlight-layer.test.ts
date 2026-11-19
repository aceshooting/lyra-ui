import { expect, fixture, html } from '@open-wc/testing';
import { regionHighlightLabel, renderRegionHighlightActions, renderRegionHighlightLayer, sameRegionRect } from './region-highlight-layer.js';

describe('region highlight helpers', () => {
  const rect = { x: 1, y: 2, width: 3, height: 4 };

  it('compares region anchors by page and every rect edge', () => {
    expect(sameRegionRect({ rect }, { rect: { ...rect } })).to.equal(true);
    expect(sameRegionRect({ page: 1, rect }, { rect })).to.equal(false);
    expect(sameRegionRect({ rect }, { rect: { ...rect, height: 5 } })).to.equal(false);
  });

  it('names an action by its label, else by its position among the highlights', () => {
    const calls: Array<[string, Record<string, string>]> = [];
    const localize = (key: 'highlightWithLabel' | 'highlightOfTotal', values: Record<string, string>): string => {
      calls.push([key, values]);
      return key;
    };
    expect(regionHighlightLabel({ label: 'Result' }, 0, 2, 'en', localize)).to.equal('highlightWithLabel');
    expect(regionHighlightLabel({}, 1, 12, 'en', localize)).to.equal('highlightOfTotal');
    expect(calls).to.deep.equal([
      ['highlightWithLabel', { label: 'Result' }],
      ['highlightOfTotal', { index: '2', total: '12' }],
    ]);
  });
});

it('renders a localized ordinal on both controls for a whitespace-only region label', async () => {
  const root = await fixture<HTMLDivElement>(html`<div></div>`);
  const highlights = [
    { id: 'first', label: '  Named area  ', anchor: { rect: { x: 1, y: 2, width: 3, height: 4 } } },
    { id: 'second', label: '  \t  ', anchor: { rect: { x: 10, y: 20, width: 30, height: 40 } } },
  ];
  const name = (highlight: (typeof highlights)[number], index: number, total: number) =>
    regionHighlightLabel(highlight, index, total, 'en', (key, values) =>
      key === 'highlightWithLabel' ? `Area: ${values['label']}` : `Area ${values['index']} of ${values['total']}`);
  const activate = () => undefined;
  const controls = await fixture<HTMLDivElement>(html`<div>
    ${renderRegionHighlightLayer(highlights, null, true, name, activate)}
    ${renderRegionHighlightActions(highlights, name, root, false, activate)}
  </div>`);
  const names = (part: string) => Array.from(controls.querySelectorAll(`[part="${part}"]`), button => button.getAttribute('aria-label'));
  expect(names('region-highlight-target')).to.deep.equal(['Area: Named area', 'Area 2 of 2']);
  expect(names('region-highlight-action')).to.deep.equal(['Area: Named area', 'Area 2 of 2']);
  expect(Array.from(controls.querySelectorAll('[part="region-highlight-action"]'), button => button.textContent?.trim()))
    .to.deep.equal(['Named area', 'Area 2 of 2']);
});
