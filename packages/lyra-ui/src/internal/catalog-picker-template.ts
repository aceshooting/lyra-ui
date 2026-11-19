import { html, nothing, type TemplateResult } from 'lit';
import { hostAriaLabel } from './a11y.js';
import { nativeAutocorrectAttribute } from './native-text-control.js';

/**
 * The accessible name of a catalog picker's own control: a host `aria-label` wins by presence; a
 * visible label names the control natively; otherwise the placeholder, then `fallback`.
 */
export function catalogControlName(
  host: Element,
  hasVisibleLabel: boolean,
  placeholder: string,
  fallback: string,
): string | typeof nothing {
  return hostAriaLabel(host) ?? (hasVisibleLabel ? nothing : placeholder || fallback);
}

/** `part="form-control-label"`, paired with the active control and the `label` slot. */
export function renderCatalogLabel(controlId: string, label: string, visible: boolean): TemplateResult {
  return html`<label part="form-control-label" for=${controlId} ?hidden=${!visible}
    >${label}<slot name="label"></slot></label
  >`;
}

/** Native editing state a catalog picker host forwards to its free-text input. */
export interface CatalogInputHost extends Element {
  readonly autocomplete: string;
  readonly spellcheck: boolean;
  readonly autocapitalize: string;
  readonly autocorrect: boolean;
  readonly inputMode: string;
  readonly enterKeyHint: string;
  readonly placeholder: string;
  readonly readonly: boolean;
  readonly required: boolean;
  readonly effectiveDisabled: boolean;
}

/** What {@linkcode renderCatalogInput} renders for one free-text picker. */
export interface CatalogInputOptions {
  /** The picker host; its `aria-label` and authored `autocorrect` attribute are read too. */
  host: CatalogInputHost;
  id: string;
  listId: string;
  activeId: string;
  open: boolean;
  /** Query while open, else the committed value's label. */
  value: string;
  name: string | typeof nothing;
  describedBy: string | undefined;
  invalid: boolean;
  onInput: (event: Event) => void;
  onKeyDown: (event: KeyboardEvent) => void;
  onFocus: (event: FocusEvent) => void;
  onBlur: (event: FocusEvent) => void;
}

/** The free-text `role="combobox"` input shared by the catalog pickers. */
export function renderCatalogInput(o: CatalogInputOptions): TemplateResult {
  const e = o.host;
  return html`<input
    id=${o.id}
    part="combobox-input"
    role="combobox"
    aria-label=${o.name}
    aria-expanded=${o.open ? 'true' : 'false'}
    aria-controls=${o.listId}
    aria-activedescendant=${o.activeId}
    aria-autocomplete="list"
    aria-describedby=${o.describedBy || nothing}
    aria-required=${e.required ? 'true' : 'false'}
    aria-readonly=${e.readonly ? 'true' : 'false'}
    aria-invalid=${o.invalid ? 'true' : 'false'}
    autocomplete=${e.autocomplete || nothing}
    spellcheck=${e.spellcheck}
    autocapitalize=${e.autocapitalize || nothing}
    autocorrect=${nativeAutocorrectAttribute(o.host, e.autocorrect)}
    inputmode=${e.inputMode || nothing}
    enterkeyhint=${e.enterKeyHint || nothing}
    .value=${o.value}
    .readOnly=${e.readonly}
    placeholder=${e.placeholder}
    ?disabled=${e.effectiveDisabled}
    @input=${o.onInput}
    @keydown=${o.onKeyDown}
    @focus=${o.onFocus}
    @blur=${o.onBlur}
  />`;
}
