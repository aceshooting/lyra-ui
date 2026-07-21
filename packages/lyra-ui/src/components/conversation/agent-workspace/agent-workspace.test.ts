import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import type { AgentRun, ChatMessage, RetrievalChunk } from '../../../ai/types.js';
import './agent-workspace.js';
import type { LyraAgentWorkspace } from './agent-workspace.class.js';

const run: AgentRun = {
  id: 'run-1',
  status: { kind: 'collecting', message: 'Gathering sources' },
  startedAt: Date.now() - 1_000,
  model: 'lyra-test',
  steps: [{ id: 'step-1', kind: 'retrieval', label: 'Find sources', status: { kind: 'running' } }],
};

const chunk: RetrievalChunk = {
  id: 'chunk-1',
  text: 'A retrieved passage.',
  score: 0.93,
  source: { id: 'doc-1', name: 'Guide.md' },
};

const messages: ChatMessage[] = [{ id: 'message-1', role: 'assistant', text: 'Hello from the agent.' }];

it('renders an empty conversation and the built-in composer', async () => {
  const el = await fixture<LyraAgentWorkspace>(html`<lr-agent-workspace></lr-agent-workspace>`);
  expect(el.shadowRoot!.querySelector('[part="messages-empty"]')).to.exist;
  expect(el.shadowRoot!.querySelector('lr-chat-composer')).to.exist;
});

it('clears follow/showDetails/showComposer from plain HTML `="false"` attributes, not just property bindings', async () => {
  const el = await fixture<LyraAgentWorkspace>(html`
    <lr-agent-workspace
      follow="false"
      show-details="false"
      show-composer="false"
      .run=${run}
    ></lr-agent-workspace>
  `);
  expect(el.follow).to.be.false;
  expect(el.showDetails).to.be.false;
  expect(el.showComposer).to.be.false;
  await el.updateComplete;
  const viewport = el.shadowRoot!.querySelector('lr-chat-viewport') as unknown as { follow: boolean };
  expect(viewport.follow).to.be.false;
  // showDetails=false hides the built-in details pane even though `run` alone would otherwise show it.
  expect(el.shadowRoot!.querySelectorAll('[part="details"]').length).to.equal(0);
  expect(el.shadowRoot!.querySelectorAll('lr-chat-composer').length).to.equal(0);
});

it('still defaults follow/showDetails/showComposer to true with no attribute set', async () => {
  const el = await fixture<LyraAgentWorkspace>(html`<lr-agent-workspace></lr-agent-workspace>`);
  expect(el.follow).to.be.true;
  expect(el.showDetails).to.be.true;
  expect(el.showComposer).to.be.true;
});

it('uses localized workspace chrome', async () => {
  const el = await fixture<LyraAgentWorkspace>(html`
    <lr-agent-workspace .strings=${{ agentWorkspaceLabel: 'Assistant panel' }}></lr-agent-workspace>
  `);
  expect(el.shadowRoot!.querySelector('[part="heading"]')!.textContent).to.equal('Assistant panel');
});

it('composes transcript and agent details from controlled data', async () => {
  const el = await fixture<LyraAgentWorkspace>(html`
    <lr-agent-workspace
      .messages=${messages}
      .run=${run}
      .tools=${[{ id: 'tool-1', name: 'search', args: {}, status: 'success' }]}
      .retrievalChunks=${[chunk]}
      .groundingAssessment=${{ supportedClaims: 1, unsupportedClaims: 0, coverage: 1 }}
      .contextSegments=${[{ id: 'context-1', label: 'Source', text: 'Passage', tokens: 3 }]}
      .metrics=${[{ id: 'tokens', label: 'Tokens', value: 42 }]}
    ></lr-agent-workspace>
  `);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('lr-chat-message')).to.exist;
  expect(el.shadowRoot!.querySelector('lr-agent-run')).to.exist;
  expect(el.shadowRoot!.querySelector('lr-tool-timeline')).to.exist;
  expect(el.shadowRoot!.querySelector('lr-retrieval-results')).to.exist;
  expect(el.shadowRoot!.querySelector('lr-grounding-summary')).to.exist;
  expect(el.shadowRoot!.querySelector('lr-context-inspector')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="details"]')).to.exist;
});

it('forwards a stable message id with retry events', async () => {
  const el = await fixture<LyraAgentWorkspace>(html`<lr-agent-workspace .messages=${[
    { id: 'message-7', role: 'assistant', status: 'failed', text: 'Failed' },
  ]}></lr-agent-workspace>`);
  const message = el.shadowRoot!.querySelector('lr-chat-message')!;
  const event = oneEvent(el, 'lr-message-retry');
  message.shadowRoot!.querySelector<HTMLButtonElement>('[part="retry-button"]')!.click();
  expect((await event).detail).to.deep.equal({ messageId: 'message-7' });
});

it('forwards a controlled retrieval selection as lr-retrieval-select, without leaking the raw lr-select', async () => {
  const el = await fixture<LyraAgentWorkspace>(html`
    <lr-agent-workspace .retrievalChunks=${[chunk]}></lr-agent-workspace>
  `);
  const results = el.shadowRoot!.querySelector('lr-retrieval-results')!;

  let rawLeaked = false;
  el.addEventListener('lr-select', () => {
    rawLeaked = true;
  });

  const listener = oneEvent(el, 'lr-retrieval-select');
  results.dispatchEvent(
    new CustomEvent('lr-select', { detail: { ids: ['chunk-1'], chunks: [chunk] }, bubbles: true, composed: true }),
  );
  const event = (await listener) as CustomEvent<{ ids: string[]; chunks: (typeof chunk)[] }>;

  expect(event.detail).to.deep.equal({ ids: ['chunk-1'], chunks: [chunk] });
  expect(el.selectedRetrievalIds).to.deep.equal(['chunk-1']);
  expect(rawLeaked, 'the raw lr-select from lr-retrieval-results must not leak past agent-workspace').to.be.false;
});

it('lets named slots replace the data-driven transcript and details', async () => {
  const el = await fixture<LyraAgentWorkspace>(html`
    <lr-agent-workspace .messages=${messages}>
      <div slot="details" id="custom-details">Custom details</div>
      <div slot="composer" id="custom-composer">Custom composer</div>
    </lr-agent-workspace>
  `);
  expect(el.querySelector('#custom-composer')).to.exist;
  expect(el.querySelector('#custom-details')).to.exist;
});

it('is accessible in a populated state', async () => {
  const el = await fixture<LyraAgentWorkspace>(html`<lr-agent-workspace .messages=${messages} .run=${run}></lr-agent-workspace>`);
  expect(el.shadowRoot!.querySelector('lr-chat-message')).to.exist;
  await expect(el).to.be.accessible();
});
