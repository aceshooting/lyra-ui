import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../test/wtr-mouse.js';
import '../components/agent-tools/thinking-panel/thinking-panel.js';
import '../components/agent-tools/task-list/task-list.js';
import '../components/retrieval/source-list/source-list.js';

describe('disclosure header paint', () => {
  for (const kind of ['thinking', 'tasks', 'sources'] as const) {
    it(`${kind} keeps its control boundary and readable pressed text`, async () => {
      const content = kind === 'thinking'
        ? html`<lr-thinking-panel expanded>Reasoning</lr-thinking-panel>`
        : kind === 'tasks'
          ? html`<lr-task-list expanded></lr-task-list>`
          : html`<lr-source-list expanded><span>Source</span></lr-source-list>`;
      const wrapper = await fixture<HTMLDivElement>(html`<div>${content}</div>`);
      const host = wrapper.firstElementChild as HTMLElement;
      host.style.cssText = '--lr-color-border: rgb(80, 80, 80); --lr-color-border-subtle: rgb(210, 210, 210); --lr-color-text: rgb(15, 15, 15); --lr-color-brand: rgb(30, 90, 180); --lr-color-brand-quiet: rgb(220, 230, 250); --lr-transition-fast: 0s';
      const base = host.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
      const header = host.shadowRoot!.querySelector<HTMLElement>('[part="header"]')!;
      const body = host.shadowRoot!.querySelector<HTMLElement>(kind === 'sources' ? '[part="list"]' : '[part="body"]')!;
      const chromeColor = kind === 'sources' ? 'rgb(80, 80, 80)' : 'rgb(210, 210, 210)';
      expect(getComputedStyle(base).borderTopColor).to.equal(chromeColor);
      expect(getComputedStyle(body).borderTopColor).to.equal(chromeColor);
      try {
        await hoverUntilMatched(header, 'pointer did not reach the disclosure header');
        await sendMouse({ type: 'down', button: 'left' });
        await waitUntil(() => header.matches(':active'), 'header did not receive the pointer press');
        await waitUntil(() => getComputedStyle(header).color === 'rgb(15, 15, 15)', 'pressed text did not return to the text token');
      } finally {
        await resetMouse();
      }
    });
  }
});
