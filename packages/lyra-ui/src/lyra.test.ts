import { expect } from '@open-wc/testing';
import './all.js';
import {
  ROOT_BARREL_OPTIONAL_PEER_TAGS,
  ROOT_BARREL_TAGS,
} from './internal/root-registration-allowlist.js';

it('registers every manifest component assigned to the all.js compatibility entry', () => {
  for (const tag of ROOT_BARREL_TAGS) {
    expect(customElements.get(tag), tag).to.exist;
  }
});

it('does NOT register the optional-peer-dependent chart/map/graph families from all.js', () => {
  for (const tag of ROOT_BARREL_OPTIONAL_PEER_TAGS) {
    // Compare to `undefined` outside chai rather than asserting `.to.not.exist` on the
    // constructor directly: when the assertion fails, chai's failure-message inspector
    // hangs the browser (rather than raising a clean AssertionError) if it has to
    // serialize a live Lit custom-element class as the "actual" value. Keeping the
    // constructor out of the assertion entirely avoids that failure mode for good.
    expect(
      customElements.get(tag) === undefined,
      `${tag} should not be pre-registered by all.js`,
    ).to.be.true;
  }
});

it('still registers each excluded family when imported directly from its own subpath', async () => {
  await import('./components/lr-chart.js');
  await import('./components/lr-bar-chart.js');
  await import('./components/lr-line-chart.js');
  await import('./components/lr-pie-chart.js');
  await import('./components/lr-doughnut-chart.js');
  await import('./components/lr-scatter-chart.js');
  await import('./components/lr-bubble-chart.js');
  await import('./components/lr-radar-chart.js');
  await import('./components/lr-polar-area-chart.js');
  await import('./components/lr-box-plot.js');
  await import('./components/lr-histogram.js');
  await import('./components/lr-map.js');
  await import('./components/lr-graph.js');
  const tags = [
    'chart',
    'bar-chart',
    'line-chart',
    'pie-chart',
    'doughnut-chart',
    'scatter-chart',
    'bubble-chart',
    'radar-chart',
    'polar-area-chart',
    'box-plot',
    'histogram',
    'map',
    'graph',
  ];
  for (const t of tags) {
    expect(customElements.get(`lr-${t}`), `lr-${t}`).to.exist;
  }
});

it('keeps runtime test seams off the root barrel', async () => {
  const root = await import('./lyra.js');
  expect(Object.keys(root).filter((name) => name.startsWith('__'))).to.deep.equal([]);
});
