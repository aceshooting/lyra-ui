import type { LitElement } from 'lit';

/** A write to the public `form` IDL may name an owner by id while reads stay element-valued. */
export type FormOwnerValue = string | HTMLFormElement | null;

/** Reflects a form-owner ID without changing the element-valued read contract. */
export function setFormOwner(host: HTMLElement, owner: FormOwnerValue): void {
  const id = typeof owner === 'string' ? owner : owner?.id ?? '';
  if (id) host.setAttribute('form', id);
  else host.removeAttribute('form');
}

/** Returns the browser-resolved form owner for a form-associated custom element. */
export function getFormOwner(internals: ElementInternals): HTMLFormElement | null {
  return internals.form;
}

interface DirectCustomErrorHost extends LitElement {
  setCustomValidity(message: string): void;
  resetValidity?(): void;
}

/** Installs the reflected `customError` IDL on a control that manages ElementInternals directly. */
export function installCustomErrorProperty(
  host: DirectCustomErrorHost,
  getCustomValidityMessage: () => string,
): void {
  if (Object.prototype.hasOwnProperty.call(host, 'customError')) return;
  const setValidity = host.setCustomValidity.bind(host);
  const resetValidity = host.resetValidity?.bind(host);
  let committing = false;
  let resetting = false;

  const reflectMessage = (message: string): void => {
    if (message) {
      if (host.getAttribute('custom-error') !== message) host.setAttribute('custom-error', message);
    } else if (host.hasAttribute('custom-error')) {
      host.removeAttribute('custom-error');
    }
  };

  const commit = (next: string | null | undefined): void => {
    if (committing) {
      if (resetting) setValidity(next ?? '');
      return;
    }
    const old = getCustomValidityMessage() || null;
    const message = next ?? '';
    committing = true;
    try {
      setValidity(message);
      reflectMessage(getCustomValidityMessage() || '');
    } finally {
      committing = false;
    }
    host.requestUpdate('customError', old);
  };

  Object.defineProperty(host, 'customError', {
    configurable: true,
    enumerable: true,
    get: (): string | null => getCustomValidityMessage() || null,
    set: commit,
  });
  Object.defineProperty(host, 'setCustomValidity', {
    configurable: true,
    writable: true,
    value: commit,
  });
  if (resetValidity) {
    Object.defineProperty(host, 'resetValidity', {
      configurable: true,
      writable: true,
      value: (): void => {
        if (committing) return;
        const old = getCustomValidityMessage() || null;
        committing = true;
        resetting = true;
        try {
          resetValidity();
          reflectMessage(getCustomValidityMessage() || '');
        } finally {
          resetting = false;
          committing = false;
        }
        host.requestUpdate('customError', old);
      },
    });
  }
}
