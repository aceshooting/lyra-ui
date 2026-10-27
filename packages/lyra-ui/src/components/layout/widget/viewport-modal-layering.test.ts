import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { twoFrames } from '../../../../test/frames.js';
import { observeOverlayStack } from '../../../internal/overlay-stack.js';
import type { LyraDialog } from '../../overlays/dialog/dialog.js';
import type { LyraAppRail } from '../app-rail/app-rail.js';
import type { LyraWidget } from './widget.js';
import '../../overlays/dialog/dialog.js';
import '../app-rail/app-rail.js';
import './widget.js';

function topModalHost(): HTMLElement | undefined {
  let top: HTMLElement | undefined;
  observeOverlayStack(document, ({ entries }) => {
    top = entries.filter(entry => entry.modal).at(-1)?.host;
  })();
  return top;
}

for (const kind of ['widget', 'app-rail'] as const) {
  for (const obstruction of ['stacking context', 'older dialog'] as const) {
    it(`paints a newer ${kind} modal above an ${obstruction}`, async () => {
      const wrapper = await fixture<HTMLElement>(html`
        <div>
          <div style="position: relative; z-index: 0; isolation: isolate;">
            ${kind === 'widget'
              ? html`<lr-widget label="Fullscreen content"><button>Widget action</button></lr-widget>`
              : html`<lr-app-rail mobile-breakpoint="100000px" icon-only-breakpoint="100001px" label="Navigation" style="--lr-transition-base: 0ms;"><button>Navigation action</button></lr-app-rail>`}
          </div>
          ${obstruction === 'older dialog'
            ? html`<lr-dialog label="Older dialog" style="--lr-dialog-width: 95vw; --lr-dialog-height: 90vh;"><button>Older action</button></lr-dialog>`
            : html`<div id="cover" style="position: fixed; inset: 0; z-index: 1; background: red;"></div>`}
        </div>
      `);
      const modal = (kind === 'widget' ? wrapper.querySelector('lr-widget') : wrapper.querySelector('lr-app-rail')) as LyraWidget | LyraAppRail;
      const older = wrapper.querySelector<LyraDialog>('lr-dialog');
      const obstructionElement = older ?? wrapper.querySelector<HTMLElement>('#cover')!;
      try {
        if (older) {
          const shown = oneEvent(older, 'lr-after-show');
          older.show();
          await shown;
          expect(older.matches(':popover-open'), 'the older dialog is in the native top layer').to.equal(true);
        }
        if (kind === 'widget') (modal as LyraWidget).fullscreen = true;
        else {
          expect((modal as LyraAppRail).mode, 'the mobile breakpoint selects mobile presentation').to.equal('mobile');
          (modal as LyraAppRail).open = true;
        }
        await modal.updateComplete;
        await waitUntil(() => topModalHost() === modal, 'the newer modal owns the shared stack');
        await twoFrames();

        const panel = modal.shadowRoot!.querySelector<HTMLElement>(kind === 'widget' ? '[part="base"]' : '[part="panel"]')!;
        if (kind === 'app-rail') await waitUntil(() => getComputedStyle(panel).transform === 'none', 'the mobile slide has settled');
        const box = panel.getBoundingClientRect();
        const x = box.left + box.width / 2;
        const y = box.top + box.height / 2;
        expect(box.width > 0 && box.height > 0, 'the modal panel has a rendered box').to.equal(true);
        expect(x > 0 && x < innerWidth && y > 0 && y < innerHeight, 'the probe is inside the viewport').to.equal(true);
        const coveringPanel = older?.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]') ?? obstructionElement;
        const coverBox = coveringPanel.getBoundingClientRect();
        expect(x > coverBox.left && x < coverBox.right && y > coverBox.top && y < coverBox.bottom,
          'the two painted surfaces overlap at the probe').to.equal(true);

        // Inert changes hit testing, not paint order. Expose only the covering surface for this
        // synchronous final probe, restore it before any callback, then immediately tear down.
        const inert = obstructionElement.inert;
        let hitBelongsToModal = false;
        try {
          obstructionElement.inert = false;
          const hit = document.elementFromPoint(x, y);
          hitBelongsToModal = hit !== null && (hit === modal || modal.contains(hit));
        } finally {
          obstructionElement.inert = inert;
        }
        expect(hitBelongsToModal, 'the logical top modal also owns the overlapping painted surface').to.equal(true);
      } finally {
        wrapper.remove();
      }
    });
  }
}
