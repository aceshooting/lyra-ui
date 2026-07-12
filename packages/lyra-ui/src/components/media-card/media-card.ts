import { html, svg, type TemplateResult, type SVGTemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { expandIcon } from '../../internal/icons.js';
import { styles } from './media-card.styles.js';

export type MediaCardKind = 'image' | 'video' | 'file';

export interface MediaCardOpenDetail {
  src: string;
  filename: string;
}

// -- safe-URL checking -------------------------------------------------
//
// `new URL()` is used (rather than a hand-rolled "does this look like a
// scheme" regex) specifically because the platform's own URL parser already
// implements the WHATWG URL Standard's input normalization -- stripping
// ASCII tab/newline and leading/trailing C0-control-or-space from the input
// before it ever looks for a scheme. A naive regex checked against the raw
// string is exactly what a crafted value like `"java\tscript:alert(1)"` is
// designed to defeat: the tab breaks a `/^[a-z]+:/`-style match (so the
// string would wrongly fall through to the "no scheme, must be relative"
// branch) while a browser attribute sink still normalizes it down to a
// working `javascript:` URL. Delegating to `URL` means this check can never
// drift out of sync with what the browser itself will actually do with the
// string. `new URL(url)` throws when `url` has no scheme and no base to
// resolve against, which is exactly the "relative or scheme-relative" case
// this component allows unconditionally -- see `schemeOf()` below.
const SAFE_MEDIA_SRC_SCHEMES = new Set(['http:', 'https:', 'blob:', 'data:']);
// Deliberately narrower than the media-src allowlist: `data:` is excluded.
// A `data:` URI is inert as an `<img>`/`<video>` *source* (a browser never
// executes script from a media element's `src`), but a `data:text/html;...`
// URI navigated to directly via a clicked `<a href>` runs as a full document
// and can execute script -- so the same scheme gets a different verdict
// depending on which DOM sink it's headed for.
const SAFE_LINK_HREF_SCHEMES = new Set(['http:', 'https:', 'blob:']);

function schemeOf(url: string): string | null {
  try {
    return new URL(url).protocol;
  } catch {
    return null;
  }
}

function safeUrlOrNull(url: string, allowedSchemes: ReadonlySet<string>): string | null {
  const trimmed = url.trim();
  if (trimmed === '') return null;
  const scheme = schemeOf(trimmed);
  if (scheme === null) return trimmed; // no scheme -- relative or scheme-relative, always allowed
  return allowedSchemes.has(scheme) ? trimmed : null;
}

/** Validates `url` is safe to assign as an `<img>`/`<video>` `src`. Returns
 *  the trimmed url when safe, `null` otherwise -- see the "safe-URL
 *  checking" comment above for the `data:` judgement call and why `URL` is
 *  used instead of a regex. */
export function safeMediaSrc(url: string): string | null {
  return safeUrlOrNull(url, SAFE_MEDIA_SRC_SCHEMES);
}

/** Validates `url` is safe to assign as an `<a href>` -- stricter than
 *  `safeMediaSrc()`, see the "safe-URL checking" comment above. Returns the
 *  trimmed url when safe, `null` otherwise. */
export function safeLinkHref(url: string): string | null {
  return safeUrlOrNull(url, SAFE_LINK_HREF_SCHEMES);
}

function detectKind(mimeType: string): MediaCardKind {
  const mt = mimeType.trim().toLowerCase();
  if (mt.startsWith('image/')) return 'image';
  if (mt.startsWith('video/')) return 'video';
  return 'file';
}

// Mirrors the shared icon set's viewBox/stroke conventions
// (internal/icons.ts's chevronIcon()/closeIcon()/etc.), and is visually
// identical to `<lyra-attachment-chip>`'s and `<lyra-document-preview>`'s
// own local `fileGlyph()` -- duplicated rather than imported (these are
// three independently consumable components, and icons.ts is off limits
// here) but kept pixel-identical so a "generic file" affordance reads the
// same wherever it shows up in the library.
const ICON_VIEW_BOX = '0 0 24 24';
const ICON_STROKE_WIDTH = '1.75';

function fileGlyph(): SVGTemplateResult {
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
    ><path d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
  `;
}

/**
 * `<lyra-media-card>` — a lightweight inline preview for one already-sent,
 * already-available attachment inside a rendered chat message body (e.g.
 * plugged into `<lyra-chat-message>`'s `attachments` slot, or embedded
 * directly by a markdown/message renderer). Distinct from two other,
 * similarly-named components in this family: `<lyra-document-preview>` is a
 * fuller viewer with header chrome and an async server-side-conversion
 * state machine (`status="converting"`), and `<lyra-attachment-chip>` is a
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
 * and similarly suspicious schemes) is rejected. See `safeMediaSrc()` /
 * `safeLinkHref()` and their shared "safe-URL checking" comment for exactly
 * why `data:` gets two different answers depending on which DOM sink it's
 * headed for, and why the check is built on `new URL()` rather than a
 * hand-rolled scheme regex. An `image`/`video` `kind` whose `src` fails the
 * media-src check falls back to the generic file-chip rendering (which then
 * separately re-validates `src` against the stricter href allowlist for its
 * own download affordance) — this is the "plain preview unavailable state"
 * a dangerous URL degrades to, rather than ever reaching a real media/anchor
 * sink.
 *
 * **The `video` case renders its open affordance separately from `base`.**
 * `image`/`file` wrap their *entire* card in one native `<button>`/`<a>` —
 * safe because an `<img>` and a plain icon+text chip have no interactive
 * content of their own to conflict with. A `<video controls>` element is
 * itself interactive content (its own play/seek/volume controls), and HTML
 * forbids nesting interactive content inside a `<button>`/`<a>` — doing so
 * anyway would also make every click on the video's own controls bubble up
 * and spuriously fire `lyra-open`. So for `kind="video"`, `base` is a plain,
 * non-interactive wrapper around `[part="media"]`, and a small separate
 * `[part="open-button"]` (not one of this component's originally-scoped
 * parts, added as the "explicit view/open affordance" the class is free to
 * provide) is the thing that actually fires `lyra-open`.
 *
 * **Navigation.** This component never navigates on its own for `image`/
 * `video` — activating the card only fires `lyra-open`; a host decides what
 * "open" means (a lightbox, a new tab, whatever). The `file`-chip case is
 * the one exception: when `src` passes the (stricter) href safety check, the
 * chip is a real `<a href download>` so a bare drop-in still does something
 * useful — but `lyra-open` fires first and is `cancelable`; a host that
 * calls `preventDefault()` on it suppresses that default download/open so it
 * can substitute its own handling instead.
 *
 * @customElement lyra-media-card
 * @event lyra-open - The card (or, for `kind="video"`, its `open-button`)
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
 */
export class LyraMediaCard extends LyraElement {
  static styles = [LyraElement.styles, styles];

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

  /** Effective kind used for rendering — `kind` if explicitly set,
   *  otherwise detected from `mime-type`. */
  private get resolvedKind(): MediaCardKind {
    return this.kind ?? detectKind(this.mimeType);
  }

  private get displayFilename(): string {
    return this.filename || 'Untitled file';
  }

  /** Accessible name for the card's own actionable element (`base` or, for
   *  video, `open-button`) — always phrased as the action it performs. */
  private get accessibleLabel(): string {
    const name = this.filename || this.alt;
    return name ? `Open ${name}` : `Open ${this.resolvedKind} attachment`;
  }

  private get imgAlt(): string {
    return this.alt || this.filename || 'Image attachment';
  }

  private get videoLabel(): string {
    return this.alt || this.filename || 'Video attachment';
  }

  private emitOpen(): CustomEvent<MediaCardOpenDetail> {
    return this.emit<MediaCardOpenDetail>('lyra-open', { src: this.src, filename: this.filename });
  }

  private onActivate = (): void => {
    this.emitOpen();
  };

  // The file-chip's `<a>` provides a real default action (download/open the
  // resource) so a bare drop-in works with no host wiring, but `lyra-open`
  // fires first and is cancelable -- a host that preventDefault()s it is
  // suppressing exactly that default, so the native click also needs
  // stopping or the download/navigation would proceed anyway.
  private onLinkClick = (e: MouseEvent): void => {
    if (this.emitOpen().defaultPrevented) e.preventDefault();
  };

  private renderImage(src: string): TemplateResult {
    return html`
      <button part="base" type="button" aria-label=${this.accessibleLabel} @click=${this.onActivate}>
        <img part="media" src=${src} alt=${this.imgAlt} />
      </button>
    `;
  }

  private renderVideo(src: string): TemplateResult {
    return html`
      <div part="base">
        <video part="media" controls src=${src} aria-label=${this.videoLabel}></video>
        <button part="open-button" type="button" aria-label=${this.accessibleLabel} @click=${this.onActivate}>
          ${expandIcon()}
        </button>
      </div>
    `;
  }

  private renderFileFallback(): TemplateResult {
    const href = safeLinkHref(this.src);
    const name = this.displayFilename;
    const content = html`
      <span part="file-icon" aria-hidden="true">${fileGlyph()}</span>
      <span part="filename" title=${name}>${name}</span>
    `;
    if (href) {
      return html`
        <a
          part="base"
          href=${href}
          download=${this.filename || ''}
          aria-label=${this.accessibleLabel}
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
    return html`<span part="base">${content}</span>`;
  }

  render(): TemplateResult {
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

defineElement('media-card', LyraMediaCard);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-media-card': LyraMediaCard;
  }
}
