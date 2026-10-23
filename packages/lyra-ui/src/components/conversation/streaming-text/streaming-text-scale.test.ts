import { expect, oneEvent } from '@open-wc/testing';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import './streaming-text.js';
import './streaming-text-core.js';
for (const tag of ['lr-streaming-text', 'lr-streaming-text-core'] as const) {
  it(`${tag} appends a plain suffix without resetting retained ranges`, async () => {
    const el = document.createElement(tag); el.contentMode = 'plain'; el.coalesceMs = 0;
    el.content = 'x'.repeat(10000); document.body.append(el);
    try {
      await el.updateComplete;
      const node = [...el.shadowRoot!.querySelector('.plain')!.childNodes].find(node => node.nodeType === 3) as Text;
      const range = document.createRange(); range.setStart(node, 100); range.setEnd(node, 200);
      let appended = 0; const original = node.appendData.bind(node);
      node.appendData = value => { appended += value.length; original(value); };
      const settled = oneEvent(el, 'lr-content-settled');
      el.content += 'y'.repeat(1000); await settled;
      expect(range.startOffset).equal(100); expect(range.endOffset).equal(200);
      expect(node.data).equal(el.content); expect(appended).equal(1000);
      recordScaleMeasurement(tag, 'n=10000 plain prefix append1000', { appended });
    } finally { el.remove(); }
  });
}

import { APPEND_MONOTONIC_MARKDOWN_PATTERNS, BOUNDARY_SENSITIVE_MARKDOWN_PATTERNS } from './markdown-detection.js';
for (const tag of ['lr-streaming-text', 'lr-streaming-text-core'] as const) {
  it(`${tag} avoids rescanning the accumulated plain prefix for auto detection`, async () => {
    const el = document.createElement(tag); el.coalesceMs = 0; document.body.append(el);
    const patterns = [...APPEND_MONOTONIC_MARKDOWN_PATTERNS, ...BOUNDARY_SENSITIVE_MARKDOWN_PATTERNS];
    const originals = patterns.map(pattern => pattern.test); let scanned = 0;
    patterns.forEach((pattern, index) => { pattern.test = function (source: string) { scanned += source.length; return originals[index]!.call(this, source); }; });
    try {
      for (let index = 0; index < 20; index++) {
        const settled = oneEvent(el, 'lr-content-settled');
        el.content += 'plain '.repeat(1000); await settled;
      }
      expect(scanned).at.most(el.content.length * 10);
      const units = (el as unknown as { markdownDetector: { scannedCodeUnits: number } }).markdownDetector.scannedCodeUnits;
      expect(units).equal(el.content.length);
      recordScaleMeasurement(tag, 'n=120000 incremental autodetection', { rescannedPatternUnits: scanned, scannedCodeUnits: units });
    } finally { patterns.forEach((pattern,index) => { pattern.test = originals[index]!; }); el.remove(); }
  });
}
