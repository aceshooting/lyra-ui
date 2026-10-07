import type { ReactiveElement } from 'lit';
import { composedParentElement, deepActiveElementIn } from '../../../internal/active-element.js';
import { setCustomState } from '../../../internal/custom-states.js';

/** Private rendered-motion coordinator shared by Details and Accordion Item. */
export class DisclosureMotionController {
  private generation = 0;

  constructor(
    private readonly host: ReactiveElement & HTMLElement,
    private readonly internals: ElementInternals,
    private readonly root: () => ParentNode,
    private readonly animatedPartSelector: string,
  ) {}

  cancel(): void {
    this.generation += 1;
    setCustomState(this.internals, 'animating', false);
  }

  /** Moves focus to `trigger` when it sits inside `region`, which a collapse is about to hide. */
  repairFocus(region: Element | null, trigger: HTMLElement | null): void {
    for (let node = deepActiveElementIn(this.host.ownerDocument); node && region; node = composedParentElement(node)) {
      if (node !== region) continue;
      trigger?.focus({ preventScroll: true });
      return;
    }
  }

  async settle(afterRender?: () => void): Promise<boolean> {
    const generation = ++this.generation;
    setCustomState(this.internals, 'animating', true);
    try {
      await this.host.updateComplete;
      if (this.generation !== generation) return false;
      afterRender?.();
      if (this.host.isConnected) {
        const view = this.host.ownerDocument.defaultView;
        if (view) await new Promise<void>((resolve) => view.requestAnimationFrame(() => resolve()));
        if (this.generation !== generation) return false;
        const base = this.root().querySelector(this.animatedPartSelector);
        const animations = base?.getAnimations({ subtree: true }) ?? [];
        await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
        if (this.generation !== generation) return false;
      }
      return true;
    } finally {
      if (this.generation === generation) setCustomState(this.internals, 'animating', false);
    }
  }
}
