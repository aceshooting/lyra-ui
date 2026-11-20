import { nothing } from 'lit';
import { AsyncDirective, directive, PartType, type ElementPart, type PartInfo } from 'lit/async-directive.js';
import { makeScrollRegionFocusable, type ScrollRegionHandle } from './scroll-region.js';

/** What `scrollRegion()` passes to `makeScrollRegionFocusable()`. */
export interface ScrollRegionDirectiveOptions {
  /** Region label added while the element overflows. */
  name?: string | undefined;
  /** `false` keeps the element's own role instead of adding `role="region"`. */
  role?: boolean;
}

class ScrollRegionDirective extends AsyncDirective {
  private el: HTMLElement | undefined;
  private handle: ScrollRegionHandle | undefined;
  private name: string | undefined;
  private role = true;

  constructor(part: PartInfo) {
    super(part);
    if (part.type !== PartType.ELEMENT) throw new Error('scrollRegion() belongs on an element');
  }

  render(_options: ScrollRegionDirectiveOptions = {}): typeof nothing {
    return nothing;
  }

  override update(part: ElementPart, [options = {}]: [ScrollRegionDirectiveOptions?]): typeof nothing {
    const role = options.role !== false;
    if (part.element !== this.el || options.name !== this.name || role !== this.role) {
      this.release();
      this.el = part.element as HTMLElement;
      this.name = options.name;
      this.role = role;
    }
    // The element's own content commits after this part, so measure once the render is done.
    queueMicrotask(() => this.attach());
    return nothing;
  }

  protected override disconnected(): void {
    this.release();
  }

  protected override reconnected(): void {
    this.attach();
  }

  private attach(): void {
    const el = this.el;
    if (!el?.isConnected || !this.isConnected) return;
    if (this.handle) this.handle.refresh();
    else this.handle = makeScrollRegionFocusable(el, this.name, { role: this.role });
  }

  private release(): void {
    this.handle?.();
    this.handle = undefined;
  }
}

/**
 * Element directive form of `makeScrollRegionFocusable()`, for a scroll body rendered where a
 * host-level `ScrollRegionController` cannot reach it, such as a row template another element
 * (`<lr-virtual-list>`) renders into its own shadow root. The element is a tab stop only while it
 * overflows, re-measured after each render of the template; disconnecting the part releases it.
 */
export const scrollRegion = directive(ScrollRegionDirective);
