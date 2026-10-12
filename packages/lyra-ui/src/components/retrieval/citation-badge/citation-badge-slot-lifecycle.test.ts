import { fixture, expect, html } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './citation-badge.js';
import type { LyraCitationBadge } from './citation-badge.js';

it('closes the keyboard-open preview when label update and last preview-node removal share one update', async () => {
  const el = (await fixture(html`
    <lr-citation-badge index="4" status="verified" label="Original source">
      <p>report.pdf, page 4</p>
    </lr-citation-badge>
  `)) as LyraCitationBadge;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
  const popover = el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement;
  const previewSlot = popover.querySelector('slot') as HTMLSlotElement;
  const assignedPreviewNodes = (): Node[] =>
    previewSlot.assignedNodes({ flatten: true }).filter((node) =>
      node.nodeType !== Node.TEXT_NODE || (node.textContent ?? '').trim().length > 0,
    );
  expect(assignedPreviewNodes().map((node) => node.nodeName)).to.deep.equal(['P']);

  await focusByKeyboard(base);
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement === base, 'keyboard focus reached the citation badge').to.be.true;
  expect(popover.hidden, 'the populated preview opens on keyboard focus').to.be.false;
  expect(base.getAttribute('aria-describedby')).to.equal(popover.id);

  // Queue the reactive render before native slotchange can refresh cached slot presence.
  el.label = 'Updated source context';
  el.querySelector('p')!.remove();
  await el.updateComplete;

  expect(el.label).to.equal('Updated source context');
  expect(base.getAttribute('aria-label')).to.equal('Citation 4, Updated source context');
  expect(popover.hidden, 'the open preview closes when the last assigned node is removed').to.be.true;
  expect(el.shadowRoot!.activeElement === base, 'closing the preview leaves keyboard focus on the citation badge').to.be.true;
  expect(base.hasAttribute('aria-describedby'), 'an empty preview is no longer advertised as a description').to.be.false;
  expect(assignedPreviewNodes(), 'no preview content remains assigned').to.have.lengthOf(0);
});
