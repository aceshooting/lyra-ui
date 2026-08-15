import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { srOnly } from '../../../internal/a11y.js';
import { styles } from './env-list.styles.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import {
  writeClipboardText,
  type LyraClipboardWriteFailure,
  type LyraClipboardWriteSuccess,
} from '../../../internal/clipboard.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_copied, LYRA_DEFAULT_copy, LYRA_DEFAULT_copyFailed, LYRA_DEFAULT_envListCopy, LYRA_DEFAULT_envListHide, LYRA_DEFAULT_envListLabel, LYRA_DEFAULT_envListReveal, LYRA_DEFAULT_envListValueHidden, LYRA_DEFAULT_noData } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


const MASK = '•'.repeat(8);

/**
 * `true`-defaulting boolean attribute converter. Lit's built-in `type: Boolean` converter is
 * presence-based -- the attribute's mere presence (regardless of its string value) maps to `true`,
 * so a plain-markup consumer writing the literal `revealable="false"`/`copyable="false"` would
 * actually get `true` (these properties' default), the opposite of what that string reads as --
 * the same bug class `<lr-checkpoint>`'s `restorable`/`confirmRestore` converters document and fix.
 */

export interface EnvEntry {
  readonly name: string;
  readonly value: string;
  readonly secret?: boolean;
}

export interface LyraEnvListEventMap {
  'lr-reveal-change': CustomEvent<Readonly<{ name: string; revealed: boolean }>>;
  'lr-copy': CustomEvent<LyraClipboardWriteSuccess>;
  'lr-copy-error': CustomEvent<LyraClipboardWriteFailure>;
  'lr-error': CustomEvent<null>;
}

/**
 * `<lr-env-list>` — masked key/value list for environment variables and secrets, with per-row
 * reveal and copy. Masking is presentational, not a security boundary: the real value sits in a DOM
 * property regardless of mask state.
 *
 * @customElement lr-env-list
 * @event lr-reveal-change - `detail: { name, revealed }`.
 * @event lr-copy - A clipboard write fulfilled. Frozen detail: `{ ok: true, text }`, where text is
 *   the real (unmasked) value.
 * @event lr-copy-error - A clipboard write failed. Frozen detail:
 *   `{ ok: false, text, reason, error }`.
 * @event lr-error - A clipboard write failed; compatibility notification without raw error text.
 * @csspart base - The `<dl>` root.
 * @csspart name - The `<dt>` name text.
 * @csspart value-cell - The `<dd>` wrapping one entry's value text and its buttons; buttons live
 * here (not as siblings of `<dt>`/`<dd>`) so the `<dl>` keeps a valid dt/dd content model.
 * @csspart value - The value text itself; carries `data-masked`.
 * @csspart reveal-button - The per-row reveal/hide toggle.
 * @csspart copy-button - The per-row copy button.
 * @cssprop [--lr-env-list-reveal-active-bg=var(--lr-color-brand-quiet)] - Background of a pressed
 *   (revealed) reveal toggle.
 * @cssprop [--lr-env-list-reveal-active-border=var(--lr-color-brand)] - Border color of a pressed
 *   (revealed) reveal toggle. Restyling the pressed state otherwise requires overriding the
 *   library-wide brand tokens, since `::part(reveal-button)[aria-pressed]` is invalid CSS.
 * @status stable
 * @since 4.0.0
 */
export class LyraEnvList extends LyraElement<LyraEnvListEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    copied: LYRA_DEFAULT_copied,
    copy: LYRA_DEFAULT_copy,
    copyFailed: LYRA_DEFAULT_copyFailed,
    envListCopy: LYRA_DEFAULT_envListCopy,
    envListHide: LYRA_DEFAULT_envListHide,
    envListLabel: LYRA_DEFAULT_envListLabel,
    envListReveal: LYRA_DEFAULT_envListReveal,
    envListValueHidden: LYRA_DEFAULT_envListValueHidden,
    noData: LYRA_DEFAULT_noData,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, srOnly];

  private _entries: readonly EnvEntry[] = [];

  /** Clone-owned readonly name/value entries to render, in order. Malformed records are skipped. */
  @property({ attribute: false })
  get entries(): readonly EnvEntry[] { return this._entries; }
  set entries(value: readonly EnvEntry[]) {
    const previous = this._entries;
    const next: EnvEntry[] = [];
    if (Array.isArray(value)) {
      for (const candidate of value) {
        try {
          if (!candidate || typeof candidate.name !== 'string' || typeof candidate.value !== 'string') continue;
          next.push(Object.freeze({
            name: candidate.name,
            value: candidate.value,
            ...(candidate.secret === undefined ? {} : { secret: Boolean(candidate.secret) }),
          }));
        } catch {
          // Retain later valid entries when a hostile record getter fails.
        }
      }
    }
    this._entries = Object.freeze(next);
    this.requestUpdate('entries', previous);
  }

  /** Whether each secret entry gets a reveal/hide toggle. */
  @property({ reflect: true, converter: trueDefaultBooleanConverter }) revealable = true;

  /** Whether each entry gets a copy-to-clipboard button. */
  @property({ reflect: true, converter: trueDefaultBooleanConverter }) copyable = true;

  /** Accessible name for the list; falls back to a localized default. */
  @property() label = '';

  @state() private revealed = new Map<string, boolean>();

  private announcementSink?: AnnouncementSink;

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncAnnouncementSink();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.releaseAnnouncementSink();
  }

  private releaseAnnouncementSink(): void {
    this.announcementSink?.release();
    this.announcementSink = undefined;
  }

  private syncAnnouncementSink(): void {
    if (!this.isConnected) {
      this.releaseAnnouncementSink();
      return;
    }
    if (this.announcementSink?.element.ownerDocument === this.ownerDocument) return;
    this.releaseAnnouncementSink();
    this.announcementSink = acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('revealable') && !this.revealable && this.revealed.size > 0) {
      this.revealed = new Map();
    }
    if (changed.has('entries')) {
      // Carry a row's reveal state forward only when that row's position still holds
      // the same name it held before this update -- reordering, inserting, or
      // removing rows resets the shifted rows to masked rather than leaking a stale
      // reveal onto an entry the consumer didn't actually ask to reveal.
      const previous = (changed.get('entries') as readonly EnvEntry[] | undefined) ?? [];
      const next = new Map<string, boolean>();
      this.entries.forEach((entry, index) => {
        if (previous[index]?.name !== entry.name) return;
        const wasRevealed = this.revealed.get(entry.name);
        if (wasRevealed !== undefined) next.set(entry.name, wasRevealed);
      });
      this.revealed = next;
    }
  }

  private toggleReveal(name: string): void {
    const isRevealed = !(this.revealed.get(name) ?? false);
    const next = new Map(this.revealed);
    next.set(name, isRevealed);
    this.revealed = next;
    this.emit('lr-reveal-change', Object.freeze({ name, revealed: isRevealed }));
  }

  private async copy(entry: EnvEntry): Promise<void> {
    const text = entry.value;
    const owner = this.isConnected ? this.ownerDocument.defaultView : null;
    const outcome = await writeClipboardText(owner, text);
    if (!this.isConnected || this.ownerDocument.defaultView !== owner) return;
    if (outcome.ok) {
      this.announcementSink?.announce(this.localize('copied'));
      this.emit('lr-copy', outcome);
      return;
    }
    this.announcementSink?.announce(this.localize('copyFailed'));
    this.emit('lr-error');
    this.emit('lr-copy-error', outcome);
  }

  private get accessibleLabel(): string {
    return this.getAttribute('aria-label')?.trim() || this.label || this.localize('envListLabel');
  }

  override render(): TemplateResult {
    if (this.entries.length === 0) {
      return html`
        <div part="base" data-empty role="group" aria-label=${this.accessibleLabel}>
          <lr-empty heading=${this.localize('noData')}></lr-empty>
        </div>
      `;
    }
    return html`
      <dl part="base" aria-label=${this.accessibleLabel}>
        ${this.entries.map((entry) => {
          const secret = entry.secret ?? true;
          const isRevealed = this.revealed.get(entry.name) ?? false;
          const masked = secret && !isRevealed;
          return html`
            <dt part="name">${entry.name}</dt>
            <dd part="value-cell">
              <span part="value" data-masked=${masked ? 'true' : 'false'}>
                ${masked
                  ? html`
                      <span class="sr-only">${this.localize('envListValueHidden')}</span>
                      <span aria-hidden="true">${MASK}</span>
                    `
                  : entry.value}
              </span>
              ${this.revealable && secret
                ? html`<button
                    part="reveal-button"
                    type="button"
                    aria-pressed=${isRevealed ? 'true' : 'false'}
                    @click=${() => this.toggleReveal(entry.name)}
                  >
                    ${isRevealed
                      ? this.localize('envListHide', undefined, { name: entry.name })
                      : this.localize('envListReveal', undefined, { name: entry.name })}
                  </button>`
                : nothing}
              ${this.copyable
                ? html`<button
                    part="copy-button"
                    type="button"
                    aria-label=${this.localize('envListCopy', undefined, { name: entry.name })}
                    @click=${() => void this.copy(entry)}
                  >
                    ${this.localize('copy')}
                  </button>`
                : nothing}
            </dd>
          `;
        })}
      </dl>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-env-list': LyraEnvList;
  }
}
