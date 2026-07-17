import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { FormAssociated } from '../../internal/form-associated.js';
import { nextId } from '../../internal/a11y.js';
import { styles } from './emoji-picker.styles.js';

export interface EmojiPickerItem {
  emoji: string;
  /** Accessible/searchable name (e.g. 'grinning face'). Used for the picked button's `aria-label`
   *  and as one of the two fields `queryText` matches against. */
  name: string;
  /** Additional searchable aliases (e.g. `['grinning']`). Matched the same way `name` is. */
  shortcodes?: string[];
}

export interface EmojiPickerGroup {
  key: string;
  label: string;
  emojis: EmojiPickerItem[];
}

export interface LyraEmojiPickerEventMap {
  input: CustomEvent<undefined>;
  change: CustomEvent<undefined>;
  blur: CustomEvent<undefined>;
  focus: CustomEvent<undefined>;
  /** Fired when an emoji is picked (click, or Enter/Space on the active grid cell). `detail: {
   *  emoji: string }` — the picked glyph, same value `this.value` is set to. */
  'lyra-change': CustomEvent<{ emoji: string }>;
}

class EmojiPickerBase extends LyraElement<LyraEmojiPickerEventMap> {}

/**
 * `<lyra-emoji-picker>` — a searchable, keyboard-navigable, form-associated emoji picker. In the
 * same "zero/optional-peer dependency" spirit as `<lyra-lite-chart>`/`<lyra-heatmap>`: `groups` is
 * fully consumer-suppliable (this component ships no emoji data of its own), with an *optional*
 * convenience auto-loader for a default set — see `emoji-data-loader.ts` and the class doc there for
 * exactly what that covers.
 *
 * @customElement lyra-emoji-picker
 * @event lyra-change - An emoji was picked. `detail: { emoji: string }`.
 * @csspart base - The root wrapper.
 * @csspart search - The search/filter `<input>`.
 * @csspart grid - The keyboard-navigable emoji grid.
 * @csspart group-label - Each group's heading, rendered above its emojis.
 * @csspart emoji - Each emoji's own `<button>`.
 * @csspart empty - The empty-state message, shown when the search matches nothing.
 */
export class LyraEmojiPicker extends FormAssociated(EmojiPickerBase) {
  static styles = [LyraElement.styles, styles];

  /** The full, ungrouped data set to search/render. Consumer-supplied — this component ships no
   *  emoji data of its own. Empty (the default) renders no groups/emojis at all, just the search
   *  input and an empty state. See `emoji-data-loader.ts` for an optional convenience loader. */
  @property({ attribute: false }) groups: EmojiPickerGroup[] = [];

  @state() private queryText = '';
  @state() private activeIndex = 0;

  @query('[part="search"]') private searchEl?: HTMLInputElement;

  private readonly gridId = nextId('emoji-picker-grid');

  private get filteredGroups(): EmojiPickerGroup[] {
    const q = this.queryText.trim().toLowerCase();
    if (!q) return this.groups;
    return this.groups
      .map((group) => ({
        ...group,
        emojis: group.emojis.filter((item) =>
          [item.name, ...(item.shortcodes ?? [])].join(' ').toLowerCase().includes(q),
        ),
      }))
      .filter((group) => group.emojis.length > 0);
  }

  private get flatItems(): EmojiPickerItem[] {
    return this.filteredGroups.flatMap((group) => group.emojis);
  }

  private onSearchInput = (event: Event): void => {
    this.queryText = (event.target as HTMLInputElement).value;
    this.activeIndex = 0;
  };

  private pick(item: EmojiPickerItem): void {
    this.value = item.emoji;
    this.emit('lyra-change', { emoji: item.emoji });
  }

  private onGridKeyDown = (event: KeyboardEvent): void => {
    const items = this.flatItems;
    if (items.length === 0) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.activeIndex = Math.min(this.activeIndex + 1, items.length - 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.activeIndex = Math.max(this.activeIndex - 1, 0);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const item = items[this.activeIndex];
      if (item) this.pick(item);
    }
  };

  protected updated(changed: PropertyValues): void {
    if (changed.has('activeIndex')) {
      this.renderRoot.querySelector<HTMLElement>('[part="emoji"][data-active]')?.scrollIntoView({
        block: 'nearest',
      });
    }
  }

  render(): TemplateResult {
    const items = this.flatItems;
    const activeId = items.length ? `${this.gridId}-item-${this.activeIndex}` : nothing;
    let index = -1;
    return html`
      <div part="base">
        <input
          part="search"
          type="search"
          .value=${this.queryText}
          aria-label=${this.localize('emojiPickerSearchLabel')}
          aria-controls=${this.gridId}
          aria-activedescendant=${activeId}
          @input=${this.onSearchInput}
        />
        <div
          part="grid"
          id=${this.gridId}
          role="listbox"
          aria-label=${this.localize('emojiPickerGridLabel')}
          @keydown=${this.onGridKeyDown}
        >
          ${items.length === 0
            ? html`<div part="empty">${this.localize('emojiPickerEmpty')}</div>`
            : this.filteredGroups.map(
                (group) => html`
                  <div part="group-label">${group.label}</div>
                  ${group.emojis.map((item) => {
                    index++;
                    const itemIndex = index;
                    return html`<button
                      type="button"
                      part="emoji"
                      id=${`${this.gridId}-item-${itemIndex}`}
                      role="option"
                      aria-selected=${itemIndex === this.activeIndex ? 'true' : 'false'}
                      aria-label=${item.name}
                      ?data-active=${itemIndex === this.activeIndex}
                      @click=${() => this.pick(item)}
                      @mouseenter=${() => (this.activeIndex = itemIndex)}
                    >${item.emoji}</button>`;
                  })}
                `,
              )}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-emoji-picker': LyraEmojiPicker;
  }
}
