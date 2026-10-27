import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { sendMouse } from '../../../../test/wtr-mouse.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { activateOverlay, deepActiveElement } from '../../../internal/overlay-manager.js';
import './responsive-panel.js';
import '../page/page.js';

for (const direction of ['ltr', 'rtl'] as const) {
  it(`keeps an aside overlay above the page sticky header in ${direction}`, async () => {
    const page = await fixture(html`<lr-page dir=${direction} style="--lr-page-header-height:80px;--lr-page-aside-width:320px">
      <button slot="header" id="opener">Open settings</button>
      <h1>Main content</h1>
      <lr-responsive-panel slot="aside" mode="overlay" label="Settings">
        <button id="action">Apply settings</button>
      </lr-responsive-panel>
    </lr-page>`);
    const panel = page.querySelector('lr-responsive-panel')!;
    const opener = page.querySelector<HTMLButtonElement>('#opener')!;
    const action = panel.querySelector<HTMLButtonElement>('#action')!;
    await panel.updateComplete;
    await focusByKeyboard(opener);
    panel.show();
    await panel.updateComplete;
    const base = panel.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    expect(base.matches(':popover-open'), 'ordinary overlays enter the browser top layer').to.equal(true);
    expect(panel.parentElement === page, 'the declarative host remains in its aside slot').to.equal(true);
    await waitUntil(() => action.getBoundingClientRect().width > 0);
    const rect = action.getBoundingClientRect();
    const header = page.shadowRoot!.querySelector<HTMLElement>('[part~="header"]')!.getBoundingClientRect();
    expect(rect.top, 'the overlay action intersects the sticky header vertically').to.be.lessThan(header.bottom);
    let clicks = 0;
    action.addEventListener('click', () => clicks++);
    await sendMouse({ type: 'click', position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)] });
    expect(clicks, 'the pointer reaches overlay content above the header').to.equal(1);
    expect(deepActiveElement(document) === action).to.equal(true);
    const veto = (event: Event): void => event.preventDefault();
    panel.addEventListener('lr-close-request', veto);
    await sendKeys({ press: 'Escape' });
    expect(panel.open).to.equal(true);
    expect(base.matches(':popover-open'), 'a veto preserves top-layer presentation').to.equal(true);
    panel.removeEventListener('lr-close-request', veto);
    await sendKeys({ press: 'Escape' });
    await waitUntil(() => !panel.open);
    expect(base.matches(':popover-open')).to.equal(false);
    await waitUntil(() => deepActiveElement(document) === opener);
  });
}

it('keeps its top-layer position while a nonmodal child opens and closes', async () => {
  const panel = await fixture(html`<lr-responsive-panel mode="overlay" open label="Settings">
    <button>Settings action</button>
    <div popover="manual"><button>Popup action</button></div>
  </lr-responsive-panel>`);
  const base = panel.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const popup = panel.querySelector('div')!;
  const show = base.showPopover;
  let promotions = 0;
  base.showPopover = (): void => {
    promotions += 1;
    show.call(base);
  };
  const handle = activateOverlay({
    host: popup,
    panel: () => popup,
    modal: false,
    trapFocus: false,
    onEscape: () => popup.hidePopover(),
  });
  try {
    popup.showPopover();
    await Promise.resolve();
    expect(base.matches(':popover-open')).to.equal(true);
    expect(promotions, 'a nonmodal child does not reorder its parent surface').to.equal(0);
    handle.deactivate({ restoreFocus: false });
    popup.hidePopover();
    await Promise.resolve();
    expect(base.matches(':popover-open')).to.equal(true);
    expect(promotions).to.equal(0);
  } finally {
    handle.deactivate({ restoreFocus: false });
    popup.hidePopover();
    base.showPopover = show;
  }
});

it('retains the body and slotted content when an open panel switches presentation and reconnects', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div>
    <lr-responsive-panel mode="inline" open><input value="Retained" /></lr-responsive-panel>
  </div>`);
  const panel = wrapper.querySelector('lr-responsive-panel')!;
  const input = panel.querySelector('input')!;
  const body = panel.shadowRoot!.querySelector('[part="body"]')!;
  await focusByKeyboard(input);
  panel.mode = 'overlay';
  await panel.updateComplete;
  const base = panel.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  expect(base.matches(':popover-open')).to.equal(true);
  expect(panel.shadowRoot!.querySelector('[part="body"]') === body).to.equal(true);
  expect(deepActiveElement(document) === input).to.equal(true);
  panel.mode = 'inline';
  await panel.updateComplete;
  expect(base.matches(':popover-open')).to.equal(false);
  expect(panel.shadowRoot!.querySelector('[part="body"]') === body).to.equal(true);
  expect(deepActiveElement(document) === input).to.equal(true);
  panel.mode = 'overlay';
  await panel.updateComplete;
  panel.remove();
  wrapper.append(panel);
  await panel.updateComplete;
  await waitUntil(() => base.matches(':popover-open'));
  expect(panel.shadowRoot!.querySelector('[part="body"]') === body).to.equal(true);
  expect(input.value).to.equal('Retained');
});

for (const upperKind of ['responsive-panel', 'page'] as const) {
  it(`keeps the newer ${upperKind} above a reconnected lower responsive panel`, async () => {
    const wrapper = await fixture<HTMLElement>(html`<div>
      <lr-responsive-panel mode="overlay" label="Lower"><button>Lower action</button></lr-responsive-panel>
    </div>`);
    const lower = wrapper.querySelector('lr-responsive-panel')!;
    const upper = upperKind === 'page' ? document.createElement('lr-page') : document.createElement('lr-responsive-panel');
    upper.style.setProperty('--lr-transition-base', '0ms');
    const action = document.createElement('button');
    action.textContent = 'Upper action';
    if (upperKind === 'page') {
      upper.style.inlineSize = '320px';
      action.slot = 'navigation';
    } else {
      upper.setAttribute('mode', 'overlay');
      upper.setAttribute('label', 'Upper');
    }
    upper.append(action);
    wrapper.append(upper);
    await upper.updateComplete;
    lower.show();
    await lower.updateComplete;
    if (upperKind === 'page') Reflect.set(upper, 'navOpen', true);
    else Reflect.set(upper, 'open', true);
    await upper.updateComplete;
    let clicks = 0;
    action.addEventListener('click', () => clicks++);
    const clickUpper = async (): Promise<void> => {
      await waitUntil(() => action.getBoundingClientRect().width > 0);
      const rect = action.getBoundingClientRect();
      await sendMouse({ type: 'click', position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)] });
    };
    await clickUpper();
    expect(clicks, 'the newer modal owns the visible pointer surface').to.equal(1);
    lower.remove();
    wrapper.append(lower);
    await lower.updateComplete;
    await clickUpper();
    expect(clicks, 'reconnecting the lower modal preserves visual order').to.equal(2);
    expect(deepActiveElement(document) === action).to.equal(true);
    // Inert suppresses hit testing but not paint. Probe the overlapping surfaces,
    // then remove this fixture before the temporary inert writes can affect later work.
    const rect = action.getBoundingClientRect();
    const inert = lower.inert;
    try {
      let upperPaintsAbove = false;
      try {
        lower.inert = false;
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        upperPaintsAbove = hit !== null && (hit === upper || upper.contains(hit));
      } finally {
        lower.inert = inert;
      }
      expect(upperPaintsAbove, 'the newer modal paints above the lower surface').to.equal(true);
    } finally {
      wrapper.remove();
    }
  });
}

it('restores a covered panel to the top layer when the newer modal closes', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div>
    <lr-responsive-panel mode="overlay" label="Lower"><button>Lower action</button></lr-responsive-panel>
    <lr-responsive-panel mode="overlay" label="Upper"><button>Upper action</button></lr-responsive-panel>
  </div>`);
  const [lower, upper] = wrapper.querySelectorAll('lr-responsive-panel');
  lower!.show();
  await lower!.updateComplete;
  upper!.show();
  await upper!.updateComplete;
  lower!.remove();
  wrapper.append(lower!);
  await lower!.updateComplete;
  await sendKeys({ press: 'Escape' });
  await waitUntil(() => !upper!.open);
  expect(lower!.open).to.equal(true);
  await waitUntil(() => lower!.shadowRoot!.querySelector('[part="base"]')!.matches(':popover-open'));
  expect(deepActiveElement(document) === lower!.querySelector('button')).to.equal(true);
  await sendKeys({ press: 'Escape' });
  await waitUntil(() => !lower!.open);
});

it('keeps a retained nonmodal child above its parent when a covering modal closes', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div>
    <lr-responsive-panel mode="overlay" label="Lower">
      <button>Lower action</button>
      <div popover="manual" style="position:fixed;inset:40px auto auto 40px;margin:0">
        <button>Popup action</button>
      </div>
    </lr-responsive-panel>
    <lr-responsive-panel mode="overlay" label="Upper"><button>Upper action</button></lr-responsive-panel>
  </div>`);
  const [lower, upper] = wrapper.querySelectorAll('lr-responsive-panel');
  const popup = lower!.querySelector('div')!;
  const action = popup.querySelector('button')!;
  lower!.show();
  await lower!.updateComplete;
  popup.showPopover();
  const handle = activateOverlay({
    host: popup,
    panel: () => popup,
    modal: false,
    trapFocus: false,
    onEscape: () => popup.hidePopover(),
  });
  try {
    upper!.show();
    await upper!.updateComplete;
    expect(popup.matches(':popover-open'), 'the child popup is retained under the covering modal').to.equal(true);
    upper!.hide();
    await upper!.updateComplete;
    await waitUntil(() => lower!.shadowRoot!.querySelector('[part="base"]')!.matches(':popover-open'));
    expect(popup.matches(':popover-open')).to.equal(true);
    const rect = action.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    expect(hit === action, 'the retained child remains above the re-exposed parent').to.equal(true);
  } finally {
    handle.deactivate({ restoreFocus: false });
    popup.hidePopover();
  }
});
