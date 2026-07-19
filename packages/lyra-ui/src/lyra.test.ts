import { expect } from '@open-wc/testing';
import './lyra.js';
import {
  ROOT_BARREL_OPTIONAL_PEER_TAGS,
  ROOT_BARREL_TAGS,
} from './internal/root-registration-allowlist.js';

it('registers every manifest component assigned to the root barrel', () => {
  for (const tag of ROOT_BARREL_TAGS) {
    expect(customElements.get(tag), tag).to.exist;
  }
});

it('does NOT register the optional-peer-dependent chart/map/graph families from the root barrel', () => {
  for (const tag of ROOT_BARREL_OPTIONAL_PEER_TAGS) {
    // Compare to `undefined` outside chai rather than asserting `.to.not.exist` on the
    // constructor directly: when the assertion fails, chai's failure-message inspector
    // hangs the browser (rather than raising a clean AssertionError) if it has to
    // serialize a live Lit custom-element class as the "actual" value. Keeping the
    // constructor out of the assertion entirely avoids that failure mode for good.
    expect(
      customElements.get(tag) === undefined,
      `${tag} should not be pre-registered by the root barrel`,
    ).to.be.true;
  }
});

it('still registers each excluded family when imported directly from its own subpath', async () => {
  await import('./components/charts/chart/chart.js');
  await import('./components/charts/chart/bar-chart.js');
  await import('./components/charts/chart/line-chart.js');
  await import('./components/charts/chart/pie-chart.js');
  await import('./components/charts/chart/doughnut-chart.js');
  await import('./components/charts/chart/scatter-chart.js');
  await import('./components/charts/chart/bubble-chart.js');
  await import('./components/charts/chart/radar-chart.js');
  await import('./components/charts/chart/polar-area-chart.js');
  await import('./components/charts/chart/box-plot.js');
  await import('./components/charts/chart/histogram.js');
  await import('./components/media/map/map.js');
  await import('./components/retrieval/graph/graph.js');
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
