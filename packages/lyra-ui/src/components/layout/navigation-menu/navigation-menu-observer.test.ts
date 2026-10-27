import { expect, fixture, html } from '@open-wc/testing';
import type { LyraNavigationMenu } from './navigation-menu.class.js';
import './navigation-menu.js';

class ControlledResizeObserver implements ResizeObserver {
  readonly observedTargets = new Set<Element>();
  disconnected = false;

  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element): void {
    this.observedTargets.add(target);
    this.disconnected = false;
  }

  unobserve(target: Element): void {
    this.observedTargets.delete(target);
  }

  disconnect(): void {
    // Keep the historical target identity so the fixture can deliver a callback that was queued
    // before disconnection, independently of the replacement observer's current subscriptions.
    this.disconnected = true;
  }

  deliver(target: Element, inlineSize: number): void {
    const box: ResizeObserverSize = { inlineSize, blockSize: 32 };
    const entry: ResizeObserverEntry = {
      target,
      contentRect: new DOMRectReadOnly(0, 0, inlineSize, box.blockSize),
      contentBoxSize: [box],
      borderBoxSize: [box],
      devicePixelContentBoxSize: [box],
    };
    this.callback([entry], this);
  }
}

function controlObservers(view: Window): {
  observers: ControlledResizeObserver[];
  restore(): void;
} {
  const original = Object.getOwnPropertyDescriptor(view, 'ResizeObserver');
  const observers: ControlledResizeObserver[] = [];
  class OwnerResizeObserver extends ControlledResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      super(callback);
      observers.push(this);
    }
  }
  Object.defineProperty(view, 'ResizeObserver', { configurable: true, value: OwnerResizeObserver });
  return {
    observers,
    restore() {
      if (original) Object.defineProperty(view, 'ResizeObserver', original);
      else Reflect.deleteProperty(view, 'ResizeObserver');
    },
  };
}

function menuObserver(observers: readonly ControlledResizeObserver[], menu: LyraNavigationMenu): ControlledResizeObserver {
  const observer = [...observers].reverse().find((candidate) => candidate.observedTargets.has(menu));
  if (!observer) throw new Error('The menu did not observe its allocation.');
  return observer;
}

async function settleAllocation(menu: LyraNavigationMenu): Promise<void> {
  const view = menu.ownerDocument.defaultView;
  if (!view) throw new Error('The connected menu has no owner window.');
  await new Promise<void>((resolve) => view.requestAnimationFrame(() => resolve()));
  await menu.updateComplete;
  await new Promise<void>((resolve) => view.requestAnimationFrame(() => resolve()));
  await menu.updateComplete;
}

function expectAllocation(menu: LyraNavigationMenu, collapsed: boolean): void {
  expect(menu.collapsed, 'the current allocation controls the menu layout').to.equal(collapsed);
  expect(menu.shadowRoot!.querySelectorAll('[part="toggle"]').length, 'the rendered layout matches allocation')
    .to.equal(collapsed ? 1 : 0);
}

describe('lr-navigation-menu observer ownership', () => {
  it('ignores retired allocation deliveries after reconnect while the current observer still works', async () => {
    const controlled = controlObservers(window);
    let menu: LyraNavigationMenu | undefined;
    try {
      const wrapper = await fixture<HTMLDivElement>(html`
        <div style="inline-size: 800px"><lr-navigation-menu mobile-breakpoint="400px">
          <lr-navigation-menu-item href="#docs">Documentation</lr-navigation-menu-item>
        </lr-navigation-menu></div>
      `);
      menu = wrapper.querySelector<LyraNavigationMenu>('lr-navigation-menu')!;
      const retired = menuObserver(controlled.observers, menu);
      retired.deliver(menu, 800);
      await settleAllocation(menu);
      expectAllocation(menu, false);

      menu.remove();
      expect(retired.disconnected).to.equal(true);
      wrapper.append(menu);
      await menu.updateComplete;
      const current = menuObserver(controlled.observers, menu);
      expect(current !== retired, 'reconnect creates a new observer').to.equal(true);
      current.deliver(menu, 800);
      await settleAllocation(menu);

      retired.deliver(menu, 200);
      await settleAllocation(menu);
      expectAllocation(menu, false);

      current.deliver(menu, 200);
      await settleAllocation(menu);
      expectAllocation(menu, true);
      current.deliver(menu, 800);
      await settleAllocation(menu);
      expectAllocation(menu, false);
    } finally {
      menu?.remove();
      controlled.restore();
    }
  });

  it('ignores allocation deliveries from the previous owner document after adoption', async () => {
    const source = controlObservers(window);
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const destinationDocument = frame.contentDocument;
    const destinationView = frame.contentWindow;
    if (!destinationDocument || !destinationView) {
      source.restore();
      frame.remove();
      throw new Error('The destination document was unavailable.');
    }
    const destination = controlObservers(destinationView);
    let menu: LyraNavigationMenu | undefined;
    try {
      menu = await fixture<LyraNavigationMenu>(html`
        <lr-navigation-menu mobile-breakpoint="400px">
          <lr-navigation-menu-item href="#docs">Documentation</lr-navigation-menu-item>
        </lr-navigation-menu>
      `);
      const retired = menuObserver(source.observers, menu);
      retired.deliver(menu, 200);
      await settleAllocation(menu);
      expectAllocation(menu, true);

      destinationDocument.body.append(destinationDocument.adoptNode(menu));
      await menu.updateComplete;
      expect(retired.disconnected).to.equal(true);
      const current = menuObserver(destination.observers, menu);
      current.deliver(menu, 800);
      await settleAllocation(menu);
      expectAllocation(menu, false);

      retired.deliver(menu, 200);
      await settleAllocation(menu);
      expectAllocation(menu, false);

      current.deliver(menu, 200);
      await settleAllocation(menu);
      expectAllocation(menu, true);
    } finally {
      menu?.remove();
      destination.restore();
      source.restore();
      frame.remove();
    }
  });
});
