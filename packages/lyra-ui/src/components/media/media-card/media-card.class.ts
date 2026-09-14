import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { relayNativeEvent } from '../../../internal/native-event-relay.js';
import type { LyraFrame } from '../../../internal/variants.js';
export type { LyraFrame } from '../../../internal/variants.js';
import { expandIcon, fileIcon } from '../../../internal/icons.js';
import {
  safeDownloadHref as safeMediaCardLinkHref,
  safeMediaSrc as safeMediaCardSrc,
} from '../../../internal/safe-url.js';
import { styles } from './media-card.styles.js';
import { sanitizeCssLength } from '../../../internal/safe-css.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_mediaCardImageAttachment, LYRA_DEFAULT_mediaCardOpenFileAttachment, LYRA_DEFAULT_mediaCardOpenImageAttachment, LYRA_DEFAULT_mediaCardOpenName, LYRA_DEFAULT_mediaCardOpenVideoAttachment, LYRA_DEFAULT_mediaCardUntitledFile, LYRA_DEFAULT_mediaCardVideoAttachment } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type LyraMediaCardKind = 'image' | 'video' | 'file';

export interface LyraMediaCardOpenDetail {
  src: string;
  filename: string;
}

export interface LyraMediaCardEventMap {
  'lr-media-open': CustomEvent<LyraMediaCardOpenDetail>;
  'lr-before-media-download': CustomEvent<LyraMediaCardOpenDetail>;
  blur: FocusEvent;
  focus: FocusEvent;
}

function detectKind(mimeType: string): LyraMediaCardKind {
  const mt = mimeType.trim().toLowerCase();
  if (mt.startsWith('image/')) return 'image';
  if (mt.startsWith('video/')) return 'video';
  return 'file';
}


/**
 * `<lr-media-card>` — a lightweight inline preview for one already-sent,
 * already-available attachment inside a rendered chat message body (e.g.
 * plugged into `<lr-chat-message>`'s `attachments` slot, or embedded
 * directly by a markdown/message renderer). Distinct from two other,
 * similarly-named components in this family: `<lr-document-preview>` is a
 * fuller viewer with header chrome and an async server-side-conversion
 * state machine (`status="converting"`), and `<lr-attachment-chip>` is a
 * pre-send queued-file chip with upload progress. This component has
 * neither concern — it only ever shows a `src` that's already final.
 *
 * **Format dispatch.** `kind` selects `'image'` (a plain `<img>`), `'video'`
 * (a plain `<video controls>`), or `'file'` (an icon + filename chip with a
 * download/open affordance). Leave `kind` unset to auto-detect from
 * `mime-type` (`image/*` / `video/*` / anything else -> `'file'`);
 * explicitly setting `kind` always wins over detection.
 *
 * **Safe-URL checking.** `src` is validated before it's ever assigned to an
 * `<img>`/`<video>` `src` or an `<a href>` — only `http:`/`https:`/`blob:`
 * (plus `data:` for a *media* `src` only) or a scheme-relative/relative URL
 * with no scheme at all pass; anything else (`javascript:`, `vbscript:`,
 * and similarly suspicious schemes) is rejected. Internal sink-specific
 * validators explain why `data:` gets two different answers depending on
 * where it is used. An `image`/`video` `kind` whose `src` fails the
 * media-src check falls back to the generic file-chip rendering — this is
 * the "plain preview unavailable state" a dangerous URL degrades to, rather
 * than ever reaching a real media/anchor sink. That fallback also re-checks
 * `src` against the stricter href allowlist for its own download affordance,
 * but since the href allowlist is a strict subset of the media-src allowlist,
 * that re-check can only ever change the outcome for a direct/auto-detected
 * `kind="file"` `src` — an `image`/`video` `src` that already failed the
 * wider media-src check necessarily fails the narrower href check too, so
 * the fallback for those two kinds is always the plain, unclickable `span`.
 *
 * **The `video` case renders its open affordance separately from `base`.**
 * `image`/`file` wrap their *entire* card in one native `<button>`/`<a>` —
 * safe because an `<img>` and a plain icon+text chip have no interactive
 * content of their own to conflict with. A `<video controls>` element is
 * itself interactive content (its own play/seek/volume controls), and HTML
 * forbids nesting interactive content inside a `<button>`/`<a>` — doing so
 * anyway would also make every click on the video's own controls bubble up
 * and spuriously fire `lr-media-open`. So for `kind="video"`, `base` is a plain,
 * non-interactive wrapper around `[part="media"]`, and a small separate
 * `[part="open-button"]` (not one of this component's originally-scoped
 * parts, added as the "explicit view/open affordance" the class is free to
 * provide) is the thing that actually fires `lr-media-open`.
 *
 * **Navigation.** This component never navigates on its own for `image`/
 * `video` — activating the card only fires noncancelable `lr-media-open`; a host decides what
 * "open" means (a lightbox, a new tab, whatever). The `file`-chip case is
 * the one exception: when `src` passes the (stricter) href safety check, the
 * chip is a real `<a href download>` so a bare drop-in still does something
 * useful — but `lr-before-media-download` fires first and is `cancelable`; a host that
 * calls `preventDefault()` on it suppresses that default download/open so it
 * can substitute its own handling instead.
 *
 * **Pressed-state theme controls.** `--lr-media-card-active-border-color`
 * and `--lr-media-card-active-bg` retint only an image/file card while it is
 * pressed. They are resolved in the state rule, rather than declared on the
 * host, so a conversation or attachment-list ancestor can theme every card
 * without muting its own values.
 *
 * **Accessible action name.** A declarative host `aria-label` remains on the
 * host as the component's overall name; it is not cloned onto a second
 * semantic owner. The actionable button or link keeps a localized,
 * purpose-specific name derived from filename/alt/kind. A property-only
 * `accessibleLabel` assignment can name that internal action when no host
 * label is present. Neither path replaces image alt text or the video
 * control's own purpose label, and an explicitly empty host name does not
 * leave the still-interactive nested action unnamed.
 *
 * **Decorative images.** `alt` is optional rather than empty-by-default, so
 * `alt=""` -- the HTML idiom for a purely decorative image -- reaches the
 * rendered `<img>` verbatim instead of collapsing into the unset case and
 * picking up a generated description. Leaving `alt` off keeps the
 * `filename`-then-generic fallback. The `<video>` label is deliberately
 * outside that carve-out: an empty accessible name would leave an
 * interactive player unnamed rather than mark it decorative.
 *
 * @customElement lr-media-card
 * @event lr-media-open - An image card or video `open-button` requested consumer-owned viewing.
 *   `detail: { src, filename }`; noncancelable notification.
 * @event lr-before-media-download - A safe file anchor is about to perform its native default.
 *   `detail: { src, filename }`; cancelable, and prevention suppresses the native download/open.
 * @event {FocusEvent} blur - Relayed once from the primary action as a bubbling, composed native
 *   event.
 * @event {FocusEvent} focus - Relayed once from the primary action as a bubbling, composed native
 *   event.
 * @csspart base - The root interactive/container element. A `<button>` for
 * `kind="image"`, a plain wrapper `<div>` for `kind="video"`, and either an
 * `<a>` (when `src` passes the href safety check) or a plain `<span>`
 * (otherwise) for the `file`-chip fallback.
 * @csspart media - The `<img>` or `<video>` element.
 * @csspart file-icon - The generic file glyph, shown only in the file-chip fallback.
 * @csspart filename - The filename text, shown only in the file-chip fallback.
 * @csspart open-button - The explicit "open" affordance rendered next to
 * `[part="media"]` for `kind="video"` only — see the class doc.
 * @attr aria-pressed - Toggle state forwarded reactively onto this card's action when that action
 * is a BUTTON (`kind="image"`'s `base`, or `kind="video"`'s `open-button`): `true`, `false` or
 * `mixed`. Anything else is ignored rather than passed through. The file chip's anchor does not
 * receive it -- `link` has no pressed state, and asserting one there is an ARIA conformance
 * failure, not a nicety.
 * @attr aria-current - Current-item state forwarded reactively onto whichever control this card
 * renders, anchor included (`aria-current` is global): `page`, `step`, `location`, `date`, `time`,
 * `true` or `false`.
 * @cssprop [--lr-media-card-max-height=var(--lr-size-20rem)] - Cap on the block size of the
 * `<img>`/`<video>` in `[part="media"]`.
 * @cssprop [--lr-media-card-bg=var(--lr-color-surface)] - Background of the RESTING `frame="card"`
 * chrome, the companion to the pressed state's `--lr-media-card-active-bg`. `frame="plain"` still
 * drops the fill entirely.
 * @cssprop [--lr-media-card-active-border-color=color-mix(in oklab, var(--lr-color-brand), var(--lr-color-mix-partner) var(--lr-color-mix-active))] - Pressed border color for image/file card actions.
 * @cssprop [--lr-media-card-active-bg=color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active))] - Pressed background color for image/file card actions.
 *
 * **Chrome escape hatch.** `frame="plain"` drops `[part="base"]`'s border, background,
 * padding, and corner radius — for a dense list/feed of cards (this component's own documented
 * primary use case) where the surrounding container already provides its own separation, so
 * cards don't double up on chrome. `frame` is the library-wide name for this container
 * treatment.
 * @status stable
 * @since 4.0.0
 */
export class LyraMediaCard extends LyraElement<LyraMediaCardEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    mediaCardImageAttachment: LYRA_DEFAULT_mediaCardImageAttachment,
    mediaCardOpenFileAttachment: LYRA_DEFAULT_mediaCardOpenFileAttachment,
    mediaCardOpenImageAttachment: LYRA_DEFAULT_mediaCardOpenImageAttachment,
    mediaCardOpenName: LYRA_DEFAULT_mediaCardOpenName,
    mediaCardOpenVideoAttachment: LYRA_DEFAULT_mediaCardOpenVideoAttachment,
    mediaCardUntitledFile: LYRA_DEFAULT_mediaCardUntitledFile,
    mediaCardVideoAttachment: LYRA_DEFAULT_mediaCardVideoAttachment,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** The media URL. Always re-validated against a safe-scheme allowlist
   *  before use — see the class doc. */
  @property() src = '';

  /** Explicit format dispatch. Leave unset to auto-detect from `mime-type`. */
  @property({ reflect: true }) kind?: LyraMediaCardKind;

  /** Drives auto-detection when `kind` is unset. Attribute removal is consumed as an absent hint. */
  @property({ attribute: 'mime-type' }) mimeType = '';

  /** Shown in the file-chip fallback, used as the download link's suggested
   *  filename, and folded into the accessible name of the whole card. */
  @property() filename = '';

  /** Alt text for the image case (and reused as a video label fallback). Unset falls back to
   *  `filename`, then a generic per-kind description; explicitly `""` marks the image decorative,
   *  matching `<lr-image-viewer>`/`<lr-document-preview>`. The `<video>` label is deliberately
   *  outside that carve-out: an empty accessible name would leave an interactive player unnamed
   *  rather than mark it decorative, so an empty `alt` still falls through there. */
  @property() alt?: string;

  /** Accessible-name input. A declarative `aria-label` names the host; a property-only assignment
   *  names the internal action when no host label is present. Nested actions otherwise keep a
   *  localized purpose name derived from `filename`, `alt`, or the resolved media kind. An
   *  explicit empty string is equivalent to the unset `null` default -- both fall through to the
   *  generated purpose-specific name. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  /** Turns off this card's OWN action: the image button and the video `open-button` render
   *  `disabled`, a safe file chip's anchor loses its `href` and `download` (so it genuinely cannot
   *  fetch rather than merely claiming `aria-disabled` on a live link) and leaves the tab order,
   *  `lr-media-open`/`lr-before-media-download` stop firing from every path including `click()`,
   *  and the affordance paints at `--lr-opacity-disabled` with a `not-allowed` cursor.
   *
   *  Deliberately does NOT reach into the `kind="video"` player: `<video controls>` is media
   *  content with its own native transport, not this card's action, and silencing playback is not
   *  what "the open affordance is unavailable" means. An unsafe-`src` file chip has no action at
   *  all, so `disabled` leaves it byte-identical.
   *
   *  Like `<lr-icon-button>`, this component is not form-associated, so an ancestor
   *  `<fieldset disabled>` does not cascade here -- disable each card explicitly. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  // Host-attribute forwarding onto the native control that actually carries this card's action,
  // identical in shape to `<lr-button>`/`<lr-icon-button>`: a `role`-less host cannot express a
  // toggle or current-item state itself, which is what left a selectable attachment grid unable to
  // announce its selection at all.
  @property({ attribute: 'aria-pressed' }) private triggerPressed: string | null = null;
  @property({ attribute: 'aria-current' }) private triggerCurrent: string | null = null;

  /** Validated `aria-pressed` token, or `nothing` when the host carries no usable value. */
  private get forwardedPressed(): string | typeof nothing {
    return ['true', 'false', 'mixed'].includes(this.triggerPressed ?? '')
      ? (this.triggerPressed as string)
      : nothing;
  }

  /** Validated `aria-current` token, or `nothing` when the host carries no usable value. */
  private get forwardedCurrent(): string | typeof nothing {
    return ['page', 'step', 'location', 'date', 'time', 'true', 'false'].includes(this.triggerCurrent ?? '')
      ? (this.triggerCurrent as string)
      : nothing;
  }

  /** A CSS length (e.g. `"16rem"`); once set, overrides the
   *  `--lr-media-card-max-height` custom property for this instance only —
   *  same contract as `<lr-document-preview>`'s identically-named prop. Invalid values are
   *  ignored. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  /** Visual chrome, on the library-wide `frame` vocabulary. `'card'` (the default) keeps the
   *  bordered, filled box. `'plain'` removes the border, background, padding and corner radius, so
   *  a card inside a dense chat transcript (or any container already drawing its own separation
   *  between attachments) doesn't double the frame. */
  @property({ reflect: true }) frame: LyraFrame = 'card';

  /** Effective kind used for rendering — `kind` if explicitly set,
   *  otherwise detected from `mime-type`. */
  private get resolvedKind(): LyraMediaCardKind {
    return this.kind ?? detectKind(this.mimeType ?? '');
  }

  private get displayFilename(): string {
    return this.filename || this.localize('mediaCardUntitledFile');
  }

  /** Accessible name for the card's own actionable element (`base` or, for
   *  video, `open-button`) — always phrased as the action it performs. */
  private get actionLabel(): string {
    const hostLabel = this.getAttribute('aria-label');
    // A present host label already controls the component itself. Keep the nested action's
    // purpose-specific generated name instead of cloning one label onto two semantic owners; an
    // explicitly unnamed host does not make its still-interactive nested button/link unnamed.
    if (this.accessibleLabel && (hostLabel === null || this.accessibleLabel !== hostLabel)) {
      return this.accessibleLabel;
    }
    const name = this.filename || this.alt;
    if (name) return this.localize('mediaCardOpenName', undefined, { name });
    if (this.resolvedKind === 'image') return this.localize('mediaCardOpenImageAttachment');
    if (this.resolvedKind === 'video') return this.localize('mediaCardOpenVideoAttachment');
    return this.localize('mediaCardOpenFileAttachment');
  }

  private get imgAlt(): string {
    // `??`, not `||`: `alt=""` is the HTML idiom for a decorative image, and collapsing it into
    // the unset case made that impossible to express -- every image got a generated description.
    return this.alt ?? (this.filename || this.localize('mediaCardImageAttachment'));
  }

  private get videoLabel(): string {
    // Deliberately `||` where `imgAlt` uses `??`. This is the `<video>`'s aria-label, and an
    // empty accessible name does not mark a player decorative -- it leaves an interactive control
    // unnamed, the same failure the class doc rules out for an explicitly empty host name.
    return this.alt || this.filename || this.localize('mediaCardVideoAttachment');
  }

  /** Per-instance override for `--lr-media-card-max-height`, applied
   *  inline on `[part="base"]` -- the only mechanism that reliably wins
   *  over the `:host{}`-declared default from outside the shadow root. */
  private get baseStyle() {
    const maxHeight = sanitizeCssLength(this.maxHeight);
    return maxHeight
      ? styleMap({ '--lr-media-card-max-height': maxHeight })
      : nothing;
  }

  private eventDetail(): LyraMediaCardOpenDetail {
    // Matches whichever safe-URL sink actually rendered (see the class doc):
    // falls back to a trimmed raw src so a whitespace-padded, otherwise-unsafe
    // src still reports the same value the DOM would show if it were safe.
    const src = safeMediaCardSrc(this.src) ?? safeMediaCardLinkHref(this.src) ?? this.src.trim();
    return { src, filename: this.filename };
  }

  private onActivate = (): void => {
    if (this.disabled) return;
    this.emit('lr-media-open', this.eventDetail());
  };

  private onActionFocus = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
  };

  private onActionBlur = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
  };

  // The file-chip's `<a>` provides a real default action (download/open the
  // resource) so a bare drop-in works with no host wiring, but `lr-before-media-download`
  // fires first and is cancelable -- a host that preventDefault()s it is
  // suppressing exactly that default, so the native click also needs
  // stopping or the download/navigation would proceed anyway.
  private onLinkClick = (e: MouseEvent): void => {
    // A disabled chip already renders an href-less anchor, so there is no default left to veto --
    // announcing a download that cannot happen would be a lie to every listener.
    if (this.disabled) {
      e.preventDefault();
      return;
    }
    if (this.emit('lr-before-media-download', this.eventDetail(), { cancelable: true }).defaultPrevented) {
      e.preventDefault();
    }
  };

  private get primaryAction(): HTMLElement | null {
    return this.shadowRoot?.querySelector<HTMLElement>(
      'button[part="base"], button[part="open-button"], a[part="base"]',
    ) ?? null;
  }

  /**
   * Focus the primary action: the image button, video open button, or safe-file anchor.
   * Unsafe/inert file previews have no action, so this is a no-op for them.
   */
  override focus(options?: FocusOptions): void {
    this.primaryAction?.focus(options);
  }

  /**
   * Blur the primary action: the image button, video open button, or safe-file anchor.
   * Unsafe/inert file previews have no action, so this is a no-op for them.
   */
  override blur(): void {
    this.primaryAction?.blur();
  }

  /**
   * Activate the primary action: the image button, video open button, or safe-file anchor.
   * Unsafe/inert file previews and `disabled` cards have no action, so this is a no-op for them.
   */
  override click(): void {
    if (this.disabled) return;
    this.primaryAction?.click();
  }

  private renderImage(src: string): TemplateResult {
    return html`
      <button
        part="base"
        type="button"
        style=${this.baseStyle}
        aria-label=${this.actionLabel}
        aria-pressed=${this.forwardedPressed}
        aria-current=${this.forwardedCurrent}
        ?disabled=${this.disabled}
        @click=${this.onActivate}
        @focus=${this.onActionFocus}
        @blur=${this.onActionBlur}
      >
        <img part="media" src=${src} alt=${this.imgAlt} />
      </button>
    `;
  }

  private renderVideo(src: string): TemplateResult {
    return html`
      <div part="base" style=${this.baseStyle}>
        <video part="media" controls src=${src} aria-label=${this.videoLabel}></video>
        <button
          part="open-button"
          type="button"
          aria-label=${this.actionLabel}
          aria-pressed=${this.forwardedPressed}
          aria-current=${this.forwardedCurrent}
          ?disabled=${this.disabled}
          @click=${this.onActivate}
          @focus=${this.onActionFocus}
          @blur=${this.onActionBlur}
        >
          ${expandIcon()}
        </button>
      </div>
    `;
  }

  private renderFileFallback(): TemplateResult {
    const href = safeMediaCardLinkHref(this.src);
    const name = this.displayFilename;
    const content = html`
      <span part="file-icon" aria-hidden="true" inert>${fileIcon()}</span>
      <span part="filename" title=${name}>${name}</span>
    `;
    if (href) {
      // Two deliberate departures from a literal copy of `<lr-button>`'s forwarding, both because
      // an anchor is not a button:
      //   1. `aria-pressed` never reaches this anchor. `link` does not support it (only a button
      //      can be a toggle), so forwarding it makes axe's `aria-allowed-attr` fail the card
      //      outright. `aria-current` is global, so it does forward.
      //   2. A disabled chip gets an explicit `role="link"`. Dropping `href` is the only way a
      //      link genuinely stops fetching, but it also drops the implicit role, and
      //      `aria-label`/`aria-current` are prohibited on the resulting generic element.
      return html`
        <a
          part="base"
          href=${this.disabled ? nothing : href}
          style=${this.baseStyle}
          download=${this.disabled ? nothing : this.filename || ''}
          role=${this.disabled ? 'link' : nothing}
          aria-label=${this.actionLabel}
          aria-current=${this.forwardedCurrent}
          aria-disabled=${this.disabled ? 'true' : 'false'}
          tabindex=${this.disabled ? '-1' : nothing}
          @click=${this.onLinkClick}
          @focus=${this.onActionFocus}
          @blur=${this.onActionBlur}
        >
          ${content}
        </a>
      `;
    }
    // No safe link target -- the "plain preview unavailable state" the class
    // doc describes: the filename/icon still display, but nothing is
    // clickable (there's nothing safe to point a download/open affordance
    // at, and no built-in lightbox to fall back to for this kind).
    return html`<span part="base" style=${this.baseStyle}>${content}</span>`;
  }

  override render(): TemplateResult {
    const kind = this.resolvedKind;
    if (kind === 'image') {
      const src = safeMediaCardSrc(this.src);
      if (src) return this.renderImage(src);
      return this.renderFileFallback();
    }
    if (kind === 'video') {
      const src = safeMediaCardSrc(this.src);
      if (src) return this.renderVideo(src);
      return this.renderFileFallback();
    }
    return this.renderFileFallback();
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-media-card': LyraMediaCard;
  }
}
