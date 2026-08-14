import { html, type TemplateResult, type PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { LyraElement } from "../../../internal/lyra-element.js";
import { nextId } from "../../../internal/a11y.js";
import { chevronIcon } from "../../../internal/icons.js";
import { tag } from "../../../internal/prefix.js";
import { styles } from "./source-list.styles.js";
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_sourceListDefaultLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export interface SourceListToggleDetail {
  expanded: boolean;
}

export interface LyraSourceListEventMap {
  "lr-toggle": CustomEvent<SourceListToggleDetail>;
}

/**
 * `<lr-source-list>` — a collapsible "Sources" panel for one chat message,
 * grouping a set of `<lr-source-card>` children (its default-slot light-DOM
 * children, plain composition — no `.items` array prop, the same shape
 * `<lr-multi-split>`'s panels take) behind a single clickable header.
 *
 * This library has no built-in pluralization (see `<lr-empty>`'s plain
 * `description` prop for a similar stance), so anything beyond the final
 * fallback is entirely consumer-supplied: `label-plural` (e.g. `"3 sources"`)
 * wins when set, falling back to `label`, falling back to a localized
 * `"Sources"` (via `this.localize()`) — see each property's own doc.
 * `sourceCount` (a read-only, live-updated count of the currently-slotted
 * children) is exposed for a consumer who wants to build that string
 * reactively instead of hand-counting DOM children.
 *
 * The card list is removed from the accessibility tree (not just visually
 * hidden) while collapsed, via the native `hidden` attribute on
 * `[part="list"]` — a screen reader user tabbing past the header never lands
 * on off-screen source cards they can't currently see.
 * When every assigned child is a source card, a neutral `<div>`/`<span>`
 * wrapper, or already `role="listitem"`, `[part="list"]` supplies list/listitem
 * semantics. Native controls and other semantic children retain their
 * semantics; their presence leaves the wrapper unroled rather than imposing
 * an invalid list context.
 *
 * @customElement lr-source-list
 * @slot - `<lr-source-card>` elements, neutral `<div>`/`<span>` wrappers, or
 * author-owned list items. Other semantic children remain as authored and
 * disable the list semantics.
 * @event lr-toggle - The header was activated, expanding or collapsing the
 * list. `detail: { expanded }`.
 * @csspart base - The outer container.
 * @csspart header - The clickable header (`<button>`) toggling `expanded`.
 * @csspart toggle - The chevron indicator inside the header.
 * @csspart list - The wrapper around the default slot, `hidden` while collapsed.
 * @status stable
 * @since 4.0.0
 */
export class LyraSourceList extends LyraElement<LyraSourceListEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    sourceListDefaultLabel: LYRA_DEFAULT_sourceListDefaultLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** Whether the card list is currently shown. Starts collapsed by default
   *  so a message's sources don't eat vertical space until asked for. */
  @property({ type: Boolean, reflect: true }) expanded = false;

  /** Header text used when `label-plural` isn't set, e.g. `"Sources"`. */
  @property() label = "";

  /** Fully consumer-built, already-pluralized header summary, e.g. `"3 sources"`
   *  or `"1 source"` — this component never counts or pluralizes on its own
   *  (see the class doc). Takes precedence over `label` when both are set. */
  @property({ attribute: "label-plural" }) labelPlural = "";

  // Tracks the default slot's assigned-element count purely for the
  // `sourceCount` convenience getter below -- unlike `<lr-multi-split>`'s
  // `panelCount` this never drives layout math, so it's plain @state rather
  // than something read back out of `updated()`.
  @state() private slottedCount = 0;

  private readonly listId = nextId("source-list-region");
  private readonly previousRoles = new Map<Element, string | null>();
  private roleObserver?: MutationObserver;
  private roleObserverDocument?: Document;
  private roleObserverGeneration = 0;

  private isCompatibleListItem(element: Element): boolean {
    const existingRole = element.getAttribute("role")?.trim();
    const ownsListItem =
      existingRole === "listitem" &&
      this.previousRoles.has(element) &&
      this.previousRoles.get(element) !== "listitem";
    const role = ownsListItem ? undefined : existingRole;
    if (role === "listitem") return true;
    if (
      role ||
      element.hasAttribute("tabindex") ||
      (element as HTMLElement).isContentEditable
    )
      return false;
    const localName = element.localName;
    return (
      localName === tag("source-card") ||
      localName === "div" ||
      localName === "span"
    );
  }

  private onRoleMutations(records: MutationRecord[]): void {
    for (const record of records) {
      const element = record.target as Element;
      if (element.parentElement !== this || element.getAttribute("slot"))
        continue;
      if (record.attributeName === "role" && this.previousRoles.has(element)) {
        this.previousRoles.set(element, element.getAttribute("role"));
      }
      this.reconcileAssignedItems();
      return;
    }
  }

  private observeRoleChanges(): void {
    if (!this.isConnected) return;
    const ownerDocument = this.ownerDocument;
    if (!this.roleObserver || this.roleObserverDocument !== ownerDocument) {
      this.resetRoleObserver();
      const MutationObserverCtor = ownerDocument.defaultView?.MutationObserver;
      if (!MutationObserverCtor) return;
      const generation = this.roleObserverGeneration;
      const observer = new MutationObserverCtor((records) => {
        if (
          this.roleObserver !== observer ||
          this.roleObserverGeneration !== generation ||
          !this.isConnected ||
          this.ownerDocument !== ownerDocument
        ) {
          return;
        }
        this.onRoleMutations(records);
      });
      this.roleObserver = observer;
      this.roleObserverDocument = ownerDocument;
    }
    this.roleObserver.observe(this, {
      attributes: true,
      attributeFilter: ["role", "tabindex", "contenteditable"],
      subtree: true,
    });
  }

  private syncItemRoles(elements: Element[]): void {
    this.roleObserver?.disconnect();
    const assigned = new Set(elements);
    const hasListSemantics = elements.every((element) =>
      this.isCompatibleListItem(element)
    );
    const list = this.shadowRoot?.querySelector('[part="list"]');
    if (this.isConnected && hasListSemantics)
      list?.setAttribute("role", "list");
    else list?.removeAttribute("role");
    for (const [element, role] of this.previousRoles) {
      if (
        hasListSemantics &&
        assigned.has(element) &&
        element.getAttribute("role") === "listitem" &&
        role !== "listitem"
      )
        continue;
      if (role === null) element.removeAttribute("role");
      else element.setAttribute("role", role);
      this.previousRoles.delete(element);
    }
    if (hasListSemantics) {
      for (const element of elements) {
        if (element.getAttribute("role")?.trim()) continue;
        if (!this.previousRoles.has(element))
          this.previousRoles.set(element, element.getAttribute("role"));
        element.setAttribute("role", "listitem");
      }
    }
    this.observeRoleChanges();
  }

  private reconcileAssignedItems(): void {
    const slot = this.shadowRoot?.querySelector(
      "slot"
    ) as HTMLSlotElement | null;
    if (!slot) return;
    const elements = slot.assignedElements({ flatten: true });
    this.slottedCount = elements.length;
    this.syncItemRoles(elements);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.observeRoleChanges();
    if (this.hasUpdated) {
      const ownerDocument = this.ownerDocument;
      const generation = this.roleObserverGeneration;
      void this.updateComplete.then(() => {
        if (
          !this.isConnected ||
          this.ownerDocument !== ownerDocument ||
          this.roleObserverGeneration !== generation
        ) {
          return;
        }
        this.reconcileAssignedItems();
      });
    }
  }

  override disconnectedCallback(): void {
    this.roleObserver?.disconnect();
    this.syncItemRoles([]);
    this.resetRoleObserver();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.resetRoleObserver();
  }

  private resetRoleObserver(): void {
    this.roleObserverGeneration += 1;
    this.roleObserver?.disconnect();
    this.roleObserver = undefined;
    this.roleObserverDocument = undefined;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.hasUpdated) {
      // Must count only children assigned to the *default* slot -- same rule
      // `firstUpdated`/`onSlotChange` apply via `assignedElements()` below --
      // otherwise a direct child carrying a foreign `slot` attribute makes
      // this pre-count disagree with the authoritative one, which schedules
      // a wasted second update (and Lit's dev-mode change-in-update warning).
      // An explicit `slot=""` still assigns to the default slot per the HTML
      // slot algorithm, so check the attribute's value rather than its mere
      // presence.
      const elements = Array.from(this.children).filter(
        (el) => !el.getAttribute("slot")
      );
      this.slottedCount = elements.length;
    }
  }

  override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    // Fallback reconciliation for slot-forwarding / engines that don't fire
    // `slotchange` for content present at parse time -- same idiom as
    // `<lr-empty>`'s `firstUpdated`.
    this.reconcileAssignedItems();
  }

  /** Read-only, live-updated count of the currently-slotted children —
   *  handy for building a `label-plural` string that stays in sync with
   *  what's actually slotted without hand-counting DOM children, e.g.
   *  `list.labelPlural = \`${list.sourceCount} sources\`;`. */
  get sourceCount(): number {
    return this.slottedCount;
  }

  private onSlotChange = (e: Event): void => {
    const elements = (e.target as HTMLSlotElement).assignedElements({
      flatten: true,
    });
    this.slottedCount = elements.length;
    this.syncItemRoles(elements);
  };

  private toggle = (): void => {
    this.expanded = !this.expanded;
    this.emit("lr-toggle", { expanded: this.expanded });
  };

  override render(): TemplateResult {
    const headerText =
      this.labelPlural || this.label || this.localize("sourceListDefaultLabel");

    return html`
      <div part="base">
        <button
          part="header"
          type="button"
          aria-label=${headerText}
          aria-expanded=${this.expanded ? "true" : "false"}
          aria-controls=${this.listId}
          @click=${this.toggle}
        >
          <span part="toggle" aria-hidden="true">${chevronIcon()}</span>
          <span>${headerText}</span>
        </button>
        <div part="list" id=${this.listId} ?hidden=${!this.expanded}>
          <slot @slotchange=${this.onSlotChange}></slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lr-source-list": LyraSourceList;
  }
}
