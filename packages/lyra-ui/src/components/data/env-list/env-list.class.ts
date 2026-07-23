import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './env-list.styles.js';
// The registering barrel, not the bare .class.js module -- this side effect is what
// registers <lr-empty> so it's actually defined when this component renders it.
import '../../overlays/empty/empty.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';

const MASK = '•'.repeat(8);

/**
 * `true`-defaulting boolean attribute converter. Lit's built-in `type: Boolean` converter is
 * presence-based -- the attribute's mere presence (regardless of its string value) maps to `true`,
 * so a plain-markup consumer writing the literal `revealable="false"`/`copyable="false"` would
 * actually get `true` (these properties' default), the opposite of what that string reads as --
 * the same bug class `<lr-checkpoint>`'s `restorable`/`confirmRestore` converters document and fix.
 */

export interface EnvEntry {
  name: string;
  value: string;
  secret?: boolean;
}

export interface LyraEnvListEventMap {
  'lr-reveal-change': CustomEvent<{ name: string; revealed: boolean }>;
  'lr-copy': CustomEvent<{ text: string }>;
}

/**
 * `<lr-env-list>` — masked key/value list for environment variables and secrets, with per-row
 * reveal and copy. Masking is presentational, not a security boundary: the real value sits in a DOM
 * property regardless of mask state.
 *
 * @customElement lr-env-list
 * @event lr-reveal-change - `detail: { name, revealed }`.
 * @event lr-copy - `detail: { text }` — the real (unmasked) value.
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
 */
export class LyraEnvList extends LyraElement<LyraEnvListEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** The name/value entries to render, in order. */
  @property({ attribute: false }) entries: EnvEntry[] = [];

  /** Whether each secret entry gets a reveal/hide toggle. */
  @property({ reflect: true, converter: trueDefaultBooleanConverter }) revealable = true;

  /** Whether each entry gets a copy-to-clipboard button. */
  @property({ reflect: true, converter: trueDefaultBooleanConverter }) copyable = true;

  /** Accessible name for the list; falls back to a localized default. */
  @property() label = '';

  @state() private revealed = new Map<string, boolean>();

  protected override willUpdate(changed: PropertyValues): void {
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
    this.emit('lr-reveal-change', { name, revealed: isRevealed });
  }

  private copy(entry: EnvEntry): void {
    try {
      void navigator.clipboard?.writeText(entry.value)?.catch(() => {});
    } catch {
      // Clipboard access can throw synchronously (e.g. insecure context or a
      // permissions-policy block); the `lr-copy` event still fires below so
      // a host can implement its own fallback.
    }
    this.emit('lr-copy', { text: entry.value });
  }

  override render(): TemplateResult {
    if (this.entries.length === 0) {
      return html`<lr-empty heading=${this.localize('noData')}></lr-empty>`;
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
    'lr-env-list': LyraEnvList;
  }
}
