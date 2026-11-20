import { expect, fixture } from '@open-wc/testing';
import './components/lr-retrieval-search.js';
import './components/lr-graph.js';
import './components/lr-swatch-picker.js';
import './components/lr-include.js';
import './components/lr-lite-chart.js';
import './components/lr-responsive-panel.js';
import './components/lr-file-icon.js';
import './components/lr-model-settings-panel.js';
import './components/lr-activity-feed.js';
import './components/lr-table.js';
import './components/lr-thinking-panel.js';
import './components/lr-random-content.js';
import './components/lr-browser-frame.js';
import './components/lr-toggle.js';
import './components/lr-toggle-group.js';
import './components/lr-navigation-menu.js';
import './components/lr-tool-call-block.js';
import './components/lr-message-parts.js';

interface ClosedSetCase {
  readonly tag: string;
  readonly property: string;
  /** Attribute name when it differs from the property name. */
  readonly attribute?: string;
  readonly fallback: string;
  readonly valid: string;
  readonly reflected: boolean;
}

const CASES: readonly ClosedSetCase[] = [
  { tag: 'lr-retrieval-search', property: 'mode', fallback: 'hybrid', valid: 'vector', reflected: false },
  { tag: 'lr-graph', property: 'layout', fallback: 'force', valid: 'layered', reflected: false },
  { tag: 'lr-swatch-picker', property: 'mode', fallback: 'swatch', valid: 'gemstone', reflected: true },
  { tag: 'lr-include', property: 'mode', fallback: 'same-origin', valid: 'cors', reflected: true },
  { tag: 'lr-lite-chart', property: 'layout', fallback: 'fit', valid: 'scroll', reflected: true },
  { tag: 'lr-responsive-panel', property: 'mode', fallback: 'auto', valid: 'overlay', reflected: true },
  { tag: 'lr-file-icon', property: 'mode', fallback: 'icon', valid: 'label', reflected: true },
  { tag: 'lr-model-settings-panel', property: 'layout', fallback: 'vertical', valid: 'compact', reflected: true },
  { tag: 'lr-activity-feed', property: 'mode', fallback: 'live', valid: 'post-hoc', reflected: true },
  { tag: 'lr-table', property: 'layout', fallback: 'auto', valid: 'fixed', reflected: true },
  { tag: 'lr-thinking-panel', property: 'mode', fallback: 'live', valid: 'post-hoc', reflected: true },
  { tag: 'lr-random-content', property: 'mode', fallback: 'unique', valid: 'sequence', reflected: true },
  { tag: 'lr-browser-frame', property: 'phase', fallback: 'idle', valid: 'streaming', reflected: true },
  { tag: 'lr-toggle', property: 'appearance', fallback: 'plain', valid: 'outlined', reflected: true },
  {
    tag: 'lr-toggle-group',
    property: 'selectionMode',
    attribute: 'selection-mode',
    fallback: 'multiple',
    valid: 'single',
    reflected: true,
  },
  {
    tag: 'lr-navigation-menu',
    property: 'panelAnchor',
    attribute: 'panel-anchor',
    fallback: 'menu',
    valid: 'item',
    reflected: true,
  },
  { tag: 'lr-tool-call-block', property: 'status', fallback: 'pending', valid: 'running', reflected: true },
  {
    tag: 'lr-message-parts',
    property: 'toolDisplay',
    attribute: 'tool-display',
    fallback: 'chip',
    valid: 'block',
    reflected: true,
  },
] as const;

describe('shared closed-set normalization', () => {
  for (const testCase of CASES) {
    it(`${testCase.tag}.${testCase.property} normalizes invalid attribute and JavaScript writes`, async () => {
      const host = document.createElement(testCase.tag);
      if (testCase.tag === 'lr-table') host.setAttribute('aria-label', 'Normalization fixture');
      const el = await fixture<HTMLElement>(host);
      const values = el as unknown as Record<string, unknown>;

      values[testCase.property] = testCase.valid;
      await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
      expect(values[testCase.property]).to.equal(testCase.valid);

      values[testCase.property] = 'not-a-supported-value';
      await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
      expect(values[testCase.property]).to.equal(testCase.fallback);
      if (testCase.reflected) expect(el.getAttribute(testCase.attribute ?? testCase.property)).to.equal(testCase.fallback);

      el.setAttribute(testCase.attribute ?? testCase.property, 'also-not-supported');
      await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
      expect(values[testCase.property]).to.equal(testCase.fallback);
      if (testCase.reflected) expect(el.getAttribute(testCase.attribute ?? testCase.property)).to.equal(testCase.fallback);
    });
  }
});
