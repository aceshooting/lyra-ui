import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraDashboardGrid } from './dashboard-grid.class.js';
import './dashboard-grid.js';

it('keeps projected cells and accessible labels after direct connected adoption', async () => {
  const grid = (await fixture(html`<lr-dashboard-grid></lr-dashboard-grid>`)) as LyraDashboardGrid;
  grid.columns = 4;
  grid.layout = [
    { cellId: 'alpha', x: 0, y: 0, w: 1, h: 1, label: 'Alpha panel' },
    { cellId: 'beta', x: 1, y: 0, w: 1, h: 1, label: 'Beta panel' },
  ];
  await grid.updateComplete;

  const iframe = document.createElement('iframe');
  const loaded = new Promise<void>((resolve) =>
    iframe.addEventListener('load', () => resolve(), { once: true })
  );
  document.body.append(iframe);
  await loaded;
  const frameDocument = iframe.contentDocument;
  if (!frameDocument) {
    iframe.remove();
    throw new Error('Could not create the destination document for the dashboard grid.');
  }
  try {
    frameDocument.body.append(grid);
    await grid.updateComplete;
    await waitUntil(() => grid.ownerDocument === frameDocument);
    const cells = [...grid.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]')];
    expect(cells.map((cell) => cell.dataset['cellId'])).to.deep.equal(['alpha', 'beta']);
    expect(cells.map((cell) => cell.getAttribute('aria-label'))).to.deep.equal(['Alpha panel', 'Beta panel']);

    await focusByKeyboard(cells[0]!);
    await sendKeys({ press: 'ArrowRight' });
    expect(grid.shadowRoot!.activeElement === cells[1], 'arrow navigation reaches the next adopted cell').to.equal(true);

    const authored = frameDocument.createElement('button');
    authored.slot = 'cell-alpha';
    authored.textContent = 'Open alpha';
    grid.append(authored);
    await waitUntil(() => authored.assignedSlot?.name === 'cell-alpha');
    expect(grid.shadowRoot!.querySelector('[part="cell"][data-cell-id="alpha"]')!.getAttribute('aria-label'))
      .to.equal('Alpha panel');
  } finally {
    grid.remove();
    iframe.remove();
  }
});
