import { SnapshotProperty } from '../../../internal/collection-source-tracker.js';
import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { property, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { hostAriaLabel, srOnly } from '../../../internal/a11y.js';
import { styles } from './env-list.styles.js';
import { normalizeLabel } from '../../../internal/accessible-name.js';
import { bdi } from '../../../internal/bidi.js';
import { KeyedCopyFeedback, reportCopyOutcome } from '../../../internal/record-copy-feedback.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import {
  writeClipboardText,
  type LyraClipboardWriteFailure,
  type LyraClipboardWriteSuccess,
} from '../../../internal/clipboard.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_envListCopy, LYRA_DEFAULT_envListHide, LYRA_DEFAULT_envListLabel, LYRA_DEFAULT_envListLimit, LYRA_DEFAULT_envListReveal } from '../../../internal/default-strings/data.generated.js';
import { LYRA_DEFAULT_copied, LYRA_DEFAULT_copy, LYRA_DEFAULT_copyFailed, LYRA_DEFAULT_envListValueHidden, LYRA_DEFAULT_noData } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

const MASK = '•'.repeat(8);
const MAX_ENV_ENTRIES = 10_000;
/** Rows rendered at once; the remaining retained entries are counted in the limit notice. */
const MAX_RENDERED_ENV_ENTRIES = 500;

export interface EnvEntry {
  readonly name: string;
  readonly value: string;
  readonly secret?: boolean;
}

export interface LyraEnvListEventMap {
  'lr-reveal-change': CustomEvent<Readonly<{ envName: string; revealed: boolean }>>;
  'lr-copy': CustomEvent<LyraClipboardWriteSuccess>;
  'lr-copy-error': CustomEvent<LyraClipboardWriteFailure>;
  'lr-error': CustomEvent<null>;
}

/**
 * `<lr-env-list>` — masked key/value list for environment variables and secrets, with per-row
 * reveal and copy. Masking is presentational, not a security boundary: the real value sits in a DOM
 * property regardless of mask state. Entry identity is a unique nonempty `name`; malformed,
 * blank-name, and later duplicate records are omitted first-wins before render, reveal state,
 * copy actions, and reveal events.
 *
 * @customElement lr-env-list
 * @event lr-reveal-change - `detail: { envName, revealed }`.
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
 * @csspart reveal-button - The per-row reveal/hide toggle, omitted while `without-reveal` is set.
 * @csspart copy-button - The per-row copy button, omitted while `without-copy-button` is set.
 * @csspart limit - Localized notice shown when more entries exist than the first 500 rendered rows,
 *   counting both retained entries past that render cap and input beyond the 10,000-entry ceiling.
 * @cssprop [--lr-env-list-reveal-active-bg=var(--lr-color-brand-quiet)] - Background of a revealed
 *   entry's reveal button, and the base its hover/press mixes from.
 * @cssprop [--lr-env-list-reveal-active-border=var(--lr-color-brand)] - Border color of a revealed
 *   entry's reveal button. Restyling that state otherwise requires overriding the library-wide
 *   brand tokens, since an attribute selector cannot follow `::part()`.
 * @cssprop [--lr-env-list-button-hover-bg=var(--lr-color-brand-quiet)] - Reveal/copy button fill while
 *   hovered; the pressed fill mixes from it.
 * @cssprop [--lr-env-list-button-active-bg] - Reveal/copy button fill while pressed.
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
    envListLimit: LYRA_DEFAULT_envListLimit,
    envListReveal: LYRA_DEFAULT_envListReveal,
    envListValueHidden: LYRA_DEFAULT_envListValueHidden,
    noData: LYRA_DEFAULT_noData,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, srOnly];

  private readonly entriesSnapshot = new SnapshotProperty<readonly EnvEntry[]>([], value => this.snapshotEntries(value));
  private omittedEntryCount = 0;

  /** Clone-owned readonly name/value entries, in order, bounded to the first 10,000 source entries;
   * the first 500 render as rows and a localized `limit` note counts the rest. Malformed records, blank names, and later duplicate names are skipped; the
   * first valid occurrence owns render, reveal, copy, and event identity. Reassign to update. */
  @property({ attribute: false })
  get entries(): readonly EnvEntry[] { return this.entriesSnapshot.read(); }
  set entries(value: readonly EnvEntry[]) {
    this.entriesSnapshot.assign(this, 'entries', value);
  }

  private snapshotEntries(value: unknown): readonly EnvEntry[] {
    const next: EnvEntry[] = [];
    const seen = new Set<string>();
    this.omittedEntryCount = Array.isArray(value) ? Math.max(0, value.length - MAX_ENV_ENTRIES) : 0;
    if (Array.isArray(value)) {
      for (const candidate of value.slice(0, MAX_ENV_ENTRIES)) {
        try {
          if (!candidate || typeof candidate.name !== 'string' || typeof candidate.value !== 'string') continue;
          const name = candidate.name;
          if (name.trim().length === 0 || seen.has(name)) continue;
          next.push(Object.freeze({
            name,
            value: candidate.value,
            ...(candidate.secret === undefined ? {} : { secret: Boolean(candidate.secret) }),
          }));
          seen.add(name);
        } catch {
          // Retain later valid entries when a hostile record getter fails.
        }
      }
    }
    return Object.freeze(next);
  }

  /** Omits every secret entry's reveal/hide toggle, so secrets stay masked. Turning it on also
   *  re-masks any entry that was revealed. */
  @property({ type: Boolean, reflect: true, attribute: 'without-reveal' }) withoutReveal = false;

  /** Omits every entry's copy-to-clipboard button. */
  @property({ type: Boolean, reflect: true, attribute: 'without-copy-button' })
  withoutCopyButton = false;

  /** Accessible name for the list; falls back to a localized default when unset. An explicitly
   *  empty string renders as an empty label rather than falling back. */
  @property() label?: string;

  @state() private revealed = new Map<string, boolean>();

  private readonly announcements = new AnnouncementSinkController(this, { eager: ['polite'] });
  private readonly copyFeedback = new KeyedCopyFeedback(this);
  private droppedReveals: string[] = [];
  private copyGeneration = 0;

  override disconnectedCallback(): void {
    this.copyGeneration += 1;
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.announcements.adopted();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('withoutReveal') && this.withoutReveal && this.revealed.size > 0) {
      this.dropReveals(new Map());
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
      this.dropReveals(next);
    }
  }

  private dropReveals(next: Map<string, boolean>): void {
    for (const [name, isRevealed] of this.revealed) {
      if (isRevealed && next.get(name) !== true) this.droppedReveals.push(name);
    }
    this.revealed = next;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const dropped = this.droppedReveals;
    if (dropped.length === 0) return;
    this.droppedReveals = [];
    for (const envName of dropped) this.emit('lr-reveal-change', Object.freeze({ envName, revealed: false }));
  }

  private toggleReveal(envName: string): void {
    const isRevealed = !(this.revealed.get(envName) ?? false);
    const next = new Map(this.revealed);
    next.set(envName, isRevealed);
    this.revealed = next;
    this.emit('lr-reveal-change', Object.freeze({ envName, revealed: isRevealed }));
  }

  private async copy(entry: EnvEntry): Promise<void> {
    const text = entry.value;
    const owner = this.isConnected ? this.ownerDocument.defaultView : null;
    const generation = ++this.copyGeneration;
    const outcome = await writeClipboardText(owner, text);
    const current = (): boolean =>
      this.isConnected &&
      this.ownerDocument.defaultView === owner &&
      generation === this.copyGeneration &&
      this.entries.some((candidate) => candidate.name === entry.name && candidate.value === text);
    if (!current()) return;
    this.copyFeedback.show(entry.name, outcome.ok);
    reportCopyOutcome(
      {
        emit: (name, detail) => {
          if (name === 'lr-copy') this.emit('lr-copy', detail as LyraClipboardWriteSuccess);
          else if (name === 'lr-error') this.emit('lr-error');
          else this.emit('lr-copy-error', detail as LyraClipboardWriteFailure);
        },
        announce: (ok) => this.announcements.announcePolite(this.localize(ok ? 'copied' : 'copyFailed')),
      },
      outcome,
      current,
    );
  }

  private get accessibleLabel(): string {
    const host = hostAriaLabel(this);
    if (host === '') return '';
    return normalizeLabel(host) ?? (this.label === '' ? '' : normalizeLabel(this.label) ?? this.localize('envListLabel'));
  }

  private renderLimit(): TemplateResult | typeof nothing {
    const shown = Math.min(this.entries.length, MAX_RENDERED_ENV_ENTRIES);
    const omitted = this.entries.length - shown + this.omittedEntryCount;
    return omitted > 0
      ? html`<p part="limit" role="note">${this.localize('envListLimit', undefined, {
          count: this.formatLocaleNumber(shown),
          omitted: this.formatLocaleNumber(omitted),
        })}</p>`
      : nothing;
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
        ${repeat(this.entries.slice(0, MAX_RENDERED_ENV_ENTRIES), (entry) => entry.name, (entry) => {
          const secret = entry.secret ?? true;
          const isRevealed = this.revealed.get(entry.name) ?? false;
          const masked = secret && !isRevealed;
          const feedback = this.copyFeedback.for(entry.name);
          return html`
            <dt part="name">${bdi(entry.name)}</dt>
            <dd part="value-cell">
              <span part="value" data-masked=${masked ? 'true' : 'false'}>
                ${masked
                  ? html`
                      <span class="sr-only">${this.localize('envListValueHidden')}</span>
                      <span aria-hidden="true">${MASK}</span>
                    `
                  : bdi(entry.value)}
              </span>
              ${!this.withoutReveal && secret
                ? html`<button
                    part="reveal-button"
                    type="button"
                    ?data-revealed=${isRevealed}
                    @click=${() => this.toggleReveal(entry.name)}
                  >
                    ${isRevealed
                      ? this.localize('envListHide', undefined, { name: entry.name })
                      : this.localize('envListReveal', undefined, { name: entry.name })}
                  </button>`
                : nothing}
              ${!this.withoutCopyButton
                ? html`<button
                    part="copy-button"
                    type="button"
                    aria-label=${feedback ? nothing : this.localize('envListCopy', undefined, { name: entry.name })}
                    data-copy-state=${ifDefined(feedback ? (feedback.ok ? 'copied' : 'failed') : undefined)}
                    @click=${() => void this.copy(entry)}
                  >
                    ${feedback ? this.localize(feedback.ok ? 'copied' : 'copyFailed') : this.localize('copy')}
                  </button>`
                : nothing}
            </dd>
          `;
        })}
      </dl>
      ${this.renderLimit()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-env-list': LyraEnvList;
  }
}
