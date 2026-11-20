// Fallback descriptions for public members whose meaning is fixed by the platform rather than by
// the component: form-associated lifecycle callbacks, constraint validation, focus and selection
// passthroughs, and native editing hints. Every component that exposes one of these names exposes
// the same native contract, so one shared sentence documents them all and cannot drift between
// components. A component's own JSDoc always wins; this only fills a description that is absent.
//
// Names whose meaning depends on the component (`label`, `value`, `type`, `mode`, ...) are
// deliberately absent: those need JSDoc where they are declared.

/** Applies to every class declaration. */
const NATIVE_METHODS = Object.freeze({
  blur: 'Removes keyboard focus from the component, like the native `blur()`.',
  checkValidity: 'Runs constraint validation and returns whether the control is valid.',
  click: 'Activates the component\'s primary internal control, like the native `click()`.',
  focus: 'Moves keyboard focus to the component\'s primary internal control, like the native `focus()`.',
  formDisabledCallback:
    'Called by the browser when an ancestor `<fieldset>` is disabled or re-enabled; the control\'s own `disabled` is kept separately.',
  formResetCallback:
    'Called by the browser when the owning form is reset; restores the reset default and clears interaction state.',
  formStateRestoreCallback:
    'Restores browser session-history or autocomplete state without emitting a user event.',
  reportValidity: 'Runs interactive constraint validation and reports an invalid result.',
  select: 'Selects all text in the internal text field, like the native `select()`.',
  setCustomValidity:
    'Sets or clears a consumer-supplied validation message without discarding intrinsic validity.',
  setRangeText:
    'Replaces a range of text in the internal text field, like the native `setRangeText()`, and synchronizes `value`.',
  setSelectionRange:
    'Sets the internal text field\'s selection range and optional direction, like the native `setSelectionRange()`.',
});

/** Applies to every class declaration. */
const NATIVE_FIELDS = Object.freeze({
  autocapitalize: 'Native `autocapitalize` hint forwarded to the internal text field.',
  autocomplete: 'Native `autocomplete` hint forwarded to the internal text field.',
  autoCorrect:
    'Native `autocorrect` hint forwarded to the internal text field (named `autoCorrect` to avoid the DOM `autocorrect` typing).',
  enterKeyHint: 'Native `enterkeyhint` virtual-keyboard hint forwarded to the internal text field.',
  enterkeyhint: 'Native `enterkeyhint` virtual-keyboard hint forwarded to the internal text field.',
  inputMode: 'Native `inputmode` virtual-keyboard hint forwarded to the internal text field.',
  selectionDirection:
    'Selection direction of the internal text field, like the native `selectionDirection`.',
  selectionEnd: 'End offset of the internal text field\'s selection, like the native `selectionEnd`.',
  selectionStart:
    'Start offset of the internal text field\'s selection, like the native `selectionStart`.',
  spellcheck: 'Native `spellcheck` hint forwarded to the internal text field.',
  withErrorText:
    'SSR slot-presence hint for `error` slot content that cannot be inspected before hydration.',
  withHint: 'SSR slot-presence hint for `hint` slot content that cannot be inspected before hydration.',
  withLabel:
    'SSR slot-presence hint for `label` slot content that cannot be inspected before hydration.',
});

/** Applies only to form-associated declarations (those exposing `willValidate`). */
const FORM_FIELDS = Object.freeze({
  defaultValue:
    'Reset default, reflected to the `value` attribute; a form reset restores it without overwriting a dirty live `value`.',
  disabled:
    'Disables the control: it cannot be focused or edited and is excluded from form submission and validation.',
  form: 'Browser-resolved form owner. Assigning a form id string or form element updates the `form` attribute.',
  labels: 'Native `<label>` elements associated with this form control.',
  name: 'Name under which the control\'s value is submitted with its form.',
  readonly: 'Prevents editing while keeping the control focusable.',
  required: 'Makes a value required for the control to be valid.',
  validationMessage: 'Current validation message, or an empty string when the control is valid.',
  validity: 'Current constraint-validation state.',
  willValidate: 'Whether this control currently participates in constraint validation.',
});

/** Applies to any declaration that renders the named slot next to the property. */
const SLOT_BACKED_FIELDS = Object.freeze({
  errorText: { slot: 'error', description: 'Error text rendered below the control. Use the `error` slot for rich content.' },
  hint: { slot: 'hint', description: 'Supporting text rendered below the control. Use the `hint` slot for rich content.' },
  label: { slot: 'label', description: 'Visible label text. Use the `label` slot for rich content.' },
});

const described = (entry) => typeof entry?.description === 'string' && entry.description.trim() !== '';
const isPublic = (member) => !member.static && (!member.privacy || member.privacy === 'public');

/** The fallback description for one member of `declaration`, or `undefined` when none applies. */
export function vocabularyDescription(declaration, member) {
  if (!isPublic(member)) return undefined;
  if (member.kind === 'method') return Object.hasOwn(NATIVE_METHODS, member.name) ? NATIVE_METHODS[member.name] : undefined;
  if (member.kind !== 'field') return undefined;
  if (Object.hasOwn(NATIVE_FIELDS, member.name)) return NATIVE_FIELDS[member.name];
  const formAssociated = (declaration.members ?? []).some((candidate) => candidate.name === 'willValidate');
  if (formAssociated && Object.hasOwn(FORM_FIELDS, member.name)) {
    // `labels` is also the chart data vocabulary; only the native NodeList is the form contract.
    if (member.name === 'labels' && member.type?.text !== 'NodeList') return undefined;
    return FORM_FIELDS[member.name];
  }
  const slotBacked = Object.hasOwn(SLOT_BACKED_FIELDS, member.name) ? SLOT_BACKED_FIELDS[member.name] : undefined;
  if (slotBacked && (declaration.slots ?? []).some((slot) => slot.name === slotBacked.slot)) {
    return slotBacked.description;
  }
  return undefined;
}

/**
 * Fills absent member descriptions from the vocabulary above, then copies every member description
 * onto its undescribed attribute. Mutates and returns `manifest`.
 */
export function applyMemberVocabulary(manifest) {
  for (const module of manifest.modules ?? []) {
    for (const declaration of module.declarations ?? []) {
      if (declaration.kind !== 'class') continue;
      for (const member of declaration.members ?? []) {
        if (described(member)) continue;
        const description = vocabularyDescription(declaration, member);
        if (description) member.description = description;
      }
      const fields = new Map((declaration.members ?? []).filter((member) => member.kind === 'field')
        .map((member) => [member.name, member]));
      for (const attribute of declaration.attributes ?? []) {
        const field = attribute.fieldName ? fields.get(attribute.fieldName) : undefined;
        if (!described(attribute) && described(field)) attribute.description = field.description;
      }
    }
  }
  return manifest;
}
