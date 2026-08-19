import { html, svg, nothing, type PropertyValues, type TemplateResult, type SVGTemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getDateTimeFormat } from '../../../internal/intl-cache.js';
import { spinnerIcon } from '../../../internal/icons.js';
import { styles } from './checkpoint.styles.js';
import { normalizeLyraTimestamp, type LyraTimestamp } from '../timestamp.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { nextId } from '../../../internal/a11y.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_cancel, LYRA_DEFAULT_checkpointConfirmPrompt, LYRA_DEFAULT_checkpointLabel, LYRA_DEFAULT_checkpointRestore, LYRA_DEFAULT_checkpointRestoreWithContext, LYRA_DEFAULT_checkpointRestoring, LYRA_DEFAULT_confirm } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface CheckpointRestoreDetail {
  checkpointId: string;
  label: string;
}

export interface LyraCheckpointEventMap {
  'lr-restore': CustomEvent<CheckpointRestoreDetail>;
}

// Mirrors the shared icon set's viewBox/stroke conventions (internal/icons.ts) without adding a
// checkpoint-specific glyph there.
function bookmarkIcon(): SVGTemplateResult {
  return svg`
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    ><path d="M6 3h12a1 1 0 0 1 1 1v16l-7-4-7 4V4a1 1 0 0 1 1-1Z"></path></svg>
  `;
}

/** `hour:minute` in the component's effective locale. The `'en'` guard mirrors the library-wide
 *  locale-resolution fallback — an empty locale string would make the `Intl.DateTimeFormat`
 *  constructor throw. */
function defaultFormatTimestamp(date: Date, locale: string): string {
  return getDateTimeFormat(locale || 'en', { hour: 'numeric', minute: '2-digit' }).format(date);
}

/** `true`-defaulting boolean attribute converter -- Lit's default presence-based `type: Boolean`
 *  can never be set back to `false` from a plain-HTML attribute once the property's own default is
 *  `true` (removing an attribute that was never present fires no `attributeChangedCallback`), so
 *  `fromAttribute` checks the literal string instead. Shared by both `restorable` and
 *  `confirmRestore`, which have the identical `true`-default parsing need. */

/**
 * `<lr-checkpoint>` — an inline conversation restore point: a labeled marker between messages
 * whose Restore affordance confirms inline, then hands the host a `lr-restore` event. This
 * component persists and restores nothing itself — host state in, events out.
 *
 * @customElement lr-checkpoint
 * @slot - Optional supplemental content under the marker row (e.g. what changed since this
 *   point).
 * @event lr-restore - Restore was activated (after the inline confirm step, when
 *   `confirmRestore` is on). `detail: { checkpointId, label }`. Not cancelable — a request; this
 *   component performs no default action and stores nothing.
 * @csspart base - The marker root (`role="group"`).
 * @csspart line - Each of the two flanking rules.
 * @csspart icon - The bookmark glyph.
 * @csspart label - The computed label text.
 * @csspart timestamp - The formatted `timestamp`, when set.
 * @csspart restore-button - The Restore button. Only rendered while `restorable`.
 * @csspart confirm-group - The inline confirm prompt, swapped in for `restore-button` while
 *   confirming.
 * @csspart confirm-prompt - The confirm prompt text.
 * @csspart confirm-button - Confirms the restore, firing `lr-restore`.
 * @csspart cancel-button - Cancels, reverting to `restore-button`.
 * @cssprop [--lr-checkpoint-spin-duration=var(--lr-transition-ambient)] - Restoring-spinner
 *   timing, inheriting the shared ambient-motion token by default (stopped under reduced motion).
 * @status stable
 * @since 4.0.0
 */
export class LyraCheckpoint extends LyraElement<LyraCheckpointEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    cancel: LYRA_DEFAULT_cancel,
    checkpointConfirmPrompt: LYRA_DEFAULT_checkpointConfirmPrompt,
    checkpointLabel: LYRA_DEFAULT_checkpointLabel,
    checkpointRestore: LYRA_DEFAULT_checkpointRestore,
    checkpointRestoreWithContext: LYRA_DEFAULT_checkpointRestoreWithContext,
    checkpointRestoring: LYRA_DEFAULT_checkpointRestoring,
    confirm: LYRA_DEFAULT_confirm,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** Opaque id echoed in the `lr-restore` event detail. */
  @property({ attribute: 'checkpoint-id' }) checkpointId = '';

  /** Checkpoint name. The generic `'Checkpoint'` fallback renders while empty. */
  @property() label = '';

  /** Optional creation time, rendered as `<time datetime>`, default `hour:minute` in
   *  `effectiveLocale`. Invalid strings are treated as unset. */
  @property({ attribute: false }) timestamp?: LyraTimestamp;

  /** Overrides the default `hour:minute` rendering of `timestamp`. */
  @property({ attribute: false }) formatTimestamp?: (date: Date) => string;

  /** When `false`, renders a plain marker with no button — for read-only views, or the currently-
   *  restored checkpoint. */
  @property({ converter: trueDefaultBooleanConverter }) restorable = true;

  /** Gates the `lr-restore` event behind the inline confirm step. */
  @property({ attribute: 'confirm-restore', converter: trueDefaultBooleanConverter }) confirmRestore = true;

  /** Host-set busy state: the Restore button becomes `aria-disabled="true"` with a spinner beside
   *  the localized "Restoring…" text. */
  @property({ type: Boolean, reflect: true }) restoring = false;

  @state() private confirming = false;

  private readonly confirmPromptId = nextId('checkpoint-confirm-prompt');
  private focusGeneration = 0;

  private get computedLabel(): string {
    return this.label || this.localize('checkpointLabel');
  }

  private get normalizedTimestamp(): Date | undefined {
    return normalizeLyraTimestamp(this.timestamp);
  }

  private fireRestore(): void {
    this.emit('lr-restore', {
      checkpointId: this.checkpointId,
      label: this.computedLabel,
    });
  }

  private onRestoreClick = (): void => {
    if (!this.restorable || this.restoring || this.confirming) return;
    if (!this.confirmRestore) {
      this.fireRestore();
      return;
    }
    this.confirming = true;
    const generation = ++this.focusGeneration;
    void this.updateComplete.then(() => {
      if (generation !== this.focusGeneration || !this.isConnected || !this.confirming) return;
      (this.renderRoot.querySelector('[part="confirm-button"]') as HTMLButtonElement | null)?.focus();
    });
  };

  private revertToRestore(refocus: boolean): void {
    if (!this.confirming) return;
    this.confirming = false;
    const generation = ++this.focusGeneration;
    if (refocus) {
      void this.updateComplete.then(() => {
        if (
          generation !== this.focusGeneration ||
          !this.isConnected ||
          this.confirming ||
          !this.restorable ||
          this.restoring
        ) return;
        (this.renderRoot.querySelector('[part="restore-button"]') as HTMLButtonElement | null)?.focus();
      });
    }
  }

  private onConfirmClick = (): void => {
    if (!this.confirming || !this.restorable || !this.confirmRestore || this.restoring) {
      this.revertToRestore(false);
      return;
    }
    this.revertToRestore(true);
    this.fireRestore();
  };

  private onCancelClick = (): void => this.revertToRestore(true);

  private onConfirmGroupKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.confirming) {
      e.stopPropagation();
      this.revertToRestore(true);
    }
  };

  private onConfirmGroupFocusOut = (e: FocusEvent): void => {
    const next = e.relatedTarget as Node | null;
    const group = this.renderRoot.querySelector('[part="confirm-group"]');
    if (group && (!next || !group.contains(next))) this.revertToRestore(false);
  };

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (
      this.confirming &&
      (changed.has('restorable') || changed.has('confirmRestore') || changed.has('restoring')) &&
      (!this.restorable || !this.confirmRestore || this.restoring)
    ) {
      this.confirming = false;
      this.focusGeneration++;
    }
  }

  override disconnectedCallback(): void {
    this.confirming = false;
    this.focusGeneration++;
    super.disconnectedCallback();
  }

  override click(): void {
    if (!this.restorable || this.restoring || this.confirming) return;
    (this.renderRoot.querySelector('[part="restore-button"]') as HTMLButtonElement | null)?.click();
  }

  override render(): TemplateResult {
    const label = this.computedLabel;
    const ariaLabel = this.getAttribute('aria-label') ?? label;
    const ts = this.normalizedTimestamp;
    const formatter = this.formatTimestamp ?? ((date: Date) => defaultFormatTimestamp(date, this.effectiveLocale));

    return html`
      <div part="base" role="group" aria-label=${ariaLabel}>
        <span part="line" aria-hidden="true"></span>
        <span part="icon" aria-hidden="true">${bookmarkIcon()}</span>
        <span part="label">${label}</span>
        ${ts ? html`<time part="timestamp" datetime=${ts.toISOString()}>${formatter(ts)}</time>` : nothing}
        ${this.restorable
          ? this.confirming
            ? html`
                <span
                  part="confirm-group"
                  @keydown=${this.onConfirmGroupKeyDown}
                  @focusout=${this.onConfirmGroupFocusOut}
                >
                  <span id=${this.confirmPromptId} part="confirm-prompt">${this.localize('checkpointConfirmPrompt')}</span>
                  <button
                    part="confirm-button"
                    type="button"
                    aria-describedby=${this.confirmPromptId}
                    @click=${this.onConfirmClick}
                  >
                    ${this.localize('confirm')}
                  </button>
                  <button
                    part="cancel-button"
                    type="button"
                    aria-describedby=${this.confirmPromptId}
                    @click=${this.onCancelClick}
                  >
                    ${this.localize('cancel')}
                  </button>
                </span>
              `
            : html`
                <button
                  part="restore-button"
                  type="button"
                  aria-label=${this.localize('checkpointRestoreWithContext', undefined, { label })}
                  aria-disabled=${this.restoring ? 'true' : 'false'}
                  @click=${this.onRestoreClick}
                >
                  ${this.restoring
                    ? html`<span class="restore-spinner" aria-hidden="true">${spinnerIcon()}</span>`
                    : nothing}
                  ${this.restoring ? this.localize('checkpointRestoring') : this.localize('checkpointRestore')}
                </button>
              `
          : nothing}
        <span part="line" aria-hidden="true"></span>
      </div>
      <slot></slot>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-checkpoint': LyraCheckpoint;
  }
}
