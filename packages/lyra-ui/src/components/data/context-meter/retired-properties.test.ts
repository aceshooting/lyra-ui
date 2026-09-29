import { fixture, expect } from '@open-wc/testing';
import type { LyraElement } from '../../../internal/lyra-element.js';
import { expectDeprecatedUsage } from '../../../../test/expected-deprecations.js';
import '../../media/animated-image/animated-image.js';
import '../../media/animation/animation.js';
import '../../media/attachment-chip/attachment-chip.js';
import '../../data/context-meter/context-meter.js';
import '../../data/env-list/env-list.js';
import '../../media/file-input/file-input.js';
import '../../data/flow-canvas/flow-canvas.js';
import '../../data/flow-controls/flow-controls.js';
import '../../data/flow-node/flow-node.js';
import '../../data/flow-run-status/flow-run-status.js';
import '../../data/funnel/funnel.js';
import '../../data/gauge/gauge.js';
import '../../media/lightbox/lightbox.js';
import '../../media/sequence-playback/sequence-playback.js';
import '../../data/sequence-strip/sequence-strip.js';
import '../../data/stat/stat.js';
import '../../data/table/table.js';
import '../../media/video-playlist/video-playlist.js';
import '../../data/word-cloud/word-cloud.js';

const cases = [
  { tag: 'lr-animated-image', old: 'respectReducedMotion', attribute: 'respect-reduced-motion', canonical: 'ignoreReducedMotion', value: false, retiredValue: false },
  { tag: 'lr-animation', old: 'respectReducedMotion', attribute: 'respect-reduced-motion', canonical: 'ignoreReducedMotion', value: false, retiredValue: false },
  { tag: 'lr-attachment-chip', old: 'compact', attribute: 'compact', canonical: 'size', value: 'm', retiredValue: true },
  { tag: 'lr-attachment-chip', old: 'previewable', attribute: 'previewable', canonical: 'withoutPreview', value: false, retiredValue: false },
  { tag: 'lr-attachment-chip', old: 'removable', attribute: 'removable', canonical: 'withoutRemoveButton', value: false, retiredValue: false },
  { tag: 'lr-context-meter', old: 'showLegend', attribute: 'show-legend', canonical: 'withLegend', value: false, retiredValue: true },
  { tag: 'lr-env-list', old: 'copyable', attribute: 'copyable', canonical: 'withoutCopyButton', value: false, retiredValue: false },
  { tag: 'lr-env-list', old: 'revealable', attribute: 'revealable', canonical: 'withoutReveal', value: false, retiredValue: false },
  { tag: 'lr-file-input', old: 'compact', attribute: 'compact', canonical: 'size', value: 'm', retiredValue: true },
  { tag: 'lr-file-input', old: 'paste', attribute: 'paste', canonical: 'withoutPaste', value: false, retiredValue: false },
  { tag: 'lr-flow-canvas', old: 'locked', attribute: 'locked', canonical: 'readonly', value: false, retiredValue: true },
  { tag: 'lr-flow-controls', old: 'hideLock', attribute: 'hide-lock', canonical: 'withoutLock', value: false, retiredValue: true },
  { tag: 'lr-flow-node', old: 'compact', attribute: 'compact', canonical: 'size', value: 'm', retiredValue: true },
  { tag: 'lr-flow-run-status', old: 'hideSummary', attribute: 'hide-summary', canonical: 'withoutSummary', value: false, retiredValue: true },
  { tag: 'lr-funnel', old: 'dropoff', attribute: 'dropoff', canonical: 'withoutDropoff', value: false, retiredValue: false },
  { tag: 'lr-gauge', old: 'showValue', attribute: 'show-value', canonical: 'withoutValue', value: false, retiredValue: false },
  { tag: 'lr-lightbox', old: 'showCounter', attribute: 'show-counter', canonical: 'withoutCounter', value: false, retiredValue: false },
  { tag: 'lr-sequence-playback', old: 'loop', attribute: 'loop', canonical: 'withoutLoop', value: false, retiredValue: false },
  { tag: 'lr-sequence-strip', old: 'showLegend', attribute: 'show-legend', canonical: 'withLegend', value: false, retiredValue: true },
  { tag: 'lr-stat', old: 'compact', attribute: 'compact', canonical: 'size', value: 'm', retiredValue: true },
  { tag: 'lr-table', old: 'emptyCompact', attribute: 'empty-compact', canonical: 'emptySize', value: 'm', retiredValue: true },
  { tag: 'lr-table', old: 'hideColumnsLabel', attribute: 'hide-columns-label', canonical: 'columnsHideLabel', value: 'Canonical text', retiredValue: 'Retired text' },
  { tag: 'lr-table', old: 'noColumnsDescription', attribute: 'no-columns-description', canonical: 'emptyColumnsDescription', value: 'Canonical text', retiredValue: 'Retired text' },
  { tag: 'lr-table', old: 'noColumnsHeading', attribute: 'no-columns-heading', canonical: 'emptyColumnsHeading', value: 'Canonical text', retiredValue: 'Retired text' },
  { tag: 'lr-video-playlist', old: 'autoAdvance', attribute: 'auto-advance', canonical: 'withoutAutoAdvance', value: false, retiredValue: false },
  { tag: 'lr-word-cloud', old: 'showLegend', attribute: 'show-legend', canonical: 'withLegend', value: false, retiredValue: true },
];

for (const entry of cases) {
  expectDeprecatedUsage(entry.tag, 'property', entry.old);
  it(`${entry.tag} ignores retired ${entry.old} writes without changing canonical rendering`, async () => {
    const el = await fixture<LyraElement>(`<${entry.tag} aria-label="Retirement control"></${entry.tag}>`);
    Reflect.set(el, entry.canonical, entry.value);
    await el.updateComplete;
    const before = el.shadowRoot!.innerHTML;
    const paint = () => [...el.shadowRoot!.querySelectorAll('[part]')].map((node) => {
      const style = getComputedStyle(node);
      return [style.display, style.padding, style.gap, style.fontSize];
    });
    const beforePaint = paint();
    el.setAttribute(entry.attribute, String(entry.retiredValue));
    await el.updateComplete;
    expect(Reflect.get(el, entry.canonical)).to.equal(entry.value);
    expect(el.shadowRoot!.innerHTML).to.equal(before);
    expect(paint()).to.deep.equal(beforePaint);
    Reflect.set(el, entry.old, entry.retiredValue);
    el.requestUpdate();
    await el.updateComplete;
    expect(Reflect.get(el, entry.canonical)).to.equal(entry.value);
    expect(el.shadowRoot!.innerHTML).to.equal(before);
    expect(paint()).to.deep.equal(beforePaint);
    el.removeAttribute(entry.attribute);
    await el.updateComplete;
    expect(Reflect.get(el, entry.canonical)).to.equal(entry.value);
  });
}

for (const tag of ['lr-attachment-chip', 'lr-flow-node', 'lr-stat', 'lr-file-input']) {
  it(`${tag} ignores retired compact styling when size is unset`, async () => {
    const el = await fixture<LyraElement>(`<${tag} aria-label="Density control"></${tag}>`);
    const paint = () => [...el.shadowRoot!.querySelectorAll('[part], .linked-content, .card')].map((node) => {
      const style = getComputedStyle(node);
      return [style.display, style.padding, style.gap, style.fontSize, style.width, style.height];
    });
    const before = paint();
    const initialSize = el.getAttribute('size');
    el.setAttribute('compact', '');
    await el.updateComplete;
    expect(paint()).to.deep.equal(before);
    expect(el.getAttribute('size')).to.equal(initialSize);
  });
}
