import { collectionSupport } from '../../../internal/collection-snapshot.js';
import { tag } from '../../../internal/prefix.js';
import type { PropertyValues } from 'lit';
import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { safeDownloadHref } from '../../../internal/safe-url.js';
import type { LyraClipboardWriteFailure, LyraClipboardWriteSuccess } from '../../../internal/clipboard.js';
import { RecordCopyFeedback, reportCopyOutcome } from '../../../internal/record-copy-feedback.js';
import { deepActiveElementIn } from '../../../internal/active-element.js';
import { composedContains } from '../../../internal/composed-tree.js';
import { restoreComposedFocus } from '../../../internal/focus-repair.js';
import { styles } from './artifact-panel.styles.js';
import { agentActionButtonStyles } from '../agent-action-button.styles.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import { firstByIdentity } from '../../../internal/collection-identity.js';
import { chevronIcon } from '../../../internal/icons.js';
import { requestThenCommit } from '../../../internal/request-commit.js';
import { trackScrollRegions } from '../../../internal/scroll-region.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_artifactPanelCode, LYRA_DEFAULT_artifactPanelGenerating, LYRA_DEFAULT_artifactPanelLabel, LYRA_DEFAULT_artifactPanelNextVersion, LYRA_DEFAULT_artifactPanelPreview, LYRA_DEFAULT_artifactPanelPreviousVersion, LYRA_DEFAULT_artifactPanelRestore, LYRA_DEFAULT_artifactPanelVersionPosition } from '../../../internal/default-strings/agent-tools.generated.js';
import { LYRA_DEFAULT_copied, LYRA_DEFAULT_copy, LYRA_DEFAULT_copyFailed, LYRA_DEFAULT_download } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface ArtifactVersion {
  id: string;
  label?: string;
}

/** Which slot is currently visible in `<lr-artifact-panel>`. */
export type ArtifactPanelView = 'preview' | 'code';

export interface LyraArtifactPanelEventMap {
  'lr-artifact-view-change-request': CustomEvent<{ view: ArtifactPanelView; previousView: ArtifactPanelView }>;
  'lr-artifact-view-change': CustomEvent<{ view: ArtifactPanelView }>;
  'lr-version-change': CustomEvent<{ versionId: string }>;
  'lr-restore': CustomEvent<{ versionId: string }>;
  'lr-copy': CustomEvent<LyraClipboardWriteSuccess>;
  'lr-error': CustomEvent<null>;
  'lr-copy-error': CustomEvent<LyraClipboardWriteFailure>;
  'lr-download': CustomEvent<{ filename: string; src: string }>;
}

/**
 * `<lr-artifact-panel>` — shell around one agent-generated artifact: a
 * title/kind header, a preview<->code toggle, version navigation with
 * restore, a streaming indicator, and built-in copy/download actions.
 * Renders none of the artifact itself — content is slotted. Version ids are stable identities;
 * empty/blank ids are omitted and duplicates normalize before navigation, labels, restore actions,
 * and counts, first-wins.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-artifact-panel
 * @event lr-artifact-view-change-request - `detail: { view, previousView }`. Cancelable; fired before a
 *   preview/code toggle press changes `view`. Preventing it keeps the current view; a listener
 *   that assigns a different `view` keeps its own assignment.
 * @event lr-artifact-view-change - `detail: { view }`. Fired when the preview/code toggle changes.
 * @event lr-version-change - `detail: { versionId }`. Fired when the previous/next
 *   navigation moves to a different version, and after an update in which a `versions`
 *   reassignment dropped the active version id: `activeVersionId` then resets to `null` ("the
 *   latest version") and the event names the latest version now shown, so a host binding
 *   `activeVersionId` can follow. An empty `versions` list shows no version and fires nothing.
 * @event lr-restore - `detail: { versionId }`. Fired by the restore-this-version button only
 *   while `hideRestore` is false; mutates nothing itself — `versions` and the resulting content stay host-owned state.
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
 *   version isn't the latest one and `hideRestore` is false.
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
  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze(['versions']);

  static override styles = [LyraElement.styles, styles, agentActionButtonStyles];

  /** The artifact's title, shown in the header. Optional. Omitting it localizes the default
   *  `artifactPanelLabel` message for the view-toggle group's accessible name (and shows no
   *  visible title); an explicit empty string also renders no visible/accessible label. */
  @property() label?: string;

  /** A short kind label (e.g. `document`, `code`), shown as a badge next to `label`. */
  @property() kind = '';

  /** Which slot is currently visible. */
  @property({ reflect: true }) view: ArtifactPanelView = 'preview';

  /** The artifact's version history, oldest first. The last entry is the latest version. Empty/blank
   *  ids are omitted and duplicates normalize first-wins before navigation, counts, and events. */
  @property({ attribute: false }) versions: readonly ArtifactVersion[] = [];

  /** The currently viewed version's id, or `null` to mean "the latest version". */
  @property({ attribute: 'active-version-id' }) activeVersionId: string | null = null;

  /** Hide the built-in Restore action while keeping version browsing available. This controls
   *  presentation only; the host remains responsible for authorizing restoration. */
  @property({ type: Boolean, reflect: true, attribute: 'hide-restore' }) hideRestore = false;

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

  private readonly copyFeedback = new RecordCopyFeedback(this, () => this.copyText, (outcome) => {
    const liveRegion = this.renderRoot.querySelector(tag('live-region')) as LyraLiveRegion | null;
    reportCopyOutcome(
      {
        emit: (name, detail) => {
          if (name === 'lr-copy') this.emit('lr-copy', detail as LyraClipboardWriteSuccess);
          else if (name === 'lr-error') this.emit('lr-error');
          else this.emit('lr-copy-error', detail as LyraClipboardWriteFailure);
        },
        announce: (ok) => liveRegion?.announce(this.localize(ok ? 'copied' : 'copyFailed')),
      },
      outcome,
    );
  });

  private versionsCache?: { source: unknown; versions: ArtifactVersion[] };
  private viewCoerced = false;
  private versionCoerced = false;

  private get normalizedVersions(): ArtifactVersion[] {
    const source = this.versions;
    if (this.versionsCache?.source === source) return this.versionsCache.versions;
    const versions = firstByIdentity(Array.isArray(source) ? source : [], (version) => version.id);
    this.versionsCache = { source, versions };
    return versions;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.seedFirstRenderState(() => {
      this.hasCodeSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'code');
    });
    if (!this.renderSlotPresence(this.hasCodeSlot) && this.view === 'code') {
      this.view = 'preview';
      this.viewCoerced = this.hasUpdated;
    }
    if (
      this.activeVersionId !== null &&
      (changed.has('versions') || changed.has('activeVersionId')) &&
      !this.normalizedVersions.some((version) => version.id === this.activeVersionId)
    ) {
      this.activeVersionId = null;
      this.removeAttribute('active-version-id');
      this.versionCoerced = this.hasUpdated;
    }
  }

  // A forwarding slot can transiently empty WebKit's assignedElements() snapshot.
  private onCodeSlotChange = (): void => {
    this.hasCodeSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'code');
    if (!this.hasCodeSlot && this.view === 'code') {
      this.view = 'preview';
      this.emit('lr-artifact-view-change', { view: 'preview' });
    }
  };

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.viewCoerced) {
      this.viewCoerced = false;
      this.emit('lr-artifact-view-change', { view: this.view });
    }
    if (this.versionCoerced) {
      this.versionCoerced = false;
      const latest = this.normalizedVersions.at(-1);
      if (this.activeVersionId === null && latest) this.emit('lr-version-change', { versionId: latest.id });
    }
  }

  private get accessibleLabel(): string {
    return this.label == null ? this.localize('artifactPanelLabel') : this.label;
  }

  private requestView(view: ArtifactPanelView): void {
    const previousView = this.view;
    if (view === previousView) return;
    requestThenCommit({
      requestDetail: { view, previousView },
      emitRequest: (detail, init: { cancelable: true }) => this.emit('lr-artifact-view-change-request', detail, init),
      commit: () => {
        if (this.view !== previousView) return;
        this.view = view;
        this.emit('lr-artifact-view-change', { view });
      },
    });
  }

  private get currentIndex(): number {
    const versions = this.normalizedVersions;
    if (this.activeVersionId === null) return versions.length - 1;
    const index = versions.findIndex((v) => v.id === this.activeVersionId);
    return index >= 0 ? index : versions.length - 1;
  }

  private goToVersion(index: number, counterpart: 'version-previous' | 'version-next'): void {
    const versions = this.normalizedVersions;
    const version = versions[index];
    if (!version) return;
    const active = deepActiveElementIn(this.ownerDocument);
    const hadFocus = active !== null && composedContains(this, active);
    const isLatest = index === versions.length - 1;
    this.activeVersionId = isLatest ? null : version.id;
    this.emit('lr-version-change', { versionId: version.id });
    (this.renderRoot.querySelector(tag('live-region')) as LyraLiveRegion | null)?.announce(
      this.localize('artifactPanelVersionPosition', undefined, {
        index: this.formatLocaleNumber(index + 1),
        count: this.formatLocaleNumber(versions.length),
      }),
    );
    if (hadFocus) {
      void this.updateComplete.then(() =>
        restoreComposedFocus(this, true, this.renderRoot.querySelector<HTMLElement>(`[part="${counterpart}"]`)),
      );
    }
  }

  private onRestore(versionId: string): void {
    if (this.hideRestore) return;
    const versions = this.normalizedVersions;
    const index = this.currentIndex;
    const version = versions[index];
    if (!version || version.id !== versionId || this.activeVersionId === null || index === versions.length - 1) return;
    this.emit('lr-restore', { versionId: version.id });
  }

  private onCopy = (): void => {
    void this.copyFeedback.write(this.copyText);
  };

  private onDownload = (): void => {
    const safeSrc = safeDownloadHref(this.downloadSrc);
    if (!safeSrc) return;
    this.emit('lr-download', { filename: this.downloadName, src: safeSrc });
  };

  constructor() {
    super();
    // Slotted prose or an image taller than a capped panel has nothing tabbable to scroll by.
    trackScrollRegions(this, () => {
      const el = this.renderRoot.querySelector<HTMLElement>('[part="body"]');
      return [el && { el, name: this.accessibleLabel }];
    });
  }

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
          ${this.renderSlotPresence(this.hasCodeSlot)
            ? html`
                <div part="view-toggle" role="group" aria-label=${this.accessibleLabel}>
                  <button
                    part="view-button"
                    type="button"
                    data-view="preview"
                    aria-pressed=${this.view === 'preview' ? 'true' : 'false'}
                    @click=${() => this.requestView('preview')}
                  >
                    ${this.localize('artifactPanelPreview')}
                  </button>
                  <button
                    part="view-button"
                    type="button"
                    data-view="code"
                    aria-pressed=${this.view === 'code' ? 'true' : 'false'}
                    @click=${() => this.requestView('code')}
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
                    @click=${() => this.goToVersion(index - 1, 'version-next')}
                  >
                    <span part="version-previous-glyph" aria-hidden="true">${chevronIcon()}</span>
                  </button>
                  <span part="version-position"
                    >${this.localize('artifactPanelVersionPosition', undefined, {
                      index: this.formatLocaleNumber(index + 1),
                      count: this.formatLocaleNumber(versions.length),
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
                    @click=${() => this.goToVersion(index + 1, 'version-previous')}
                  >
                    <span part="version-next-glyph" aria-hidden="true">${chevronIcon()}</span>
                  </button>
                  ${!isLatest && !this.hideRestore
                    ? html`<button
                        part="restore-button"
                        data-agent-action="neutral"
                        type="button"
                        @click=${() => this.onRestore(currentVersion!.id)}
                      >
                        ${this.localize('artifactPanelRestore')}
                      </button>`
                    : nothing}
                </div>
              `
            : nothing}
          <slot name="actions" part="actions"></slot>
          ${this.copyText
            ? html`<button part="copy-button" data-agent-action="neutral" type="button" data-copy-status=${this.copyFeedback.status} @click=${this.onCopy}>${
                this.copyFeedback.status === 'success'
                  ? this.localize('copied')
                  : this.copyFeedback.status === 'error'
                    ? this.localize('copyFailed')
                    : this.localize('copy')
              }</button>`
            : nothing}
          ${this.downloadSrc
            ? html`<button part="download-button" data-agent-action="neutral" type="button" @click=${this.onDownload}>
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
