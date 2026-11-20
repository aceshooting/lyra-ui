import { expect, waitUntil } from '@open-wc/testing';
import '../../lr-map.js';
import { ScriptedOverlayMap, originalGetContext, liveScriptedMap } from '../../../../test/map-scripted-engine.js';

const OriginalIntersectionObserver = window.IntersectionObserver;

describe('lr-map same-task DOM move', () => {
  beforeEach(() => {
    ScriptedOverlayMap.instances = [];
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      writable: true,
      value(this: HTMLCanvasElement, contextId: string, ...rest: unknown[]) {
        if (contextId === 'webgl2') return {};
        return originalGetContext.call(this, contextId as never, ...(rest as []));
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, writable: true, value: OriginalIntersectionObserver });
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, writable: true, value: originalGetContext });
  });

  it('keeps the native map across a same-task move and rebuilds it after a real disconnect', async () => {
    const { el, engine } = await liveScriptedMap();
    const wrapper = el.parentElement!;
    const sibling = wrapper.appendChild(document.createElement('section'));
    const moves: Array<() => void> = [() => { el.remove(); sibling.append(el); }];
    const moveBefore = (wrapper as unknown as { moveBefore?: (node: Node, child: Node | null) => void }).moveBefore;
    if (typeof moveBefore === 'function') moves.push(() => moveBefore.call(wrapper, el, sibling));
    for (const move of moves) {
      move();
      await el.updateComplete;
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(el.map === (engine as unknown), 'a same-task move keeps the native map').to.equal(true);
      expect(ScriptedOverlayMap.instances.length).to.equal(1);
    }
    el.remove();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(el.map == null, 'a real disconnect disposes the native map').to.equal(true);
    wrapper.append(el);
    await waitUntil(() => el.map != null && el.map !== (engine as unknown), 'reconnecting builds a new native map', { timeout: 2000 });
  });
});
