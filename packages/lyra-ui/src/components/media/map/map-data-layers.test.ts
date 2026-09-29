import { expect } from '@open-wc/testing';
import {
  clusterColorExpression,
  heatmapColorExpression,
  heatmapWeightExpression,
  heatmapZoomValue,
  lineColorExpression,
  mutedCategoryOpacityExpression,
  pointColorExpression,
  pointRadiusExpression,
} from './map-data-layers.js';

it('builds category and graduated paint expressions from already-resolved colors', () => {
  expect(pointColorExpression('status', [['open', 'rgb(1, 2, 3)'], ['closed', 'rgb(4, 5, 6)']], 'gray'))
    .to.deep.equal(['match', ['get', 'status'], 'open', 'rgb(1, 2, 3)', 'closed', 'rgb(4, 5, 6)', 'gray']);
  expect(pointColorExpression(undefined, [['open', 'red']], 'gray')).to.equal('gray');
  expect(lineColorExpression(undefined, [[0, 'red'], [5, 'blue']], 'black')).to.equal('black');
  expect(lineColorExpression('speed', [[0, 'green'], [10, 'orange']], 'gray')).to.deep.equal([
    'case', ['==', ['typeof', ['get', 'speed']], 'number'],
    ['interpolate', ['linear'], ['number', ['get', 'speed']], 0, 'green', 10, 'orange'],
    'gray',
  ]);
  expect(clusterColorExpression([[10, 'blue'], [50, 'red']], 'gray')).to.deep.equal([
    'step', ['get', 'point_count'], 'blue', 10, 'blue', 50, 'red',
  ]);
  expect(clusterColorExpression([], 'gray')).to.equal('gray');
});

it('resolves a cluster fallback only when there are no color steps', () => {
  let fallbackReads = 0;
  const fallback = () => {
    fallbackReads += 1;
    return 'gray';
  };
  expect(clusterColorExpression([[10, 'blue']], fallback)).to.deep.equal([
    'step', ['get', 'point_count'], 'blue', 10, 'blue',
  ]);
  expect(fallbackReads).to.equal(0);
  expect(clusterColorExpression([], fallback)).to.equal('gray');
  expect(fallbackReads).to.equal(1);
});

it('builds muted-category opacity and guarded point-radius expressions', () => {
  expect(mutedCategoryOpacityExpression('kind', ['hidden-a', 'hidden-b'], 0.25)).to.deep.equal([
    'match', ['get', 'kind'], 'hidden-a', 0.25, 'hidden-b', 0.25, 1,
  ]);
  expect(pointRadiusExpression(7)).to.equal(7);
  expect(pointRadiusExpression({
    field: 'visits',
    stops: [[0, 4], [100, 12]],
    interpolation: 'step',
    fallback: 6,
  })).to.deep.equal([
    'case', ['all', ['==', ['typeof', ['get', 'visits']], 'number'],
      ['>=', ['number', ['get', 'visits'], 0], -Number.MAX_VALUE],
      ['<=', ['number', ['get', 'visits'], 0], Number.MAX_VALUE]],
    ['step', ['number', ['get', 'visits'], 0], 4, 0, 4, 100, 12], 6,
  ]);
});

it('normalizes heatmap ranges, zoom stops, and transparent color-ramp floors', () => {
  const options = {
    weightField: 'density',
    weightRange: [2, 10] as const,
    stops: [] as readonly (readonly [number, string])[],
    radius: undefined,
    intensity: undefined,
  };
  expect(heatmapWeightExpression(options)).to.deep.equal([
    'interpolate', ['linear'], ['get', 'density'], 2, 0, 10, 1,
  ]);
  expect(heatmapWeightExpression({ ...options, weightRange: [10, 2] as const })).to.deep.equal(['get', 'density']);
  expect(heatmapWeightExpression(undefined)).to.equal(undefined);
  expect(heatmapZoomValue(500, 30, 1, 200)).to.equal(200);
  expect(heatmapZoomValue([[1, 4], [5, 900]], 30, 1, 200)).to.deep.equal([
    'interpolate', ['linear'], ['zoom'], 1, 4, 5, 200,
  ]);
  expect(heatmapZoomValue([], 30, 1, 200)).to.equal(30);
  expect(heatmapColorExpression([[0.5, 'hot']], [[0.25, 'cool'], [1, 'warm']])).to.deep.equal([
    'interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0, 0, 0, 0)', 0.5, 'hot',
  ]);
  expect(heatmapColorExpression([[0, 'flat']], [[0.25, 'cool'], [1, 'warm']])).to.deep.equal([
    'interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0, 0, 0, 0)', 0.25, 'cool', 1, 'warm',
  ]);
});

it('resolves default heatmap stops only when the authored ramp cannot interpolate', () => {
  let fallbackReads = 0;
  const fallback = () => {
    fallbackReads += 1;
    return [[0.25, 'cool'], [1, 'warm']] as const;
  };
  expect(heatmapColorExpression([[0.5, 'hot']], fallback)).to.deep.equal([
    'interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0, 0, 0, 0)', 0.5, 'hot',
  ]);
  expect(fallbackReads).to.equal(0);
  expect(heatmapColorExpression([[0, 'flat']], fallback)).to.deep.equal([
    'interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0, 0, 0, 0)', 0.25, 'cool', 1, 'warm',
  ]);
  expect(fallbackReads).to.equal(1);
});
