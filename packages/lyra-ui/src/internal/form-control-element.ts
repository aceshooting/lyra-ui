import { getFormOwner } from './direct-form-associated.js';
import { LyraElement, type LyraEventMap } from './lyra-element.js';

/** Subclasses assign `internals` from their `FormControlController` in the constructor. */
const internalsOf = (host: object): ElementInternals => (host as { internals: ElementInternals }).internals;

/** Base for hand-wired form-associated controls: the read-only native form surface, written once. */
export class LyraFormControlElement<Events = LyraEventMap> extends LyraElement<Events> {
  /** Returns the browser-resolved form owner, including an external owner selected by `form`. */
  getForm(): HTMLFormElement | null { return getFormOwner(internalsOf(this)); }
  /** Native labels associated with this form control. */
  get labels(): NodeList { return internalsOf(this).labels; }
  /** Current native validity state. */
  get validity(): ValidityState { return internalsOf(this).validity; }
  /** Current native validation message. */
  get validationMessage(): string { return internalsOf(this).validationMessage; }
  /** Whether this control currently participates in constraint validation. */
  get willValidate(): boolean { return internalsOf(this).willValidate; }
}
