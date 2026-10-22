import assert from 'node:assert/strict';
import test from 'node:test';
import { editor, type Internals } from '../../test/docx-editor-harness.js';
import type { DocxChartModel } from './chart-model.js';

/**
 * The editor's template, read through the values it hands to Lit: what the browser would bind to the command
 * palette's close events and to each painted chart. Rendering builds the template without touching the DOM,
 * so an element that was never connected can still be asked what it binds.
 */

interface Template { strings: readonly string[]; values: readonly unknown[] }

/** The value bound where the template's static text ends with `binding` (`@event=`, `.property=`). */
function bound(template: Template, binding: string): unknown {
  const index = template.strings.findIndex((chunk, position) => position < template.values.length && chunk.trimEnd().endsWith(binding));
  assert.ok(index >= 0, `${binding} is bound`);
  return template.values[index];
}

const chart = (series: number, title: string): DocxChartModel => ({
  type: 'bar', stacked: false, title, labels: ['Q1', 'Q2'],
  series: Array.from({ length: series }, (_, index) => ({ label: `Series ${index + 1}`, data: [index, index + 1] })),
});

/** The `datasets` handed to each painted chart, in layer order. */
function paintedDatasets(i: Internals): object[][] {
  const layer = i.renderCharts() as Template;
  const charts = layer.values.find(Array.isArray) as Template[];
  return charts.map(template => bound(template, '.datasets=') as object[]);
}

test('the command palette cannot leak its close events out of the editor', () => {
  const { i } = editor();
  const template = i.render() as Template;
  for (const type of ['lr-close', 'lr-close-request']) {
    const listener = bound(template, `@${type}=`);
    assert.equal(typeof listener, 'function', type);
    const event = new Event(type, { bubbles: true, cancelable: true });
    (listener as (event: Event) => void)(event);
    assert.equal(event.cancelBubble, true, `${type} stops at the editor`);
    assert.equal(event.defaultPrevented, false, `${type} still lets the palette close`);
  }
});

test('chart series are painted in the Office colors, cycling after six, from datasets built once per chart', () => {
  const wide = chart(7, 'Wide'), narrow = chart(2, 'Narrow');
  const frame = { left: 0, top: 0, width: 80, height: 60 };
  const { i } = editor({ chartLayer: { clip: frame, charts: [
    { placement: { drawingId: 'one', model: wide }, frame },
    { placement: { drawingId: 'two', model: narrow }, frame },
  ] } });
  const [first, second] = paintedDatasets(i) as [Record<string, unknown>[], Record<string, unknown>[]];
  assert.deepEqual(first.map(dataset => dataset['color']), ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47', '#4472C4']);
  assert.deepEqual(first[1], { label: 'Series 2', data: [1, 2], color: '#ED7D31' });
  assert.deepEqual(second.map(dataset => dataset['label']), ['Series 1', 'Series 2']);
  assert.deepEqual(second.map(dataset => dataset['color']), ['#4472C4', '#ED7D31']);
  // The document's own series are copied, never painted over.
  assert.deepEqual(wide.series[0], { label: 'Series 1', data: [0, 1] });
  // Rendering again hands Lit the very same arrays, so an unchanged chart is not reassigned.
  const [firstAgain, secondAgain] = paintedDatasets(i);
  assert.equal(firstAgain, first);
  assert.equal(secondAgain, second);
  assert.notEqual(first, second);
});
