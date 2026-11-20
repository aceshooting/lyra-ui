import { expect, fixture, html } from '@open-wc/testing';
import type { TemplateResult } from 'lit';
import { focusByKeyboard } from '../../../test/wtr-focus.js';
import '../lr-agent-run.js';
import '../lr-approval-queue.js';
import '../lr-background-runs.js';
import '../lr-subagent-panel.js';
import '../lr-tool-param-form.js';

// Every target here takes focus only by script (focus repair or a validation reveal). After a
// keyboard action that focus is :focus-visible, so it must paint the tokenized ring rather than
// the UA default.
const RING = '--lr-focus-ring-color: rgb(1, 2, 3); --lr-focus-ring-width: 4px';
const cases: Array<[string, TemplateResult, string]> = [
  ['approval-queue count', html`<lr-approval-queue style=${RING}></lr-approval-queue>`, '[part="count"]'],
  ['agent-run empty', html`<lr-agent-run style=${RING}></lr-agent-run>`, '[part="empty"]'],
  ['agent-run status', html`<lr-agent-run style=${RING} .run=${{ id: 'r', status: 'running', steps: [] }}></lr-agent-run>`, '[part="status"]'],
  ['background-runs empty', html`<lr-background-runs style=${RING}></lr-background-runs>`, '[part="empty"]'],
  ['subagent-panel empty', html`<lr-subagent-panel style=${RING}></lr-subagent-panel>`, '[part="empty"]'],
  ['subagent-panel run', html`<lr-subagent-panel style=${RING} .runs=${[{ id: 'a', label: 'A', status: 'running' }]}></lr-subagent-panel>`, '[part~="run"]'],
];

describe('script-focused agent-tools targets', () => {
  for (const [name, template, selector] of cases) {
    it(`paints the tokenized focus ring on the ${name}`, async () => {
      const el = await fixture<HTMLElement>(template);
      const target = el.shadowRoot!.querySelector<HTMLElement>(selector)!;
      await focusByKeyboard(target);
      const style = getComputedStyle(target);
      expect([style.outlineStyle, style.outlineColor, style.outlineWidth]).to.deep.equal(['solid', 'rgb(1, 2, 3)', '4px']);
    });
  }

  it('paints the tokenized focus ring on a revealed missing-property error', async () => {
    const el = await fixture<HTMLElementTagNameMap['lr-tool-param-form']>(html`<lr-tool-param-form style=${RING}
      .schema=${{ type: 'object', properties: {}, required: ['city'] }}></lr-tool-param-form>`);
    el.reportValidity();
    await el.updateComplete;
    const target = el.shadowRoot!.querySelector<HTMLElement>('[data-missing-property]')!;
    await focusByKeyboard(target);
    const style = getComputedStyle(target);
    expect([style.outlineStyle, style.outlineColor, style.outlineWidth]).to.deep.equal(['solid', 'rgb(1, 2, 3)', '4px']);
  });
});
