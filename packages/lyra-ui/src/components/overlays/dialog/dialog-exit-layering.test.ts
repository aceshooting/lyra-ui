import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { twoFrames } from '../../../../test/frames.js';
import { observeOverlayStack } from '../../../internal/overlay-stack.js';
import { setAnimation } from '../../../utilities/animation-registry.js';
import type { LyraDialog } from './dialog.js';
import './dialog.js';

it('keeps a closing dialog painted above a reconnected lower dialog until its exit settles', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div>
    <lr-dialog id="lower" label="Lower" style="--lr-dialog-width:360px;--lr-dialog-height:240px"><button>Lower action</button></lr-dialog>
    <lr-dialog id="upper" label="Upper" style="--lr-dialog-width:360px;--lr-dialog-height:240px"><button>Upper action</button></lr-dialog>
  </div>`);
  const lower = wrapper.querySelector<LyraDialog>('#lower')!;
  const upper = wrapper.querySelector<LyraDialog>('#upper')!;
  let top: HTMLElement | undefined;
  const releaseStack = observeOverlayStack(document, ({ entries }) => { top = entries.filter(entry => entry.modal).at(-1)?.host; });
  const releaseAnimation = setAnimation(upper, 'dialog.hide', {
    keyframes: [{ opacity: 1, transform: 'none' }, { opacity: 1, transform: 'none' }],
    options: { duration: 10_000 },
  });
  const releaseBackdrop = setAnimation(upper, 'dialog.overlay.hide', null);
  let afterHide = 0;
  upper.addEventListener('lr-after-hide', () => { afterHide += 1; });
  try {
    await lower.show();
    await upper.show();
    wrapper.append(lower);
    await lower.updateComplete;
    await twoFrames();
    expect(top === upper).to.equal(true);
    expect(lower.matches(':popover-open'), 'the moved lower dialog waits behind the newer activation').to.equal(false);

    void upper.hide();
    await upper.updateComplete;
    const upperPanel = upper.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!;
    await waitUntil(() => upperPanel.getAnimations().some(animation => animation.id === 'dialog.hide'));
    const animation = upperPanel.getAnimations().find(candidate => candidate.id === 'dialog.hide')!;
    animation.pause();
    await twoFrames();
    expect(top === lower, 'interaction ownership has returned to the lower dialog').to.equal(true);
    expect(afterHide, 'the upper exit has not settled').to.equal(0);
    expect(upper.matches(':popover-open'), 'the closing upper surface remains presented').to.equal(true);
    const upperBox = upperPanel.getBoundingClientRect();
    const lowerBox = lower.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!.getBoundingClientRect();
    const x = upperBox.left + upperBox.width / 2;
    const y = upperBox.top + upperBox.height / 2;
    expect(x > 0 && x < innerWidth && y > 0 && y < innerHeight).to.equal(true);
    expect(x > lowerBox.left && x < lowerBox.right && y > lowerBox.top && y < lowerBox.bottom,
      'the exiting panel overlaps the lower panel').to.equal(true);

    // Closing disables pointer input independently of paint. Expose it only for this final
    // synchronous probe, restore both writes, and immediately destroy the fixture.
    const inert = upper.inert;
    const pointer = upper.style.getPropertyValue('pointer-events');
    const priority = upper.style.getPropertyPriority('pointer-events');
    let hitUpper = false;
    try {
      upper.inert = false;
      upper.style.setProperty('pointer-events', 'auto', 'important');
      const hit = document.elementFromPoint(x, y);
      hitUpper = hit !== null && (hit === upper || upper.contains(hit));
    } finally {
      upper.inert = inert;
      upper.style.removeProperty('pointer-events');
      if (pointer) upper.style.setProperty('pointer-events', pointer, priority);
    }
    expect(hitUpper, 'the still-visible exit retains its paint order until completion').to.equal(true);
  } finally {
    wrapper.remove();
    releaseStack();
    releaseAnimation();
    releaseBackdrop();
  }
});

it('admits a genuinely newer dialog during an exit and promotes the waiting older dialog after exits settle', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div>
    <lr-dialog id="lower" label="Lower"><button>Lower action</button></lr-dialog>
    <lr-dialog id="closing" label="Closing"><button>Closing action</button></lr-dialog>
    <lr-dialog id="newer" label="Newer"><button>Newer action</button></lr-dialog>
  </div>`);
  const lower = wrapper.querySelector<LyraDialog>('#lower')!;
  const closing = wrapper.querySelector<LyraDialog>('#closing')!;
  const newer = wrapper.querySelector<LyraDialog>('#newer')!;
  const releaseAnimation = setAnimation(closing, 'dialog.hide', {
    keyframes: [{ opacity: 1 }, { opacity: 1 }],
    options: { duration: 10_000 },
  });
  const releaseBackdrop = setAnimation(closing, 'dialog.overlay.hide', null);
  try {
    await lower.show();
    await closing.show();
    wrapper.append(lower);
    await lower.updateComplete;
    await twoFrames();
    expect(lower.matches(':popover-open')).to.equal(false);
    const hidden = closing.hide();
    await closing.updateComplete;
    const panel = closing.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!;
    await waitUntil(() => panel.getAnimations().some(animation => animation.id === 'dialog.hide'));
    const animation = panel.getAnimations().find(candidate => candidate.id === 'dialog.hide')!;
    animation.pause();
    await twoFrames();
    expect(lower.matches(':popover-open'), 'an older activation waits for the retained exit').to.equal(false);

    await newer.show();
    expect(newer.matches(':popover-open'), 'a newly activated dialog does not wait for an older exit').to.equal(true);
    expect(closing.matches(':popover-open'), 'the old exit is still presented').to.equal(true);
    animation.finish();
    await hidden;
    expect(lower.matches(':popover-open'), 'the newer active dialog still covers the waiting activation').to.equal(false);
    await newer.hide();
    await waitUntil(() => lower.matches(':popover-open'), 'the older activation is promoted after both exits settle');
  } finally {
    wrapper.remove();
    releaseAnimation();
    releaseBackdrop();
  }
});
