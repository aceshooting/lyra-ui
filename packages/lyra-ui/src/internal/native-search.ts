import { html, nothing, type TemplateResult } from 'lit';
import { closeIcon } from './icons.js';
import { relayNativeEvent } from './native-event-relay.js';

interface NativeSearchOptions {
  host: HTMLElement;
  part: string;
  value: string;
  label: string;
  placeholder: string;
  clearLabel: string;
  controls?: string;
  disabled?: () => boolean;
  readOnly?: boolean;
  autocomplete?: string;
  spellcheck?: boolean;
  autocapitalize?: string;
  autocorrect?: string;
  inputmode?: string;
  enterkeyhint?: string;
  containInput?: boolean;
  onValue: (value: string) => void;
  onKeydown?: (event: KeyboardEvent) => void;
}

/** Native search chrome for composite filters; the parent owns filtering and event policy. */
export function renderNativeSearch(options: NativeSearchOptions): TemplateResult {
  const editable = (): boolean => !options.disabled?.() && !options.readOnly;
  const onInput = (event: Event): void => {
    if (options.containInput) event.stopPropagation();
    if (editable()) options.onValue((event.currentTarget as HTMLInputElement).value);
  };
  const clear = (event: Event): void => {
    if (!editable() || !options.value) return;
    const input = (event.currentTarget as HTMLElement).parentNode?.querySelector<HTMLInputElement>('input');
    if (input) input.value = '';
    options.onValue('');
    input?.focus();
  };
  const relayFocus = (event: FocusEvent): void => {
    if (options.containInput) event.stopPropagation();
    relayNativeEvent(options.host, event);
  };
  return html`<input class="native-search-input" part=${options.part} type="search"
    .value=${options.value} aria-label=${options.label} aria-controls=${options.controls ?? nothing}
    placeholder=${options.placeholder} ?disabled=${options.disabled?.()} ?readonly=${options.readOnly}
    autocomplete=${options.autocomplete || nothing} spellcheck=${options.spellcheck === undefined ? nothing : String(options.spellcheck)}
    autocapitalize=${options.autocapitalize || nothing} autocorrect=${options.autocorrect || nothing}
    inputmode=${options.inputmode || nothing} enterkeyhint=${options.enterkeyhint || nothing}
    @input=${onInput} @keydown=${options.onKeydown ?? nothing} @focus=${relayFocus} @blur=${relayFocus}
  />${options.value && !options.readOnly ? html`<button part="search-clear"
    type="button" ?disabled=${options.disabled?.()} aria-label=${options.clearLabel} @click=${clear}
    ><span aria-hidden="true" inert>${closeIcon()}</span></button>` : nothing}`;
}
