import { html, nothing, svg, type TemplateResult, type SVGTemplateResult, type PropertyValues } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import { chevronIcon } from '../../../internal/icons.js';
import { getDateTimeFormat } from '../../../internal/intl-cache.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import '../../utility/live-region/live-region.class.js';
import { styles } from './chat-message.styles.js';

export type ChatMessageRole = 'user' | 'assistant' | 'system';
export type ChatMessageStatus = 'sending' | 'sent' | 'failed' | 'streaming';

// Mirrors the shared icon set's viewBox/stroke conventions
// (internal/icons.ts's chevronIcon()/closeIcon()/etc.) without adding a
// retry glyph to that module -- it's off limits here -- so this one-off icon
// still reads as part of the same visual language as the rest of the
// library's inline icons. Same approach lr-checkbox's own local
// checkmark/indeterminate glyphs take for the identical reason.
const ICON_VIEW_BOX = '0 0 24 24';
const ICON_STROKE_WIDTH = '1.75';

function retryIcon(): SVGTemplateResult {
  return svg`
    <svg
      width="1em"
      height="1em"
      viewBox=${ICON_VIEW_BOX}
      fill="none"
      stroke="currentColor"
      stroke-width=${ICON_STROKE_WIDTH}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    ><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
  `;
}

/** `hour:minute` in the component's effective locale; `formatTimestamp`
 *  overrides it when an application needs a different date/time contract.
 *  Uses the shared per-locale formatter cache -- this runs on every render
 *  of every message in a conversation surface, and constructing an
 *  `Intl.DateTimeFormat` per call is an ICU locale-data lookup.
 *  `effectiveLocale` always resolves to a non-empty tag (it falls back to
 *  `'en'`), so no empty-locale guard is needed. */
function defaultFormatTimestamp(date: Date, locale: string): string {
  return getDateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(date);
}

/** Visible (not just color-coded) text for every non-resting status --
 *  `'sent'` renders nothing here, it's the resting state. Localized via
 *  this.localize() in the statusText getter below -- these are the
 *  LyraMessageKey names, not the displayed strings themselves (those live
 *  in localization.ts's DEFAULT_STRINGS). */
const STATUS_TEXT_KEY: Record<Exclude<ChatMessageStatus, 'sent'>, string> = {
  sending: 'chatSending',
  streaming: 'chatResponding',
  failed: 'chatFailedToSend',
};

export interface LyraChatMessageEventMap {
  'lr-retry': CustomEvent<{ messageId?: string }>;
  'lr-collapse-toggle': CustomEvent<boolean>;
}
/**
 * `<lr-chat-message>` — a role-based message bubble *shell* for a chat/
 * agent conversation surface. It renders none of the message content itself:
 * the default slot carries whatever a consumer wants to display (plain
 * text, a `<lr-markdown>`, a custom template, anything at all) and this
 * component only supplies the surrounding chrome — alignment/coloring by
 * `role`, an avatar/badges header row, an optional collapse toggle, an
 * attachments strip, and a status-aware footer (a live-updating status dot +
 * text, the formatted `timestamp`, a built-in retry affordance for
 * `status="failed"`, and an `actions` slot for everything else).
 *
 * No built-in copy button is rendered. Deciding what "the copyable text" of
 * an arbitrary slotted message even means (plain text? the rendered
 * markdown source? something else?) is exactly the kind of content
 * interpretation this shell deliberately stays out of — slot a copy control
 * into `actions` instead. Firing `lr-copy` (`detail: { text }`) from that
 * control keeps the event name consistent with `<lr-json-viewer>`'s own
 * copy affordance, for anything listening at the conversation-surface level.
 *
 * Accessibility of `status`: the current status is always available as
 * plain visible text (`[part="status-text"]`), never color alone. A
 * transition *to* `"failed"`, or *from* `"streaming"` to `"sent"` (a stream
 * finishing), is additionally announced through an internal
 * `<lr-live-region>` (see that component's header for the throttled-
 * announcement wiring this composes) so a screen-reader user who isn't
 * currently focused on this message still learns about it — *unless* the
 * `failure` slot has content, in which case this internal announcement is
 * skipped: the host's own `role="alert"` failure content is expected to
 * announce itself, and firing both would double-announce the same failure
 * with two different (and differently specific) messages. This differs
 * from `<lr-typing-indicator>`'s deliberately simpler `role="status"`
 * approach — that component only ever has one thing to announce (its own
 * mount); this one has a `status` that can flip between several values
 * across a single element's lifetime, which is exactly the coalescing job
 * `<lr-live-region>` exists for.
 *
 * `role` is a message-author role (`user`/`assistant`/`system`, matching
 * the vocabulary of every chat/completion API), *not* a WAI-ARIA role, so
 * it reflects to a `data-role` attribute rather than the bare `role`
 * attribute — `role="user"` would collide with `Element`'s own ARIA `role`
 * accessor and is not a valid ARIA role token to begin with.
 *
 * `actionsOutsideBubble` allows the `actions` slot to render as a sibling
 * immediately after the message bubble instead of nested inside the footer —
 * useful for consumers whose action row (e.g., a hover-reveal copy button)
 * must sit visually outside the bubble's chrome.
 *
 * @customElement lr-chat-message
 * @slot - The message body.
 * @slot avatar - An avatar/icon for the message author.
 * @slot badges - Small status/metric chips (e.g. token count, latency, model name) — entirely app-supplied; this component computes none of that itself.
 * @slot actions - Action controls (e.g. copy, retry), rendered at the end of the footer.
 * @slot attachments - File/image attachment chips, rendered below the message body by default; see `attachments-position`.
 * @slot failure - Only ever rendered while `status="failed"`. Empty (the default), the footer keeps
 *   its built-in `[part="status-text"]`/`[part="retry-button"]` exactly as before. The moment this
 *   slot has assigned content, that built-in status text and retry button are suppressed — the host
 *   is now fully responsible for presenting its own failure UI, and the built-in `chatFailedAnnounce`
 *   live-region announcement is suppressed too (see `@event lr-retry` below for the effect on that
 *   event, and the "Accessibility of `status`" paragraph above for the built-in announcement this
 *   replaces). Content assigned here should carry `role="alert"` itself when it represents an
 *   actionable send failure — this component does not add that role on the host's behalf, since it
 *   has no way to know what markup the host puts in this slot. This mirrors `lr-flow-node`'s `header`
 *   slot, which replaces that component's own built-in heading row the same way.
 * @event lr-retry - Fired by the built-in retry button, only rendered when `status="failed"` and the
 *   `failure` slot is empty. `detail: { messageId?: string }` includes this element's stable
 *   `messageId` when supplied, so a conversation surface can identify the message without a
 *   closure around each row. A host using the `failure` slot owns its own retry control and is not
 *   required to use this event at all — but nothing stops that control from dispatching its own
 *   `new CustomEvent('lr-retry', { bubbles: true, composed: true })` to stay consistent with the
 *   same event contract a listener further up a conversation surface already relies on for every
 *   other message.
 * @event lr-collapse-toggle - `detail: boolean` (the new `collapsed` state) — fired when the user activates the built-in collapse button.
 * @csspart bubble - The message bubble root. Programmatically focusable (`tabindex="-1"`) so focus has a stable place to land when the built-in retry button is removed (e.g. a `lr-retry` listener flipping `status` away from `"failed"`).
 * @csspart header - The row above the message body — avatar, badges, and the collapse toggle. Hidden entirely when none of those have anything to show.
 * @csspart avatar - The wrapper around the `avatar` slot.
 * @csspart badges - The wrapper around the `badges` slot.
 * @csspart collapse-button - The built-in collapse/expand toggle (only rendered when `collapsible`).
 * @csspart body - The wrapper around the default slot (the message content). Hidden while `collapsed`.
 * @csspart attachments - The wrapper around the `attachments` slot.
 * @csspart failure - The `failure` slot itself (`display: contents` — it contributes no box of its
 *   own, so the host's own content lays out exactly as if it were a direct child of `bubble`, with no
 *   `::part(failure)` override needed to get there). Only present in the DOM while `status="failed"`.
 * @csspart footer - The row below the message body — status, timestamp, retry, and actions. Hidden entirely when none of those have anything to show.
 * @csspart status-indicator - A small decorative (`aria-hidden`) dot reflecting `status`; absent while `status="sent"`.
 * @csspart status-text - The visible text twin of `status-indicator` — carries the state in text, not just color.
 * @csspart timestamp - The formatted `timestamp`, rendered in a `<time>` element.
 * @csspart retry-button - The built-in retry button (only rendered when `status="failed"`).
 * @csspart actions - The wrapper around the `actions` slot. Rendered inside the footer by default; a sibling immediately after `bubble` when `actionsOutsideBubble` is set.
 * @cssprop [--lr-chat-message-max-width=80%] - Maximum inline size of the message bubble.
 * @cssprop [--lr-transition-ambient=1.8s ease-in-out] - Streaming-indicator animation duration
 *   and timing function.
 */
export class LyraChatMessage extends LyraElement<LyraChatMessageEventMap> {
  static styles = [LyraElement.styles, styles];

  // `status` needs a hand-written accessor (see `previousStatus` below) so
  // it's declared via `static properties` + `noAccessor` rather than
  // `@property()` directly -- the same pattern `lr-playback`'s `playing`
  // uses for the identical reason (a property whose setter must run real
  // logic on every assignment, not just on the next completed render).
  static properties = {
    status: { reflect: true, noAccessor: true },
  };

  /** Who authored the message. Reflects to `data-role` — see the class doc. */
  @property({ reflect: true, attribute: 'data-role' }) role: ChatMessageRole = 'assistant';

  /** Optional stable application-defined identifier for this message. Included in `lr-retry`
   *  detail when set. */
  @property({ attribute: 'message-id', reflect: true }) messageId = '';

  /** When the message was sent/received. Accepts a `Date` or anything
   *  `new Date()` can parse (e.g. an ISO 8601 string); invalid input is
   *  treated the same as unset (no timestamp rendered). */
  @property({ attribute: false }) timestamp?: Date | string;

  /** Overrides the default `hour:minute` rendering of `timestamp` — this
   *  library has no i18n system of its own, so an overridable formatter is
   *  the established way to hand locale-sensitive display back to the
   *  consumer (mirrors `lr-heatmap`'s `cellText`). */
  @property({ attribute: false }) formatTimestamp?: (date: Date) => string;

  /** Shows the built-in collapse/expand toggle in the header. */
  @property({ type: Boolean, reflect: true }) collapsible = false;

  /** Whether the message body is currently hidden. Effective whenever set,
   *  independent of `collapsible` — `collapsible` only controls whether the
   *  built-in toggle button is rendered, mirroring `lr-widget`'s identical
   *  `collapsible`/`collapsed` pair. */
  @property({ type: Boolean, reflect: true }) collapsed = false;

  /** Where the `attachments` slot renders relative to the message body.
   *  `'after'` (the default) reproduces today's exact DOM order. `'before'`
   *  renders attachments immediately above the body -- both DOM and visual
   *  order move together (no CSS `order` trick), so reading/focus order
   *  always matches what's on screen. */
  @property({ attribute: 'attachments-position' }) attachmentsPosition: 'before' | 'after' = 'after';

  /** Renders the `actions` slot's content as a sibling immediately after `[part="bubble"]` instead of
   *  nested inside `[part="footer"]`'s own padding/background box — for a consumer whose action row
   *  (e.g. a hover-reveal copy button) must sit visually outside the bubble's chrome. `false` (the
   *  default) keeps today's exact DOM: actions render inside the footer, inside the bubble. */
  @property({ type: Boolean, reflect: true, attribute: 'actions-outside-bubble' }) actionsOutsideBubble = false;

  @state() private hasAvatarSlot = false;
  @state() private hasBadgesSlot = false;
  @state() private hasAttachmentsSlot = false;
  @state() private hasActionsSlot = false;
  /** Whether the `failure` slot currently has assigned content. Only meaningful while
   *  `status === "failed"` -- that's the only time the slot itself is even in the render (see
   *  `render()`), mirroring `lr-flow-node`'s identical `hasHeaderSlot` flag for its own
   *  entirely-replaces-the-built-in-UI `header` slot. */
  @state() private hasFailureSlot = false;

  @query('lr-live-region') private liveRegion?: LyraLiveRegion;
  @query('[part="bubble"]') private bubbleEl?: HTMLElement;

  private readonly bodyId = nextId('chat-message-body');

  private _status: ChatMessageStatus = 'sent';

  /** The value `status` held immediately before its current one, recorded
   *  at the point of assignment in the setter below -- *not* derived from
   *  Lit's `changed`/`changedProperties`, which only ever remembers the
   *  single oldest value seen since the last completed update. Without this,
   *  setting `status` to `"streaming"` and then immediately overwriting it
   *  (e.g. to `"sent"`) within the same task, with no render in between,
   *  would silently lose the `"streaming"` intermediate value before
   *  `announceStatusChange` ever gets to see it. */
  private previousStatus: ChatMessageStatus = 'sent';

  /** True only until the component's first completed update -- gates the
   *  status-change announcement below so a message never announces
   *  whatever status it happens to mount with (mirrors the same "not on
   *  first paint" intent `willUpdate`'s `!this.hasUpdated` check has for the
   *  slot-presence flags, except `this.hasUpdated` itself is already `true`
   *  by the time `updated()` runs for the first time, so it can't be reused
   *  here). */
  private isMounting = true;

  /** Delivery/generation state. Drives the footer's status dot/text and,
   *  for `"failed"`, the bubble's danger treatment and the built-in retry
   *  button. Declared via `static properties` above with a hand-written
   *  accessor (see `previousStatus`). */
  get status(): ChatMessageStatus {
    return this._status;
  }
  set status(value: ChatMessageStatus) {
    const old = this._status;
    if (value === old) return;
    this.previousStatus = old;
    this._status = value;
    this.requestUpdate('status', old);
  }

  protected willUpdate(changed: PropertyValues): void {
    if (!this.hasUpdated) {
      this.hasAvatarSlot = this.hasSlotted('avatar');
      this.hasBadgesSlot = this.hasSlotted('badges');
      this.hasAttachmentsSlot = this.hasSlotted('attachments');
      this.hasActionsSlot = this.hasSlotted('actions');
      // Mounting directly into status="failed" with failure-slot content already present in the
      // initial markup -- the <slot name="failure"> element is about to exist for the very first
      // time this render, so there's no prior slotchange to have fired yet. Same "detected on first
      // paint, not just via slotchange" need the avatar/badges flags above already have.
      if (this.status === 'failed') {
        this.hasFailureSlot = this.hasSlotted('failure');
      }
    } else if (changed.has('status')) {
      if (this.status === 'failed') {
        // Entering "failed" *after* mount -- the <slot name="failure"> element didn't exist in the
        // previous render (see render()), so any slot="failure" content the host already had sitting
        // in its light DOM has never had a slotchange fire for it either. Recheck directly, same
        // reasoning as the mount-time check above.
        this.hasFailureSlot = this.hasSlotted('failure');
      } else if (this.previousStatus === 'failed' && this.hasFailureSlot && this.isFocusWithinFailureSlot()) {
        // Leaving "failed" while the host's own failure content held focus (e.g. the host's own
        // retry button, whose click listener is documented to flip status away from "failed") --
        // the <slot name="failure"> this content was rendering through is about to disappear from
        // this render entirely. An assigned node with no <slot> left to render into is forcibly
        // blurred by the browser, which silently drops focus to <body> if nothing intervenes. Move
        // focus to the always-rendered bubble first, synchronously, mirroring onRetryClick's
        // identical rescue for the built-in retry button.
        this.bubbleEl?.focus();
      }
    }
  }

  protected updated(changed: PropertyValues): void {
    const wasMounting = this.isMounting;
    this.isMounting = false;
    if (!wasMounting && changed.has('status')) {
      this.announceStatusChange(this.previousStatus);
    }
  }

  private hasSlotted(name: string): boolean {
    return Array.from(this.children).some((el) => el.getAttribute('slot') === name);
  }

  /** Whether `document.activeElement` is (or is inside) one of this host's `slot="failure"`
   *  children. Slotting doesn't move an element out of the light DOM -- `document.activeElement`
   *  reports the actual focused node regardless of where Shadow DOM projects it for rendering --
   *  so this walks the host's real children, same as `hasSlotted` above, rather than anything
   *  shadow-root-relative. */
  private isFocusWithinFailureSlot(): boolean {
    const active = document.activeElement;
    if (!active) return false;
    return Array.from(this.children).some((el) => el.getAttribute('slot') === 'failure' && el.contains(active));
  }

  private get normalizedTimestamp(): Date | undefined {
    if (this.timestamp === undefined) return undefined;
    const date = this.timestamp instanceof Date ? this.timestamp : new Date(this.timestamp);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private get statusText(): string | undefined {
    return this.status === 'sent' ? undefined : this.localize(STATUS_TEXT_KEY[this.status]);
  }

  private announceStatusChange(previous: ChatMessageStatus): void {
    if (previous === this.status) return;
    const region = this.liveRegion;
    if (!region) return;
    if (this.status === 'failed') {
      // The `failure` slot's own content is expected to carry `role="alert"` and announce itself --
      // see the class doc's "Accessibility of `status`" paragraph. Firing this generic announcement
      // on top of that would double-announce the same failure.
      if (this.hasFailureSlot) return;
      region.mode = 'assertive';
      region.announce(this.localize('chatFailedAnnounce'), { force: true });
    } else if (previous === 'streaming' && this.status === 'sent') {
      region.mode = 'polite';
      region.announce(this.localize('chatCompleteAnnounce'), { force: true });
    }
  }

  private onAvatarSlotChange = (e: Event): void => {
    this.hasAvatarSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onBadgesSlotChange = (e: Event): void => {
    this.hasBadgesSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onAttachmentsSlotChange = (e: Event): void => {
    this.hasAttachmentsSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onActionsSlotChange = (e: Event): void => {
    this.hasActionsSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onFailureSlotChange = (e: Event): void => {
    this.hasFailureSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private toggleCollapsed = (): void => {
    this.collapsed = !this.collapsed;
    this.emit<boolean>('lr-collapse-toggle', this.collapsed);
  };

  private onRetryClick = (): void => {
    // A `lr-retry` listener is documented to respond by flipping `status`
    // away from `"failed"`, which removes this very button on the next
    // render. Move focus to the always-rendered bubble first, synchronously,
    // so it lands somewhere stable inside the message instead of silently
    // reverting to `<body>` once the button it was on disappears.
    this.bubbleEl?.focus();
    this.emit('lr-retry', { messageId: this.messageId || undefined });
  };

  render(): TemplateResult {
    const ts = this.normalizedTimestamp;
    const formatter = this.formatTimestamp ?? ((date: Date) => defaultFormatTimestamp(date, this.effectiveLocale));
    // Once the `failure` slot is populated it takes over full responsibility for presenting the
    // failed state -- suppress the built-in status text and retry button so a consumer is never
    // shown both at once (see the class doc's `failure` slot entry).
    const suppressBuiltInFailedUi = this.status === 'failed' && this.hasFailureSlot;
    const statusText = suppressBuiltInFailedUi ? undefined : this.statusText;
    const showHeader = this.hasAvatarSlot || this.hasBadgesSlot || this.collapsible;
    // `statusText` is already truthy whenever `status === 'failed'` and the built-in UI isn't
    // suppressed, so it alone covers that case here too.
    const showFooter = Boolean(statusText) || Boolean(ts) || (!this.actionsOutsideBubble && this.hasActionsSlot);
    const actionsBlock = html`<span part="actions" ?hidden=${!this.hasActionsSlot}
      ><slot name="actions" @slotchange=${this.onActionsSlotChange}></slot
    ></span>`;
    const attachmentsBlock = html`<div part="attachments" ?hidden=${!this.hasAttachmentsSlot}>
      <slot name="attachments" @slotchange=${this.onAttachmentsSlotChange}></slot>
    </div>`;

    return html`
      <div part="bubble" tabindex="-1">
        <div part="header" ?hidden=${!showHeader}>
          <span part="avatar" ?hidden=${!this.hasAvatarSlot}
            ><slot name="avatar" @slotchange=${this.onAvatarSlotChange}></slot
          ></span>
          <span part="badges" ?hidden=${!this.hasBadgesSlot}
            ><slot name="badges" @slotchange=${this.onBadgesSlotChange}></slot
          ></span>
          ${this.collapsible
            ? html`<button
                part="collapse-button"
                type="button"
                aria-expanded=${this.collapsed ? 'false' : 'true'}
                aria-controls=${this.bodyId}
                aria-label=${this.localize(this.collapsed ? 'expandMessage' : 'collapseMessage')}
                @click=${this.toggleCollapsed}
              >
                <span class="chevron">${chevronIcon()}</span>
              </button>`
            : nothing}
        </div>
        ${this.attachmentsPosition === 'before' ? attachmentsBlock : nothing}
        <div part="body" id=${this.bodyId} ?hidden=${this.collapsed}>
          <slot></slot>
        </div>
        ${this.attachmentsPosition === 'before' ? nothing : attachmentsBlock}
        ${this.status === 'failed'
          ? html`<slot part="failure" name="failure" @slotchange=${this.onFailureSlotChange}></slot>`
          : nothing}
        <div part="footer" ?hidden=${!showFooter}>
          ${statusText
            ? html`<span part="status-indicator" aria-hidden="true"></span><span part="status-text"
                  >${statusText}</span
                >`
            : nothing}
          ${ts ? html`<time part="timestamp" datetime=${ts.toISOString()}>${formatter(ts)}</time>` : nothing}
          ${this.status === 'failed' && !suppressBuiltInFailedUi
            ? html`<button part="retry-button" type="button" @click=${this.onRetryClick}>
                ${retryIcon()}<span>${this.localize('retry')}</span>
              </button>`
            : nothing}
          ${this.actionsOutsideBubble ? nothing : actionsBlock}
        </div>
        <lr-live-region></lr-live-region>
      </div>
      ${this.actionsOutsideBubble ? actionsBlock : nothing}
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-chat-message': LyraChatMessage;
  }
}
