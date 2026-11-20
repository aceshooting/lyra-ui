import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { shadowFocusTarget } from './active-element.js';
import { isHtmlElement } from './dom-guards.js';
import { repairUnavailableControlFocus } from './focus-navigation.js';

type FocusFallback = HTMLElement | null | undefined;

/**
 * Keeps keyboard focus inside a host whose focused shadow `<button>` ends an update disabled or
 * removed (a pager reaching its last page, a zoom button reaching its limit). The focused button is
 * read before each render; after it, focus moves to the first available of the button's own
 * sibling buttons (same parent) and then `extra(control)`, but only while focus has actually
 * fallen out of place (see `repairUnavailableControlFocus()`).
 */
export class ControlFocusRepairController implements ReactiveController {
  private focused?: HTMLElement;

  constructor(
    private readonly host: ReactiveControllerHost & Element,
    private readonly extra: (control: HTMLElement) => Iterable<FocusFallback> = () => [],
  ) {
    host.addController(this);
  }

  hostUpdate(): void {
    const active = shadowFocusTarget(this.host);
    this.focused = isHtmlElement(active) && active.localName === 'button' ? active : undefined;
  }

  hostUpdated(): void {
    const control = this.focused;
    this.focused = undefined;
    if (!control) return;
    const siblings = control.isConnected && control.parentElement
      ? control.parentElement.querySelectorAll<HTMLElement>(':scope > button')
      : [];
    repairUnavailableControlFocus(control, [...siblings, ...this.extra(control)]);
  }
}

/** Registers a `ControlFocusRepairController` on `host`; call it from the constructor. */
export function repairControlFocusOnUpdate(
  host: ReactiveControllerHost & Element,
  extra?: (control: HTMLElement) => Iterable<FocusFallback>,
): ControlFocusRepairController {
  return new ControlFocusRepairController(host, extra);
}
