import { expect, fixture, oneEvent } from '@open-wc/testing';
import { html } from 'lit';
import { LyraElement } from './lyra-element.js';
import * as anchorTarget from './anchor-target.js';
import {
  DocumentAnchorTargetBase,
  HIGHLIGHT_CANDIDATE_LIMIT,
  HIGHLIGHT_SNAPSHOT_LIMIT,
  prioritizedHighlightCandidates,
  type LyraAnchorTargetEventMap,
} from './anchor-target-base.js';
import type { LyraAnchor, LyraAnchorKind } from './document-anchors.js';
import { defineElement } from './prefix.js';

class RegionTargetBase extends LyraElement<LyraAnchorTargetEventMap> {
  override render() {
    return html`<div part="content">region viewer caption</div>${this.renderAnchorLiveRegion()}`;
  }
}

interface RegionTargetBase {
  renderAnchorLiveRegion(): unknown;
}

class RegionTarget extends DocumentAnchorTargetBase(RegionTargetBase) {
  override readonly anchorKinds: readonly LyraAnchorKind[] = ['region'];
  applied: LyraAnchor[] = [];
  protected override async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
    this.applied.push(anchor);
    return anchor.kind === 'region';
  }
  bind(): void {
    this.bindTextSelection(this.renderRoot.querySelector('[part="content"]')!);
  }
}

class TextTarget extends anchorTarget.DocumentAnchorTarget(RegionTargetBase) {
  bind(): void {
    this.bindTextSelection(this.renderRoot.querySelector('[part="content"]')!);
  }
}

defineElement('anchor-target-base-test-region', RegionTarget);
defineElement('anchor-target-base-test-text', TextTarget);

declare global {
  interface HTMLElementTagNameMap {
    'lr-anchor-target-base-test-region': RegionTarget;
    'lr-anchor-target-base-test-text': TextTarget;
  }
}

function selectContent(host: HTMLElement): () => void {
  const content = host.shadowRoot!.querySelector('[part="content"]')!;
  const range = document.createRange();
  range.selectNodeContents(content.firstChild!);
  const own = Object.getOwnPropertyDescriptor(window, 'getSelection');
  const selection = {
    rangeCount: 1,
    isCollapsed: false,
    getRangeAt: () => range,
    getComposedRanges: () => [range],
  };
  Object.defineProperty(window, 'getSelection', { configurable: true, value: () => selection });
  return () => {
    if (own) Object.defineProperty(window, 'getSelection', own);
    else Reflect.deleteProperty(window, 'getSelection');
  };
}

describe('DocumentAnchorTargetBase', () => {
  it('is the base the text-capable mixin and its re-exports share', () => {
    expect(anchorTarget.DocumentAnchorTargetBase === DocumentAnchorTargetBase).to.equal(true);
    expect(anchorTarget.prioritizedHighlightCandidates === prioritizedHighlightCandidates).to.equal(true);
    expect(anchorTarget.HIGHLIGHT_CANDIDATE_LIMIT).to.equal(HIGHLIGHT_CANDIDATE_LIMIT);
    expect(anchorTarget.HIGHLIGHT_SNAPSHOT_LIMIT).to.equal(HIGHLIGHT_SNAPSHOT_LIMIT);
  });

  it('navigates anchors and highlight ids without the text-quote default', async () => {
    const el = await fixture<RegionTarget>(html`<lr-anchor-target-base-test-region></lr-anchor-target-base-test-region>`);
    el.highlights = [{ id: 'crop', anchor: { kind: 'region', page: 1, rect: { x: 0, y: 0, width: 0.5, height: 0.5 } } }];
    const result = oneEvent(el, 'lr-anchor-result');
    expect(await el.scrollToAnchor('crop')).to.equal(true);
    expect((await result).detail.found).to.equal(true);
    expect(el.activeHighlightId).to.equal('crop');
    expect(el.applied.map((anchor) => anchor.kind)).to.deep.equal(['region']);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="anchor-live-region"]')!.textContent!.trim()).to.not.equal('');
  });

  it('emits a selection with no anchor by default while the text-capable mixin builds a text quote', async () => {
    const region = await fixture<RegionTarget>(html`<lr-anchor-target-base-test-region></lr-anchor-target-base-test-region>`);
    const text = await fixture<TextTarget>(html`<lr-anchor-target-base-test-text></lr-anchor-target-base-test-text>`);
    region.bind();
    text.bind();
    for (const [el, kind] of [[region, null], [text, 'text-quote']] as const) {
      const restore = selectContent(el);
      try {
        const selected = oneEvent(el, 'lr-text-select');
        el.shadowRoot!.querySelector('[part="content"]')!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        const { detail } = await selected;
        expect(detail.text).to.equal('region viewer caption');
        expect(detail.anchor?.kind ?? null).to.equal(kind);
        expect(Object.isFrozen(detail)).to.equal(true);
      } finally {
        restore();
      }
    }
  });
});
