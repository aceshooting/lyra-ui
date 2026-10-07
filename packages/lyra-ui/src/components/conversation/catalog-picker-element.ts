import { LyraElement } from '../../internal/lyra-element.js';
import { getFormOwner, setFormOwner, type FormOwnerValue } from '../../internal/form-associated.js';
import type { LyraSelectionDirection } from '../../internal/shared-unions.js';
import { activeElementIn } from '../../internal/active-element.js';
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
  select(): void;
  setSelectionRange(start: number | null, end: number | null, direction?: LyraSelectionDirection): void;
  setRangeText(replacement: string): void;
  setRangeText(replacement: string, start: number, end: number, selectMode?: SelectionMode): void;
}

/** Shared native-control and form projection for catalog-backed model and voice fields. */
export abstract class LyraCatalogPickerElement<Events> extends LyraElement<Events> {
  protected abstract get catalogEditing(): CatalogPickerEditing;
  protected abstract get formInternals(): ElementInternals;
  abstract get effectiveDisabled(): boolean;
  protected suppressControlBlur = false;
  protected modeFocusRepair?: ComposedFocusRepairSnapshot;
  protected focusedModeRepair?: ComposedFocusRepairSnapshot;
  protected focusReturnTarget?: HTMLElement;
  private hasSyncedDescribedByElements = false;

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
      activeElementIn(this.shadowRoot) === renderedControl
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
  /** The associated form, including an explicit external form owner. */
  getForm(): HTMLFormElement | null { return getFormOwner(this.formInternals); }
  /** Native labels associated with this form control. */
  get labels(): NodeList { return this.formInternals.labels; }
  /** Current native validity state. */
  get validity(): ValidityState { return this.formInternals.validity; }
  /** Current native validation message. */
  get validationMessage(): string { return this.formInternals.validationMessage; }
  /** Whether this control currently participates in constraint validation. */
  get willValidate(): boolean { return this.formInternals.willValidate; }
}
