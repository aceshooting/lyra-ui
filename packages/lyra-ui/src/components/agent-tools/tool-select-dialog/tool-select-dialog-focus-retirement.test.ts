import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { twoFrames } from '../../../../test/frames.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraToolSelectDialog } from './tool-select-dialog.js';
import './tool-select-dialog.js';

for (const retirement of ['close', 'disconnect'] as const) {
  it(`retires pending Load more focus on ${retirement} and restores fresh keyboard loading`, async () => {
    const dialog = await fixture<LyraToolSelectDialog>(html`<lr-tool-select-dialog open
      .tools=${Array.from({ length: 201 }, (_, index) => ({ id: `tool-${index}`, name: `Tool ${index}` }))}
    ><div slot="footer"></div></lr-tool-select-dialog>`);
    const parent = dialog.parentNode!;
    const footer = dialog.querySelector<HTMLElement>('[slot="footer"]')!;
    await waitUntil(() => dialog.matches(':popover-open'));
    const loadMore = dialog.shadowRoot!.querySelector<HTMLButtonElement>('[part="load-more"]')!;
    expect(dialog.shadowRoot!.querySelectorAll('[part="tool-row"]').length).to.equal(200);
    await focusByKeyboard(loadMore, footer);
    let retired = false;
    const obsoleteFocus: string[] = [];
    const trackFocus = (event: Event): void => {
      const part = (event.target as Element).getAttribute('part');
      if (retired && (part === 'body' || part === 'load-more')) obsoleteFocus.push(part);
    };
    dialog.shadowRoot!.addEventListener('focusin', trackFocus);
    loadMore.addEventListener('click', () => {
      retired = true;
      if (retirement === 'close') dialog.close();
      else dialog.remove();
    }, { once: true });
    await sendKeys({ press: 'Enter' });
    expect(retired, 'keyboard activation reaches the retiring click listener').to.equal(true);
    await dialog.updateComplete;
    await twoFrames();
    expect(obsoleteFocus, 'queued loading never focuses retired controls').to.deep.equal([]);
    dialog.shadowRoot!.removeEventListener('focusin', trackFocus);

    if (retirement === 'disconnect') parent.appendChild(dialog);
    dialog.show();
    await dialog.updateComplete;
    await waitUntil(() => dialog.matches(':popover-open'));
    // A new catalog resets the rendered window through the public tools property.
    dialog.tools = Array.from({ length: 201 }, (_, index) => ({ id: `fresh-${index}`, name: `Fresh ${index}` }));
    await dialog.updateComplete;
    const freshLoad = dialog.shadowRoot!.querySelector<HTMLButtonElement>('[part="load-more"]')!;
    await focusByKeyboard(freshLoad, footer);
    await sendKeys({ press: 'Enter' });
    await dialog.updateComplete;
    await waitUntil(() => dialog.shadowRoot!.activeElement?.getAttribute('part') === 'body', 'fresh loading focuses the completed catalog');
    expect(dialog.shadowRoot!.querySelectorAll('[part="tool-row"]').length).to.equal(201);
    expect(dialog.shadowRoot!.querySelectorAll('[part="load-more"]').length).to.equal(0);
  });
}
