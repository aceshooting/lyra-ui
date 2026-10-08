import type { PropertyDeclarations } from 'lit';
import { state } from 'lit/decorators.js';
import { LyraFormControlElement } from '../../internal/form-control-element.js';
import {
  getFormOwner,
  isBarredFromValidation,
  setFormOwner,
  type FormOwnerValue,
} from '../../internal/form-associated.js';
import { FormControlController, reflectFormName } from '../../internal/form-control-controller.js';
import { GlassScrollLayer } from '../../internal/glass-scroll-layer.js';
import { syncValidityStates } from '../../internal/custom-states.js';
import type { LyraSelectionDirection } from '../../internal/shared-unions.js';
import { shadowFocusTarget } from '../../internal/active-element.js';
import { syncAriaDescribedByElements } from '../../internal/aria-reflection.js';
import {
  applyComposedFocusRepair,
  captureComposedFocusRepair,
  isComposedFocusAvailable,
  type ComposedFocusRepairSnapshot,
} from '../../internal/focus-navigation.js';

interface CatalogPickerEditing {
  readonly input: HTMLInputElement | null;
  click(): void;
  focus(options?: FocusOptions): void;
  blur(): void;
  hide(): void;
  select(): void;
  setSelectionRange(start: number | null, end: number | null, direction?: LyraSelectionDirection): void;
  setRangeText(replacement: string): void;
  setRangeText(replacement: string, start: number, end: number, selectMode?: SelectionMode): void;
}

/** Shared native-control and form projection for catalog-backed model and voice fields. */
export abstract class LyraCatalogPickerElement<Events> extends LyraFormControlElement<Events> {
  static override properties: PropertyDeclarations = {
    customError: { attribute: 'custom-error', reflect: true, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    required: { type: Boolean, reflect: true, noAccessor: true },
    name: { reflect: true, noAccessor: true },
  };

  protected abstract get catalogEditing(): CatalogPickerEditing;
  /** The localized `valueMissing` message. */
  protected abstract requiredMessage(): string;
  /** Set on first blur; gates the `data-invalid` reflection so validity styling never flashes. */
  @state() protected touched = false;
  protected internals: ElementInternals;
  private validityController: FormControlController;
  /** Consumer-supplied validation message reflected through `custom-error`. */
  declare customError: string | null;
  protected _fieldsetDisabled = false;
  private _name = '';
  private _disabled = false;
  private _required = false;
  protected suppressControlBlur = false;
  protected modeFocusRepair?: ComposedFocusRepairSnapshot;
  protected focusedModeRepair?: ComposedFocusRepairSnapshot;
  protected focusReturnTarget?: HTMLElement;
  private hasSyncedDescribedByElements = false;

  constructor() {
    super();
    this.validityController = new FormControlController(this, {
      invalid: (init) => this.emitUntyped('lr-invalid', init),
      interacted: this.markInteracted,
      customError: () => this.validityController.customValidityMessage,
    });
    this.internals = this.validityController.formInternals;
    new GlassScrollLayer(this, '[part="listbox"]', () => (this as unknown as { open: boolean }).open);
    // A native input always submits "" from construction, so an untouched control is still in FormData.
    this.internals.setFormValue('');
  }

  private emitUntyped(name: string, init: { cancelable: true }): CustomEvent<unknown> {
    return (this.emit as unknown as (n: string, d: null, i: { cancelable: true }) => CustomEvent<unknown>).call(this, name, null, init);
  }

  protected get formInternals(): ElementInternals { return this.internals; }

  /** The form submission key, reflected synchronously for native form APIs. */
  get name(): string { return this._name; }
  set name(next: string) {
    const old = this._name;
    this._name = next ?? '';
    reflectFormName(this, this._name);
    this.requestUpdate('name', old);
  }

  get disabled(): boolean { return this._disabled; }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    this.toggleAttribute('disabled', this._disabled);
    this._fieldsetDisabled =
      this.validityController?.fieldsetDisabled(this._fieldsetDisabled) ?? this._fieldsetDisabled;
    if (this._disabled) this.releaseOnDisable();
    // Disabling bars constraint validation, so the violation is dropped synchronously with it.
    this.updateValidity();
    this.requestUpdate('disabled', old);
  }

  get required(): boolean { return this._required; }
  set required(next: boolean) {
    const old = this._required;
    this._required = Boolean(next);
    this.toggleAttribute('required', this._required);
    this.updateValidity();
    this.requestUpdate('required', old);
  }

  /** Whether the control is disabled explicitly or by an ancestor fieldset. */
  get effectiveDisabled(): boolean { return this.disabled || this._fieldsetDisabled; }

  /** Closes the popup when the control becomes disabled; hosts extend it to stop their own work. */
  protected releaseOnDisable(): void { this.catalogEditing.hide(); }

  /** Own `disabled`/`readonly` and a disabled fieldset bar constraint validation. */
  protected get barredFromValidation(): boolean { return isBarredFromValidation(this, this.internals); }

  /** `''` is the one "nothing committed" sentinel here (a catalog id is never blank), so `!value` is exact. */
  protected updateValidity(): void {
    if (this.barredFromValidation) {
      this.validityController.setValidity({});
    } else if (this.required && !(this as unknown as { value: string }).value) {
      this.validityController.setValidity({ valueMissing: true }, this.requiredMessage());
    } else {
      this.validityController.setValidity({});
    }
    this.publishValidityStates();
  }

  /** Republishes the validity custom states; `ElementInternals` is driven directly, not through `FormAssociated`. */
  protected publishValidityStates(): void {
    syncValidityStates(this.internals, {
      required: this.required,
      hasInteracted: this.touched,
      barred: this.barredFromValidation,
    });
  }

  protected formDisabledChanged(disabled: boolean): void {
    if (this.validityController?.reflectingDisabled) return;
    const wasDisabled = this.effectiveDisabled;
    this._fieldsetDisabled = disabled;
    if (wasDisabled === this.effectiveDisabled) return;
    if (disabled) this.releaseOnDisable();
    // Cascaded disablement bars constraint validation exactly like the control's own `disabled`.
    this.updateValidity();
    this.requestUpdate();
  }

  protected markInteracted = (): void => {
    if (this.touched) return;
    this.touched = true;
    this.publishValidityStates();
  };

  checkValidity(): boolean { return this.validityController.checkValidity(); }
  reportValidity(): boolean {
    this.validityController.syncConstraints();
    // A reportValidity() call is what a submit attempt runs, so it counts as interaction.
    this.touched = true;
    this.publishValidityStates();
    return this.internals.reportValidity();
  }

  /**
   * Sets or clears a consumer-supplied validation error, e.g. a server-side rejection. A non-empty
   * `message` raises `customError` and becomes `validationMessage`; `''` clears it and restores the
   * computed validity. It survives intrinsic recomputation and `form.reset()`. Used verbatim, never
   * localized.
   */
  setCustomValidity(message: string): void {
    this.validityController.setCustomValidity(message ?? '');
    this.publishValidityStates();
  }

  protected syncCatalogDescription(controlId: string): void {
    const hostDescribedBy = this.getAttribute('aria-describedby');
    // A no-op assignment of ariaDescribedByElements can erase literal hint/error idrefs.
    if (!hostDescribedBy && !this.hasSyncedDescribedByElements) return;
    const control = this.renderRoot.querySelector<HTMLElement>(`#${CSS.escape(controlId)}`);
    this.hasSyncedDescribedByElements = syncAriaDescribedByElements(
      this,
      control ?? undefined,
      hostDescribedBy,
    );
  }

  protected prepareModeFocus(closedMode: boolean): boolean {
    if (!this.hasUpdated) return false;
    const renderedControl = this.renderRoot.querySelector<HTMLElement>(
      '[part="trigger"], [part="combobox-input"]',
    );
    const changed = (renderedControl?.getAttribute('part') === 'trigger') !== closedMode;
    this.suppressControlBlur = changed;
    this.modeFocusRepair = changed && renderedControl !== null &&
      shadowFocusTarget(this) === renderedControl
      ? captureComposedFocusRepair(this, this.modeFocusFallback() ?? renderedControl) ?? undefined
      : changed ? this.focusedModeRepair : undefined;
    return changed;
  }

  protected finishModeFocus(key: string): void {
    this.suppressControlBlur = false;
    const repair = this.modeFocusRepair;
    this.modeFocusRepair = undefined;
    if (!repair) return;
    this.scheduleAfterUpdate(() => {
      const replacement = this.renderRoot.querySelector<HTMLElement>('[part="trigger"], [part="combobox-input"]');
      const target = replacement && isComposedFocusAvailable(replacement)
        ? replacement : this.modeFocusFallback();
      applyComposedFocusRepair(repair, target);
      if (this.focusedModeRepair === repair) this.focusedModeRepair = undefined;
    }, key);
  }

  protected clearModeFocus(): void {
    this.modeFocusRepair = undefined;
    this.focusedModeRepair = undefined;
    this.focusReturnTarget = undefined;
  }

  protected captureModeFocus(event: FocusEvent): void {
    const related = event.relatedTarget;
    if (related && (related as Node).nodeType === 1 && isComposedFocusAvailable(related as Element)) {
      this.focusReturnTarget = related as HTMLElement;
    }
    const control = event.currentTarget;
    if (!control || (control as Node).nodeType !== 1) return;
    this.focusedModeRepair = captureComposedFocusRepair(
      this,
      this.modeFocusFallback() ?? control as HTMLElement,
    ) ?? undefined;
  }

  protected retireModeFocusAfterBlur(event: FocusEvent): void {
    if (event.relatedTarget && (event.relatedTarget as Node).nodeType === 1) {
      this.focusedModeRepair = undefined;
      return;
    }
    queueMicrotask(() => {
      if (!this.suppressControlBlur && !this.effectiveDisabled && !this.hasAttribute('inert')) {
        this.focusedModeRepair = undefined;
      }
    });
  }

  protected modeFocusFallback(): HTMLElement | null {
    if (this.focusReturnTarget && isComposedFocusAvailable(this.focusReturnTarget)) {
      return this.focusReturnTarget;
    }
    const owner = this.renderRoot.querySelector<HTMLElement>('[part="form-control"]');
    return owner && isComposedFocusAvailable(owner) ? owner : null;
  }

  /** Clicks the active trigger or editable input; the free-text path also focuses it. */
  override click(): void { this.catalogEditing.click(); }
  /** Focuses the active trigger or editable input. */
  override focus(options?: FocusOptions): void { this.catalogEditing.focus(options); }
  /** Blurs the active trigger or editable input. */
  override blur(): void { this.catalogEditing.blur(); }

  /** The native editable input, or null in closed catalog mode and before render. */
  get input(): HTMLInputElement | null { return this.catalogEditing.input; }
  /** Native selection start in free-text mode; null otherwise. */
  get selectionStart(): number | null { return this.input?.selectionStart ?? null; }
  set selectionStart(value: number | null) { if (this.input) this.input.selectionStart = value; }
  /** Native selection end in free-text mode; null otherwise. */
  get selectionEnd(): number | null { return this.input?.selectionEnd ?? null; }
  set selectionEnd(value: number | null) { if (this.input) this.input.selectionEnd = value; }
  /** Native selection direction in free-text mode; null otherwise. */
  get selectionDirection(): LyraSelectionDirection | null {
    return (this.input?.selectionDirection as LyraSelectionDirection | undefined) ?? null;
  }
  set selectionDirection(value: LyraSelectionDirection | null) {
    if (this.input) this.input.selectionDirection = value;
  }
  /** Selects all editable text in free-text mode; otherwise a no-op. */
  select(): void { this.catalogEditing.select(); }
  /** Sets the native selection range in free-text mode; otherwise a no-op. */
  setSelectionRange(start: number | null, end: number | null, direction?: LyraSelectionDirection): void {
    this.catalogEditing.setSelectionRange(start, end, direction);
  }
  /** Replaces editable text and synchronizes value, form data, and validity without input events.
   * This is a no-op in closed catalog mode and before render. */
  setRangeText(replacement: string): void;
  setRangeText(replacement: string, start: number, end: number, selectMode?: SelectionMode): void;
  setRangeText(replacement: string, start?: number, end?: number, selectMode?: SelectionMode): void {
    if (start === undefined || end === undefined) this.catalogEditing.setRangeText(replacement);
    else this.catalogEditing.setRangeText(replacement, start, end, selectMode);
  }

  /** The associated form, including an explicit external form owner. */
  get form(): HTMLFormElement | null { return getFormOwner(this.formInternals); }
  set form(owner: FormOwnerValue) { setFormOwner(this, owner); }
}
