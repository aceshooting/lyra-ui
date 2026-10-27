import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

// See ../../forms/time-range/time-range.docs.test.mjs for why this reads raw source/markdown
// instead of going through wtr: esbuild strips JSDoc/comment text from every `.ts` module before a
// browser ever sees it.
const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'tooltip.class.ts'), 'utf8');
const llmsOverlays = readFileSync(join(here, '../../../../llms/overlays.md'), 'utf8');
const inventory = JSON.parse(readFileSync(join(here, '../../../../scripts/fixtures/component-inventory.json'), 'utf8'));

test('lr-tooltip @slot trigger doc no longer attributes the named trigger slot to Web Awesome', () => {
  assert.doesNotMatch(
    source,
    /@slot trigger - Web Awesome shape/,
    'wa-tooltip has only a single unnamed default slot -- it has no trigger slot to attribute this to',
  );
});

test('llms/overlays.md no longer claims Web Awesome uses a named trigger slot for lr-tooltip', () => {
  assert.doesNotMatch(
    llmsOverlays,
    /Web Awesome uses named `trigger` plus default tooltip\s*content\./,
    'the authored consumer reference must not repeat the same wrong attribution',
  );
});

test('the pinned wa-tooltip surface really has only the unnamed default slot', () => {
  const waTooltip = inventory.upstreams.webawesome.components.find((component) => component.tag === 'wa-tooltip');
  assert.ok(waTooltip, 'expected a pinned wa-tooltip entry');
  assert.deepEqual(
    waTooltip.surface.slots.map((slot) => slot.name),
    [''],
    'wa-tooltip should declare only the unnamed default slot',
  );
});

test('the graph virtual-anchor example forwards the viewport rectangle without shifting its origin', () => {
  const example = llmsOverlays.split('**`showAt()` composed with `lr-graph`**')[1]?.match(/```js\n([\s\S]*?)```/u)?.[1];
  assert.ok(example, 'expected the authored graph composition example');
  const rectangle = { left: 37, top: 53, width: 84, height: 26 };
  class Element {
    matches() { return true; }
    getBoundingClientRect() { return rectangle; }
  }
  let click, anchor;
  const graph = { addEventListener(type, listener) { assert.equal(type, 'click'); click = listener; } };
  const detail = { showAt(value) { anchor = value; } };
  runInNewContext(example, { Element, document: { querySelector: tag => tag === 'lr-graph' ? graph : detail } });
  click({ composedPath: () => [new Element()] });
  assert.deepEqual({ ...anchor }, { x: rectangle.left, y: rectangle.top, width: rectangle.width, height: rectangle.height });
});
