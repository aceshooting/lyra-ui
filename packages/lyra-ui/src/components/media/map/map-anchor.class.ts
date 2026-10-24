import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { flattenedParentElement } from '../../../internal/composed-tree.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { devWarnOnce } from '../../../internal/dev-mode-attribute-warning.js';
import { litDevWarnings } from '../../../internal/dev-warning.js';
import { attachInternalsSafely } from '../../../internal/element-internals.js';
import { closeIcon } from '../../../internal/icons.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { tag } from '../../../internal/prefix.js';
import type { LyraMapAnchorBoundary, LyraMapAnchorCloseDetail, LyraMapAnchorCloseReason, LyraMapAnchorSafeArea } from './map-anchor-options.js';
import { MAP_ANCHOR_SEAM, type MapAnchorChildOperation, type MapAnchorOwner } from './map-anchor-seam.js';
import { styles } from './map-anchor.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_close } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface LyraMapAnchorEventMap {
  /** Cancelable proposal to close the anchor. */
  'lr-close-request': CustomEvent<LyraMapAnchorCloseDetail>;
  'lr-close': CustomEvent<LyraMapAnchorCloseDetail>;
}

/** Why an open anchor is not placed: no map, another slot, or nested inside another anchor. */
type MapAnchorDetachment = 'map' | 'slot' | 'nested';

/**
 * `<lr-map-anchor>` — rich, interactive content anchored to a coordinate of its `<lr-map>`. Every
 * anchor is an independent panel: whoever owns it opens, moves and closes it without affecting the
 * map's other anchors or its `anchor` slot. The content stays the caller's own light-DOM nodes,
 * never cloned or moved, so their listeners, component state and application CSS survive camera
 * moves, off-screen hiding, `mapStyle` replacement and map reconnects.
 *
 * Make the anchor a direct child of `lr-map`, where it assigns itself to the map's `anchors` slot,
 * or author `slot="anchors"` yourself; frameworks that hydrate server markup should author it. An
 * element assigned to `anchors` may also wrap anchors. An anchor anywhere else (no map, another
 * slot, or inside another anchor's content) stays hidden, with a development warning while open.
 * `lr-map.js` does not register this element: import `lr-map-anchor.js` as well.
 *
 * While `open`, with a valid `lngLat` and content, the panel sits above the point, flips below it
 * near the top edge and shifts on both axes to stay inside the map allocation minus `safeArea` and
 * any `boundary` elements; the camera and `lngLat` are never changed. Each of those two defaults
 * to the map's `anchorSafeArea`/`anchorBoundary` while `undefined`, and logical safe-area edges
 * follow the map's direction. The panel hides, without closing, while the point is off screen, the
 * content is empty, the anchor is `hidden`, the map is not ready, inert or disabled, or more than 16
 * anchors of the map are open (later ones, in document order, wait until one closes), and returns
 * when that changes. It stays placed through a `mapStyle` replacement.
 *
 * Anchors do not avoid each other. Overlapping ones are painted in the order they were last
 * opened, focused or pressed, with the one containing focus in front, above the map's own `anchor`
 * slot panel; the ordering never moves the elements, and Tab follows document order.
 *
 * Opening never moves focus, except to an `[autofocus]` element of the content on the first
 * placement after `open` becomes true. When a shown anchor holding focus hides, closes or is
 * removed, focus returns to where it came from, else to the map. A `closable` anchor shows a
 * localized close button and closes on Escape: an overlay open inside it closes first, then the
 * anchor containing focus, else the frontmost closable anchor. A `label` (or a host `aria-label`,
 * which wins) names the panel as a group; without one, the content owns its semantics. There is no
 * show or hide motion.
 *
 * @customElement lr-map-anchor
 * @attr {boolean | 'until-found'} hidden - Hides the panel without changing `open`. Removing the
 *   attribute permits placement again when the other placement conditions hold.
 * @slot - The anchored content, any light DOM. It is only rendered, never cloned or moved.
 * @slot close-icon - Replaces the glyph of the close button.
 * @event lr-close-request - **Cancelable.** Frozen `detail: { reason }` (`'api'`, `'close-button'`
 *   or `'escape'`) before a requested close. `preventDefault()` keeps the anchor open, and a
 *   listener that changes `open`, `lngLat` or the anchor's map abandons the close. An `open = false`
 *   assignment is a silent state write.
 * @event lr-close - Frozen `detail: { reason }` after an accepted close has set `open` to false. Not
 *   fired when the panel merely hides, or for removal or disconnect. Ancestors that handle only this
 *   anchor's dismissal check `event.target`.
 * @csspart base - The positioned panel surface. A `z-index` set on it replaces automatic ordering.
 * @csspart body - The scrolling content wrapper.
 * @csspart close-button - The localized icon close button of a `closable` anchor.
 * @csspart close-icon - The wrapper of the close glyph.
 * @cssstate placed - Matches while the panel is placed and shown.
 * @status experimental
 * @since unreleased
 */
export class LyraMapAnchor extends LyraElement<LyraMapAnchorEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    close: LYRA_DEFAULT_close,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'hidden'];
  }

  /** The owner's open request. A close action or Escape writes `false`; assigning it never emits events. */
  @property({ type: Boolean, reflect: true }) open = false;

  /** Where the panel points, `[longitude, latitude]`. Compared by identity, like the map's `anchorLngLat`;
   * an absent or invalid coordinate hides the panel without closing it. */
  @property({ attribute: false }) lngLat?: readonly [number, number] | null;

  /** Adds a localized close button and nonmodal Escape ownership. `close()` works either way. */
  @property({ type: Boolean, reflect: true }) closable = false;

  /** Accessible name of the panel, which then becomes a group. A host `aria-label` wins. */
  @property() label?: string;

  /** Additional clipping Elements intersected with the map allocation, as for the map's
   * `anchorBoundary`, which applies while this is `undefined`. An empty array adds none. */
  @property({ attribute: false }) boundary?: LyraMapAnchorBoundary;

  /** Logical CSS-pixel insets inside the map allocation, as for the map's `anchorSafeArea`, which
   * applies while this is `undefined`. `{}` opts out of the map's insets. */
  @property({ attribute: false }) safeArea?: LyraMapAnchorSafeArea;

  private readonly internals = attachInternalsSafely(this);
  /** The map whose `anchors` slot renders this anchor. */
  private owner?: MapAnchorOwner;
  private detachment?: MapAnchorDetachment;
  private autofocusPending = false;
  private attachmentRevision = 0;

  override connectedCallback(): void {
    this.attachmentRevision += 1;
    super.connectedCallback();
    const parent = this.parentElement as Partial<MapAnchorOwner> | null;
    if (!this.hasAttribute('slot') && parent && parent.localName !== this.localName && (parent.localName === tag('map') || typeof parent[MAP_ANCHOR_SEAM] === 'function')) {
      this.slot = 'anchors';
    }
    this.refreshOwner();
  }

  override disconnectedCallback(): void {
    this.attachmentRevision += 1;
    super.disconnectedCallback();
    this.attachTo(undefined);
  }

  override attributeChangedCallback(name: string, oldValue: string | null, value: string | null): void {
    super.attributeChangedCallback(name, oldValue, value);
    if (name === 'hidden' && oldValue !== value) this.requestUpdate();
  }

  /** Requests a close with reason `'api'`, whether or not the panel is shown. Returns true only when
   * it closed: false when not open, vetoed, or abandoned by a listener. */
  close(): boolean { return this.requestClose('api'); }

  /** Synchronously focuses the first eligible content control, else the close button. Returns false
   * when the panel is not shown or placed yet, is inert, or has nothing focusable; never queues. */
  focusContent(): boolean { return this.owner?.[MAP_ANCHOR_SEAM](this, 'focus') === true; }

  /** @internal Owning-map runtime seam: re-checks attachment, publishes placement, or closes on Escape. */
  [MAP_ANCHOR_SEAM](operation: MapAnchorChildOperation): boolean {
    if (operation === 'refresh') this.refreshOwner();
    else if (operation === 'placed' || operation === 'unplaced') setCustomState(this.internals, 'placed', operation === 'placed');
    else if (operation === 'autofocus') {
      const pending = this.autofocusPending;
      this.autofocusPending = false;
      return pending;
    }
    else return this.requestClose(operation);
    return false;
  }

  /** The first map slot on the flattened path decides: a map's `anchors` slot attaches the anchor. */
  private refreshOwner(): void {
    let owner: MapAnchorOwner | undefined, detachment: MapAnchorDetachment = 'map';
    for (let node = this.isConnected ? flattenedParentElement(this) : null; node; node = flattenedParentElement(node)) {
      if (node.localName === this.localName) { detachment = 'nested'; break; }
      const host = node.localName === 'slot' ? (node.getRootNode() as Partial<ShadowRoot>).host as Partial<MapAnchorOwner> | undefined : undefined;
      if (!host || typeof host[MAP_ANCHOR_SEAM] !== 'function') continue;
      if ((node as HTMLSlotElement).name === 'anchors') owner = host as MapAnchorOwner;
      else detachment = host.localName === this.localName ? 'nested' : 'slot';
      break;
    }
    this.detachment = owner ? undefined : detachment;
    this.attachTo(owner);
  }

  private attachTo(owner: MapAnchorOwner | undefined): void {
    const previous = this.owner;
    if (owner === previous) return;
    this.owner = owner;
    this.attachmentRevision += 1;
    previous?.[MAP_ANCHOR_SEAM](this, 'detach');
    owner?.[MAP_ANCHOR_SEAM](this, 'attach');
  }

  /** The request/close sequence of every close source; placement and focus repair come from the map. */
  private requestClose(reason: LyraMapAnchorCloseReason): boolean {
    if (!this.open) return false;
    const owner = this.owner, lngLat = this.lngLat, revision = this.attachmentRevision;
    const repair = owner?.[MAP_ANCHOR_SEAM](this, 'capture');
    const detail = Object.freeze({ reason } satisfies LyraMapAnchorCloseDetail);
    if (this.emit('lr-close-request', detail, { cancelable: true }).defaultPrevented || !this.open ||
      this.lngLat !== lngLat || this.owner !== owner || this.attachmentRevision !== revision) return false;
    this.open = false;
    owner?.[MAP_ANCHOR_SEAM](this, 'retire');
    this.emit('lr-close', detail);
    // A listener that reopened the anchor keeps focus where it is.
    if (!this.open) owner?.[MAP_ANCHOR_SEAM](this, 'repair', repair);
    return true;
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    if (changed.has('open')) this.autofocusPending = this.open;
    this.owner?.[MAP_ANCHOR_SEAM](this, changed.has('lngLat') || (changed.has('open') && this.open) ? 'request' : 'sync');
    if (!litDevWarnings() || !this.open || this.owner) return;
    // A map that upgrades or renders after this anchor attaches it through its slotchange first.
    setTimeout(() => {
      if (this.open && !this.owner && this.isConnected && this.detachment) {
        devWarnOnce(`lyra-map-anchor-unattached:${this.detachment}`,
          `<${this.localName}> is open but not rendered through a map's anchors slot (${this.detachment === 'map' ? 'no map' : this.detachment === 'slot' ? 'another slot' : 'nested in another anchor'}), so it stays hidden.`);
      }
    });
  }

  private onContentChange = (): void => { this.owner?.[MAP_ANCHOR_SEAM](this, 'sync'); };

  private onCloseClick = (): void => { this.requestClose('close-button'); };

  override render(): TemplateResult {
    const name = this.hasAttribute('aria-label') ? this.getAttribute('aria-label') : this.label;
    return html`<div class="fence" aria-hidden="true"></div><div part="base" hidden role=${name ? 'group' : nothing}
      aria-label=${name || nothing}><div part="body"><slot @slotchange=${this.onContentChange}></slot></div>${this.closable
        ? html`<button type="button" part="close-button" aria-label=${this.localize('close')} @click=${this.onCloseClick}
          ><span part="close-icon" aria-hidden="true"><slot name="close-icon">${closeIcon()}</slot></span></button>` : nothing}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-map-anchor': LyraMapAnchor;
  }
}
