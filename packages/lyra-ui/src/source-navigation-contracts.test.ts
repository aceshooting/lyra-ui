import { expect, fixture, html } from '@open-wc/testing';
import { focusByKeyboard } from '../test/wtr-focus.js';
import './components/agent-tools/agent-trace/agent-trace.js';
import './components/agent-tools/span-waterfall/span-waterfall.js';
import './components/agent-tools/task-list/task-list.js';
import './components/agent-tools/trace-tree/trace-tree.js';
import './components/agent-tools/eval-dataset/eval-dataset.js';
import './components/conversation/thread-list/thread-list.js';
import './components/data/document-library/document-library.js';
import './components/data/file-tree/file-tree.js';
import './components/retrieval/mind-map/mind-map.js';
import './components/retrieval/knowledge-graph-explorer/knowledge-graph-explorer.js';
import './components/utility/json-viewer/json-viewer.js';
import './components/viewers/xml-viewer/xml-viewer.js';

for (const tagName of [
  'lr-agent-trace', 'lr-span-waterfall', 'lr-task-list', 'lr-trace-tree',
  'lr-file-tree', 'lr-mind-map', 'lr-json-viewer', 'lr-xml-viewer',
  'lr-knowledge-graph-explorer',
] as const) {
  it(`${tagName} declines unbound source navigation without taking the caller's focus`, async () => {
    const host = await fixture<HTMLDivElement>(html`<div><button type="button">Reveal record</button></div>`);
    const caller = host.querySelector('button')!;
    await focusByKeyboard(caller);
    const element = document.createElement(tagName);
    element.setAttribute('aria-label', 'Records');

    expect(await element.revealSourceKey('missing')).to.equal(false);
    expect(document.activeElement === caller, 'detached navigation leaves focus with the caller').to.equal(true);

    host.append(element);
    await element.updateComplete;
    expect(await element.revealSourceKey('missing')).to.equal(false);
    expect(document.activeElement === caller, 'rendered navigation leaves focus with the caller').to.equal(true);
  });
}

for (const tagName of ['lr-eval-dataset', 'lr-document-library', 'lr-thread-list'] as const) {
  it(`${tagName} reports an unknown source total before a provider is bound`, async () => {
    const element = document.createElement(tagName);
    expect(element.sourceTotal).to.equal(null);
    await fixture(element);
    expect(element.sourceTotal).to.equal(null);
  });
}

it('a detached explorer declines camera focus before its composed graph exists', async () => {
  const explorer = document.createElement('lr-knowledge-graph-explorer');
  expect(await explorer.focusNode('missing')).to.equal(false);
  expect(explorer.selectedNodeId).to.equal(null);
});
