import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { twoFrames } from '../../../../test/frames.js';
import { observeOverlayStack } from '../../../internal/overlay-stack.js';
import type { LyraDialog } from '../../overlays/dialog/dialog.js';
import type { LyraTour } from './tour.js';
import '../../overlays/dialog/dialog.js';
import './tour.js';

it('keeps a newer dialog above a reconnected modal tour', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div>
    <lr-tour></lr-tour>
    <lr-dialog label="Newer dialog" style="--lr-dialog-width:400px;--lr-dialog-height:300px"><button>Dialog action</button></lr-dialog>
  </div>`);
  const tour = wrapper.querySelector<LyraTour>('lr-tour')!;
  const dialog = wrapper.querySelector<LyraDialog>('lr-dialog')!;
  let top: HTMLElement | undefined;
  const release = observeOverlayStack(document, ({ entries }) => { top = entries.filter(entry => entry.modal).at(-1)?.host; });
  try {
    tour.steps = [{ stepId: 'intro', target: '#missing', heading: 'Welcome', content: 'Introduction' }];
    tour.start();
    await tour.updateComplete;
    await waitUntil(() => tour.matches(':popover-open'));
    await dialog.show();
    wrapper.append(tour);
    await tour.updateComplete;
    await twoFrames();
    expect(top === dialog, 'the dialog remains the logical top modal').to.equal(true);
    expect(tour.open && dialog.open).to.equal(true);
    const tourBox = tour.shadowRoot!.querySelector<HTMLElement>('[part="popover"]')!.getBoundingClientRect();
    const dialogBox = dialog.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!.getBoundingClientRect();
    const x = Math.max(tourBox.left, dialogBox.left) + (Math.min(tourBox.right, dialogBox.right) - Math.max(tourBox.left, dialogBox.left)) / 2;
    const y = Math.max(tourBox.top, dialogBox.top) + (Math.min(tourBox.bottom, dialogBox.bottom) - Math.max(tourBox.top, dialogBox.top)) / 2;
    expect(x > tourBox.left && x < tourBox.right && x > dialogBox.left && x < dialogBox.right).to.equal(true);
    expect(y > tourBox.top && y < tourBox.bottom && y > dialogBox.top && y < dialogBox.bottom).to.equal(true);
    expect(x > 0 && x < innerWidth && y > 0 && y < innerHeight).to.equal(true);
    const inert = tour.inert;
    let hitDialog = false;
    try {
      tour.inert = false;
      const hit = document.elementFromPoint(x, y);
      hitDialog = hit !== null && (hit === dialog || dialog.contains(hit));
    } finally {
      tour.inert = inert;
    }
    expect(hitDialog, 'the newer dialog also owns the overlapping painted surface').to.equal(true);
  } finally {
    wrapper.remove();
    release();
  }
});
