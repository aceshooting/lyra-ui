import { expect, waitUntil } from '@open-wc/testing';

/** Shrinks `DocumentAnchorTarget`'s retry loop so a permanently-unresolvable `scrollToAnchor()` call
 *  resolves in milliseconds instead of waiting out the real 5s default timeout. */
export function shrinkAnchorRetry(el: HTMLElement): void {
  (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
  (
    el as unknown as { anchorRetryIntervalMs: number }
  ).anchorRetryIntervalMs = 5;
}

export async function assertScrollFrameFollowsAdoption(
  el: HTMLElement & { updateComplete: Promise<unknown> },
  scrollColumnIntoView: () => Promise<void>
): Promise<void> {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameWindow = frame.contentWindow;
  const frameDocument = frame.contentDocument;
  if (!frameWindow || !frameDocument) {
    frame.remove();
    throw new Error('The iframe realm was unavailable.');
  }

  const originalRequest = window.requestAnimationFrame;
  const originalCancel = window.cancelAnimationFrame;
  const originalFrameRequest = frameWindow.requestAnimationFrame;
  const originalFrameCancel = frameWindow.cancelAnimationFrame;
  const originalMatchMedia = window.matchMedia;
  const originalFrameMatchMedia = frameWindow.matchMedia;
  const renderRoot = el.shadowRoot!;
  const originalQuerySelector = renderRoot.querySelector.bind(renderRoot);
  const queued = new Map<number, FrameRequestCallback>();
  const cancelled: number[] = [];
  const scrollBehaviors: ScrollBehavior[] = [];
  let nextHandle = 0;
  let topRequests = 0;
  let frameRequests = 0;
  let topMotionQueries = 0;
  let frameMotionQueries = 0;

  const target = {
    scrollIntoView: (options: ScrollIntoViewOptions) => {
      if (options.behavior) scrollBehaviors.push(options.behavior);
    },
  };
  const row = { querySelectorAll: () => [target, target] };
  const list = {
    updateComplete: Promise.resolve(),
    shadowRoot: { querySelector: () => row },
  };
  renderRoot.querySelector = ((selector: string) =>
    selector.startsWith('lr-virtual-list')
      ? list
      : originalQuerySelector(selector)) as typeof renderRoot.querySelector;
  window.matchMedia = (() => {
    topMotionQueries++;
    return { matches: false } as MediaQueryList;
  }) as typeof window.matchMedia;
  frameWindow.matchMedia = (() => {
    frameMotionQueries++;
    return { matches: true } as MediaQueryList;
  }) as typeof frameWindow.matchMedia;

  window.requestAnimationFrame = ((callback: FrameRequestCallback): number => {
    topRequests++;
    const handle = ++nextHandle;
    queued.set(handle, callback);
    return handle;
  }) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = ((handle: number): void => {
    cancelled.push(handle);
    queued.delete(handle);
  }) as typeof window.cancelAnimationFrame;
  frameWindow.requestAnimationFrame = ((
    callback: FrameRequestCallback
  ): number => {
    frameRequests++;
    const handle = ++nextHandle;
    queueMicrotask(() => callback(0));
    return handle;
  }) as typeof frameWindow.requestAnimationFrame;
  frameWindow.cancelAnimationFrame =
    (() => {}) as typeof frameWindow.cancelAnimationFrame;

  try {
    const staleScroll = scrollColumnIntoView();
    await waitUntil(() => topRequests === 1);
    frameDocument.body.append(el);
    await el.updateComplete;
    for (const [handle, callback] of [...queued]) {
      queued.delete(handle);
      callback(0);
    }
    await staleScroll;

    const currentScroll = scrollColumnIntoView();
    await waitUntil(() => frameRequests === 1 || topRequests === 2);
    for (const [handle, callback] of [...queued]) {
      queued.delete(handle);
      callback(0);
    }
    await currentScroll;

    expect(el.ownerDocument === frameDocument).to.be.true;
    expect(topRequests).to.equal(1);
    expect(cancelled).to.deep.equal([1]);
    expect(frameRequests).to.equal(1);
    expect(topMotionQueries).to.equal(0);
    expect(frameMotionQueries).to.equal(1);
    expect(scrollBehaviors).to.deep.equal(['auto']);
  } finally {
    window.requestAnimationFrame = originalRequest;
    window.cancelAnimationFrame = originalCancel;
    frameWindow.requestAnimationFrame = originalFrameRequest;
    frameWindow.cancelAnimationFrame = originalFrameCancel;
    window.matchMedia = originalMatchMedia;
    frameWindow.matchMedia = originalFrameMatchMedia;
    renderRoot.querySelector =
      originalQuerySelector as typeof renderRoot.querySelector;
    frame.remove();
  }
}
