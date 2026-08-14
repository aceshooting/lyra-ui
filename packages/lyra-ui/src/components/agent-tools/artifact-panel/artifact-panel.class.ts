import type { PropertyValues } from 'lit';
import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { safeDownloadHref } from '../../../internal/safe-url.js';
import {
  writeClipboardText,
  type LyraClipboardWriteFailure,
  type LyraClipboardWriteSuccess,
} from '../../../internal/clipboard.js';
import { styles } from './artifact-panel.styles.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import { firstByIdentity } from '../collection-identity.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_artifactPanelCode, LYRA_DEFAULT_artifactPanelGenerating, LYRA_DEFAULT_artifactPanelLabel, LYRA_DEFAULT_artifactPanelNextVersion, LYRA_DEFAULT_artifactPanelPreview, LYRA_DEFAULT_artifactPanelPreviousVersion, LYRA_DEFAULT_artifactPanelRestore, LYRA_DEFAULT_artifactPanelVersionPosition, LYRA_DEFAULT_copied, LYRA_DEFAULT_copy, LYRA_DEFAULT_copyFailed, LYRA_DEFAULT_download } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface ArtifactVersion {
  id: string;
  label?: string;
}

/** Which slot is currently visible in `<lr-artifact-panel>`. */
export type ArtifactPanelView = 'preview' | 'code';

export interface LyraArtifactPanelEventMap {
  'lr-view-change': CustomEvent<{ view: ArtifactPanelView }>;
  'lr-version-change': CustomEvent<{ versionId: string }>;
  'lr-restore': CustomEvent<{ versionId: string }>;
  'lr-copy': CustomEvent<LyraClipboardWriteSuccess>;
  'lr-error': CustomEvent<undefined>;
  'lr-copy-error': CustomEvent<LyraClipboardWriteFailure>;
  'lr-download': CustomEvent<{ filename: string; src: string }>;
}

/**
 * `<lr-artifact-panel>` — shell around one agent-generated artifact: a
 * title/kind header, a preview<->code toggle, version navigation with
 * restore, a streaming indicator, and built-in copy/download actions.
 * Renders none of the artifact itself — content is slotted. Version ids are stable identities;
 * duplicate ids normalize before navigation, labels, restore actions, and counts, first-wins.
 *
 * @customElement lr-artifact-panel
 * @event lr-view-change - `detail: { view }`. Fired when the preview/code toggle changes.
 * @event lr-version-change - `detail: { versionId }`. Fired when the previous/next
 *   navigation moves to a different version.
 * @event lr-restore - `detail: { versionId }`. Fired by the restore-this-version button;
 *   mutates nothing itself — `versions` and the resulting content stay host-owned state.
 * @event lr-copy - `detail: { ok: true, text }`. Fired after the clipboard write fulfills.
 * @event lr-error - The clipboard write failed; generic no-detail notification.
 * @event lr-copy-error - `detail: { ok: false, text, reason, error }` — typed clipboard failure.
 * @event lr-download - `detail: { filename, src }`. Fired with the sanitized download URL.
 * @slot - Preview-view content.
 * @slot code - Code-view content (typically a `<lr-code-block>`). The preview/code toggle
 *   only renders once this slot has assigned content.
 * @slot actions - Extra header controls, rendered between the version navigation and the
 *   built-in copy/download buttons.
 * @csspart base - The root wrapper.
 * @csspart header - The header row.
 * @csspart label - The artifact title.
 * @csspart kind - The kind badge.
 * @csspart view-toggle - The preview/code toggle group (rendered only once the `code` slot
 *   has content).
 * @csspart view-button - One toggle button; carries `data-view="preview"` or `data-view="code"`.
 * @csspart version-nav - The version navigation group (rendered only once `versions` is non-empty).
 * @csspart version-previous - The previous-version button.
 * @csspart version-previous-glyph - The chevron glyph inside `version-previous`, mirrored under RTL.
 * @csspart version-next - The next-version button.
 * @csspart version-next-glyph - The chevron glyph inside `version-next`, mirrored under RTL.
 * @csspart version-position - The "Version N of M" text.
 * @csspart version-label - The active `ArtifactVersion.label`, when supplied.
 * @csspart restore-button - The restore-this-version button, rendered only while the active
 *   version isn't the latest one.
 * @csspart actions - The `actions` slot wrapper.
 * @csspart copy-button - The copy button, rendered only while `copyText` is non-empty.
 * @csspart download-button - The download button, rendered only while `downloadSrc` is non-empty.
 * @csspart body - The content body wrapper.
 * @csspart streaming-indicator - The streaming state indicator, rendered only while `streaming`.
 * @cssprop [--lr-artifact-panel-view-active-bg=var(--lr-color-brand-quiet)] - Background of the
 *   pressed (active) preview/code toggle button.
 * @cssprop [--lr-artifact-panel-view-active-color=var(--lr-color-brand)] - Text color of the pressed
 *   (active) preview/code toggle button. Restyling the pressed state otherwise requires overriding
 *   the library-wide brand tokens, since `::part(view-button)[aria-pressed]` is invalid CSS.
 * @status stable
 * @since 4.0.0
 */
export class LyraArtifactPanel extends LyraElement<LyraArtifactPanelEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    artifactPanelCode: LYRA_DEFAULT_artifactPanelCode,
    artifactPanelGenerating: LYRA_DEFAULT_artifactPanelGenerating,
    artifactPanelLabel: LYRA_DEFAULT_artifactPanelLabel,
    artifactPanelNextVersion: LYRA_DEFAULT_artifactPanelNextVersion,
    artifactPanelPreview: LYRA_DEFAULT_artifactPanelPreview,
    artifactPanelPreviousVersion: LYRA_DEFAULT_artifactPanelPreviousVersion,
    artifactPanelRestore: LYRA_DEFAULT_artifactPanelRestore,
    artifactPanelVersionPosition: LYRA_DEFAULT_artifactPanelVersionPosition,
    copied: LYRA_DEFAULT_copied,
    copy: LYRA_DEFAULT_copy,
    copyFailed: LYRA_DEFAULT_copyFailed,
    download: LYRA_DEFAULT_download,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** The artifact's title, shown in the header. */
  @property() label = '';

  /** A short kind label (e.g. `document`, `code`), shown as a badge next to `label`. */
  @property() kind = '';

  /** Which slot is currently visible. */
  @property({ reflect: true }) view: ArtifactPanelView = 'preview';

  /** The artifact's version history, oldest first. The last entry is the latest version. Duplicate
   *  ids normalize first-wins before navigation, position counts, and restore events. */
  @property({ attribute: false }) versions: ArtifactVersion[] = [];

  /** The currently viewed version's id, or `null` to mean "the latest version". */
  @property({ attribute: 'active-version-id' }) activeVersionId: string | null = null;

  /** Whether the artifact is still being generated. Sets `aria-busy` on the body and shows a
   *  text indicator instead of an animated one, so it stays legible under reduced motion. */
  @property({ type: Boolean, reflect: true }) streaming = false;

  /** The text copied to the clipboard by the copy button. Empty hides the button. */
  @property({ attribute: 'copy-text' }) copyText = '';

  /** The download URL, sanitized through `safeDownloadHref()` before use. Empty hides the button. */
  @property({ attribute: 'download-src' }) downloadSrc = '';

  /** The suggested filename reported in the `lr-download` event detail. */
  @property({ attribute: 'download-name' }) downloadName = '';

  @state() private hasCodeSlot = false;

  private copyGeneration = 0;

  private get normalizedVersions(): ArtifactVersion[] {
    return firstByIdentity(Array.isArray(this.versions) ? this.versions : [], (version) => version.id);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.copyGeneration += 1;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.hasUpdated) {
      this.hasCodeSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'code');
    }
    if (!this.hasCodeSlot && this.view === 'code') this.view = 'preview';
    if (
      this.activeVersionId !== null &&
      (changed.has('versions') || changed.has('activeVersionId')) &&
      !this.normalizedVersions.some((version) => version.id === this.activeVersionId)
    ) {
      this.activeVersionId = null;
      this.removeAttribute('active-version-id');
    }
  }

  private onCodeSlotChange = (e: Event): void => {
    this.hasCodeSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
    if (!this.hasCodeSlot && this.view === 'code') this.view = 'preview';
  };

  private get accessibleLabel(): string {
    return this.label || this.localize('artifactPanelLabel');
  }

  private setView(view: ArtifactPanelView): void {
    this.view = view;
    this.emit('lr-view-change', { view });
  }

  private get currentIndex(): number {
    const versions = this.normalizedVersions;
    if (this.activeVersionId === null) return versions.length - 1;
    const index = versions.findIndex((v) => v.id === this.activeVersionId);
    return index >= 0 ? index : versions.length - 1;
  }

  private goToVersion(index: number): void {
    const versions = this.normalizedVersions;
    const version = versions[index];
    if (!version) return;
    const isLatest = index === versions.length - 1;
    this.activeVersionId = isLatest ? null : version.id;
    this.emit('lr-version-change', { versionId: version.id });
    (this.renderRoot.querySelector('lr-live-region') as LyraLiveRegion | null)?.announce(
      this.localize('artifactPanelVersionPosition', undefined, {
        index: this.formatCount(index + 1),
        count: this.formatCount(versions.length),
      }),
    );
  }

  private onCopy = async (): Promise<void> => {
    const text = this.copyText;
    const owner = this.isConnected ? this.ownerDocument.defaultView : null;
    const generation = ++this.copyGeneration;
    const outcome = await writeClipboardText(owner, text);
    if (
      !owner ||
      !this.isConnected ||
      this.ownerDocument.defaultView !== owner ||
      generation !== this.copyGeneration
    ) return;
    const liveRegion = this.renderRoot.querySelector('lr-live-region') as LyraLiveRegion | null;
    if (outcome.ok) {
      liveRegion?.announce(this.localize('copied'));
      this.emit('lr-copy', outcome);
      return;
    }
    liveRegion?.announce(this.localize('copyFailed'));
    this.emit('lr-error');
    this.emit('lr-copy-error', outcome);
  };

  private onDownload = (): void => {
    const safeSrc = safeDownloadHref(this.downloadSrc);
    if (!safeSrc) return;
    this.emit('lr-download', { filename: this.downloadName, src: safeSrc });
  };

  override render(): TemplateResult {
    const versions = this.normalizedVersions;
    const hasVersions = versions.length > 0;
    const index = this.currentIndex;
    const currentVersion = versions[index];
    const isLatest = this.activeVersionId === null || index === versions.length - 1;
    return html`
      <div part="base">
        <lr-live-region mode="polite"></lr-live-region>
        <div part="header">
          ${this.label ? html`<span part="label">${this.label}</span>` : nothing}
          ${this.kind ? html`<span part="kind">${this.kind}</span>` : nothing}
          ${this.hasCodeSlot
            ? html`
                <div part="view-toggle" role="group" aria-label=${this.accessibleLabel}>
                  <button
                    part="view-button"
                    type="button"
                    data-view="preview"
                    aria-pressed=${this.view === 'preview' ? 'true' : 'false'}
                    @click=${() => this.setView('preview')}
                  >
                    ${this.localize('artifactPanelPreview')}
                  </button>
                  <button
                    part="view-button"
                    type="button"
                    data-view="code"
                    aria-pressed=${this.view === 'code' ? 'true' : 'false'}
                    @click=${() => this.setView('code')}
                  >
                    ${this.localize('artifactPanelCode')}
                  </button>
                </div>
              `
            : nothing}
          ${hasVersions
            ? html`
                <div part="version-nav">
                  <button
                    part="version-previous"
                    type="button"
                    aria-label=${this.localize('artifactPanelPreviousVersion')}
                    ?disabled=${index <= 0}
                    @click=${() => this.goToVersion(index - 1)}
                  >
                    <span part="version-previous-glyph" aria-hidden="true">‹</span>
                  </button>
                  <span part="version-position"
                    >${this.localize('artifactPanelVersionPosition', undefined, {
                      index: this.formatCount(index + 1),
                      count: this.formatCount(versions.length),
                    })}</span
                  >
                  ${currentVersion?.label
                    ? html`<span part="version-label">${currentVersion.label}</span>`
                    : nothing}
                  <button
                    part="version-next"
                    type="button"
                    aria-label=${this.localize('artifactPanelNextVersion')}
                    ?disabled=${index >= versions.length - 1}
                    @click=${() => this.goToVersion(index + 1)}
                  >
                    <span part="version-next-glyph" aria-hidden="true">›</span>
                  </button>
                  ${!isLatest
                    ? html`<button
                        part="restore-button"
                        type="button"
                        @click=${() =>
                          // safe: inside the hasVersions branch, `index` is an in-bounds version index
                          this.emit('lr-restore', { versionId: versions[index]!.id })}
                      >
                        ${this.localize('artifactPanelRestore')}
                      </button>`
                    : nothing}
                </div>
              `
            : nothing}
          <slot name="actions" part="actions"></slot>
          ${this.copyText
            ? html`<button part="copy-button" type="button" @click=${this.onCopy}>${this.localize('copy')}</button>`
            : nothing}
          ${this.downloadSrc
            ? html`<button part="download-button" type="button" @click=${this.onDownload}>
                ${this.localize('download')}
              </button>`
            : nothing}
        </div>
        <div part="body" aria-busy=${this.streaming ? 'true' : 'false'}>
          <slot style=${this.view === 'code' ? 'display:none' : nothing}></slot>
          <slot
            name="code"
            style=${this.view === 'preview' ? 'display:none' : nothing}
            @slotchange=${this.onCodeSlotChange}
          ></slot>
          ${this.streaming
            ? html`<span part="streaming-indicator">${this.localize('artifactPanelGenerating')}</span>`
            : nothing}
        </div>
      </div>
    `;
  }
  /** `localize()` interpolates with a bare `String(value)`, so a number handed to it renders in
   *  ASCII digits no matter the locale -- mixing two numbering systems inside one translated
   *  sentence. Route every user-facing number through the effective locale instead. */
  private formatCount(value: number): string {
    return getNumberFormat(this.effectiveLocale).format(value);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-artifact-panel': LyraArtifactPanel;
  }

}
