import { expect } from '@open-wc/testing';
import './lyra.js';

it('registers every component', () => {
  const tags = [
    'sparkline',
    'toast',
    'toast-item',
    'combobox',
    'option',
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
    'graph',
    'tree',
    'tree-node',
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
  ];
  for (const t of tags) {
    expect(customElements.get(`lyra-${t}`), `lyra-${t}`).to.exist;
  }
});
