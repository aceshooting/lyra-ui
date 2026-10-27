import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { twoFrames } from '../../../../test/frames.js';
import { observeOverlayStack } from '../../../internal/overlay-stack.js';
import type { LyraDialog } from './dialog.js';
import './dialog.js';

it('keeps a newer dialog painted above an older open dialog after a DOM move', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div>
      <lr-dialog id="lower" label="Older dialog" style="--lr-dialog-width: 360px; --lr-dialog-height: 240px;"><button>Older action</button></lr-dialog>
      <lr-dialog id="upper" label="Newer dialog" style="--lr-dialog-width: 360px; --lr-dialog-height: 240px;"><button>Newer action</button></lr-dialog>
    </div>
  `);
  const lower = wrapper.querySelector<LyraDialog>('#lower')!;
  const upper = wrapper.querySelector<LyraDialog>('#upper')!;
  let topModal: HTMLElement | undefined;
  const release = observeOverlayStack(document, ({ entries }) => {
    topModal = entries.filter(entry => entry.modal).at(-1)?.host;
  });
  try {
    for (const dialog of [lower, upper]) {
      const shown = oneEvent(dialog, 'lr-after-show');
      dialog.show();
      await shown;
    }
    expect(topModal === upper, 'the second dialog starts as the logical top modal').to.equal(true);
    expect(upper.matches(':popover-open'), 'the newer dialog starts in the native top layer').to.equal(true);

    // append performs disconnect/connect even within the same parent, preserving this activation
    // while avoiding an additional inert ancestor that could mask the paint-order probe.
    wrapper.append(lower);
    await Promise.all([lower.updateComplete, upper.updateComplete]);
    await waitUntil(() => topModal === upper, 'moving the older dialog preserves activation order');
    await twoFrames();
    expect(lower.open && upper.open, 'the DOM move keeps both dialogs open').to.equal(true);
    expect(lower.inert, 'the older dialog remains outside the active interaction scope').to.equal(true);
    const lowerPanel = lower.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!;
    const upperPanel = upper.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!;
    const upperBox = upperPanel.getBoundingClientRect();
    const lowerBox = lowerPanel.getBoundingClientRect();
    const x = upperBox.left + upperBox.width / 2;
    const y = upperBox.top + upperBox.height / 2;
    expect(upperBox.width > 0 && upperBox.height > 0, 'the newer panel has a rendered box').to.equal(true);
    expect(x > 0 && x < innerWidth && y > 0 && y < innerHeight, 'the probe is inside the viewport').to.equal(true);
    expect(x > lowerBox.left && x < lowerBox.right && y > lowerBox.top && y < lowerBox.bottom,
      'both panels paint at the probe').to.equal(true);

    // Temporarily removing inert reveals paint order to hit testing without delivering events.
    // No await or event follows: the final assertion immediately tears down this fixture.
    const inert = lower.inert;
    let hitBelongsToUpper = false;
    try {
      lower.inert = false;
      const hit = document.elementFromPoint(x, y);
      hitBelongsToUpper = hit !== null && (hit === upper || upper.contains(hit));
    } finally {
      lower.inert = inert;
    }
    expect(hitBelongsToUpper, 'the newer dialog paints above the reconnected older dialog').to.equal(true);
  } finally {
    release();
    wrapper.remove();
  }
});
