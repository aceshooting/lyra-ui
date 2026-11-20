import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { shadowFocusTarget } from './active-element.js';
import { resolveCssTokenLength } from './css-token-length.js';
import { applyComposedFocusRepair, captureComposedFocusRepair } from './focus-navigation.js';
import { OwnedResizeObserver } from './owned-observer.js';
import { OwnedFrame } from './owned-timer.js';

/** A region rectangle in percentages of its frame. */
export interface RegionRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Tests for intersecting hit areas belonging to different highlights. Each hit area is centred
 *  on its rectangle and at least `min` pixels in each dimension. */
export function highlightHitAreasOverlap(
  rectsByItem: readonly (readonly RegionRect[])[],
  { width, height }: Pick<DOMRectReadOnly, 'width' | 'height'>,
  min: number,
): boolean {
  const boxes = rectsByItem.flatMap((rects, index) => rects.map((rect) => {
    const boxWidth = Math.max((rect.width / 100) * width, min);
    const boxHeight = Math.max((rect.height / 100) * height, min);
    const left = ((rect.x + rect.width / 2) / 100) * width - boxWidth / 2;
    const top = ((rect.y + rect.height / 2) / 100) * height - boxHeight / 2;
    return { index, left, top, right: left + boxWidth, bottom: top + boxHeight };
  })).sort((first, second) => first.left - second.left);
  for (let first = 0; first < boxes.length; first++) {
    const a = boxes[first]!;
    for (let second = first + 1; second < boxes.length && boxes[second]!.left < a.right; second++) {
      const b = boxes[second]!;
      if (b.index !== a.index && b.top < a.bottom && a.top < b.bottom) return true;
    }
  }
  return false;
}

type HitTargetsHost = ReactiveControllerHost & HTMLElement;

/**
 * Chooses between on-image region targets and the separate action list for two or more region
 * highlights. Targets stay on the image until their minimum hit areas (`--lr-icon-button-size`)
 * overlap at the frame's rendered size, re-measured on resize; a focused target or action moves
 * to its counterpart when the presentation switches.
 */
export class RegionHitTargetsController implements ReactiveController {
  /** Starts overlapping, so dense regions never render colliding targets before a measurement. */
  private overlapping = true;
  private switched = false;
  private frame?: Element;
  private focusRepair: ReturnType<typeof captureComposedFocusRepair> = null;
  private readonly measurement: OwnedFrame;
  private readonly resize: OwnedResizeObserver;

  constructor(private readonly host: HitTargetsHost, private readonly rects: () => readonly RegionRect[]) {
    this.measurement = new OwnedFrame(host);
    this.resize = new OwnedResizeObserver(host, (entries) => {
      for (const { target } of entries) this.schedule(target);
    });
    host.addController(this);
  }

  /** Whether the regions render as the action list rather than as on-image targets. */
  showActions(count: number): boolean {
    return count > 1 && this.overlapping;
  }

  /** Ref callback for the relatively positioned frame the regions are laid out in. */
  readonly bind = (frame: Element | undefined): void => {
    this.frame = frame;
    this.sync();
  };

  /** Re-measures after the region set changes. */
  sync(): void {
    this.resize.clear();
    const frame = this.frame;
    if (!frame || !this.host.isConnected || this.rects().length < 2) {
      this.measurement.cancel();
      return;
    }
    this.resize.observe(frame);
    this.schedule(frame);
  }

  hostConnected(): void {
    this.resize.resume();
  }

  hostDisconnected(): void {
    this.resize.disconnect();
    this.measurement.cancel();
    this.focusRepair = null;
    this.switched = false;
  }

  hostUpdated(): void {
    if (!this.switched) return;
    this.switched = false;
    const focusRepair = this.focusRepair;
    this.focusRepair = null;
    if (!focusRepair) return;
    const id = focusRepair.activeElement.getAttribute('data-highlight-id');
    const buttons = this.host.shadowRoot?.querySelectorAll<HTMLButtonElement>('[data-highlight-id]') ?? [];
    applyComposedFocusRepair(focusRepair, [...buttons].find((button) => button.getAttribute('data-highlight-id') === id));
  }

  private schedule(frame: Element): void {
    this.measurement.schedule(() => this.measure(frame));
  }

  private measure(frame: Element): void {
    const view = this.host.ownerDocument.defaultView!;
    const min = resolveCssTokenLength(
      view.getComputedStyle(frame).getPropertyValue('--lr-icon-button-size').trim(),
      { host: frame },
    ) ?? 0;
    const overlaps = highlightHitAreasOverlap(
      this.rects().map((rect) => [rect]),
      { width: frame.clientWidth, height: frame.clientHeight },
      min,
    );
    if (overlaps === this.overlapping) return;
    const focused = shadowFocusTarget(this.host);
    if (focused?.localName === 'button' && focused.hasAttribute('data-highlight-id')) {
      this.focusRepair = captureComposedFocusRepair(this.host, focused as HTMLButtonElement);
    }
    this.overlapping = overlaps;
    this.switched = true;
    this.host.requestUpdate();
  }
}
