import { expect, fixture } from '@open-wc/testing';
import './components/retrieval/retrieval-search/retrieval-search.js';
import './components/retrieval/graph/graph.js';
import './components/forms/swatch-picker/swatch-picker.js';
import './components/viewers/include/include.js';
import './components/charts/chart/lite-chart.js';
import './components/layout/responsive-panel/responsive-panel.js';
import './components/media/file-icon/file-icon.js';
import './components/conversation/model-settings-panel/model-settings-panel.js';
import './components/agent-tools/activity-feed/activity-feed.js';
import './components/data/table/table.js';
import './components/agent-tools/thinking-panel/thinking-panel.js';
import './components/utility/random-content/random-content.js';
import './components/agent-tools/browser-frame/browser-frame.js';

interface ClosedSetCase {
  readonly tag: string;
  readonly property: string;
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
] as const;

describe('shared closed-set normalization', () => {
  for (const testCase of CASES) {
    it(`${testCase.tag}.${testCase.property} normalizes invalid attribute and JavaScript writes`, async () => {
      const el = await fixture<HTMLElement>(document.createElement(testCase.tag));
      const values = el as unknown as Record<string, unknown>;

      values[testCase.property] = testCase.valid;
      await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
      expect(values[testCase.property]).to.equal(testCase.valid);

      values[testCase.property] = 'not-a-supported-value';
      await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
      expect(values[testCase.property]).to.equal(testCase.fallback);
      if (testCase.reflected) expect(el.getAttribute(testCase.property)).to.equal(testCase.fallback);

      el.setAttribute(testCase.property, 'also-not-supported');
      await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
      expect(values[testCase.property]).to.equal(testCase.fallback);
      if (testCase.reflected) expect(el.getAttribute(testCase.property)).to.equal(testCase.fallback);
    });
  }
});
