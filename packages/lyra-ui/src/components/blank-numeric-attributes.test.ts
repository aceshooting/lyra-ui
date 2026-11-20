import { expect } from '@open-wc/testing';
import './lr-alert.js';
import './lr-avatar-group.js';
import './lr-carousel.js';
import './lr-citation-badge.js';
import './lr-combobox.js';
import './lr-csv-viewer.js';
import './lr-format-number.js';
import './lr-heatmap.js';
import './lr-otp-input.js';
import './lr-popup.js';
import './lr-qr-code.js';
import './lr-rating.js';
import './lr-slider.js';
import './lr-split-panel.js';
import './lr-table.js';
import './lr-tour.js';
import './lr-word-cloud.js';

// One row per converter shape: literal, imported/module constant, `Infinity`, `null`/optional
// `undefined`, hand-written accessors, `static properties` entries, and the shared
// `declaredDefaultConverter`/custom converters.
const CASES: ReadonlyArray<readonly [tag: string, attribute: string, property: string]> = [
  ['lr-alert', 'duration', 'duration'],
  ['lr-avatar-group', 'max', 'max'],
  ['lr-carousel', 'slides-per-page', 'slidesPerPage'],
  ['lr-carousel', 'current-slide', 'currentSlide'],
  ['lr-citation-badge', 'index', 'index'],
  ['lr-combobox', 'source-delay', 'sourceDelay'],
  ['lr-csv-viewer', 'max-bytes', 'maxBytes'],
  ['lr-csv-viewer', 'max-rows', 'maxRows'],
  ['lr-format-number', 'minimum-fraction-digits', 'minimumFractionDigits'],
  ['lr-heatmap', 'bucket-count', 'bucketCount'],
  ['lr-otp-input', 'length', 'length'],
  ['lr-popup', 'arrow-padding', 'arrowPadding'],
  ['lr-qr-code', 'size', 'size'],
  ['lr-rating', 'precision', 'precision'],
  ['lr-rating', 'max', 'max'],
  ['lr-slider', 'max', 'max'],
  ['lr-split-panel', 'position', 'position'],
  ['lr-split-panel', 'snap-threshold', 'snapThreshold'],
  ['lr-table', 'page-size', 'pageSize'],
  ['lr-table', 'max-rows', 'maxRows'],
  ['lr-tour', 'distance', 'distance'],
  ['lr-word-cloud', 'min-font-size', 'minFontSize'],
];

const read = (element: Element, property: string): unknown =>
  (element as unknown as Record<string, unknown>)[property];

it('keeps the declared default for an empty or whitespace numeric attribute', () => {
  const mismatches: string[] = [];
  for (const [tag, attribute, property] of CASES) {
    const expected = read(document.createElement(tag), property);
    for (const blank of ['', ' \t ']) {
      const element = document.createElement(tag);
      element.setAttribute(attribute, '7');
      element.setAttribute(attribute, blank);
      const actual = read(element, property);
      if (!Object.is(actual, expected)) {
        mismatches.push(`${tag}[${attribute}=${JSON.stringify(blank)}]: ${String(actual)} !== ${String(expected)}`);
      }
    }
  }
  expect(mismatches).to.deep.equal([]);
});
