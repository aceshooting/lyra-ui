import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { hoverUntilMatched, resetMouse, sendMouse, settlePointer } from '../../../../test/wtr-mouse.js';
import './app-rail.js';
import type { LyraAppRail } from './app-rail.js';

describe('resize request continuation', () => {
  for (const revoke of ['resizable', 'mode', 'disconnect'] as const) {
    for (const interaction of ['keyboard', 'pointer'] as const) {
      it(`preserves listener state when ${interaction} resize revokes ${revoke}`, async () => {
        const el = await fixture<LyraAppRail>(html`
          <lr-app-rail force-mode="full" resizable rail-width-px="240"
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
          el.railWidthPx = 300;
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
          expect(el.railWidthPx).to.equal(300);
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
        <lr-app-rail force-mode="full" resizable rail-width-px="240"></lr-app-rail>
      `);
      const commits: number[] = [];
      el.addEventListener('lr-rail-resize', (event) => commits.push((event as CustomEvent<{ widthPx: number }>).detail.widthPx));
      el.addEventListener('lr-rail-resize-request', (event) => {
        el.railWidthPx = 300;
        if (veto) event.preventDefault();
      });
      el.shadowRoot!.querySelector<HTMLElement>('[part="resizer"]')!.focus();
      await sendKeys({ press: 'ArrowRight' });
      await el.updateComplete;
      expect(el.railWidthPx).to.equal(veto ? 300 : 248);
      expect(commits).to.deep.equal(veto ? [] : [248]);
    });
  }
});
