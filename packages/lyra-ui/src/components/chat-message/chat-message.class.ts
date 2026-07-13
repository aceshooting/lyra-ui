import { html, nothing, svg, type TemplateResult, type SVGTemplateResult, type PropertyValues } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { nextId } from '../../internal/a11y.js';
import { chevronIcon } from '../../internal/icons.js';
import type { LyraLiveRegion } from '../live-region/live-region.class.js';
import '../live-region/live-region.class.js';
import { styles } from './chat-message.styles.js';

export type ChatMessageRole = 'user' | 'assistant' | 'system';
export type ChatMessageStatus = 'sending' | 'sent' | 'failed' | 'streaming';

// Mirrors the shared icon set's viewBox/stroke conventions
// (internal/icons.ts's chevronIcon()/closeIcon()/etc.) without adding a
// retry glyph to that module -- it's off limits here -- so this one-off icon
// still reads as part of the same visual language as the rest of the
// library's inline icons. Same approach lyra-checkbox's own local
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

/** `hour:minute` in the runtime's default locale -- the sensible baseline
 *  this library (with no i18n system of its own) can offer without
 *  hardcoding English strings; `formatTimestamp` overrides it. */
function defaultFormatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

/** Visible (not just color-coded) text for every non-resting status --
 *  `'sent'` renders nothing here, it's the resting state. */
const STATUS_TEXT: Record<Exclude<ChatMessageStatus, 'sent'>, string> = {
  sending: 'Sending…',
  streaming: 'Responding…',
  failed: 'Failed to send',
};

export interface LyraChatMessageEventMap {
  'lyra-retry': CustomEvent<undefined>;
}
/**
 * `<lyra-chat-message>` — a role-based message bubble *shell* for a chat/
 * agent conversation surface. It renders none of the message content itself:
 * the default slot carries whatever a consumer wants to display (plain
 * text, a `<lyra-markdown>`, a custom template, anything at all) and this
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
 * into `actions` instead. Firing `lyra-copy` (`detail: { text }`) from that
 * control keeps the event name consistent with `<lyra-json-viewer>`'s own
 * copy affordance, for anything listening at the conversation-surface level.
 *
 * Accessibility of `status`: the current status is always available as
 * plain visible text (`[part="status-text"]`), never color alone. A
 * transition *to* `"failed"`, or *from* `"streaming"` to `"sent"` (a stream
 * finishing), is additionally announced through an internal
 * `<lyra-live-region>` (see that component's header for the throttled-
 * announcement wiring this composes) so a screen-reader user who isn't
 * currently focused on this message still learns about it. This differs
 * from `<lyra-typing-indicator>`'s deliberately simpler `role="status"`
 * approach — that component only ever has one thing to announce (its own
 * mount); this one has a `status` that can flip between several values
 * across a single element's lifetime, which is exactly the coalescing job
 * `<lyra-live-region>` exists for.
 *
 * `role` is a message-author role (`user`/`assistant`/`system`, matching
 * the vocabulary of every chat/completion API), *not* a WAI-ARIA role, so
 * it reflects to a `data-role` attribute rather than the bare `role`
 * attribute — `role="user"` would collide with `Element`'s own ARIA `role`
 * accessor and is not a valid ARIA role token to begin with.
 *
 * @customElement lyra-chat-message
 * @slot - The message body.
 * @slot avatar - An avatar/icon for the message author.
 * @slot badges - Small status/metric chips (e.g. token count, latency, model name) — entirely app-supplied; this component computes none of that itself.
 * @slot actions - Action controls (e.g. copy, retry), rendered at the end of the footer.
 * @slot attachments - File/image attachment chips, rendered below the message body.
 * @event lyra-retry - Fired by the built-in retry button, only rendered when `status="failed"`.
 * @event lyra-collapse-toggle - `detail: boolean` (the new `collapsed` state) — fired when the user activates the built-in collapse button.
 * @csspart bubble - The message bubble root. Programmatically focusable (`tabindex="-1"`) so focus has a stable place to land when the built-in retry button is removed (e.g. a `lyra-retry` listener flipping `status` away from `"failed"`).
 * @csspart header - The row above the message body — avatar, badges, and the collapse toggle. Hidden entirely when none of those have anything to show.
 * @csspart avatar - The wrapper around the `avatar` slot.
 * @csspart badges - The wrapper around the `badges` slot.
 * @csspart collapse-button - The built-in collapse/expand toggle (only rendered when `collapsible`).
 * @csspart body - The wrapper around the default slot (the message content). Hidden while `collapsed`.
 * @csspart attachments - The wrapper around the `attachments` slot.
 * @csspart footer - The row below the message body — status, timestamp, retry, and actions. Hidden entirely when none of those have anything to show.
 * @csspart status-indicator - A small decorative (`aria-hidden`) dot reflecting `status`; absent while `status="sent"`.
 * @csspart status-text - The visible text twin of `status-indicator` — carries the state in text, not just color.
 * @csspart timestamp - The formatted `timestamp`, rendered in a `<time>` element.
 * @csspart retry-button - The built-in retry button (only rendered when `status="failed"`).
 * @csspart actions - The wrapper around the `actions` slot.
 */
export class LyraChatMessage extends LyraElement<LyraChatMessageEventMap> {
  static styles = [LyraElement.styles, styles];

  // `status` needs a hand-written accessor (see `previousStatus` below) so
  // it's declared via `static properties` + `noAccessor` rather than
  // `@property()` directly -- the same pattern `lyra-playback`'s `playing`
  // uses for the identical reason (a property whose setter must run real
  // logic on every assignment, not just on the next completed render).
  static properties = {
    status: { reflect: true, noAccessor: true },
  };

  /** Who authored the message. Reflects to `data-role` — see the class doc. */
  @property({ reflect: true, attribute: 'data-role' }) role: ChatMessageRole = 'assistant';

  /** When the message was sent/received. Accepts a `Date` or anything
   *  `new Date()` can parse (e.g. an ISO 8601 string); invalid input is
   *  treated the same as unset (no timestamp rendered). */
  @property({ attribute: false }) timestamp?: Date | string;

  /** Overrides the default `hour:minute` rendering of `timestamp` — this
   *  library has no i18n system of its own, so an overridable formatter is
   *  the established way to hand locale-sensitive display back to the
   *  consumer (mirrors `lyra-heatmap`'s `cellText`). */
  @property({ attribute: false }) formatTimestamp?: (date: Date) => string;

  /** Shows the built-in collapse/expand toggle in the header. */
  @property({ type: Boolean, reflect: true }) collapsible = false;

  /** Whether the message body is currently hidden. Effective whenever set,
   *  independent of `collapsible` — `collapsible` only controls whether the
   *  built-in toggle button is rendered, mirroring `lyra-widget`'s identical
   *  `collapsible`/`collapsed` pair. */
  @property({ type: Boolean, reflect: true }) collapsed = false;

  @state() private hasAvatarSlot = false;
  @state() private hasBadgesSlot = false;
  @state() private hasAttachmentsSlot = false;
  @state() private hasActionsSlot = false;

  @query('lyra-live-region') private liveRegion?: LyraLiveRegion;
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

  protected willUpdate(): void {
    if (!this.hasUpdated) {
      this.hasAvatarSlot = this.hasSlotted('avatar');
      this.hasBadgesSlot = this.hasSlotted('badges');
      this.hasAttachmentsSlot = this.hasSlotted('attachments');
      this.hasActionsSlot = this.hasSlotted('actions');
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

  private get normalizedTimestamp(): Date | undefined {
    if (this.timestamp === undefined) return undefined;
    const date = this.timestamp instanceof Date ? this.timestamp : new Date(this.timestamp);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private get statusText(): string | undefined {
    return this.status === 'sent' ? undefined : STATUS_TEXT[this.status];
  }

  private announceStatusChange(previous: ChatMessageStatus): void {
    if (previous === this.status) return;
    const region = this.liveRegion;
    if (!region) return;
    if (this.status === 'failed') {
      region.mode = 'assertive';
      region.announce('Message failed to send.', { force: true });
    } else if (previous === 'streaming' && this.status === 'sent') {
      region.mode = 'polite';
      region.announce('Message complete.', { force: true });
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

  private toggleCollapsed = (): void => {
    this.collapsed = !this.collapsed;
    this.emit<boolean>('lyra-collapse-toggle', this.collapsed);
  };

  private onRetryClick = (): void => {
    // A `lyra-retry` listener is documented to respond by flipping `status`
    // away from `"failed"`, which removes this very button on the next
    // render. Move focus to the always-rendered bubble first, synchronously,
    // so it lands somewhere stable inside the message instead of silently
    // reverting to `<body>` once the button it was on disappears.
    this.bubbleEl?.focus();
    this.emit('lyra-retry');
  };

  render(): TemplateResult {
    const ts = this.normalizedTimestamp;
    const formatter = this.formatTimestamp ?? defaultFormatTimestamp;
    const statusText = this.statusText;
    const showHeader = this.hasAvatarSlot || this.hasBadgesSlot || this.collapsible;
    // `statusText` is already truthy whenever `status === 'failed'`, so it
    // alone covers that case here too.
    const showFooter = Boolean(statusText) || Boolean(ts) || this.hasActionsSlot;

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
                <span class="chevron" style=${`transform:rotate(${this.collapsed ? '0deg' : '90deg'})`}
                  >${chevronIcon()}</span
                >
              </button>`
            : nothing}
        </div>
        <div part="body" id=${this.bodyId} ?hidden=${this.collapsed}>
          <slot></slot>
        </div>
        <div part="attachments" ?hidden=${!this.hasAttachmentsSlot}>
          <slot name="attachments" @slotchange=${this.onAttachmentsSlotChange}></slot>
        </div>
        <div part="footer" ?hidden=${!showFooter}>
          ${statusText
            ? html`<span part="status-indicator" aria-hidden="true"></span><span part="status-text"
                  >${statusText}</span
                >`
            : nothing}
          ${ts ? html`<time part="timestamp" datetime=${ts.toISOString()}>${formatter(ts)}</time>` : nothing}
          ${this.status === 'failed'
            ? html`<button part="retry-button" type="button" @click=${this.onRetryClick}>
                ${retryIcon()}<span>${this.localize('retry')}</span>
              </button>`
            : nothing}
          <span part="actions" ?hidden=${!this.hasActionsSlot}
            ><slot name="actions" @slotchange=${this.onActionsSlotChange}></slot
          ></span>
        </div>
        <lyra-live-region></lyra-live-region>
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lyra-chat-message': LyraChatMessage;
  }
}
