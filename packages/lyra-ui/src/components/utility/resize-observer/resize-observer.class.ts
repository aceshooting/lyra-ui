import { collectionSupport } from '../../../internal/collection-snapshot.js';
import type { PropertyValues, TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './resize-observer.styles.js';
import { ownerObserverConstructor, SlottedObserverController } from '../../../internal/slotted-observer.js';

export type ResizeObserverBox = 'content-box' | 'border-box' | 'device-pixel-content-box';

export interface LyraResizeObserverEventMap {
  'lr-resize': CustomEvent<
    Readonly<{ entries: readonly ResizeObserverEntry[] }>
  >;
}

/**
 * `<lr-resize-observer>` — observes the first-party or consumer-owned
 * elements in its default slot and emits typed resize entries. The wrapper has
 * no visual layout of its own (`display: contents`).
 *
 * @customElement lr-resize-observer
 * @slot - Elements to observe.
 * @event lr-resize - Observed elements changed size; the detached bounded entry sequence and
 * containing detail are frozen while native entry identities are retained.
 * @csspart base - The non-layout wrapper around the observed slot.
 * @status stable
 * @since 4.0.0
 */
export class LyraResizeObserver extends LyraElement<LyraResizeObserverEventMap> {
  static override styles = [LyraElement.styles, styles];
  protected static override collectionSupport = collectionSupport;

  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-resize',
  ]);

  protected static override readonly identityEventDetailCollectionItems =
    Object.freeze({ 'lr-resize': Object.freeze(['entries']) });

  /** Stops observing while set. Reflects to the `disabled` attribute. */
  @property({ type: Boolean, reflect: true }) disabled = false;
  /** Box model whose size is reported: `'content-box'` (default), `'border-box'` or `'device-pixel-content-box'`. */
  @property({ reflect: true }) box: ResizeObserverBox = 'content-box';

  // @renderController SlottedObserverController
  private readonly slotted = new SlottedObserverController<ResizeObserver>(this, {
    schedule: (rebuild) => this.scheduleAfterUpdate(rebuild),
    configure: (ownerDocument) => {
      const ResizeObserverCtor = ownerObserverConstructor(ownerDocument, 'ResizeObserver');
      if (this.disabled || !ResizeObserverCtor) return undefined;
      return {
        create: (session) => new ResizeObserverCtor((entries) => {
          if (session.current()) this.emit('lr-resize', { entries: [...entries] });
        }),
        observe: (observer, target) => {
          try {
            observer.observe(target, { box: this.box });
          } catch {
            observer.observe(target);
          }
        },
      };
    },
  });

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.slotted.retire();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('disabled') || changed.has('box')) this.slotted.schedule();
  }

  override render(): TemplateResult {
    return this.slotted.renderSlot();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-resize-observer': LyraResizeObserver;
  }
}
