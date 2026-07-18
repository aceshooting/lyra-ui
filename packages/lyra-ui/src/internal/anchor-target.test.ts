import { fixture, expect, oneEvent, aTimeout } from '@open-wc/testing';
import { html as litHtml } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from './lyra-element.js';
import { DocumentAnchorTarget, type LyraAnchorTargetEventMap } from './anchor-target.js';
import type { LyraAnchor } from '../components/document-viewer/anchors.js';
import { defineElement } from './prefix.js';

class StubAnchorTargetBase extends LyraElement<LyraAnchorTargetEventMap> {
  @property({ type: Number, attribute: 'apply-succeeds-after' }) applySucceedsAfter = 0;
  applyCallCount = 0;

  render() {
    return litHtml`<div part="content">stub content for selection tests</div>${this.renderAnchorLiveRegion()}`;
  }
}

class StubAnchorTarget extends DocumentAnchorTarget(StubAnchorTargetBase) {
  protected async applyAnchor(_anchor: LyraAnchor): Promise<boolean> {
    this.applyCallCount++;
    return this.applyCallCount > this.applySucceedsAfter;
  }
}
defineElement('anchor-target-test-stub', StubAnchorTarget);

declare global {
  interface HTMLElementTagNameMap {
    'lr-anchor-target-test-stub': StubAnchorTarget;
  }
}

describe('DocumentAnchorTarget mixin', () => {
  it('defaults highlights/activeHighlightId/anchor/anchorKinds', async () => {
    const el = await fixture<StubAnchorTarget>(litHtml`<lr-anchor-target-test-stub></lr-anchor-target-test-stub>`);
    expect(el.highlights).to.deep.equal([]);
    expect(el.activeHighlightId).to.be.null;
    expect(el.anchor).to.be.null;
    expect(el.anchorKinds).to.deep.equal([]);
  });

  it('scrollToAnchor retries until applyAnchor succeeds, then resolves true', async () => {
    const el = await fixture<StubAnchorTarget>(litHtml`<lr-anchor-target-test-stub apply-succeeds-after="2"></lr-anchor-target-test-stub>`);
    (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
    (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 500;
    const ok = await el.scrollToAnchor({ kind: 'page', page: 1 });
    expect(ok).to.be.true;
    expect(el.applyCallCount).to.be.greaterThan(2);
  });

  it('scrollToAnchor times out to false and announces anchorNotFound', async () => {
    const el = await fixture<StubAnchorTarget>(litHtml`<lr-anchor-target-test-stub apply-succeeds-after="9999"></lr-anchor-target-test-stub>`);
    (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
    (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
    const eventPromise = oneEvent(el, 'lr-anchor-result');
    const ok = await el.scrollToAnchor({ kind: 'page', page: 1 });
    expect(ok).to.be.false;
    expect((await eventPromise).detail).to.deep.equal({ found: false });
    await el.updateComplete;
    const region = el.shadowRoot!.querySelector('[part="anchor-live-region"]')!;
    expect(region.textContent).to.contain('Passage not found in this document.');
  });

  it('a second scrollToAnchor call supersedes the first (generation guard)', async () => {
    const el = await fixture<StubAnchorTarget>(litHtml`<lr-anchor-target-test-stub apply-succeeds-after="9999"></lr-anchor-target-test-stub>`);
    (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
    (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 5000;
    const firstCall = el.scrollToAnchor({ kind: 'page', page: 1 });
    await aTimeout(20);
    el.applySucceedsAfter = 0; // the second call's applyAnchor will succeed immediately
    const secondCall = el.scrollToAnchor({ kind: 'page', page: 2 });
    expect(await firstCall).to.be.false; // superseded, not timed out
    expect(await secondCall).to.be.true;
  });

  it('scrollToAnchor with a highlight id sets activeHighlightId on success', async () => {
    const el = await fixture<StubAnchorTarget>(litHtml`<lr-anchor-target-test-stub></lr-anchor-target-test-stub>`);
    el.highlights = [{ id: 'cite-1', anchor: { kind: 'page', page: 1 } }];
    await el.updateComplete;
    const ok = await el.scrollToAnchor('cite-1');
    expect(ok).to.be.true;
    expect(el.activeHighlightId).to.equal('cite-1');
  });

  it('scrollToAnchor with an unknown highlight id resolves false without calling applyAnchor', async () => {
    const el = await fixture<StubAnchorTarget>(litHtml`<lr-anchor-target-test-stub></lr-anchor-target-test-stub>`);
    const ok = await el.scrollToAnchor('does-not-exist');
    expect(ok).to.be.false;
    expect(el.applyCallCount).to.equal(0);
  });

  it('setting the anchor property auto-runs scrollToAnchor and emits lr-anchor-result', async () => {
    const el = await fixture<StubAnchorTarget>(litHtml`<lr-anchor-target-test-stub></lr-anchor-target-test-stub>`);
    const eventPromise = oneEvent(el, 'lr-anchor-result');
    el.anchor = { kind: 'page', page: 1 };
    expect((await eventPromise).detail).to.deep.equal({ found: true });
  });

  it('re-assigning anchor to the identical value re-fires (hasChanged always true)', async () => {
    const el = await fixture<StubAnchorTarget>(litHtml`<lr-anchor-target-test-stub></lr-anchor-target-test-stub>`);
    el.anchor = 'cite-1';
    await oneEvent(el, 'lr-anchor-result');
    const secondPromise = oneEvent(el, 'lr-anchor-result');
    el.anchor = 'cite-1'; // identical value
    await secondPromise; // must fire again, not be swallowed by Lit's default reference equality
  });

  it('bindTextSelection emits lr-text-select once per selection end with a text-quote anchor by default', async () => {
    const el = await fixture<StubAnchorTarget>(litHtml`<lr-anchor-target-test-stub></lr-anchor-target-test-stub>`);
    const content = el.shadowRoot!.querySelector('[part="content"]')!;
    (el as unknown as { bindTextSelection: (root: Element) => void }).bindTextSelection(content);

    const range = document.createRange();
    range.selectNodeContents(content.firstChild!);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    const eventPromise = oneEvent(el, 'lr-text-select');
    content.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    const detail = (await eventPromise).detail;
    expect(detail.text).to.equal('stub content for selection tests');
    expect(detail.anchor).to.exist;
    expect(detail.anchor!.kind).to.equal('text-quote');
    expect(detail.rects).to.be.an('array');
    selection.removeAllRanges();
  });

  it('bindTextSelection reports a null anchor when computeSelectionAnchor declines', async () => {
    class DecliningStub extends DocumentAnchorTarget(StubAnchorTargetBase) {
      protected computeSelectionAnchor(): LyraAnchor | null {
        return null;
      }
    }
    defineElement('anchor-target-test-declining', DecliningStub);
    const el = await fixture<DecliningStub>(litHtml`<lr-anchor-target-test-declining></lr-anchor-target-test-declining>`);
    const content = el.shadowRoot!.querySelector('[part="content"]')!;
    (el as unknown as { bindTextSelection: (root: Element) => void }).bindTextSelection(content);

    const range = document.createRange();
    range.selectNodeContents(content.firstChild!);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    const eventPromise = oneEvent(el, 'lr-text-select');
    content.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    expect((await eventPromise).detail.anchor).to.be.null;
    selection.removeAllRanges();
  });

  it('is accessible', async () => {
    const el = await fixture<StubAnchorTarget>(litHtml`<lr-anchor-target-test-stub></lr-anchor-target-test-stub>`);
    await expect(el).to.be.accessible();
  });
});
