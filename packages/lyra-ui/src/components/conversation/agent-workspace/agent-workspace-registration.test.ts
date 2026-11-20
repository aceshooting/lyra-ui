import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-agent-workspace.js';
import type { LyraAgentWorkspace } from './agent-workspace.class.js';

const panels = ['agent-run', 'tool-timeline', 'retrieval-results', 'grounding-summary', 'context-inspector'];

it('registers each details panel only when the workspace first has data for it', async () => {
  const workspace = await fixture<LyraAgentWorkspace>(html`<lr-agent-workspace></lr-agent-workspace>`);
  expect(panels.filter(name => customElements.get(`lr-${name}`))).to.deep.equal([]);
  workspace.run = { id: 'run-1', status: { kind: 'running' }, steps: [] };
  await workspace.updateComplete;
  const run = workspace.shadowRoot!.querySelector('lr-agent-run');
  const Run = customElements.get('lr-agent-run');
  expect(Boolean(Run && run instanceof Run)).to.equal(true);
  expect(panels.filter(name => customElements.get(`lr-${name}`))).to.deep.equal(['agent-run']);
});
