import type { LitElement } from 'lit';
import { AnchoredValidityController, resolveValidityAnchor } from './anchored-validity.js';
import { attachInternalsSafely } from './element-internals.js';
import { installCustomErrorProperty } from './direct-form-associated.js';
import { installInteractionOnInvalid, installInvalidEventAlias, withStaticValidityCheck } from './invalid-event-alias.js';

interface FormControlHost extends LitElement {
  setCustomValidity(message: string): void;
  resetValidity?(): void;
}

interface FormControlOptions {
  invalid?: (init: { cancelable: true }) => CustomEvent<unknown>;
  interacted?: () => void;
  customError?: () => string;
}

/** Shared FACE setup and validation, independent of a control's value and reset model. */
export class FormControlController extends AnchoredValidityController {
  readonly formInternals: ElementInternals;
  private disabledMutationDepth = 0;

  constructor(private readonly host: FormControlHost, options: FormControlOptions = {}) {
    const internals = attachInternalsSafely(host);
    super(host, internals, () => resolveValidityAnchor(host));
    this.formInternals = internals;
    if (options.invalid) installInvalidEventAlias(host, options.invalid);
    if (options.interacted) installInteractionOnInvalid(host, options.interacted);
    if (options.customError) installCustomErrorProperty(host, options.customError);

    // Bracket native reactions regardless of whether disabled or attributeChanged fires first.
    const setAttribute = host.setAttribute;
    const removeAttribute = host.removeAttribute;
    const toggleAttribute = host.toggleAttribute;
    host.setAttribute = (name, value) => this.mutateAttribute(name, () => setAttribute.call(host, name, value));
    host.removeAttribute = (name) => this.mutateAttribute(name, () => removeAttribute.call(host, name));
    host.toggleAttribute = (...args) => this.mutateAttribute(args[0], () => toggleAttribute.apply(host, args));
  }

  private mutateAttribute<T>(name: string, mutate: () => T): T {
    if (name.toLowerCase() !== 'disabled') return mutate();
    this.disabledMutationDepth++;
    try { return mutate(); }
    finally { this.disabledMutationDepth--; }
  }

  get reflectingDisabled(): boolean { return this.disabledMutationDepth > 0; }

  /** Refresh the cascade after own disablement ends, including a fieldset's first legend. */
  fieldsetDisabled(previous: boolean): boolean {
    return this.host.hasAttribute('disabled') || typeof this.host.matches !== 'function'
      ? previous : this.host.matches(':disabled');
  }

  /** Flush only an existing render, so same-tick native constraints are current. */
  syncConstraints(): void {
    const host = this.host as unknown as { hasUpdated: boolean; performUpdate(): void };
    if (host.hasUpdated) host.performUpdate();
  }

  checkValidity(update?: () => void): boolean {
    this.syncConstraints();
    update?.();
    return withStaticValidityCheck(this.host, () => this.formInternals.checkValidity());
  }
}

/** Reflect the submission key synchronously; callers retain their own value synchronization. */
export function reflectFormName(host: HTMLElement, name: string | null): void {
  if (name) host.setAttribute('name', name);
  else host.removeAttribute('name');
}
