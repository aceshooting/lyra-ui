import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { hasRealContent } from './a11y.js';
import { AccessibleTextController } from './accessible-text-controller.js';
import { defaultLabelForwardingSlots, isDefaultLabelNode } from './default-label-forwarding.js';
import { SEED_FIRST_RENDER_STATE } from './lyra-element.js';

type CheckedControlLabelHost = ReactiveControllerHost & HTMLElement & {
  readonly renderRoot?: ParentNode;
  readonly hasUpdated: boolean;
  [SEED_FIRST_RENDER_STATE]?: (seed: () => void) => void;
};

/** What a checked control hands {@linkcode CheckedControlLabelController}. */
export interface CheckedControlLabelOptions {
  /** Receives the default label's presence after every sample. */
  changed(present: boolean): void;
  /** The rendered default label slot (default: the first unnamed slot in the render root). */
  slot?(): HTMLSlotElement | null;
  /**
   * Light-DOM slot names whose content mutations also resample (default: the label slot `''`).
   * An empty list observes every slot, for controls that derive more state from the same pass.
   */
  observedSlots?: readonly string[];
}

/**
 * Whether a checkbox-like control's unnamed label slot carries real content, so the label wrapper
 * and its gap collapse for an icon-only or `aria-label`-only control. Seeds from light DOM before
 * the first render (deferred behind hydration), then follows the rendered slot's flattened
 * assignment, forwarding slots below the host, projected text mutations and adoption.
 */
export class CheckedControlLabelController implements ReactiveController {
  private presentValue = false;
  private readonly text: AccessibleTextController;

  constructor(
    private readonly host: CheckedControlLabelHost,
    private readonly options: CheckedControlLabelOptions,
  ) {
    this.text = new AccessibleTextController(host, options.observedSlots ?? [''], () => this.recompute(), ['slot']);
    host.addController(this);
  }

  /** The presence from the last sample. */
  get present(): boolean {
    return this.presentValue;
  }

  hostConnected(): void {
    this.host.addEventListener('slotchange', this.onSlotChange);
    // A reconnect is no longer a hydration boundary, so it samples the new tree at once.
    if (this.host.hasUpdated || !this.host[SEED_FIRST_RENDER_STATE]) this.recompute();
    else this.host[SEED_FIRST_RENDER_STATE](() => this.recompute());
  }

  hostDisconnected(): void {
    this.host.removeEventListener('slotchange', this.onSlotChange);
  }

  /** Call from the host's `adoptedCallback()` to observe in the new realm. */
  adopted(): void {
    this.text.adopted();
  }

  /** Rebinds text observation and resamples, after a render path or assignment change. */
  refresh(): void {
    this.text.bind();
    this.recompute();
  }

  /** Bind on the rendered default slot (`@slotchange=${label.onSlotChange}`); also heard on the host. */
  readonly onSlotChange = (event: Event): void => {
    const target = event.target as Element | null;
    if (target?.nodeType !== 1 || target.localName !== 'slot') return;
    if (target.getRootNode() === this.host.renderRoot) {
      if ((target.getAttribute('name') ?? '') !== '') return;
    } else if (!defaultLabelForwardingSlots(this.host).includes(target as HTMLSlotElement)) {
      return;
    }
    this.refresh();
  };

  private recompute(): void {
    const root = this.host.renderRoot;
    if (!root) return;
    const slot = this.options.slot ? this.options.slot() : root.querySelector<HTMLSlotElement>('slot:not([name])');
    const nodes: Node[] = slot
      ? slot.assignedNodes({ flatten: true })
      : Array.from(this.host.childNodes)
          .filter(node => isDefaultLabelNode(node))
          .flatMap(node => {
            if (node.nodeType !== 1 || (node as Element).localName !== 'slot') return [node];
            const forwarding = node as HTMLSlotElement;
            return forwarding.assignedNodes().length > 0
              ? forwarding.assignedNodes({ flatten: true })
              : Array.from(forwarding.childNodes);
          });
    this.presentValue = hasRealContent(nodes);
    this.options.changed(this.presentValue);
  }
}
