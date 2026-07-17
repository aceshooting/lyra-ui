import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './env-list.styles.js';
// The registering barrel, not the bare .class.js module -- this side effect is what
// registers <lyra-empty> so it's actually defined when this component renders it.
import '../empty/empty.js';

const MASK = '•'.repeat(8);

export interface EnvEntry {
  name: string;
  value: string;
  secret?: boolean;
}

export interface LyraEnvListEventMap {
  'lyra-reveal-change': CustomEvent<{ name: string; revealed: boolean }>;
  'lyra-copy': CustomEvent<{ text: string }>;
}

/**
 * `<lyra-env-list>` — masked key/value list for environment variables and secrets, with per-row
 * reveal and copy. Masking is presentational, not a security boundary: the real value sits in a DOM
 * property regardless of mask state.
 *
 * @customElement lyra-env-list
 * @event lyra-reveal-change - `detail: { name, revealed }`.
 * @event lyra-copy - `detail: { text }` — the real (unmasked) value.
 * @csspart base - The `<dl>` root.
 * @csspart name - The `<dt>` name text.
 * @csspart value-cell - The `<dd>` wrapping one entry's value text and its buttons; buttons live
 * here (not as siblings of `<dt>`/`<dd>`) so the `<dl>` keeps a valid dt/dd content model.
 * @csspart value - The value text itself; carries `data-masked`.
 * @csspart reveal-button - The per-row reveal/hide toggle.
 * @csspart copy-button - The per-row copy button.
 */
export class LyraEnvList extends LyraElement<LyraEnvListEventMap> {
  static styles = [LyraElement.styles, styles];

  /** The name/value entries to render, in order. */
  @property({ attribute: false }) entries: EnvEntry[] = [];

  /** Whether each secret entry gets a reveal/hide toggle. */
  @property({ type: Boolean, reflect: true }) revealable = true;

  /** Whether each entry gets a copy-to-clipboard button. */
  @property({ type: Boolean, reflect: true }) copyable = true;

  /** Accessible name for the list; falls back to a localized default. */
  @property() label = '';

  @state() private revealed = new Map<string, boolean>();

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('entries')) {
      // Carry a row's reveal state forward only when that row's position still holds
      // the same name it held before this update -- reordering, inserting, or
      // removing rows resets the shifted rows to masked rather than leaking a stale
      // reveal onto an entry the consumer didn't actually ask to reveal.
      const previous = (changed.get('entries') as EnvEntry[] | undefined) ?? [];
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
    this.emit('lyra-reveal-change', { name, revealed: isRevealed });
  }

  private copy(entry: EnvEntry): void {
    try {
      void navigator.clipboard?.writeText(entry.value)?.catch(() => {});
    } catch {
      // Clipboard access can throw synchronously (e.g. insecure context or a
      // permissions-policy block); the `lyra-copy` event still fires below so
      // a host can implement its own fallback.
    }
    this.emit('lyra-copy', { text: entry.value });
  }

  render(): TemplateResult {
    if (this.entries.length === 0) {
      return html`<lyra-empty heading=${this.localize('noData')}></lyra-empty>`;
    }
    return html`
      <dl part="base" aria-label=${this.label || this.localize('envListLabel')}>
        ${this.entries.map((entry) => {
          const secret = entry.secret ?? true;
          const isRevealed = this.revealed.get(entry.name) ?? false;
          const masked = secret && !isRevealed;
          return html`
            <dt part="name">${entry.name}</dt>
            <dd part="value-cell">
              <span part="value" data-masked=${masked ? 'true' : 'false'}>
                ${masked
                  ? html`<span aria-label=${this.localize('envListValueHidden')}>${MASK}</span>`
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
                    @click=${() => this.copy(entry)}
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
    'lyra-env-list': LyraEnvList;
  }
}
