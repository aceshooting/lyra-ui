import { ignoreResizeObserverLoopErrors } from '../../../../test/resize-observer-noise.js';
import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './usage-badge.js';
import '../../overlays/dialog/dialog.js';
import type { LyraUsageBadge } from './usage-badge.js';
import type { LyraDialog } from '../../overlays/dialog/dialog.js';

ignoreResizeObserverLoopErrors(
  'These deferred lifecycle controls finish dialog exits and reopen the same observed panel while releasing pending layout work.'
);

function holdRuntime(badge: LyraUsageBadge): () => void {
  const seam = badge as unknown as {
    loadTooltipOverlayRuntime(): Promise<unknown>;
  };
  const load = seam.loadTooltipOverlayRuntime.bind(badge);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  seam.loadTooltipOverlayRuntime = () => gate.then(load);
  return release;
}
function tooltip(badge: LyraUsageBadge): HTMLElement | null {
  return badge.shadowRoot!.querySelector<HTMLElement>('[part="tooltip"]');
}
function base(badge: LyraUsageBadge): HTMLElement {
  return badge.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
}
function enter(badge: LyraUsageBadge): void {
  base(badge).dispatchEvent(new Event('mouseenter'));
}
async function frame(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}
async function settleCancelled(badge: LyraUsageBadge): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      badge.updateComplete,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () =>
            reject(new Error('cancelled opening left updateComplete pending')),
          1500
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

it('keeps a real newer dialog topmost after an older pending tooltip runtime resolves', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div>
    <lr-dialog id="older" label="Older" style="--lr-duration-base:0ms"
      ><button id="other">Other work</button
      ><lr-usage-badge tokens-in="12"></lr-usage-badge
    ></lr-dialog>
    <lr-dialog id="newer" label="Newer" style="--lr-duration-base:0ms"
      ><button>Newer work</button></lr-dialog
    >
  </div>`);
  const older = wrapper.querySelector<LyraDialog>('#older')!;
  const newer = wrapper.querySelector<LyraDialog>('#newer')!;
  const badge = wrapper.querySelector<LyraUsageBadge>('lr-usage-badge')!;
  const release = holdRuntime(badge);
  try {
    await older.show();
    older.querySelector<HTMLButtonElement>('#other')!.focus();
    enter(badge);
    await frame();
    expect(tooltip(badge)!.hidden).to.be.true;
    await newer.show();
    const focused = document.activeElement;
    release();
    await badge.updateComplete;
    expect(tooltip(badge)!.hidden).to.be.false;
    expect(document.activeElement === focused).to.be.true;
    await sendKeys({ press: 'Escape' });
    await waitUntil(
      () => !newer.open,
      'newer dialog owns first Escape after deferred older activation'
    );
    expect(older.open).to.be.true;
    expect(tooltip(badge)!.hidden).to.be.false;
    await sendKeys({ press: 'Escape' });
    await badge.updateComplete;
    expect(tooltip(badge)!.hidden).to.be.true;
    expect(older.open).to.be.true;
  } finally {
    release();
    await newer.close('api');
    await older.close('api');
  }
});

it('settles a cancelled hover opening before the runtime finishes, then permits a fresh open', async () => {
  const badge = await fixture<LyraUsageBadge>(
    html`<lr-usage-badge tokens-in="12"></lr-usage-badge>`
  );
  const release = holdRuntime(badge);
  try {
    enter(badge);
    await frame();
    base(badge).dispatchEvent(new Event('mouseleave'));
    await settleCancelled(badge);
    release();
    await frame();
    expect(tooltip(badge)!.hidden).to.be.true;
    enter(badge);
    await badge.updateComplete;
    expect(tooltip(badge)!.hidden).to.be.false;
  } finally {
    release();
  }
});

it('settles an opening cancelled by clearing its last content before the runtime finishes', async () => {
  const badge = await fixture<LyraUsageBadge>(
    html`<lr-usage-badge tokens-in="12"></lr-usage-badge>`
  );
  const release = holdRuntime(badge);
  try {
    enter(badge);
    await frame();
    badge.tokensIn = undefined;
    await settleCancelled(badge);
    release();
    await frame();
    expect(tooltip(badge) === null).to.be.true;
    badge.tokensIn = 12;
    await badge.updateComplete;
    expect(tooltip(badge)!.hidden).to.be.true;
    enter(badge);
    await badge.updateComplete;
    expect(tooltip(badge)!.hidden).to.be.false;
  } finally {
    release();
  }
});

it('cancels a disconnected pending opening before a same-node reconnect', async () => {
  const wrapper = await fixture<HTMLDivElement>(
    html`<div><lr-usage-badge tokens-in="12"></lr-usage-badge></div>`
  );
  const badge = wrapper.querySelector<LyraUsageBadge>('lr-usage-badge')!;
  const release = holdRuntime(badge);
  try {
    enter(badge);
    await frame();
    badge.remove();
    wrapper.append(badge);
    await settleCancelled(badge);
    release();
    await frame();
    expect(tooltip(badge)!.hidden).to.be.true;
    enter(badge);
    await badge.updateComplete;
    expect(tooltip(badge)!.hidden).to.be.false;
  } finally {
    release();
  }
});

it('does not revive an opening after its containing dialog closed while loading', async () => {
  const dialog = await fixture<LyraDialog>(
    html`<lr-dialog label="Usage" style="--lr-duration-base:0ms"
      ><button id="other">Other work</button
      ><lr-usage-badge tokens-in="12"></lr-usage-badge
    ></lr-dialog>`
  );
  const badge = dialog.querySelector<LyraUsageBadge>('lr-usage-badge')!;
  const release = holdRuntime(badge);
  try {
    await dialog.show();
    dialog.querySelector<HTMLButtonElement>('#other')!.focus();
    enter(badge);
    await frame();
    await sendKeys({ press: 'Escape' });
    await waitUntil(
      () => !dialog.open,
      'the hidden pending tooltip does not consume native Escape'
    );
    await waitUntil(
      () => base(badge).getClientRects().length === 0,
      'the containing dialog finishes its exit and stops rendering the badge'
    );
    release();
    await badge.updateComplete;
    expect(tooltip(badge)!.hidden).to.be.true;
    await dialog.show();
    expect(tooltip(badge)!.hidden).to.be.true;
    enter(badge);
    await badge.updateComplete;
    expect(tooltip(badge)!.hidden).to.be.false;
  } finally {
    release();
    await dialog.close('api');
  }
});

it('cancels a pending opening on cross-document adoption and opens freshly in the new realm', async () => {
  const wrapper = await fixture<HTMLDivElement>(
    html`<div>
      <lr-usage-badge tokens-in="12"></lr-usage-badge
      ><iframe title="Adoption destination"></iframe>
    </div>`
  );
  const badge = wrapper.querySelector<LyraUsageBadge>('lr-usage-badge')!;
  const frameElement = wrapper.querySelector<HTMLIFrameElement>('iframe')!;
  await waitUntil(
    () => Boolean(frameElement.contentDocument?.body),
    'the destination iframe is ready'
  );
  const nextDocument = frameElement.contentDocument!;
  const release = holdRuntime(badge);
  try {
    enter(badge);
    await frame();
    nextDocument.body.append(nextDocument.adoptNode(badge));
    await settleCancelled(badge);
    release();
    await frame();
    expect(badge.ownerDocument === nextDocument).to.be.true;
    expect(tooltip(badge)!.hidden).to.be.true;
    enter(badge);
    await badge.updateComplete;
    expect(tooltip(badge)!.hidden).to.be.false;
    const escape = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    nextDocument.dispatchEvent(escape);
    await badge.updateComplete;
    expect(escape.defaultPrevented).to.be.true;
    expect(tooltip(badge)!.hidden).to.be.true;
  } finally {
    release();
    badge.remove();
  }
});

it('keeps a newer open generation when an older cancelled loader settles late', async () => {
  const badge = await fixture<LyraUsageBadge>(
    html`<lr-usage-badge tokens-in="12"></lr-usage-badge>`
  );
  const seam = badge as unknown as {
    loadTooltipOverlayRuntime(): Promise<unknown>;
  };
  const load = seam.loadTooltipOverlayRuntime.bind(badge);
  let release!: () => void;
  const firstGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  seam.loadTooltipOverlayRuntime = () =>
    ++calls === 1 ? firstGate.then(load) : load();
  try {
    enter(badge);
    await frame();
    base(badge).dispatchEvent(new Event('mouseleave'));
    await settleCancelled(badge);
    enter(badge);
    await badge.updateComplete;
    expect(tooltip(badge)!.hidden).to.be.false;
    release();
    await frame();
    expect(tooltip(badge)!.hidden).to.be.false;
    const escape = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(escape);
    await badge.updateComplete;
    expect(escape.defaultPrevented).to.be.true;
    expect(tooltip(badge)!.hidden).to.be.true;
  } finally {
    release();
  }
});

it('settles a failed first-load attempt and permits a later opening to retry', async () => {
  const badge = await fixture<LyraUsageBadge>(
    html`<lr-usage-badge tokens-in="12"></lr-usage-badge>`
  );
  const seam = badge as unknown as {
    loadTooltipOverlayRuntime(): Promise<unknown>;
  };
  const load = seam.loadTooltipOverlayRuntime.bind(badge);
  let calls = 0;
  seam.loadTooltipOverlayRuntime = () =>
    ++calls === 1
      ? Promise.reject(new Error('Simulated unavailable tooltip runtime'))
      : load();
  enter(badge);
  await settleCancelled(badge);
  expect(tooltip(badge)!.hidden).to.be.true;
  base(badge).dispatchEvent(new Event('mouseleave'));
  enter(badge);
  await badge.updateComplete;
  expect(tooltip(badge)!.hidden).to.be.false;
});
