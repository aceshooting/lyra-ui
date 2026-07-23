import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { expandIcon, fileIcon } from '../../../internal/icons.js';
import {
  safeDownloadHref as validateLinkHref,
  safeMediaSrc as validateMediaSrc,
} from '../../../internal/safe-url.js';
import { styles } from './media-card.styles.js';

export type MediaCardKind = 'image' | 'video' | 'file';

/** Visual chrome for `<lr-media-card>`'s root, mirroring `lr-source-card`'s `appearance`
 *  vocabulary. */
export type MediaCardAppearance = 'card' | 'plain';

export interface MediaCardOpenDetail {
  src: string;
  filename: string;
}

export interface LyraMediaCardEventMap {
  'lr-open': CustomEvent<MediaCardOpenDetail>;
}

/** Validates `url` for an `<img>`/`<video>` source. Kept as a public wrapper
 * so existing imports and generated API metadata remain stable. */
export function safeMediaSrc(url: string): string | null {
  return validateMediaSrc(url);
}

/** Validates `url` for the library's download/open link sinks — `http:`,
 * `https:`, `blob:`, or relative. Deliberately narrower than the general-purpose
 * navigation validator of the same name in `internal/safe-url.js`, which also
 * admits `mailto:`; a mail handoff names no retrievable bytes, so it is not a
 * valid target for this component's `download` affordance. Kept as a public
 * wrapper so existing imports and generated API metadata remain stable. */
export function safeLinkHref(url: string): string | null {
  return validateLinkHref(url);
}

function detectKind(mimeType: string): MediaCardKind {
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
 * and similarly suspicious schemes) is rejected. `safeMediaSrc()` and
 * `safeLinkHref()` share a platform-URL-based validator; their sink-specific
 * allowlists explain why `data:` gets two different answers depending on
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
 * and spuriously fire `lr-open`. So for `kind="video"`, `base` is a plain,
 * non-interactive wrapper around `[part="media"]`, and a small separate
 * `[part="open-button"]` (not one of this component's originally-scoped
 * parts, added as the "explicit view/open affordance" the class is free to
 * provide) is the thing that actually fires `lr-open`.
 *
 * **Navigation.** This component never navigates on its own for `image`/
 * `video` — activating the card only fires `lr-open`; a host decides what
 * "open" means (a lightbox, a new tab, whatever). The `file`-chip case is
 * the one exception: when `src` passes the (stricter) href safety check, the
 * chip is a real `<a href download>` so a bare drop-in still does something
 * useful — but `lr-open` fires first and is `cancelable`; a host that
 * calls `preventDefault()` on it suppresses that default download/open so it
 * can substitute its own handling instead.
 *
 * **Accessible action name.** The host `aria-label` maps to
 * `accessibleLabel` and overrides the filename/alt/per-kind action name on
 * whichever internal element is actionable for the resolved kind. The name
 * is therefore applied directly to the button or link across the shadow
 * boundary; it does not replace the image alt text or the video control's
 * own label.
 *
 * @customElement lr-media-card
 * @event lr-open - The card (or, for `kind="video"`, its `open-button`)
 * was activated. `detail: { src, filename }`. Cancelable — see the class
 * doc's "Navigation" section for what calling `preventDefault()` on it does
 * in the `file`-chip case.
 * @csspart base - The root interactive/container element. A `<button>` for
 * `kind="image"`, a plain wrapper `<div>` for `kind="video"`, and either an
 * `<a>` (when `src` passes the href safety check) or a plain `<span>`
 * (otherwise) for the `file`-chip fallback.
 * @csspart media - The `<img>` or `<video>` element.
 * @csspart file-icon - The generic file glyph, shown only in the file-chip fallback.
 * @csspart filename - The filename text, shown only in the file-chip fallback.
 * @csspart open-button - The explicit "open" affordance rendered next to
 * `[part="media"]` for `kind="video"` only — see the class doc.
 * @cssprop [--lr-media-card-max-height=var(--lr-size-20rem)] - Cap on the block size of the
 * `<img>`/`<video>` in `[part="media"]`.
 *
 * **Chrome escape hatch.** `appearance="plain"` drops `[part="base"]`'s border, background,
 * padding, and corner radius — for a dense list/feed of cards (this component's own documented
 * primary use case) where the surrounding container already provides its own separation, so
 * cards don't double up on chrome. Mirrors `<lr-source-card>`'s identical `appearance`
 * vocabulary.
 */
export class LyraMediaCard extends LyraElement<LyraMediaCardEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** The media URL. Always re-validated against a safe-scheme allowlist
   *  before use — see the class doc. */
  @property() src = '';

  /** Explicit format dispatch. Leave unset to auto-detect from `mime-type`. */
  @property({ reflect: true }) kind?: MediaCardKind;

  /** Drives auto-detection when `kind` is unset. */
  @property({ attribute: 'mime-type' }) mimeType = '';

  /** Shown in the file-chip fallback, used as the download link's suggested
   *  filename, and folded into the accessible name of the whole card. */
  @property() filename = '';

  /** Alt text for the image case (and reused as a video label fallback).
   *  Falls back to `filename`, then a generic per-kind description. */
  @property() alt = '';

  /** Accessible-name override for the card's actionable element. Maps to
   *  the host's `aria-label` attribute and wins over names derived from
   *  `filename`, `alt`, or the resolved media kind. */
  @property({ attribute: 'aria-label' }) accessibleLabel = '';

  /** A CSS length (e.g. `"16rem"`); once set, overrides the
   *  `--lr-media-card-max-height` custom property for this instance only —
   *  same contract as `<lr-document-preview>`'s identically-named prop. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  /** Visual chrome, mirroring `<lr-source-card>`'s `appearance` vocabulary. `'card'` (the
   *  default) keeps the bordered, filled box. `'plain'` removes the border, background, padding
   *  and corner radius, so a card inside a dense chat transcript (or any container already
   *  drawing its own separation between attachments) doesn't double the frame. */
  @property({ reflect: true }) appearance: MediaCardAppearance = 'card';

  /** Effective kind used for rendering — `kind` if explicitly set,
   *  otherwise detected from `mime-type`. */
  private get resolvedKind(): MediaCardKind {
    return this.kind ?? detectKind(this.mimeType);
  }

  private get displayFilename(): string {
    return this.filename || this.localize('mediaCardUntitledFile');
  }

  /** Accessible name for the card's own actionable element (`base` or, for
   *  video, `open-button`) — always phrased as the action it performs. */
  private get actionLabel(): string {
    if (this.accessibleLabel) return this.accessibleLabel;
    const name = this.filename || this.alt;
    if (name) return this.localize('mediaCardOpenName', undefined, { name });
    if (this.resolvedKind === 'image') return this.localize('mediaCardOpenImageAttachment');
    if (this.resolvedKind === 'video') return this.localize('mediaCardOpenVideoAttachment');
    return this.localize('mediaCardOpenFileAttachment');
  }

  private get imgAlt(): string {
    return this.alt || this.filename || this.localize('mediaCardImageAttachment');
  }

  private get videoLabel(): string {
    return this.alt || this.filename || this.localize('mediaCardVideoAttachment');
  }

  /** Per-instance override for `--lr-media-card-max-height`, applied
   *  inline on `[part="base"]` -- the only mechanism that reliably wins
   *  over the `:host{}`-declared default from outside the shadow root. */
  private get baseStyle(): string | typeof nothing {
    return this.maxHeight ? `--lr-media-card-max-height:${this.maxHeight}` : nothing;
  }

  private emitOpen(): CustomEvent<MediaCardOpenDetail> {
    // Matches whichever safe-URL sink actually rendered (see the class doc):
    // falls back to a trimmed raw src so a whitespace-padded, otherwise-unsafe
    // src still reports the same value the DOM would show if it were safe.
    const src = safeMediaSrc(this.src) ?? safeLinkHref(this.src) ?? this.src.trim();
    return this.emit<MediaCardOpenDetail>('lr-open', { src, filename: this.filename }, { cancelable: true });
  }

  private onActivate = (): void => {
    this.emitOpen();
  };

  // The file-chip's `<a>` provides a real default action (download/open the
  // resource) so a bare drop-in works with no host wiring, but `lr-open`
  // fires first and is cancelable -- a host that preventDefault()s it is
  // suppressing exactly that default, so the native click also needs
  // stopping or the download/navigation would proceed anyway.
  private onLinkClick = (e: MouseEvent): void => {
    if (this.emitOpen().defaultPrevented) e.preventDefault();
  };

  private get primaryAction(): HTMLElement | null {
    return this.shadowRoot?.querySelector<HTMLElement>(
      'button[part="base"], button[part="open-button"], a[part="base"]',
    ) ?? null;
  }

  override focus(options?: FocusOptions): void {
    this.primaryAction?.focus(options);
  }

  override blur(): void {
    this.primaryAction?.blur();
  }

  override click(): void {
    this.primaryAction?.click();
  }

  private renderImage(src: string): TemplateResult {
    return html`
      <button part="base" type="button" style=${this.baseStyle} aria-label=${this.actionLabel} @click=${this.onActivate}>
        <img part="media" src=${src} alt=${this.imgAlt} />
      </button>
    `;
  }

  private renderVideo(src: string): TemplateResult {
    return html`
      <div part="base" style=${this.baseStyle}>
        <video part="media" controls src=${src} aria-label=${this.videoLabel}></video>
        <button part="open-button" type="button" aria-label=${this.actionLabel} @click=${this.onActivate}>
          ${expandIcon()}
        </button>
      </div>
    `;
  }

  private renderFileFallback(): TemplateResult {
    const href = safeLinkHref(this.src);
    const name = this.displayFilename;
    const content = html`
      <span part="file-icon" aria-hidden="true">${fileIcon()}</span>
      <span part="filename" title=${name}>${name}</span>
    `;
    if (href) {
      return html`
        <a
          part="base"
          href=${href}
          style=${this.baseStyle}
          download=${this.filename || ''}
          aria-label=${this.actionLabel}
          @click=${this.onLinkClick}
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
      const src = safeMediaSrc(this.src);
      if (src) return this.renderImage(src);
      return this.renderFileFallback();
    }
    if (kind === 'video') {
      const src = safeMediaSrc(this.src);
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
