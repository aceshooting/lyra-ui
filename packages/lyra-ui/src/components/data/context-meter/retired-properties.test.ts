import { fixture, expect } from '@open-wc/testing';
import type { LyraElement } from '../../../internal/lyra-element.js';
import '../../lr-animated-image.js';
import '../../lr-animation.js';
import '../../lr-attachment-chip.js';
import '../../lr-context-meter.js';
import '../../lr-env-list.js';
import '../../lr-file-input.js';
import '../../lr-flow-canvas.js';
import '../../lr-flow-controls.js';
import '../../lr-flow-node.js';
import '../../lr-flow-run-status.js';
import '../../lr-funnel.js';
import '../../lr-gauge.js';
import '../../lr-lightbox.js';
import '../../lr-sequence-playback.js';
import '../../lr-sequence-strip.js';
import '../../lr-stat.js';
import '../../lr-table.js';
import '../../lr-video-playlist.js';
import '../../lr-word-cloud.js';

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
