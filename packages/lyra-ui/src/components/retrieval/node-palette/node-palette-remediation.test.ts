import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { WithCanvas } from './node-palette.stories.js';
import type { LyraNodePalette } from './node-palette.js';
import type { LyraFlowCanvas } from '../../data/flow-canvas/flow-canvas.js';

it('the actual WithCanvas story commits repeated native placements to visible canvas nodes', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div>${WithCanvas.render!({}, {} as never)}</div>`);
  const palette = wrapper.querySelector<LyraNodePalette>('lr-node-palette')!;
  const canvas = wrapper.querySelector<LyraFlowCanvas>('lr-flow-canvas')!;
  await palette.updateComplete;
  const option = palette.shadowRoot!.querySelector<HTMLElement>('[role="option"]')!;
  option.focus();
  await sendKeys({ press: 'Enter' });
  await waitUntil(() => canvas.nodes.length === 1, 'first placement reaches public canvas model');
  await canvas.updateComplete;
  expect(canvas.nodes[0]!.type).to.equal('http-request');
  expect(canvas.shadowRoot!.querySelectorAll('lr-flow-node').length).to.equal(1);
  option.focus();
  await sendKeys({ press: 'Enter' });
  await waitUntil(() => canvas.nodes.length === 2, 'second placement reaches public canvas model');
  await canvas.updateComplete;
  expect(new Set(canvas.nodes.map(node => node.id)).size).to.equal(2);
  expect(canvas.shadowRoot!.querySelectorAll('lr-flow-node').length).to.equal(2);
});
