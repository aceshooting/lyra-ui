import {
  fixture,
  expect,
  html,
  waitUntil,
  aTimeout,
  oneEvent,
} from '@open-wc/testing';
import { select } from 'd3-selection';
import '../src/components/retrieval/graph/graph.js';
import {
  LyraGraph as LyraGraphElement,
  type LyraGraphEdge,
  type LyraGraphNode,
  type LyraGraphNodeLabelsMode,
} from '../src/components/retrieval/graph/graph.js';
import type {
  D3SimulationLinkDatum,
  D3SimulationNodeDatum,
} from '../src/components/retrieval/graph/graph-loader.js';
import { layeredLayout } from '../src/internal/layered-layout.js';
import { invalidateLyraTheme } from '../src/internal/theme-watcher.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../src/internal/announcer.js';
import { resetMouse, sendMouse } from './wtr-mouse.js';

export type GraphSimulationNode = LyraGraphNode & D3SimulationNodeDatum;
export type GraphSimulationLink = Omit<LyraGraphEdge, 'source' | 'target'> &
  D3SimulationLinkDatum<GraphSimulationNode> & { dangling?: boolean };

/** The graph simulation is intentionally private production state. These tests exercise its
 *  coordinate continuity and hit-testing contracts through one exact, test-only structural seam
 *  instead of weakening the component's encapsulation. */
export type LyraGraph = Pick<LyraGraphElement, keyof LyraGraphElement> & {
  simNodes: GraphSimulationNode[];
  simLinks: GraphSimulationLink[];
};

export function asTestGraph(element: LyraGraphElement): LyraGraph {
  return element as unknown as LyraGraph;
}

export function mediaQueryOverride(
  ownerWindow: Window,
  matches: (query: string) => boolean
): typeof window.matchMedia {
  const originalMatchMedia = ownerWindow.matchMedia;
  return (query: string) => {
    const nativeQuery = originalMatchMedia.call(ownerWindow, query);
    return new Proxy(nativeQuery, {
      get(target, property) {
        if (property === 'matches') return matches(query);
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  };
}

export const nodes = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
];
export const links = [{ source: 'a', target: 'b' }];

export function announcementSink(
  doc: Document = document,
  politeness: 'polite' | 'assertive' = 'polite'
): HTMLElement | null {
  return doc.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="${politeness}"]`
  );
}

export function announcementTexts(
  doc: Document = document,
  politeness: 'polite' | 'assertive' = 'polite'
): string[] {
  const sink = announcementSink(doc, politeness);
  return sink
    ? Array.from(sink.children).map((child) => child.textContent ?? '')
    : [];
}

export function stubPointerCapture(canvas: HTMLCanvasElement): {
  captured: Set<number>;
  restore(): void;
} {
  const setDescriptor = Object.getOwnPropertyDescriptor(
    canvas,
    'setPointerCapture'
  );
  const releaseDescriptor = Object.getOwnPropertyDescriptor(
    canvas,
    'releasePointerCapture'
  );
  const captured = new Set<number>();
  Object.defineProperty(canvas, 'setPointerCapture', {
    configurable: true,
    value: (pointerId: number) => captured.add(pointerId),
  });
  Object.defineProperty(canvas, 'releasePointerCapture', {
    configurable: true,
    value: (pointerId: number) => captured.delete(pointerId),
  });
  return {
    captured,
    restore() {
      if (setDescriptor)
        Object.defineProperty(canvas, 'setPointerCapture', setDescriptor);
      else
        delete (canvas as unknown as { setPointerCapture?: unknown })
          .setPointerCapture;
      if (releaseDescriptor)
        Object.defineProperty(
          canvas,
          'releasePointerCapture',
          releaseDescriptor
        );
      else
        delete (canvas as unknown as { releasePointerCapture?: unknown })
          .releasePointerCapture;
    },
  };
}

/** Shadows `ownerDocument` with a Proxy that forwards everything to the real document except
 *  `defaultView` (forced to `null`), so `this.ownerWindow` (`this.ownerDocument.defaultView ??
 *  undefined`) resolves to `undefined` without touching anything else the component still
 *  legitimately needs from its real owner document. */
export function stubNoOwnerWindow(el: LyraGraph): () => void {
  const real = el.ownerDocument;
  const fake = new Proxy(real, {
    get(target, prop, _receiver) {
      if (prop === 'defaultView') return null;
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function'
        ? (value as (...args: unknown[]) => unknown).bind(target)
        : value;
    },
  });
  Object.defineProperty(el, 'ownerDocument', {
    configurable: true,
    value: fake,
  });
  return () => {
    Reflect.deleteProperty(el, 'ownerDocument');
  };
}
// d3-force's internal timer runs on requestAnimationFrame, which Chromium
// throttles heavily on backgrounded tabs when many test files run
// concurrently — give it generous headroom so the full suite isn't flaky.
export const NODE_COUNT_TIMEOUT = 5000;
// forceSimulation()'s *default* alphaDecay/alphaMin (unconfigured here, so
// this is the real production default) needs ~300 ticks to decay from
// alpha=1 to alphaMin — at rAF's nominal ~16.7ms/tick that's already ~5000ms
// with zero slack, so waiting for a full settle (as opposed to just the
// first paint NODE_COUNT_TIMEOUT above covers) needs its own, larger budget
// or it fails on every run, not just loaded ones.
export const ALPHA_SETTLE_TIMEOUT = 15_000;

export async function waitForCanvasBackingStore(
  canvas: HTMLCanvasElement
): Promise<void> {
  const dpr = canvas.ownerDocument.defaultView?.devicePixelRatio || 1;
  await waitUntil(
    () =>
      canvas.width === Math.round(canvas.clientWidth * dpr) &&
      canvas.height === Math.round(canvas.clientHeight * dpr),
    'canvas backing store did not finish sizing for pointer hit-testing',
    { timeout: NODE_COUNT_TIMEOUT }
  );
}

export interface FakeIntersectionObserverInstance {
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
  disconnected: boolean;
}

/** Stubs the global `IntersectionObserver` with a fully fake, manually-driven implementation so
 *  the canvas visibility-gating tests control exactly when (and whether) intersection is
 *  reported -- the same spy-the-observer-constructor technique `animation.test.ts`/`map.test.ts`
 *  use, since a real IntersectionObserver reports an on-screen fixture as intersecting almost
 *  immediately in the headless test page, making these scenarios impossible to reproduce
 *  deterministically. Duplicated locally rather than shared, matching those same two files'
 *  own per-file copy of this exact helper. */
export function stubIntersectionObserver() {
  const original = window.IntersectionObserver;
  const observedTargets: Element[] = [];
  const instances: FakeIntersectionObserverInstance[] = [];
  class FakeIntersectionObserver implements FakeIntersectionObserverInstance {
    callback: IntersectionObserverCallback;
    options?: IntersectionObserverInit;
    disconnected = false;
    constructor(
      callback: IntersectionObserverCallback,
      options?: IntersectionObserverInit
    ) {
      this.callback = callback;
      this.options = options;
      instances.push(this);
    }
    observe(target: Element): void {
      observedTargets.push(target);
    }
    unobserve(): void {}
    disconnect(): void {
      this.disconnected = true;
    }
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  (
    window as unknown as { IntersectionObserver: typeof IntersectionObserver }
  ).IntersectionObserver =
    FakeIntersectionObserver as unknown as typeof IntersectionObserver;
  return {
    instances,
    observedTargets,
    restore(): void {
      (
        window as unknown as {
          IntersectionObserver: typeof IntersectionObserver;
        }
      ).IntersectionObserver = original;
    },
  };
}

export { fixture, expect, html, waitUntil, aTimeout, oneEvent, select, LyraGraphElement, layeredLayout, invalidateLyraTheme, ANNOUNCEMENT_SINK_ATTRIBUTE, resetMouse, sendMouse };
export type { LyraGraphEdge, LyraGraphNode, LyraGraphNodeLabelsMode, D3SimulationLinkDatum, D3SimulationNodeDatum };
