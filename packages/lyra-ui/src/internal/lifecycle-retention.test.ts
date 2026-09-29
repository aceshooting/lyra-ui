import { expect } from '@open-wc/testing';
import { acquireAnnouncementSink } from './announcer.js';
import { activateOverlay } from './overlay-manager.js';
import { RenderedStateController } from './rendered-state.js';

interface ObserverCounters {
  readonly activeTargets: number;
  readonly activeObservers: number;
  readonly documentRootTargets: number;
  readonly otherTargets: number;
}

function captureDescriptor(target: object, key: PropertyKey): PropertyDescriptor | undefined {
  return Object.getOwnPropertyDescriptor(target, key);
}

function restoreDescriptor(
  target: object,
  key: PropertyKey,
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) Object.defineProperty(target, key, descriptor);
  else Reflect.deleteProperty(target, key);
}

function captureLifecycleResources(doc: Document): {
  keydownListeners: () => number;
  mutation: () => ObserverCounters;
  resize: () => ObserverCounters;
  restore: () => void;
} {
  const view = doc.defaultView;
  if (!view?.MutationObserver || !view.ResizeObserver) {
    throw new Error('This test requires native MutationObserver and ResizeObserver support');
  }

  const addDescriptor = captureDescriptor(doc, 'addEventListener');
  const removeDescriptor = captureDescriptor(doc, 'removeEventListener');
  const mutationDescriptor = captureDescriptor(view, 'MutationObserver');
  const resizeDescriptor = captureDescriptor(view, 'ResizeObserver');
  const nativeAdd = doc.addEventListener;
  const nativeRemove = doc.removeEventListener;
  const NativeMutationObserver = view.MutationObserver;
  const NativeResizeObserver = view.ResizeObserver;

  const listeners = new Map<EventListenerOrEventListenerObject, Set<boolean>>();
  const mutationTargets = new Map<object, Set<Node>>();
  const resizeTargets = new Map<object, Set<Element>>();

  Object.defineProperty(doc, 'addEventListener', {
    configurable: true,
    value(type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) {
      if (callback === null) return;
      nativeAdd.call(doc, type, callback, options);
      if (type !== 'keydown') return;
      const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
      // DOM listener identity is the type, callback and capture flag. Re-adding an existing
      // identity with different passive/once options does not create a second registration.
      let captures = listeners.get(callback);
      if (!captures) {
        captures = new Set();
        listeners.set(callback, captures);
      }
      captures.add(capture);
    },
  });
  Object.defineProperty(doc, 'removeEventListener', {
    configurable: true,
    value(type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) {
      if (callback === null) return;
      nativeRemove.call(doc, type, callback, options);
      if (type !== 'keydown') return;
      const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
      const captures = listeners.get(callback);
      captures?.delete(capture);
      if (captures?.size === 0) listeners.delete(callback);
    },
  });

  class CountingMutationObserver implements MutationObserver {
    private readonly native: MutationObserver;
    private readonly targets = new Set<Node>();

    constructor(callback: MutationCallback) {
      this.native = new NativeMutationObserver(callback);
      mutationTargets.set(this, this.targets);
    }

    disconnect(): void {
      this.native.disconnect();
      this.targets.clear();
      mutationTargets.delete(this);
    }

    observe(target: Node, options?: MutationObserverInit): void {
      this.native.observe(target, options);
      this.targets.add(target);
      mutationTargets.set(this, this.targets);
    }

    takeRecords(): MutationRecord[] {
      return this.native.takeRecords();
    }
  }

  class CountingResizeObserver implements ResizeObserver {
    private readonly native: ResizeObserver;
    private readonly targets = new Set<Element>();

    constructor(callback: ResizeObserverCallback) {
      this.native = new NativeResizeObserver(callback);
      resizeTargets.set(this, this.targets);
    }

    disconnect(): void {
      this.native.disconnect();
      this.targets.clear();
      resizeTargets.delete(this);
    }

    observe(target: Element, options?: ResizeObserverOptions): void {
      this.native.observe(target, options);
      this.targets.add(target);
      resizeTargets.set(this, this.targets);
    }

    unobserve(target: Element): void {
      this.native.unobserve(target);
      this.targets.delete(target);
      if (this.targets.size === 0) resizeTargets.delete(this);
    }
  }

  Object.defineProperty(view, 'MutationObserver', {
    configurable: true,
    writable: true,
    value: CountingMutationObserver,
  });
  Object.defineProperty(view, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: CountingResizeObserver,
  });

  const counter = (observations: Map<object, Set<Node | Element>>): ObserverCounters => {
    let activeObservers = 0;
    let activeTargets = 0;
    let documentRootTargets = 0;
    let otherTargets = 0;
    for (const targets of observations.values()) {
      if (targets.size === 0) continue;
      activeObservers += 1;
      activeTargets += targets.size;
      for (const target of targets) {
        if (target === doc.documentElement) documentRootTargets += 1;
        else otherTargets += 1;
      }
    }
    return { activeObservers, activeTargets, documentRootTargets, otherTargets };
  };

  return {
    keydownListeners: () => [...listeners.values()].reduce((count, captures) => count + captures.size, 0),
    mutation: () => counter(mutationTargets as Map<object, Set<Node | Element>>),
    resize: () => counter(resizeTargets as Map<object, Set<Node | Element>>),
    restore: () => {
      restoreDescriptor(doc, 'addEventListener', addDescriptor);
      restoreDescriptor(doc, 'removeEventListener', removeDescriptor);
      restoreDescriptor(view, 'MutationObserver', mutationDescriptor);
      restoreDescriptor(view, 'ResizeObserver', resizeDescriptor);
    },
  };
}

function makeVisibleElement(doc: Document, label: string): HTMLDivElement {
  const element = doc.createElement('div');
  element.dataset['lifecycleRetention'] = label;
  element.style.display = 'block';
  element.style.inlineSize = '40px';
  element.style.blockSize = '20px';
  return element;
}

it('releases shared overlay, announcement, and resize resources after repeated lifecycles', () => {
  const frame = document.createElement('iframe');
  frame.title = 'Isolated lifecycle resource accounting';
  frame.style.cssText = 'position:fixed;width:640px;height:480px;left:-10000px;top:0;border:0;';
  document.body.append(frame);

  const doc = frame.contentDocument;
  if (!doc?.body) {
    frame.remove();
    throw new Error('Could not create the isolated lifecycle test document');
  }

  const controllers: RenderedStateController[] = [];
  const overlays: ReturnType<typeof activateOverlay>[] = [];
  const sinks: ReturnType<typeof acquireAnnouncementSink>[] = [];
  const hosts: HTMLElement[] = [];

  const cleanup = (): void => {
    for (const controller of controllers.splice(0)) controller.stop();
    for (const overlay of overlays.splice(0)) overlay.deactivate({ restoreFocus: false });
    for (const sink of sinks.splice(0)) sink.release();
    for (const host of hosts.splice(0)) host.remove();
  };

  let restoreResources: () => void = () => undefined;
  try {
    const resources = captureLifecycleResources(doc);
    restoreResources = resources.restore;
    // One complete pass warms the per-document singleton owners. Every later pass must return to
    // the same empty baseline instead of accumulating live listeners, observers, or sink nodes.
    for (let cycle = 0; cycle < 10; cycle += 1) {
      let escaped = 0;
      const targets: HTMLElement[] = [];
      const renderedChanges: boolean[][] = [];
      for (let index = 0; index < 2; index += 1) {
        const host = makeVisibleElement(doc, `host-${cycle}-${index}`);
        const panel = makeVisibleElement(doc, `panel-${cycle}-${index}`);
        panel.setAttribute('role', 'dialog');
        panel.tabIndex = -1;
        host.append(panel);
        doc.body.append(host);
        hosts.push(host);
        overlays.push(activateOverlay({
          host,
          panel: () => panel,
          onEscape: () => { escaped += 1; },
          modal: true,
          trapFocus: false,
        }));

        const target = makeVisibleElement(doc, `resize-target-${cycle}-${index}`);
        host.append(target);
        targets.push(target);
        const changes: boolean[] = [];
        renderedChanges.push(changes);
        const controller = new RenderedStateController(host, target, (rendered) => changes.push(rendered));
        controllers.push(controller);
        controller.start();
      }

      const firstSink = acquireAnnouncementSink('polite', { document: doc });
      const secondSink = acquireAnnouncementSink('polite', { document: doc });
      sinks.push(firstSink, secondSink);
      expect(firstSink.element).to.equal(secondSink.element);
      firstSink.announce(`Lifecycle cycle ${cycle}`);
      expect(firstSink.element.textContent).to.contain(`Lifecycle cycle ${cycle}`);

      expect(resources.keydownListeners()).to.equal(1);
      // The modal manager and shared rendered-state hub each observe documentElement. Each
      // overlay also owns a style-property lease observer on its host, for four live observer
      // registrations overall. The two rendered-state controllers own two ResizeObservers.
      expect(resources.mutation()).to.deep.equal({
        activeObservers: 4,
        activeTargets: 4,
        documentRootTargets: 2,
        otherTargets: 2,
      });
      expect(resources.resize()).to.deep.equal({
        activeObservers: 2,
        activeTargets: 2,
        documentRootTargets: 0,
        otherTargets: 2,
      });
      expect(doc.querySelectorAll('[data-lr-live-region="polite"]')).to.have.length(1);

      doc.dispatchEvent(new frame.contentWindow!.KeyboardEvent('keydown', {
        bubbles: true,
        key: 'Escape',
      }));
      expect(escaped).to.equal(1);

      // Exercise an actual rendered-state transition, then restore the visible target before
      // teardown so observer ownership is still asserted while both watches are active.
      targets[0]!.style.display = 'none';
      controllers[0]!.check();
      targets[0]!.style.display = 'block';
      controllers[0]!.check();
      expect(renderedChanges[0]).to.deep.equal([true, false, true]);

      cleanup();
      expect(resources.keydownListeners()).to.equal(0);
      expect(resources.mutation()).to.deep.equal({
        activeObservers: 0,
        activeTargets: 0,
        documentRootTargets: 0,
        otherTargets: 0,
      });
      expect(resources.resize()).to.deep.equal({
        activeObservers: 0,
        activeTargets: 0,
        documentRootTargets: 0,
        otherTargets: 0,
      });
      expect(doc.querySelectorAll('[data-lr-live-region="polite"]')).to.have.length(0);
    }
  } finally {
    cleanup();
    restoreResources();
    frame.remove();
  }
});
