import { place } from './positioner.js';

export type AnchoredPopoverPlacer = (anchor: Element, popup: HTMLElement) => () => void;

/** Owns the replace/cleanup lifecycle for one anchored floating surface. */
export class AnchoredPopoverController {
  #cleanup?: () => void;

  constructor(private readonly placer: AnchoredPopoverPlacer = place) {}

  reposition(anchor: Element, popup: HTMLElement): void {
    this.disconnect();
    this.#cleanup = this.placer(anchor, popup);
  }

  disconnect(): void {
    this.#cleanup?.();
    this.#cleanup = undefined;
  }
}

