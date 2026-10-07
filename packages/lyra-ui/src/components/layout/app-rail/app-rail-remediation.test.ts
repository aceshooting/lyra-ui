import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { hoverUntilMatched, resetMouse, sendMouse, settlePointer } from '../../../../test/wtr-mouse.js';
import './app-rail.js';
import '../app-rail-group/app-rail-group.js';
import type { LyraAppRail } from './app-rail.js';

describe('resize request continuation', () => {
  for (const revoke of ['resizable', 'mode', 'disconnect'] as const) {
    for (const interaction of ['keyboard', 'pointer'] as const) {
      it(`preserves listener state when ${interaction} resize revokes ${revoke}`, async () => {
        const el = await fixture<LyraAppRail>(html`
          <lr-app-rail force-mode="full" resizable rail-width="240"
            style="block-size: 16rem; --lr-transition-fast: 0ms;"></lr-app-rail>
        `);
        const resizer = el.shadowRoot!.querySelector<HTMLElement>('[part="resizer"]')!;
        let requests = 0;
        let commits = 0;
        el.addEventListener('lr-rail-resize', () => commits++);
        el.addEventListener('lr-rail-resize-request', () => {
          requests++;
          if (revoke === 'resizable') el.resizable = false;
          else if (revoke === 'mode') el.forceMode = 'icon-only';
          else el.remove();
          el.railWidth = 300;
        });
        try {
          if (interaction === 'keyboard') {
            resizer.focus();
            await sendKeys({ press: 'ArrowRight' });
          } else {
            await hoverUntilMatched(resizer, 'The rail resizer receives the pointer');
            const rect = resizer.getBoundingClientRect();
            await sendMouse({ type: 'down' });
            await waitUntil(() => el.dragging, 'The resize gesture starts');
            await sendMouse({ type: 'move', position: [Math.round(rect.x + rect.width / 2 + 24), Math.round(rect.y + rect.height / 2)] });
            await waitUntil(() => requests === 1, 'The move dispatches one resize request');
            await sendMouse({ type: 'up' });
          }
          await el.updateComplete;
          await settlePointer();
          expect(requests).to.equal(1);
          expect(el.railWidth).to.equal(300);
          expect(commits).to.equal(0);
          expect(el.dragging).to.equal(false);
        } finally {
          await resetMouse();
        }
      });
    }
  }

  for (const veto of [false, true]) {
    it(`keeps a width-only listener assignment ${veto ? 'when explicitly vetoed' : 'subject to normal acceptance'}`, async () => {
      const el = await fixture<LyraAppRail>(html`
        <lr-app-rail force-mode="full" resizable rail-width="240"></lr-app-rail>
      `);
      const commits: number[] = [];
      el.addEventListener('lr-rail-resize', (event) => commits.push((event as CustomEvent<{ widthPx: number }>).detail.widthPx));
      el.addEventListener('lr-rail-resize-request', (event) => {
        el.railWidth = 300;
        if (veto) event.preventDefault();
      });
      el.shadowRoot!.querySelector<HTMLElement>('[part="resizer"]')!.focus();
      await sendKeys({ press: 'ArrowRight' });
      await el.updateComplete;
      expect(el.railWidth).to.equal(veto ? 300 : 248);
      expect(commits).to.deep.equal(veto ? [] : [248]);
    });
  }
});

describe('rail overlay clicks, resizer keys and label', () => {
  it('measures its width only while a resizer renders', async () => {
    const el = await fixture<LyraAppRail>(html`<lr-app-rail force-mode="full"></lr-app-rail>`);
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    const measure = base.getBoundingClientRect.bind(base);
    let reads = 0;
    base.getBoundingClientRect = () => {
      reads += 1;
      return measure();
    };
    el.requestUpdate();
    await el.updateComplete;
    expect(reads).to.equal(0);
  });

  it('keeps the mobile overlay open for disclosures, header actions and item end content, and closes it for a link', async () => {
    const el = await fixture<LyraAppRail>(html`
      <lr-app-rail mobile-breakpoint="9999px">
        <lr-app-rail-group heading="Projects" collapsible>
          <button slot="header-actions" id="add">Add</button>
          <lr-app-rail-item href="#rail-target" id="item">A<span slot="meta" id="count">3</span><button slot="end" id="more">More</button></lr-app-rail-item>
        </lr-app-rail-group>
      </lr-app-rail>
    `);
    await waitUntil(() => el.mode === 'mobile');
    el.open = true;
    await el.updateComplete;
    const group = el.querySelector('lr-app-rail-group')!;
    const item = el.querySelector('lr-app-rail-item')!;
    await item.updateComplete;
    const clicks: Array<() => void> = [
      () => group.shadowRoot!.querySelector<HTMLElement>('[part="toggle"]')!.click(),
      () => el.querySelector<HTMLElement>('#add')!.click(),
      () => el.querySelector<HTMLElement>('#more')!.click(),
      () => el.querySelector<HTMLElement>('#count')!.click(),
    ];
    for (const click of clicks) {
      click();
      await el.updateComplete;
      expect(el.open).to.equal(true);
    }
    item.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!.click();
    await el.updateComplete;
    expect(el.open).to.equal(false);
  });

  it('leaves modified keys to the browser and jumps to the limits with Home and End', async () => {
    const el = await fixture<LyraAppRail>(html`
      <lr-app-rail force-mode="full" resizable rail-width="240" min-rail-width="200" max-rail-width="400"></lr-app-rail>
    `);
    const resizer = el.shadowRoot!.querySelector<HTMLElement>('[part="resizer"]')!;
    const press = (key: string, init: KeyboardEventInit = {}): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
      resizer.dispatchEvent(event);
      return event;
    };
    for (const init of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }, { isComposing: true }]) {
      expect(press('ArrowLeft', init).defaultPrevented, Object.keys(init)[0]).to.equal(false);
    }
    expect(el.railWidth).to.equal(240);
    press('Home');
    expect(el.railWidth).to.equal(200);
    press('End');
    expect(el.railWidth).to.equal(400);
  });

  it('takes an empty label literally and exposes accessibleLabel for the host aria-label', async () => {
    const el = await fixture<LyraAppRail>(html`<lr-app-rail label=""></lr-app-rail>`);
    expect(el.shadowRoot!.querySelector('[part~="base"]')!.getAttribute('aria-label')).to.equal('');
    expect(el.accessibleLabel).to.equal(null);
    el.setAttribute('aria-label', 'Main');
    await el.updateComplete;
    expect(el.accessibleLabel).to.equal('Main');
    expect(el.shadowRoot!.querySelector('[part~="base"]')!.getAttribute('aria-label')).to.equal('Main');
  });

  it('eases the mobile toggle fill on hover and press like the collapse control', async () => {
    const el = await fixture<LyraAppRail>(html`<lr-app-rail></lr-app-rail>`);
    const style = getComputedStyle(el.shadowRoot!.querySelector<HTMLElement>('[part="toggle"]')!);
    expect(style.transitionProperty).to.contain('background-color');
    expect(Number.parseFloat(style.transitionDuration)).to.be.greaterThan(0);
  });
});
