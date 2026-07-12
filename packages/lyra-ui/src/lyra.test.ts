import { expect } from '@open-wc/testing';
import './lyra.js';

it('registers every non-peer-dependent component from the root barrel', () => {
  const tags = [
    'sparkline',
    'toast',
    'toast-item',
    'combobox',
    'option',
    'select',
    'date-picker',
    'date-input',
    'flag',
    'empty',
    'skeleton',
    'stat',
    'table',
    'gauge',
    'export-button',
    'split',
    'time-range',
    'playback',
    'heatmap',
    'tree',
    'tree-node',
    'lite-chart',
    'word-cloud',
    'file-input',
    'widget',
  ];
  for (const t of tags) {
    expect(customElements.get(`lyra-${t}`), `lyra-${t}`).to.exist;
  }
});

it('does NOT register the optional-peer-dependent chart/map/graph families from the root barrel', () => {
  const excluded = [
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
  for (const t of excluded) {
    // Compare to `undefined` outside chai rather than asserting `.to.not.exist` on the
    // constructor directly: when the assertion fails, chai's failure-message inspector
    // hangs the browser (rather than raising a clean AssertionError) if it has to
    // serialize a live Lit custom-element class as the "actual" value. Keeping the
    // constructor out of the assertion entirely avoids that failure mode for good.
    expect(
      customElements.get(`lyra-${t}`) === undefined,
      `lyra-${t} should not be pre-registered by the root barrel`,
    ).to.be.true;
  }
});

it('still registers each excluded family when imported directly from its own subpath', async () => {
  await import('./components/chart/chart.js');
  await import('./components/chart/bar-chart.js');
  await import('./components/chart/line-chart.js');
  await import('./components/chart/pie-chart.js');
  await import('./components/chart/doughnut-chart.js');
  await import('./components/chart/scatter-chart.js');
  await import('./components/chart/bubble-chart.js');
  await import('./components/chart/radar-chart.js');
  await import('./components/chart/polar-area-chart.js');
  await import('./components/chart/box-plot.js');
  await import('./components/chart/histogram.js');
  await import('./components/map/map.js');
  await import('./components/graph/graph.js');
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
    expect(customElements.get(`lyra-${t}`), `lyra-${t}`).to.exist;
  }
});
