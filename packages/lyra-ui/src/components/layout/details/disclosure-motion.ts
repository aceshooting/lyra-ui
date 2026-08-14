import type { ReactiveElement } from 'lit';
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
