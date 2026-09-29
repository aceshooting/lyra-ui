import { waitUntil } from '@open-wc/testing';
import { focusAfterPointer } from './wtr-focus.js';
import { deepActiveElement } from '../src/internal/overlay-manager.js';

export interface HiddenOpenerScenario {
  /** Element that emits `closeEvent` when the overlay is dismissed. */
  host: HTMLElement;
  /** Event after which the simulated host re-shows its opener. */
  closeEvent: string;
  /** Opens the overlay; called while the opener holds focus. */
  open(): Promise<void>;
  /** Dismisses the overlay through its public close path. */
  close(): Promise<void>;
}

/** A host hides its own opener while an overlay is open and re-shows it from its own render a frame
 *  after it learns of the close: focus must still end on that opener. */
export async function expectFocusReturnsToReshownOpener(scenario: HiddenOpenerScenario): Promise<void> {
  const opener = document.createElement('button');
  opener.type = 'button';
  opener.textContent = 'Open';
  document.body.append(opener);
  const reShow = (): void => {
    requestAnimationFrame(() => {
      opener.style.visibility = '';
    });
  };
  scenario.host.addEventListener(scenario.closeEvent, reShow);
  try {
    await focusAfterPointer(opener);
    await scenario.open();
    opener.style.visibility = 'hidden';
    await scenario.close();
    await waitUntil(
      () => opener.style.visibility === '' && deepActiveElement(document) === opener,
      `focus stayed on ${deepActiveElement(document)?.localName ?? 'nothing'}`,
    );
  } finally {
    scenario.host.removeEventListener(scenario.closeEvent, reShow);
    opener.remove();
  }
}
