import { fixture, expect, oneEvent, aTimeout, waitUntil } from '@open-wc/testing';
import { html as litHtml } from 'lit';
import { property } from 'lit/decorators.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from './announcer.js';
import { LyraElement } from './lyra-element.js';
import {
  DocumentAnchorTarget,
  HIGHLIGHT_CANDIDATE_LIMIT,
  HIGHLIGHT_SNAPSHOT_LIMIT,
  prioritizedHighlightCandidates,
  type LyraAnchorTargetEventMap,
} from './anchor-target.js';
import type { LyraAnchor } from '../components/viewers/document-viewer/anchors.js';
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

class DecliningStubAnchorTarget extends DocumentAnchorTarget(StubAnchorTargetBase) {
  protected computeSelectionAnchor(): LyraAnchor | null {
    return null;
  }
}

/** No override of `scrollToAnchor()` itself (unlike `lr-ebook-viewer`) -- exercises the mixin's
 *  OWN default safety net for a throwing `applyAnchor()`, per `anchor-target.ts`'s
 *  `scrollToAnchor()`/`performScrollToAnchor()` split. */
class ThrowingStubAnchorTarget extends DocumentAnchorTarget(StubAnchorTargetBase) {
  protected async applyAnchor(_anchor: LyraAnchor): Promise<boolean> {
    throw new Error('applyAnchor boom');
  }
}

class DefaultStubAnchorTarget extends DocumentAnchorTarget(StubAnchorTargetBase) {}

defineElement('anchor-target-test-stub', StubAnchorTarget);
defineElement('anchor-target-test-declining', DecliningStubAnchorTarget);
defineElement('anchor-target-test-throwing', ThrowingStubAnchorTarget);
defineElement('anchor-target-test-default', DefaultStubAnchorTarget);

function installComposedSelection(range: Range, shadowRoot: ShadowRoot): () => void {
  const view = shadowRoot.ownerDocument.defaultView!;
  const ownDescriptor = Object.getOwnPropertyDescriptor(view, 'getSelection');
  const composedRange = {
    startContainer: range.startContainer,
    startOffset: range.startOffset,
    endContainer: range.endContainer,
    endOffset: range.endOffset,
    collapsed: range.collapsed,
  } as StaticRange;
  const selection = {
    isCollapsed: range.collapsed,
    rangeCount: 1,
    getRangeAt: () => range,
    getComposedRanges: ({ shadowRoots }: { shadowRoots: ShadowRoot[] }) =>
      shadowRoots.includes(shadowRoot) ? [composedRange] : [],
  } as unknown as Selection & {
    getComposedRanges(options: { shadowRoots: ShadowRoot[] }): StaticRange[];
  };

  Object.defineProperty(view, 'getSelection', {
    configurable: true,
    value: () => selection,
  });
  return () => {
    if (ownDescriptor) Object.defineProperty(view, 'getSelection', ownDescriptor);
    else delete (view as unknown as { getSelection?: unknown }).getSelection;
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-anchor-target-test-stub': StubAnchorTarget;
    'lr-anchor-target-test-declining': DecliningStubAnchorTarget;
    'lr-anchor-target-test-throwing': ThrowingStubAnchorTarget;
    'lr-anchor-target-test-default': DefaultStubAnchorTarget;
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

  it('takes a frozen highlight snapshot synchronously while preserving anchor identity', async () => {
    const el = await fixture<StubAnchorTarget>(litHtml`<lr-anchor-target-test-stub></lr-anchor-target-test-stub>`);
    const anchor: LyraAnchor = { kind: 'page', page: 1 };
    const source = [{ id: 'cite-1', label: 'Original', anchor }];

    el.highlights = source;
    source[0]!.label = 'Mutated';
    source.push({ id: 'later', label: 'Later', anchor });

    expect(el.highlights).to.deep.equal([{ id: 'cite-1', label: 'Original', anchor }]);
    expect(el.highlights[0]!.anchor).to.equal(anchor);
    expect(Object.isFrozen(el.highlights)).to.be.true;
    expect(Object.isFrozen(el.highlights[0])).to.be.true;
  });

  it('retains the first unique nonempty highlight id after trimming', async () => {
    const el = await fixture<StubAnchorTarget>(litHtml`<lr-anchor-target-test-stub></lr-anchor-target-test-stub>`);
    const anchor: LyraAnchor = { kind: 'page', page: 1 };

    el.highlights = [
      { id: '', label: 'Empty', anchor },
      { id: '   ', label: 'Blank', anchor },
      { id: ' cite-1 ', label: 'First', anchor },
      { id: 'cite-1', label: 'Duplicate', anchor },
      { id: 'cite-2', label: 'Second', anchor },
    ];

    expect(el.highlights.map((highlight) => [highlight.id, highlight.label])).to.deep.equal([
      ['cite-1', 'First'],
      ['cite-2', 'Second'],
    ]);
  });

  it('bounds snapshot admission while allowing one ignored entry to be replaced', async () => {
    const el = await fixture<StubAnchorTarget>(litHtml`<lr-anchor-target-test-stub></lr-anchor-target-test-stub>`);
    let idReads = 0;
    const source = Array.from({ length: HIGHLIGHT_SNAPSHOT_LIMIT + 1 }, (_, index) => ({
      get id() {
        idReads++;
        return index === 0 ? '' : `highlight-${index}`;
      },
      anchor: { kind: 'page' as const, page: 1 },
    }));

    el.highlights = source;

    expect(idReads).to.equal(HIGHLIGHT_SNAPSHOT_LIMIT + 1);
    expect(el.highlights).to.have.length(HIGHLIGHT_SNAPSHOT_LIMIT);
    expect(el.highlights.at(-1)?.id).to.equal(`highlight-${HIGHLIGHT_SNAPSHOT_LIMIT}`);
  });

  it('retains an active candidate at the end of the bounded snapshot', async () => {
    const el = await fixture<StubAnchorTarget>(litHtml`<lr-anchor-target-test-stub></lr-anchor-target-test-stub>`);
    const anchor: LyraAnchor = { kind: 'page', page: 1 };
    el.highlights = Array.from({ length: HIGHLIGHT_SNAPSHOT_LIMIT }, (_, index) => ({
      id: `highlight-${index}`,
      anchor,
    }));

    const candidates = prioritizedHighlightCandidates(
      el.highlights,
      `highlight-${HIGHLIGHT_SNAPSHOT_LIMIT - 1}`,
    );

    expect(candidates).to.have.length(HIGHLIGHT_CANDIDATE_LIMIT);
    expect(candidates[0]?.id).to.equal(`highlight-${HIGHLIGHT_SNAPSHOT_LIMIT - 1}`);
  });

  it('scrollToAnchor retries until applyAnchor succeeds, then resolves true', async () => {
    const el = await fixture<StubAnchorTarget>(litHtml`<lr-anchor-target-test-stub apply-succeeds-after="2"></lr-anchor-target-test-stub>`);
    (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
    (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 500;
    const ok = await el.scrollToAnchor({ kind: 'page', page: 1 });
    expect(ok).to.be.true;
    expect(el.applyCallCount).to.be.greaterThan(2);
  });

  it('declines anchors through the mixin default when a consumer has no resolver', async () => {
    const el = await fixture<DefaultStubAnchorTarget>(
      litHtml`<lr-anchor-target-test-default></lr-anchor-target-test-default>`,
    );
    (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 0;
    const eventPromise = oneEvent(el, 'lr-anchor-result');

    expect(await el.scrollToAnchor({ kind: 'page', page: 1 })).to.be.false;
    expect((await eventPromise).detail).to.deep.equal({ found: false });
  });

  it('scrollToAnchor times out to false and announces anchorNotFound', async () => {
    const el = await fixture<StubAnchorTarget>(litHtml`<lr-anchor-target-test-stub apply-succeeds-after="9999"></lr-anchor-target-test-stub>`);
    el.strings = { anchorNotFound: 'Passage not found in this document.' };
    (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
    (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
    const eventPromise = oneEvent(el, 'lr-anchor-result');
    const ok = await el.scrollToAnchor({ kind: 'page', page: 1 });
    expect(ok).to.be.false;
    expect((await eventPromise).detail).to.deep.equal({ found: false });
    await el.updateComplete;
    const region = el.shadowRoot!.querySelector('[part="anchor-live-region"]')!;
    expect(region.textContent).to.contain('Passage not found in this document.');
    expect(region.getAttribute('aria-hidden')).to.equal('true');
    expect(region.hasAttribute('role')).to.be.false;
    expect(region.hasAttribute('aria-live')).to.be.false;
    expect(
      document.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`)?.textContent,
    ).to.contain('Passage not found in this document.');
  });

  it('scrollToAnchor degrades a throwing applyAnchor to a resolved false and still emits lr-anchor-result', async () => {
    // Regression for the mixin's default scrollToAnchor()/performScrollToAnchor() safety net
    // when applyAnchor() throws: the failure must not leave scrollToAnchor()'s documented
    // "always reports a definite
    // result" contract broken by rejecting instead of resolving.
    const el = await fixture<ThrowingStubAnchorTarget>(
      litHtml`<lr-anchor-target-test-throwing></lr-anchor-target-test-throwing>`,
    );
    const eventPromise = oneEvent(el, 'lr-anchor-result');
    const result = await el.scrollToAnchor({ kind: 'page', page: 1 });
    expect(result).to.be.false;
    expect((await eventPromise).detail).to.deep.equal({ found: false });
  });

  it('pre-mounts a light-DOM sink, appends repeated results, and releases it on disconnect', async () => {
    const el = await fixture<StubAnchorTarget>(litHtml`<lr-anchor-target-test-stub></lr-anchor-target-test-stub>`);
    el.strings = { anchorJumpedToPage: 'Jumped to page {page}.' };
    const selector = `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`;
    const sink = document.querySelector<HTMLElement>(selector)!;

    expect(Boolean(sink), 'the region is mounted before the first result').to.be.true;
    expect(sink.parentElement === document.body).to.be.true;
    expect(sink.childElementCount).to.equal(0);

    await el.scrollToAnchor({ kind: 'page', page: 2 });
    await el.scrollToAnchor({ kind: 'page', page: 2 });
    expect(Array.from(sink.children, (child) => child.textContent)).to.deep.equal([
      'Jumped to page 2.',
      'Jumped to page 2.',
    ]);

    el.remove();
    expect(document.querySelector(selector) === null, 'the last holder removes the shared region').to.be.true;

    document.body.append(el);
    const reconnected = document.querySelector<HTMLElement>(selector)!;
    expect(Boolean(reconnected), 'reconnect acquires in the current owner document').to.be.true;
    expect(reconnected.childElementCount, 'reconnect does not replay the previous result').to.equal(0);
    el.remove();
  });

  it('keeps anchor-result announcements silent while the host is hidden', async () => {
    const el = await fixture<StubAnchorTarget>(litHtml`
      <lr-anchor-target-test-stub hidden></lr-anchor-target-test-stub>
    `);
    const sink = document.querySelector<HTMLElement>(
      `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
    )!;

    expect(await el.scrollToAnchor({ kind: 'page', page: 2 })).to.be.true;
    expect(sink.childElementCount).to.equal(0);
  });

  it('keeps anchor-result announcements silent behind inaccessible composed ancestors', async () => {
    const wrapper = await fixture<HTMLElement>(litHtml`
      <div><lr-anchor-target-test-stub></lr-anchor-target-test-stub></div>
    `);
    const el = wrapper.querySelector('lr-anchor-target-test-stub') as StubAnchorTarget;
    const sink = document.querySelector<HTMLElement>(
      `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
    )!;
    const scenarios: Array<[string, () => void, () => void]> = [
      [
        'inert',
        () => { wrapper.inert = true; },
        () => { wrapper.inert = false; },
      ],
      [
        'case-insensitive aria-hidden',
        () => { wrapper.setAttribute('aria-hidden', ' TRUE '); },
        () => { wrapper.removeAttribute('aria-hidden'); },
      ],
      [
        'display none',
        () => { wrapper.style.display = 'none'; },
        () => { wrapper.style.display = ''; },
      ],
      [
        'visibility hidden',
        () => { wrapper.style.visibility = 'hidden'; },
        () => { wrapper.style.visibility = ''; },
      ],
      [
        'visibility collapse',
        () => { wrapper.style.visibility = 'collapse'; },
        () => { wrapper.style.visibility = ''; },
      ],
      [
        'content visibility hidden',
        () => { wrapper.style.contentVisibility = 'hidden'; },
        () => { wrapper.style.contentVisibility = ''; },
      ],
    ];

    for (const [name, hide, restore] of scenarios) {
      hide();
      expect(await el.scrollToAnchor({ kind: 'page', page: 3 }), name).to.be.true;
      expect(sink.childElementCount, name).to.equal(0);
      restore();
    }
  });

  it('schedules and cancels retries in the adopted owner realm alongside its sink', async () => {
    const frame = document.createElement('iframe');
    const loaded = oneEvent(frame, 'load');
    frame.srcdoc = '<!doctype html><html><body></body></html>';
    document.body.append(frame);
    await loaded;

    const frameDocument = frame.contentDocument!;
    const frameWindow = frame.contentWindow!;
    const originalFrameSetTimeout = frameWindow.setTimeout;
    const originalFrameClearTimeout = frameWindow.clearTimeout;
    const originalParentSetTimeout = window.setTimeout;
    const originalParentClearTimeout = window.clearTimeout;
    let frameSchedules = 0;
    let frameCancels = 0;
    let parentSchedules = 0;
    let parentCancels = 0;

    frameWindow.setTimeout = ((_handler: TimerHandler, timeout?: number) => {
      if (timeout === 5000) frameSchedules += 1;
      return 81;
    }) as typeof frameWindow.setTimeout;
    frameWindow.clearTimeout = ((handle?: number) => {
      if (handle === 81) frameCancels += 1;
    }) as typeof frameWindow.clearTimeout;
    window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      if (timeout === 5000) parentSchedules += 1;
      return originalParentSetTimeout(handler, timeout, ...args);
    }) as typeof window.setTimeout;
    window.clearTimeout = ((handle?: number) => {
      if (handle !== undefined) parentCancels += 1;
      originalParentClearTimeout(handle);
    }) as typeof window.clearTimeout;

    let el: StubAnchorTarget | undefined;
    try {
      el = await fixture<StubAnchorTarget>(litHtml`
        <lr-anchor-target-test-stub apply-succeeds-after="9999"></lr-anchor-target-test-stub>
      `);
      el.remove();
      frameDocument.body.append(frameDocument.adoptNode(el));
      (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5000;
      (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 10000;

      expect(
        frameDocument.querySelector(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`) !== null,
      ).to.be.true;
      expect(document.querySelector(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`) === null).to.be
        .true;

      const pending = el.scrollToAnchor({ kind: 'page', page: 1 });
      await waitUntil(() => frameSchedules + parentSchedules > 0, 'a retry should be scheduled');
      expect(frameSchedules).to.equal(1);
      expect(parentSchedules).to.equal(0);

      el.remove();
      expect(frameCancels).to.equal(1);
      expect(parentCancels).to.equal(0);
      expect(await pending).to.be.false;
      expect(
        frameDocument.querySelector(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`) === null,
      ).to.be.true;
    } finally {
      el?.remove();
      frameWindow.setTimeout = originalFrameSetTimeout;
      frameWindow.clearTimeout = originalFrameClearTimeout;
      window.setTimeout = originalParentSetTimeout;
      window.clearTimeout = originalParentClearTimeout;
      frame.remove();
    }
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
    const restoreSelection = installComposedSelection(range, el.shadowRoot!);
    try {
      const eventPromise = oneEvent(el, 'lr-text-select');
      content.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      const detail = (await eventPromise).detail;
      expect(detail.text).to.equal('stub content for selection tests');
      expect(detail.anchor).to.exist;
      expect(detail.anchor!.kind).to.equal('text-quote');
      expect(detail.rects).to.be.an('array');
      expect(Object.isFrozen(detail)).to.be.true;
      expect(Object.isFrozen(detail.anchor)).to.be.true;
      expect(Object.isFrozen(detail.rects)).to.be.true;
    } finally {
      restoreSelection();
    }
  });

  it('bindTextSelection reports a null anchor when computeSelectionAnchor declines', async () => {
    const el = await fixture<DecliningStubAnchorTarget>(litHtml`
      <lr-anchor-target-test-declining></lr-anchor-target-test-declining>
    `);
    const content = el.shadowRoot!.querySelector('[part="content"]')!;
    (el as unknown as { bindTextSelection: (root: Element) => void }).bindTextSelection(content);

    const range = document.createRange();
    range.selectNodeContents(content.firstChild!);
    const restoreSelection = installComposedSelection(range, el.shadowRoot!);
    try {
      const eventPromise = oneEvent(el, 'lr-text-select');
      content.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      expect((await eventPromise).detail.anchor).to.be.null;
    } finally {
      restoreSelection();
    }
  });

  it('is accessible', async () => {
    const el = await fixture<StubAnchorTarget>(litHtml`<lr-anchor-target-test-stub></lr-anchor-target-test-stub>`);
    await expect(el).to.be.accessible();
  });
});
