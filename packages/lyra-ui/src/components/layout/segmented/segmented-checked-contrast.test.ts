import { fixture, expect, html } from '@open-wc/testing';
import { contrastRatio, effectiveBackground } from '../../../../test/color-contrast.js';
import './segmented.js';
import type { LyraSegmented, LyraSegmentedItem } from './segmented.js';

const items = (): LyraSegmentedItem[] => [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

const LOOKS = ['lyra', 'shadcn', 'material', 'data', 'terminal', 'high-contrast'];
const SURFACES = ['--lr-color-surface', '--lr-color-surface-raised', '--lr-color-surface-overlay'];

describe('lr-segmented checked state without a shadow or hue', () => {
  let previous: CSSStyleSheet[];
  before(async () => {
    previous = document.adoptedStyleSheets;
    const sheets = await Promise.all(['theme.css', 'styles/tokens-root.css', 'looks/shadcn.css', 'looks/material.css', 'looks/data.css', 'looks/terminal.css', 'looks/high-contrast.css'].map(async path => {
      const response = await fetch(new URL(`../../../${path}`, import.meta.url));
      if (!response.ok) throw new Error(`Missing segmented fixture ${path}`);
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(await response.text());
      return sheet;
    }));
    document.adoptedStyleSheets = [...previous, ...sheets];
  });
  after(() => { document.adoptedStyleSheets = previous; });

  for (const look of LOOKS) for (const mode of ['light', 'dark']) for (const direction of ['ltr', 'rtl']) {
    it(`keeps the checked segment at least 3:1 against its container in ${look}/${mode}/${direction}`, async () => {
      for (const surface of SURFACES) {
        const scope = await fixture<HTMLDivElement>(html`<div data-lr-look=${look} data-lr-mode=${mode} dir=${direction} style="--lr-transition-fast: 0ms">
          <div class="container" style="background: var(${surface}); padding: 1rem">
            <lr-segmented label="Range" .items=${items()} value="week"></lr-segmented>
          </div>
        </div>`);
        const container = scope.querySelector('.container') as HTMLElement;
        const el = scope.querySelector('lr-segmented') as LyraSegmented;
        await el.updateComplete;
        const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
        const [unchecked, checked] = [...el.shadowRoot!.querySelectorAll('[part="segment"]')] as HTMLElement[];
        const checkedStyle = getComputedStyle(checked!);
        // The track is transparent by default, so what the checked segment sits on is the first painted ancestor.
        const track = effectiveBackground(base, container);
        const label = `${look}/${mode}/${direction}/${surface}`;
        expect(contrastRatio(checkedStyle.backgroundColor, track), `${label}: checked fill vs track`).to.be.at.least(3);
        expect(contrastRatio(checkedStyle.backgroundColor, effectiveBackground(unchecked!, base, container)), `${label}: checked vs unchecked segment`).to.be.at.least(3);
        expect(contrastRatio(checkedStyle.color, checkedStyle.backgroundColor), `${label}: checked label`).to.be.at.least(4.5);
      }
    });

    it(`passes axe with a checked segment in ${look}/${mode}/${direction}`, async () => {
      const scope = await fixture<HTMLDivElement>(html`<div data-lr-look=${look} data-lr-mode=${mode} dir=${direction} style="background: var(--lr-color-surface); padding: 1rem">
        <lr-segmented label="Range" .items=${items()} value="week"></lr-segmented>
      </div>`);
      await (scope.querySelector('lr-segmented') as LyraSegmented).updateComplete;
      await expect(scope).to.be.accessible();
    });
  }

  it('lets a consumer fill and label override the inverted default', async () => {
    const scope = await fixture<HTMLDivElement>(html`<div style="--lr-segmented-selected-bg: rgb(0, 51, 102); --lr-segmented-selected-color: rgb(255, 255, 255)">
      <lr-segmented label="Range" .items=${items()} value="week"></lr-segmented>
    </div>`);
    const el = scope.querySelector('lr-segmented') as LyraSegmented;
    await el.updateComplete;
    const checked = el.shadowRoot!.querySelectorAll('[part="segment"]')[1] as HTMLElement;
    expect(getComputedStyle(checked).backgroundColor).to.equal('rgb(0, 51, 102)');
    expect(getComputedStyle(checked).color).to.equal('rgb(255, 255, 255)');
  });
});
