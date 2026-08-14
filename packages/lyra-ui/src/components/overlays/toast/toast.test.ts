import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import { toast } from './toaster.js';
import './toast.js';
import type { LyraToast } from './toast.js';
import type { LyraToastItem } from './toast-item.js';
import { styles } from './toast.styles.js';

function announcementTexts(politeness: 'polite' | 'assertive'): string[] {
  const sink = document.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="${politeness}"]`);
  return sink ? Array.from(sink.children, (child) => child.textContent ?? '') : [];
}

it('announces only the normalized message when toast() supplies icon and action controls', async () => {
  const assertiveBefore = announcementTexts('assertive');
  const politeBefore = announcementTexts('polite');
  const { item } = toast({
    message: 'File deleted',
    variant: 'danger',
    duration: 0,
    withIcon: true,
    action: { label: 'Undo', onClick: () => {} },
  });
  const el = await item;

  try {
    const sink = document.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`);
    expect(Boolean(sink), 'the assertive sink should be pre-mounted').to.equal(true);

    const icon = document.createElement('span');
    icon.slot = 'icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '!';
    el.append(icon);

    await waitUntil(() => el.hasAttribute('data-visible'), 'toast should show before it announces', {
      timeout: 1000,
    });

    expect(el.hasAttribute('role'), 'visible toast chrome must not own a live role').to.equal(false);
    expect(el.hasAttribute('aria-live'), 'visible toast chrome must not own live state').to.equal(false);
    expect(sink?.getAttribute('aria-atomic')).to.equal('false');
    expect(announcementTexts('assertive').slice(assertiveBefore.length)).to.deep.equal(['File deleted']);
    expect(announcementTexts('polite').slice(politeBefore.length)).to.deep.equal([]);

    const helperAction = el.querySelector<HTMLButtonElement>('button');
    const closeButton = el.shadowRoot?.querySelector<HTMLButtonElement>('[part="close-button"]');
    expect(Boolean(helperAction), 'toast() should retain its visible action').to.equal(true);
    expect(helperAction?.textContent).to.equal('Undo');
    expect(closeButton?.getAttribute('aria-label')).to.equal('Close: File deleted');

    const lateAction = document.createElement('button');
    lateAction.type = 'button';
    lateAction.textContent = 'Retry';
    el.append(lateAction);
    await Promise.resolve();
    await el.updateComplete;
    expect(
      announcementTexts('assertive').slice(assertiveBefore.length),
      'adding a control after show must not re-announce the message subtree',
    ).to.deep.equal(['File deleted']);

    el.shadowRoot?.querySelector<HTMLElement>('[part="toast-item"]')?.getAnimations().forEach((animation) => {
      animation.finish();
    });
    await expect(el).to.be.accessible();
  } finally {
    el.remove();
  }
});

it('mounts a singleton region and shows an item', async () => {
  const handle = toast({ message: 'hi', variant: 'success', duration: 0 });
  const region = document.querySelector('lr-toast');
  expect(region).to.exist;

  await waitUntil(() => region!.querySelector('lr-toast-item'));
  expect(document.querySelectorAll('lr-toast').length).to.equal(1);

  handle.dismiss();
  await waitUntil(() => !region!.querySelector('lr-toast-item'), 'item should be removed', {
    timeout: 2000,
  });
});

it('reuses the same region for multiple toasts', async () => {
  toast({ message: 'a', duration: 0 });
  toast({ message: 'b', duration: 0 });
  await waitUntil(() => document.querySelectorAll('lr-toast-item').length >= 2);
  expect(document.querySelectorAll('lr-toast').length).to.equal(1);
});

it('renders an action button when provided', async () => {
  let clicked = false;
  const { item } = toast({
    message: 'undo me',
    duration: 0,
    action: { label: 'Undo', onClick: () => (clicked = true) },
  });
  const el = await item;
  const btn = el.querySelector('button');
  expect((btn) != null).to.equal(true);
  btn!.click();
  expect(clicked).to.be.true;
});

it('styles the appended action button through the design-token system instead of leaving it browser-default', async () => {
  // toast-item.styles.ts previously had no ::slotted(button) rule at all, so
  // the <button> toaster.ts appends for `action` rendered with completely
  // unstyled UA chrome (a boxed, beveled button) instead of matching the
  // rest of the token-driven design.
  const { item } = toast({
    message: 'undo me',
    duration: 0,
    action: { label: 'Undo', onClick: () => {} },
  });
  const el = await item;
  const btn = el.querySelector('button')!;
  const computed = getComputedStyle(btn);
  expect(computed.borderStyle, 'the default UA button border must be removed').to.equal('none');
  expect(computed.backgroundColor, 'the default UA button background must be removed').to.equal(
    'rgba(0, 0, 0, 0)',
  );
  expect(computed.cursor).to.equal('pointer');

  const messageNode = Array.from(el.childNodes).find((node) => node.nodeType === Node.TEXT_NODE)!;
  const messageRange = document.createRange();
  messageRange.selectNodeContents(messageNode);
  const messageRect = messageRange.getBoundingClientRect();
  const buttonRect = btn.getBoundingClientRect();
  expect(
    buttonRect.left - messageRect.right,
    'the action label must not visually run into the message text',
  ).to.be.at.least(4);
});

it('keeps an English message and action in logical order inside an RTL page', async () => {
  const wrapper = await fixture(html`
    <div dir="rtl"><lr-toast-item duration="0">Item deleted<button>Undo</button></lr-toast-item></div>
  `);
  const el = wrapper.querySelector('lr-toast-item') as LyraToastItem;
  await el.updateComplete;

  const messageNode = Array.from(el.childNodes).find((node) => node.nodeType === Node.TEXT_NODE)!;
  const messageRange = document.createRange();
  messageRange.selectNodeContents(messageNode);
  const messageRect = messageRange.getBoundingClientRect();
  const buttonRect = el.querySelector('button')!.getBoundingClientRect();

  expect(messageRect.left, 'the LTR message must render before its LTR action').to.be.lessThan(buttonRect.left);
  expect(buttonRect.left - messageRect.right).to.be.at.least(4);
});

it('reflects the placement property on <lr-toast>', async () => {
  const region = (await fixture(html`<lr-toast></lr-toast>`)) as LyraToast;
  expect(region.getAttribute('placement')).to.equal('top-end');

  region.placement = 'bottom-center';
  await region.updateComplete;
  expect(region.getAttribute('placement')).to.equal('bottom-center');
});

it('honors the mapped --gap and --width aliases without displacing the Lyra names', async () => {
  const region = (await fixture(html`
    <lr-toast style="--gap: 13px; --width: 321px"></lr-toast>
  `)) as LyraToast;
  const stack = region.shadowRoot!.querySelector<HTMLElement>('[part="stack"]')!;

  expect(getComputedStyle(stack).gap).to.equal('13px');
  expect(getComputedStyle(stack).inlineSize).to.equal('321px');

  region.style.setProperty('--lr-toast-gap', '17px');
  region.style.setProperty('--lr-toast-width', '287px');
  expect(getComputedStyle(stack).gap).to.equal('17px');
  expect(getComputedStyle(stack).inlineSize).to.equal('287px');
});

it('publishes the visible custom state exactly while the stack contains a toast item', async function () {
  try {
    document.createElement('div').matches(':state(visible)');
  } catch {
    this.skip();
  }

  const region = (await fixture(html`<lr-toast></lr-toast>`)) as LyraToast;
  expect(region.matches(':state(visible)')).to.equal(false);

  const item = document.createElement('lr-toast-item') as LyraToastItem;
  item.duration = 0;
  item.textContent = 'Now visible';
  region.appendChild(item);
  await waitUntil(() => region.matches(':state(visible)'));

  item.remove();
  await aTimeout(0);
  expect(region.matches(':state(visible)')).to.equal(false);
});

const toastPlacements = [
  "top-start",
  "top-center",
  "top-end",
  "bottom-start",
  "bottom-center",
  "bottom-end",
] as const;

async function toastPlacementFixture(
  inlineSize: 319 | 320,
  direction: "ltr" | "rtl",
  toastWidth: number
): Promise<HTMLElement> {
  return fixture(html`
    <div
      style="
        position: relative;
        inline-size: ${inlineSize}px;
        block-size: 211px;
        transform: translateZ(0);
      "
    >
      ${toastPlacements.map(
        (placement) => html`
          <lr-toast
            dir=${direction}
            placement=${placement}
            style="
              --lr-space-l: 7px;
              --lr-safe-area-top: 17px;
              --lr-safe-area-bottom: 29px;
              --lr-safe-area-inline-start: 41px;
              --lr-safe-area-inline-end: 73px;
              --lr-toast-width: ${toastWidth}px;
            "
          >
            <span
              style="display: block; inline-size: 100%; block-size: 20px"
            ></span>
          </lr-toast>
        `
      )}
    </div>
  `);
}

it("positions every logical placement inside an asymmetric safe-area rectangle at 319px and 320px", async () => {
  const toastWidth = 96;
  for (const inlineSize of [319, 320] as const) {
    for (const direction of ["ltr", "rtl"] as const) {
      const wrapper = await toastPlacementFixture(
        inlineSize,
        direction,
        toastWidth
      );
      const wrapperRect = wrapper.getBoundingClientRect();
      const safeLeft = wrapperRect.left + (direction === "ltr" ? 41 : 73);
      const safeRight = wrapperRect.right - (direction === "ltr" ? 73 : 41);
      const safeCenter = (safeLeft + safeRight) / 2;

      for (const placement of toastPlacements) {
        const region = wrapper.querySelector<LyraToast>(
          `lr-toast[placement="${placement}"]`
        )!;
        const stack =
          region.shadowRoot!.querySelector<HTMLElement>('[part="stack"]')!;
        const stackRect = stack.getBoundingClientRect();
        const message = `${inlineSize}px ${direction} ${placement}`;

        expect(stackRect.width, `${message} width`).to.be.closeTo(
          toastWidth,
          0.75
        );
        if (placement.startsWith("top")) {
          expect(stackRect.top, `${message} block start`).to.be.closeTo(
            wrapperRect.top + 17,
            0.75
          );
        } else {
          expect(stackRect.bottom, `${message} block end`).to.be.closeTo(
            wrapperRect.bottom - 29,
            0.75
          );
        }

        if (placement.endsWith("start")) {
          const actualStart =
            direction === "ltr" ? stackRect.left : stackRect.right;
          const expectedStart = direction === "ltr" ? safeLeft : safeRight;
          expect(actualStart, `${message} inline start`).to.be.closeTo(
            expectedStart,
            0.75
          );
        } else if (placement.endsWith("end")) {
          const actualEnd =
            direction === "ltr" ? stackRect.right : stackRect.left;
          const expectedEnd = direction === "ltr" ? safeRight : safeLeft;
          expect(actualEnd, `${message} inline end`).to.be.closeTo(
            expectedEnd,
            0.75
          );
        } else {
          expect(
            (stackRect.left + stackRect.right) / 2,
            `${message} inline center`
          ).to.be.closeTo(safeCenter, 0.75);
        }
      }
    }
  }
});

it("caps every placement to the usable safe-area width instead of the physical viewport", async () => {
  for (const inlineSize of [319, 320] as const) {
    for (const direction of ["ltr", "rtl"] as const) {
      const wrapper = await toastPlacementFixture(inlineSize, direction, 2000);
      const wrapperRect = wrapper.getBoundingClientRect();
      const safeLeft = wrapperRect.left + (direction === "ltr" ? 41 : 73);
      const safeRight = wrapperRect.right - (direction === "ltr" ? 73 : 41);

      for (const placement of toastPlacements) {
        const region = wrapper.querySelector<LyraToast>(
          `lr-toast[placement="${placement}"]`
        )!;
        const stack =
          region.shadowRoot!.querySelector<HTMLElement>('[part="stack"]')!;
        const stackRect = stack.getBoundingClientRect();
        const message = `${inlineSize}px ${direction} ${placement}`;

        expect(stackRect.left, `${message} physical left`).to.be.closeTo(
          safeLeft,
          0.75
        );
        expect(stackRect.right, `${message} physical right`).to.be.closeTo(
          safeRight,
          0.75
        );
      }
    }
  }
});

it("resolves every placement inset from the logical safe-area tokens", async () => {
  for (const direction of ["ltr", "rtl"] as const) {
    for (const placement of toastPlacements) {
      const region = (await fixture(html`
        <lr-toast
          dir=${direction}
          placement=${placement}
          style="
            --lr-space-l: 11px;
            --lr-safe-area-top: 101px;
            --lr-safe-area-bottom: 103px;
            --lr-safe-area-inline-start: 107px;
            --lr-safe-area-inline-end: 109px;
            --lr-toast-width: 2000px;
          "
        ></lr-toast>
      `)) as LyraToast;
      const placementStyle = getComputedStyle(region);

      if (placement.startsWith('top')) {
        expect(placementStyle.insetBlockStart, `${direction} ${placement} block start`).to.equal('101px');
      } else {
        expect(placementStyle.insetBlockEnd, `${direction} ${placement} block end`).to.equal('103px');
      }
      if (placement.endsWith('start')) {
        expect(placementStyle.insetInlineStart, `${direction} ${placement} inline start`).to.equal('107px');
      } else if (placement.endsWith('end')) {
        expect(placementStyle.insetInlineEnd, `${direction} ${placement} inline end`).to.equal('109px');
      }
    }
  }
});

it('does not retroactively move an already-open toast when a later call uses a different placement', async () => {
  const first = toast({ message: 'stay put', placement: 'top-start', duration: 0 });
  await first.item;
  const firstRegion = document.querySelector('lr-toast[placement="top-start"]') as LyraToast | null;
  expect(firstRegion, 'a region for top-start should have been mounted').to.exist;

  toast({ message: 'elsewhere', placement: 'bottom-start', duration: 0 });
  await waitUntil(() => document.querySelector('lr-toast[placement="bottom-start"]'));

  expect(firstRegion!.placement, 'the earlier top-start region must stay at top-start').to.equal('top-start');
  expect(firstRegion!.isConnected).to.be.true;
});

it('create() on the region resolves to the item', async () => {
  const region = (await fixture(html`<lr-toast></lr-toast>`)) as LyraToast;
  const item = await region.create('direct', { variant: 'warning', duration: 0 });
  expect(item.variant).to.equal('warning');
  expect(item.textContent).to.contain('direct');
});

it('recreates its child observer in the adopted owner realm', async () => {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const foreignWindow = iframe.contentWindow!;
  const descriptor = Object.getOwnPropertyDescriptor(foreignWindow, 'MutationObserver');
  const NativeMutationObserver = foreignWindow.MutationObserver;
  let toastObservations = 0;
  class TrackingMutationObserver extends NativeMutationObserver {
    override observe(target: Node, options?: MutationObserverInit): void {
      super.observe(target, options);
      if ((target as { localName?: string }).localName === 'lr-toast') toastObservations += 1;
    }
  }
  Object.defineProperty(foreignWindow, 'MutationObserver', {
    configurable: true,
    value: TrackingMutationObserver,
  });
  const region = (await fixture(html`<lr-toast></lr-toast>`)) as LyraToast;
  region.remove();

  try {
    iframe.contentDocument!.body.append(iframe.contentDocument!.adoptNode(region));
    await region.updateComplete;
    expect(toastObservations).to.be.greaterThan(0);
  } finally {
    region.remove();
    if (descriptor) Object.defineProperty(foreignWindow, 'MutationObserver', descriptor);
    else delete (foreignWindow as Window & { MutationObserver?: typeof MutationObserver }).MutationObserver;
    iframe.remove();
  }
});

it('create() does not depend on the ambient document factory after adoption', async () => {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const region = (await fixture(html`<lr-toast></lr-toast>`)) as LyraToast;
  region.remove();
  const descriptor = Object.getOwnPropertyDescriptor(document, 'createElement');
  const nativeCreateElement = document.createElement;

  try {
    const foreignWindow = iframe.contentWindow!;
    const ForeignHTMLElement = (
      foreignWindow as unknown as { HTMLElement: typeof HTMLElement }
    ).HTMLElement;
    class ForeignToastItem extends ForeignHTMLElement {
      variant = 'neutral';
      duration = 5000;
      size = 'medium';
      withIcon = false;
      readonly updateComplete = Promise.resolve(true);
      async show(): Promise<void> {}
      async hide(): Promise<void> {}
    }
    foreignWindow.customElements.define('lr-toast-item', ForeignToastItem);
    iframe.contentDocument!.body.append(iframe.contentDocument!.adoptNode(region));
    await region.updateComplete;
    Object.defineProperty(document, 'createElement', {
      configurable: true,
      value(name: string, options?: ElementCreationOptions) {
        if (name === 'lr-toast-item') throw new Error('ambient toast-item factory used');
        return nativeCreateElement.call(document, name, options);
      },
    });

    const item = await region.create('Owner item', { duration: 0 });
    expect(item.ownerDocument === iframe.contentDocument).to.equal(true);
    expect(typeof item.hide).to.equal('function');
  } finally {
    if (descriptor) Object.defineProperty(document, 'createElement', descriptor);
    else delete (document as Document & { createElement?: Document['createElement'] }).createElement;
    region.remove();
    iframe.remove();
  }
});

it("create() with no options leaves every field at <lr-toast-item>'s own declared defaults", async () => {
  // create() must not hardcode its own copy of each default -- it should
  // defer entirely to whatever `document.createElement('lr-toast-item')`
  // already sets, so this stays correct even if toast-item.ts's own
  // property defaults ever change.
  const probe = document.createElement('lr-toast-item') as LyraToastItem;
  const region = (await fixture(html`<lr-toast></lr-toast>`)) as LyraToast;
  const item = await region.create('defaults only');

  expect(item.variant).to.equal(probe.variant);
  expect(item.duration).to.equal(probe.duration);
  expect(item.size).to.equal(probe.size);
  expect(item.withIcon).to.equal(probe.withIcon);
});

it('is accessible as a bare region with no toasts open', async () => {
  const region = (await fixture(html`<lr-toast></lr-toast>`)) as LyraToast;
  const stack = region.shadowRoot!.querySelector('[part="stack"]')!;
  expect(stack.hasAttribute('role')).to.be.false;
  expect(stack.hasAttribute('aria-live')).to.be.false;
  await expect(region).to.be.accessible();
});

it('is accessible once a toast item is showing inside it', async () => {
  const region = (await fixture(html`<lr-toast></lr-toast>`)) as LyraToast;
  const item = await region.create('Accessible toast', { duration: 0 });
  // `data-visible` starts the transition; wait for its completion so axe measures the final
  // foreground colour instead of WebKit's partially transparent animation frame.
  await oneEvent(item, 'lr-after-show');
  await expect(region).to.be.accessible();
});

it('does not contain the dead `[part="stack"]::slotted(*)` selector', () => {
  // `::slotted()` must be attached directly to a compound selector matching the
  // <slot> element itself; `[part='stack']` matches the wrapping <div>, not the
  // nested <slot>, so this compound selector can never match anything and is inert.
  const cssText = Array.isArray(styles)
    ? styles.map((s) => s.cssText).join('\n')
    : (styles as { cssText: string }).cssText;
  expect(cssText).to.not.match(/\[part=['"]?stack['"]?\]\s*::slotted/);
  expect(cssText).to.match(/(^|\n)\s*::slotted\(\*\)\s*{/);
});

it('keeps an actionable toast persistent when duration is omitted', async () => {
  const handle = toast({ message: 'Undoable', action: { label: 'Undo', onClick: () => {} } });
  const item = await handle.item;
  expect(item.duration).to.equal(0);
  await item.hide();
});
