import { fixture, expect, html } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './entity-chip.js';
import type { LyraEntityChip } from './entity-chip.js';

it('closes the keyboard-open preview when label update and last preview-node removal share one update', async () => {
  const el = (await fixture(html`
    <lr-entity-chip entity-id="entity-17" text="Marie Curie">
      <p>Physicist, 1867–1934</p>
    </lr-entity-chip>
  `)) as LyraEntityChip;
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
  expect(el.shadowRoot!.activeElement === base, 'keyboard focus reached the entity chip').to.be.true;
  expect(popover.hidden, 'the populated preview opens on keyboard focus').to.be.false;
  expect(base.getAttribute('aria-describedby')).to.equal(popover.id);

  // Queue the reactive render before native slotchange can refresh cached slot presence.
  el.text = 'Marie Curie, updated';
  el.querySelector('p')!.remove();
  await el.updateComplete;

  expect(el.text).to.equal('Marie Curie, updated');
  expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent).to.equal('Marie Curie, updated');
  expect(base.getAttribute('aria-label')).to.equal('Marie Curie, updated');
  expect(popover.hidden, 'the open preview closes when the last assigned node is removed').to.be.true;
  expect(el.shadowRoot!.activeElement === base, 'closing the preview leaves keyboard focus on the entity chip').to.be.true;
  expect(base.hasAttribute('aria-describedby'), 'an empty preview is no longer advertised as a description').to.be.false;
  expect(assignedPreviewNodes(), 'no preview content remains assigned').to.have.lengthOf(0);
});
