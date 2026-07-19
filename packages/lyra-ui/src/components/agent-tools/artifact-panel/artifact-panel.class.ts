import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { safeMediaSrc } from '../../../internal/safe-url.js';
import { styles } from './artifact-panel.styles.js';
// Import the registering barrel (not the bare `.class.js` module) so
// `<lr-live-region>` is actually defined by the time this component renders it.
import '../../utility/live-region/live-region.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';

export interface ArtifactVersion {
  id: string;
  label?: string;
}

export interface LyraArtifactPanelEventMap {
  'lr-view-change': CustomEvent<{ view: 'preview' | 'code' }>;
  'lr-version-change': CustomEvent<{ versionId: string }>;
  'lr-restore': CustomEvent<{ versionId: string }>;
  'lr-copy': CustomEvent<{ text: string }>;
  'lr-download': CustomEvent<{ filename: string; src?: string }>;
}

/**
 * `<lr-artifact-panel>` — shell around one agent-generated artifact: a
 * title/kind header, a preview<->code toggle, version navigation with
 * restore, a streaming indicator, and built-in copy/download actions.
 * Renders none of the artifact itself — content is slotted.
 *
 * @customElement lr-artifact-panel
 * @event lr-view-change - `detail: { view }`. Fired when the preview/code toggle changes.
 * @event lr-version-change - `detail: { versionId }`. Fired when the previous/next
 *   navigation moves to a different version.
 * @event lr-restore - `detail: { versionId }`. Fired by the restore-this-version button;
 *   mutates nothing itself — `versions` and the resulting content stay host-owned state.
 * @event lr-copy - `detail: { text }`. Fired after a best-effort clipboard write.
 * @event lr-download - `detail: { filename, src? }`. Fired with the sanitized download URL.
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
 * @csspart version-next - The next-version button.
 * @csspart version-position - The "Version N of M" text.
 * @csspart restore-button - The restore-this-version button, rendered only while the active
 *   version isn't the latest one.
 * @csspart actions - The `actions` slot wrapper.
 * @csspart copy-button - The copy button, rendered only while `copyText` is non-empty.
 * @csspart download-button - The download button, rendered only while `downloadSrc` is non-empty.
 * @csspart body - The content body wrapper.
 * @csspart streaming-indicator - The streaming state indicator, rendered only while `streaming`.
 */
export class LyraArtifactPanel extends LyraElement<LyraArtifactPanelEventMap> {
  static styles = [LyraElement.styles, styles];

  /** The artifact's title, shown in the header. */
  @property() label = '';

  /** A short kind label (e.g. `document`, `code`), shown as a badge next to `label`. */
  @property() kind = '';

  /** Which slot is currently visible. */
  @property({ reflect: true }) view: 'preview' | 'code' = 'preview';

  /** The artifact's version history, oldest first. The last entry is the latest version. */
  @property({ attribute: false }) versions: ArtifactVersion[] = [];

  /** The currently viewed version's id, or `null` to mean "the latest version". */
  @property({ attribute: 'active-version-id' }) activeVersionId: string | null = null;

  /** Whether the artifact is still being generated. Sets `aria-busy` on the body and shows a
   *  text indicator instead of an animated one, so it stays legible under reduced motion. */
  @property({ type: Boolean, reflect: true }) streaming = false;

  /** The text copied to the clipboard by the copy button. Empty hides the button. */
  @property({ attribute: 'copy-text' }) copyText = '';

  /** The download URL, sanitized through `safeMediaSrc()` before use. Empty hides the button. */
  @property({ attribute: 'download-src' }) downloadSrc = '';

  /** The suggested filename reported in the `lr-download` event detail. */
  @property({ attribute: 'download-name' }) downloadName = '';

  @state() private hasCodeSlot = false;

  protected willUpdate(): void {
    if (!this.hasUpdated) {
      this.hasCodeSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'code');
    }
  }

  private onCodeSlotChange = (e: Event): void => {
    this.hasCodeSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private setView(view: 'preview' | 'code'): void {
    this.view = view;
    this.emit('lr-view-change', { view });
  }

  private get currentIndex(): number {
    if (this.activeVersionId === null) return this.versions.length - 1;
    const index = this.versions.findIndex((v) => v.id === this.activeVersionId);
    return index >= 0 ? index : this.versions.length - 1;
  }

  private goToVersion(index: number): void {
    const version = this.versions[index];
    if (!version) return;
    const isLatest = index === this.versions.length - 1;
    this.activeVersionId = isLatest ? null : version.id;
    this.emit('lr-version-change', { versionId: version.id });
    (this.renderRoot.querySelector('lr-live-region') as LyraLiveRegion | null)?.announce(
      this.localize('artifactPanelVersionPosition', undefined, {
        index: index + 1,
        count: this.versions.length,
      }),
    );
  }

  private onCopy = (): void => {
    try {
      // navigator.clipboard is absent in insecure contexts / older browsers, and some engines
      // throw synchronously rather than rejecting -- either way this is best-effort; lr-copy
      // fires regardless of whether the OS clipboard was actually reached.
      void navigator.clipboard?.writeText(this.copyText)?.catch(() => {});
    } catch {
      // see above
    }
    this.emit('lr-copy', { text: this.copyText });
  };

  private onDownload = (): void => {
    const safeSrc = safeMediaSrc(this.downloadSrc);
    if (!safeSrc) return;
    this.emit('lr-download', { filename: this.downloadName, src: safeSrc });
  };

  render(): TemplateResult {
    const hasVersions = this.versions.length > 0;
    const index = this.currentIndex;
    const isLatest = this.activeVersionId === null || index === this.versions.length - 1;
    return html`
      <div part="base">
        <lr-live-region mode="polite"></lr-live-region>
        <div part="header">
          ${this.label ? html`<span part="label">${this.label}</span>` : nothing}
          ${this.kind ? html`<span part="kind">${this.kind}</span>` : nothing}
          ${this.hasCodeSlot
            ? html`
                <div part="view-toggle" role="group" aria-label=${this.localize('artifactPanelLabel')}>
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
                    ‹
                  </button>
                  <span part="version-position"
                    >${this.localize('artifactPanelVersionPosition', undefined, {
                      index: index + 1,
                      count: this.versions.length,
                    })}</span
                  >
                  <button
                    part="version-next"
                    type="button"
                    aria-label=${this.localize('artifactPanelNextVersion')}
                    ?disabled=${index >= this.versions.length - 1}
                    @click=${() => this.goToVersion(index + 1)}
                  >
                    ›
                  </button>
                  ${!isLatest
                    ? html`<button
                        part="restore-button"
                        type="button"
                        @click=${() => this.emit('lr-restore', { versionId: this.versions[index].id })}
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
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-artifact-panel': LyraArtifactPanel;
  }
}
