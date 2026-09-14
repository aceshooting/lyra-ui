import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { nextId } from '../../../internal/a11y.js';
import { chevronIcon } from '../../../internal/icons.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteRange } from '../../../internal/numbers.js';
import { tag } from '../../../internal/prefix.js';
import { requestThenCommit } from '../../../internal/request-commit.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { markVetoGuardWrite, VetoWriteGuard } from '../../../internal/veto-write-guard.js';
import { styles } from './app-rail-group.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_expand } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export interface LyraAppRailGroupToggleDetail {
  open: boolean;
}

export interface LyraAppRailGroupEventMap {
  'lr-toggle-request': CustomEvent<LyraAppRailGroupToggleDetail>;
  'lr-toggle': CustomEvent<LyraAppRailGroupToggleDetail>;
}

/**
 * `<lr-app-rail-group>` — a titled section of navigation items inside `<lr-app-rail>`.
 *
 * Grouping is by COMPOSITION: a group holds whatever it is given (`<lr-app-rail-item>`s, nested
 * groups, anything else a consumer slots), and has no items array, no renderer callback and no
 * model of its own. Nothing about its contents is described twice, so a group can never disagree
 * with what is actually rendered inside it.
 *
 * The group names itself with a real heading landmark (`role="heading"` plus a settable
 * `aria-level`, not a hard-wired `<h3>` whose level would be wrong in half the pages that embed a
 * rail), and labels its own `role="group"` container from that same heading — so a screen-reader
 * user reaches "Workspaces, group" instead of an unnamed run of links.
 *
 * `collapsible` opts in the standard disclosure shape: the heading's own text becomes a button
 * carrying `aria-expanded` and `aria-controls`, exactly as the accordion pattern prescribes,
 * rather than a separate unlabeled chevron next to an inert title. Collapsing goes through the
 * library's request/commit pair, so a consumer can veto it (`preventDefault()`) or resolve it
 * itself by assigning `open` from the request listener.
 *
 * The owning rail marks a slotted group `icon-only` the same way it marks a slotted item, and the
 * group forwards that to the items and nested groups it DIRECTLY owns — including ones appended
 * later — so composition survives the rail's icon-only presentation without the rail having to
 * reach through it. A nested group re-forwards in turn, so exactly one element ever writes
 * `icon-only` onto any given node and a nested group clips its own heading too.
 *
 * @customElement lr-app-rail-group
 * @slot - The group's navigation items. `<lr-app-rail-item>` and nested `<lr-app-rail-group>`
 *   children mirror the group's `icon-only` state automatically; anything else is rendered as
 *   given.
 * @slot heading - Rich heading content, replacing the `heading` property. Becomes the collapse
 *   control's own accessible name while `collapsible` is set.
 * @slot header-actions - Controls rendered beside the heading — an "add" button, an overflow menu.
 *   A SIBLING of the heading (and so of the collapse control inside it), matching `<lr-details>`'s
 *   header-actions shape, so activating one never toggles the group.
 * @event lr-toggle-request - Cancelable proposal emitted before `open` changes from the built-in
 *   collapse control. Call `preventDefault()` to keep the current state, or assign `open` from the
 *   listener to resolve it yourself — a write during the dispatch suppresses the default commit
 *   even when it assigns the value the property already held. Not emitted for a direct `open`
 *   write. `detail: LyraAppRailGroupToggleDetail`.
 * @event lr-toggle - The group finished opening or closing. Non-cancelable, emitted after `open`
 *   is written, and never emitted for a vetoed or listener-resolved request.
 *   `detail: LyraAppRailGroupToggleDetail`.
 * @csspart base - The `role="group"` container.
 * @csspart header - The row holding the heading and any header actions.
 * @csspart heading - The heading landmark. Carries `role="heading"` and `aria-level`.
 * @csspart heading-text - The wrapper around the heading text/slot; visually clipped while
 *   `icon-only`, keeping the group's accessible name intact.
 * @csspart toggle - The collapse control, only rendered while `collapsible` is set. Renders
 *   `aria-expanded` in both states and takes its accessible name from the heading text.
 * @csspart toggle-icon - The wrapper around the collapse chevron. Direction-aware through this
 *   wrapper's own `transform`, never a second mirrored glyph.
 * @csspart header-actions - The wrapper around the `header-actions` slot. Hidden while empty.
 * @csspart content - The collapsible region holding the default slot.
 * @cssprop [--lr-app-rail-group-gap=var(--lr-space-xs)] - Gap between the group's own items.
 * @cssprop [--lr-app-rail-group-padding-block=var(--lr-space-xs)] - Block padding around
 *   `[part="base"]`.
 * @cssprop [--lr-app-rail-group-heading-color=var(--lr-color-text-quiet)] - Heading text color.
 * @cssprop [--lr-app-rail-group-heading-font-size=var(--lr-font-size-sm)] - Heading font size.
 * @cssprop [--lr-app-rail-group-hover-bg=var(--lr-color-brand-quiet)] - Collapse-control hover
 *   background.
 * @cssprop [--lr-app-rail-group-hover-color=var(--lr-color-brand)] - Collapse-control hover
 *   foreground.
 * @cssprop --lr-app-rail-group-active-bg - Collapse-control pressed background; defaults to the
 *   same brand-quiet active mix the rest of the rail uses.
 * @cssprop [--lr-app-rail-group-active-color=var(--lr-color-brand)] - Collapse-control pressed
 *   foreground.
 *
 * @example
 * ```html
 * <lr-app-rail>
 *   <lr-app-rail-group heading="Workspaces" collapsible>
 *     <lr-app-rail-item href="/one">One</lr-app-rail-item>
 *     <lr-app-rail-item href="/two">Two</lr-app-rail-item>
 *   </lr-app-rail-group>
 * </lr-app-rail>
 * ```
 * @status experimental
 * @since unreleased
 */
export class LyraAppRailGroup extends LyraElement<LyraAppRailGroupEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    expand: LYRA_DEFAULT_expand,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'icon-only'];
  }

  /** The group's heading text. The `heading` slot replaces it when populated. */
  @property() heading = '';

  /** The `aria-level` the heading landmark reports. A rail sits at a different depth in every
   *  page that embeds it, so the level is settable rather than baked into a fixed `<h3>`.
   *  Clamped to the 1-6 range a heading can actually carry, and rounded; a non-finite value falls
   *  back to the default.
   *  @default 3 */
  @property({ type: Number, attribute: 'heading-level' }) headingLevel = 3;

  /** Opts in the built-in collapse control. `false` (the default) renders the heading as inert
   *  text, exactly as a plain section title. `open` still governs whether the content renders, so
   *  a consumer can drive collapse entirely from its own chrome without opting in here. */
  @property({ type: Boolean, reflect: true }) collapsible = false;

  /** Whether the group's content is shown. `true` by default — a nav section that hid itself on
   *  first paint would be the surprising default — which is why it carries
   *  `trueDefaultBooleanConverter`: Lit's presence-based boolean converter cannot parse
   *  `open="false"`, so without it the property would be unsettable from markup.
   *  @default true */
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter })
  get open(): boolean {
    return this._open;
  }
  set open(next: boolean) {
    const old = this._open;
    this._open = next;
    // Unconditional, including for a write of the value already held: the guard records that a
    // write HAPPENED, which is the only question a synchronous listener's self-resolution can be
    // answered by (a value compare reports "unchanged" for exactly that case).
    markVetoGuardWrite(this.toggleGuard);
    this.requestUpdate('open', old);
  }
  private _open = true;

  private readonly toggleGuard = new VetoWriteGuard();

  @state() private hasHeadingSlot = false;
  @state() private hasHeaderActionsSlot = false;

  private readonly headingId = nextId('app-rail-group-heading');
  private readonly contentId = nextId('app-rail-group-content');

  private get safeHeadingLevel(): number {
    return Math.round(finiteRange(this.headingLevel, 3, 1, 6));
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncOwnedItems();
  }

  override attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null,
  ): void {
    super.attributeChangedCallback(name, oldValue, newValue);
    if (name !== 'icon-only' || oldValue === newValue) return;
    this.syncOwnedItems();
    this.requestUpdate();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.syncOwnedItems();
  }

  /** Mirrors this group's `icon-only` state onto every `<lr-app-rail-item>` and nested
   *  `<lr-app-rail-group>` it DIRECTLY owns. The rail cannot reach these itself:
   *  `assignedElements({ flatten: true })` expands nested `<slot>` elements, not element children,
   *  so a group's contents never appear in the rail's own assignment list.
   *
   *  One owner per node, exactly as the rail already treats its own top level. A deep
   *  `querySelectorAll` would let an outer group write `icon-only` onto items a nested group also
   *  writes -- and because that selector matched only items, the nested group never received
   *  `icon-only` itself, so its own next sync (it runs from `connectedCallback`, `updated` and the
   *  default slot's `slotchange`) read `false` and stripped the attribute the outer group had just
   *  set, unclipping every label inside it in a narrow rail. Marking the nested group instead
   *  cascades through that group's own `attributeChangedCallback`, which also gets its heading
   *  clipped -- something the item-only selector could never do.
   *
   *  Gated on `isConnected` so a detached group stops claiming ownership of nodes appended to it
   *  afterwards. */
  private syncOwnedItems(): void {
    if (!this.isConnected) return;
    const iconOnly = this.hasAttribute('icon-only');
    const groupTag = tag('app-rail-group');
    for (const node of this.querySelectorAll(`${tag('app-rail-item')}, ${groupTag}`)) {
      // Resolved from the PARENT, never the node: `closest()` matches the node itself first, so a
      // nested group asked directly would always answer "I own myself" and never be marked.
      if ((node.parentElement?.closest(groupTag) ?? null) !== this) continue;
      node.toggleAttribute('icon-only', iconOnly);
    }
  }

  /** `assignedNodes({ flatten: true })` returns a slot's FALLBACK content when nothing is assigned
   *  to it -- and this slot's fallback IS `this.heading`. Reading only the flattened list made the
   *  state oscillate: fallback present -> `hasHeadingSlot` -> render `nothing` as the fallback ->
   *  list empty -> `hasHeadingSlot` false -> render the heading again, forever. WebKit fires
   *  `slotchange` for a fallback-content mutation where Chromium and Firefox do not, so the first
   *  `heading` write after mount hung the page outright there (a microtask loop, so no timer ever
   *  ran again). Gate on the UNFLATTENED list first -- it never contains fallback -- and flatten
   *  only once something really is assigned, which still resolves a consumer's forwarding
   *  `<slot>` down to its own (possibly empty) content. */
  private onHeadingSlotChange = (event: Event): void => {
    const slot = event.target as HTMLSlotElement;
    this.hasHeadingSlot =
      slot.assignedNodes().length > 0 && slot.assignedNodes({ flatten: true }).length > 0;
  };

  private onHeaderActionsSlotChange = (event: Event): void => {
    this.hasHeaderActionsSlot = (event.target as HTMLSlotElement)
      .assignedNodes({ flatten: true })
      .some((node) => node.nodeType !== 3 || (node.textContent ?? '').trim() !== '');
  };

  private onContentSlotChange = (): void => {
    this.syncOwnedItems();
  };

  private onToggleClick = (): void => {
    const next = !this._open;
    requestThenCommit({
      requestDetail: { open: next },
      emitRequest: (detail, init: { cancelable: true }) =>
        this.emit('lr-toggle-request', detail, init),
      guard: this.toggleGuard,
      commit: () => {
        this.open = next;
        this.emit('lr-toggle', { open: next });
      },
    });
  };

  override render(): TemplateResult {
    const named = this.hasHeadingSlot || this.heading.trim() !== '';
    const headingContent = html`<span part="heading-text"
      ><slot name="heading" @slotchange=${this.onHeadingSlotChange}
        >${this.hasHeadingSlot ? nothing : this.heading}</slot
      ></span
    >`;
    return html`
      <div part="base" role="group" aria-labelledby=${this.headingId}>
        <div part="header">
          <div
            part="heading"
            id=${this.headingId}
            role="heading"
            aria-level=${this.safeHeadingLevel}
          >
            ${this.collapsible
              ? html`<button
                  part="toggle"
                  type="button"
                  aria-expanded=${this._open ? 'true' : 'false'}
                  aria-controls=${this.contentId}
                  aria-label=${named
                    ? nothing
                    : this.localize(this._open ? 'collapse' : 'expand')}
                  @click=${this.onToggleClick}
                >
                  <span part="toggle-icon" aria-hidden="true">${chevronIcon()}</span>${headingContent}
                </button>`
              : headingContent}
          </div>
          <span part="header-actions" ?hidden=${!this.hasHeaderActionsSlot}
            ><slot
              name="header-actions"
              @slotchange=${this.onHeaderActionsSlotChange}
            ></slot
          ></span>
        </div>
        <div part="content" id=${this.contentId} ?hidden=${!this._open}>
          <slot @slotchange=${this.onContentSlotChange}></slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-app-rail-group': LyraAppRailGroup;
  }
}
