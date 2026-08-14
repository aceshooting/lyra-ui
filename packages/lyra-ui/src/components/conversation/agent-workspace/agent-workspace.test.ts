import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import type { AgentRun, CancelEventDetail, ChatMessage, RetrievalChunk } from '../../../ai/types.js';
import '../../forms/button/button.js';
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

it('uses a plain-frame fallback composer without changing a supplied composer', async () => {
  const fallbackHost = await fixture<LyraAgentWorkspace>(html`<lr-agent-workspace></lr-agent-workspace>`);
  const fallback = fallbackHost.shadowRoot!.querySelector('lr-chat-composer') as
    | (HTMLElement & { updateComplete: Promise<unknown> })
    | null;
  expect(fallback !== null, 'the built-in composer renders by default').to.equal(true);
  if (fallback === null) return;

  await fallback.updateComplete;
  expect(fallback.getAttribute('frame')).to.equal('plain');
  const fallbackBase = fallback.shadowRoot!.querySelector('[part="base"]') as HTMLElement | null;
  expect(fallbackBase !== null, 'the built-in composer exposes its base part').to.equal(true);
  if (fallbackBase === null) return;
  const fallbackChrome = getComputedStyle(fallbackBase);
  expect(fallbackChrome.borderTopWidth).to.equal('0px');
  expect(fallbackChrome.paddingTop).to.equal('0px');

  const slottedHost = await fixture<LyraAgentWorkspace>(html`
    <lr-agent-workspace>
      <lr-chat-composer slot="composer" frame="card"></lr-chat-composer>
    </lr-agent-workspace>
  `);
  const supplied = slottedHost.querySelector('lr-chat-composer') as HTMLElement | null;
  expect(supplied !== null, 'the supplied composer remains in the light DOM').to.equal(true);
  if (supplied === null) return;
  expect(supplied.getAttribute('frame')).to.equal('card');
  const composerSlot = slottedHost.shadowRoot!.querySelector('slot[name="composer"]') as HTMLSlotElement | null;
  expect(composerSlot !== null, 'the workspace exposes its composer slot').to.equal(true);
  if (composerSlot === null) return;
  expect(composerSlot.assignedElements().length).to.equal(1);
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
  // showDetails=false hides the stable details pane even though `run` alone would otherwise show it.
  expect((el.shadowRoot!.querySelector('[part="details"]') as HTMLElement).hidden).to.be.true;
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

it('forwards caller-supplied retrieval failure text through the child errorText contract', async () => {
  const el = await fixture<LyraAgentWorkspace>(html`
    <lr-agent-workspace retrieval-error="Retrieval service unavailable"></lr-agent-workspace>
  `);
  const results = el.shadowRoot!.querySelector('lr-retrieval-results') as HTMLElement & {
    errorText: string;
    updateComplete: Promise<unknown>;
  };
  await results.updateComplete;

  expect(results.errorText).to.equal('Retrieval service unavailable');
  expect(results.shadowRoot!.querySelector('[part="error"]')?.textContent).to.equal(
    'Retrieval service unavailable',
  );
});

it('forwards lr-cancel from the built-in agent run carrying that run\'s own object detail', async () => {
  const el = await fixture<LyraAgentWorkspace>(html`<lr-agent-workspace .run=${run}></lr-agent-workspace>`);
  await el.updateComplete;
  const agentRun = el.shadowRoot!.querySelector('lr-agent-run');
  expect(agentRun === null, 'the built-in agent run renders when `run` is set').to.equal(false);

  let detailIsObject = false;
  let reason: string | undefined;
  el.addEventListener('lr-cancel', (event) => {
    detailIsObject = typeof event.detail === 'object' && event.detail !== null;
    // `event` is typed straight off `LyraAgentWorkspaceEventMap` via LyraElement's
    // addEventListener overload, so reading `.reason` here is only well-typed while that map
    // declares `CancelEventDetail` rather than `undefined`.
    reason = event.detail.reason;
  });
  // Exactly what <lr-agent-run>'s own Cancel button emits (`emit('lr-cancel', {})`), plus a
  // `reason` the shape allows -- both cross the shadow boundary unchanged.
  agentRun!.dispatchEvent(
    new CustomEvent<CancelEventDetail>('lr-cancel', {
      detail: { reason: 'stopped' },
      bubbles: true,
      composed: true,
    }),
  );

  expect(detailIsObject).to.equal(true);
  expect(reason).to.equal('stopped');
});

it('renders ordered message parts when present while preserving legacy text messages', async () => {
  const el = await fixture<LyraAgentWorkspace>(html`
    <lr-agent-workspace .messages=${[
      {
        id: 'parts-message',
        role: 'assistant',
        text: 'Legacy fallback',
        parts: [
          { id: 'reasoning', type: 'reasoning', text: 'Checking', state: 'complete' },
          { id: 'answer', type: 'text', text: 'Structured answer', state: 'complete' },
        ],
      },
      { id: 'legacy-message', role: 'assistant', text: 'Legacy answer' },
    ]}></lr-agent-workspace>
  `);
  expect(el.shadowRoot!.querySelectorAll('lr-message-parts')).to.have.lengthOf(1);
  expect(el.shadowRoot!.querySelectorAll('lr-markdown')).to.have.lengthOf(1);
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

it('observes details content added and removed after mount', async () => {
  const el = await fixture<LyraAgentWorkspace>(html`<lr-agent-workspace></lr-agent-workspace>`);
  const body = el.shadowRoot!.querySelector('[part="body"]')!;
  expect(body.getAttribute('data-details')).to.equal('false');

  const details = document.createElement('div');
  details.slot = 'details';
  details.textContent = 'Dynamic details';
  el.append(details);
  await el.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  expect(body.getAttribute('data-details')).to.equal('true');
  expect((el.shadowRoot!.querySelector('[part="details"]') as HTMLElement).hidden).to.be.false;

  details.remove();
  await el.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  expect(body.getAttribute('data-details')).to.equal('false');
  expect((el.shadowRoot!.querySelector('[part="details"]') as HTMLElement).hidden).to.be.true;
});

it('showComposer=false suppresses only the built-in fallback and keeps a custom composer visible', async () => {
  const el = await fixture<LyraAgentWorkspace>(html`
    <lr-agent-workspace show-composer="false">
      <div slot="composer" id="custom-composer">Custom composer</div>
    </lr-agent-workspace>
  `);
  expect((el.shadowRoot!.querySelector('lr-chat-composer')) == null).to.be.true;
  expect((el.shadowRoot!.querySelector('[part="composer"]') as HTMLElement).hidden).to.be.false;
  expect(el.querySelector('#custom-composer')).to.exist;
});

it('renders a bounded latest-message window for very large fallback transcripts', async function () {
  // Rendering 500 lr-chat-message children is inherently more expensive than the framework's
  // default budget assumes, especially on non-Chromium engines and under CI/full-suite
  // contention -- give this one test a margined threshold (see document-library.test.ts's
  // equivalent 1000-row case and web-test-runner.config.js's shared 6000ms default).
  this.timeout(20_000);
  const manyMessages: ChatMessage[] = Array.from({ length: 510 }, (_, index) => ({
    id: `message-${index}`,
    role: 'assistant',
    text: `Message ${index}`,
  }));
  const el = await fixture<LyraAgentWorkspace>(
    html`<lr-agent-workspace .messages=${manyMessages} unread-start-index="505"></lr-agent-workspace>`,
  );
  const rendered = el.shadowRoot!.querySelectorAll('lr-chat-message');
  expect(rendered).to.have.lengthOf(500);
  expect((rendered[0] as HTMLElement).getAttribute('message-id')).to.equal('message-10');
  const viewport = el.shadowRoot!.querySelector('lr-chat-viewport') as unknown as {
    unreadStartIndex: number | null;
  };
  expect(viewport.unreadStartIndex).to.equal(495);
});

it('uses both narrow body tracks without leaving dead space above the composer', async () => {
  const el = await fixture<LyraAgentWorkspace>(html`
    <lr-agent-workspace style="inline-size:360px; block-size:640px" .messages=${messages}>
      <div slot="details" style="block-size:500px">Tall details</div>
    </lr-agent-workspace>
  `);
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  const details = el.shadowRoot!.querySelector('[part="details"]') as HTMLElement;
  expect(Math.abs(body.getBoundingClientRect().bottom - details.getBoundingClientRect().bottom)).to.be.at.most(1);
  expect(
    (el.shadowRoot!.querySelector('[part="conversation"]') as HTMLElement).getBoundingClientRect().height,
  ).to.be.greaterThan(100);
});

it('contains long localized workspace content at 320px', async () => {
  const longText = 'LocalizedWorkspaceContentWithoutNaturalBreaks'.repeat(4);
  const longMessages: ChatMessage[] = [{ id: 'long-message', role: 'assistant', text: longText }];
  const wrapper = await fixture<HTMLDivElement>(html`
    <div style="inline-size:320px; block-size:640px">
      <lr-agent-workspace
        style="inline-size:100%; block-size:100%"
        .messages=${longMessages}
        .strings=${{
          agentWorkspaceLabel: longText,
          composerPlaceholder: longText,
        }}
      >
        <lr-button slot="header-actions" size="s" variant="neutral">${longText}</lr-button>
      </lr-agent-workspace>
    </div>
  `);
  const el = wrapper.querySelector('lr-agent-workspace') as LyraAgentWorkspace | null;
  expect(el !== null, 'the workspace renders inside the 320px allocation').to.equal(true);
  if (el === null) return;

  await el.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement | null;
  const heading = el.shadowRoot!.querySelector('[part="heading"]') as HTMLElement | null;
  expect(base !== null, 'the workspace exposes its base part').to.equal(true);
  expect(heading !== null, 'the workspace exposes its heading part').to.equal(true);
  if (base === null || heading === null) return;

  expect(el.getBoundingClientRect().width).to.be.at.most(321);
  expect(base.scrollWidth).to.be.at.most(base.clientWidth + 1);
  expect(heading.scrollWidth).to.be.at.most(heading.clientWidth + 1);
});

it('is accessible in a populated state', async () => {
  const el = await fixture<LyraAgentWorkspace>(html`<lr-agent-workspace .messages=${messages} .run=${run}></lr-agent-workspace>`);
  expect(el.shadowRoot!.querySelector('lr-chat-message')).to.exist;
  await expect(el).to.be.accessible();
});

// -- Bridged child events ---------------------------------------------------

it('adopts the composer draft from the embedded composer\'s lr-input', async () => {
  const el = await fixture<LyraAgentWorkspace>(html`<lr-agent-workspace .run=${run}></lr-agent-workspace>`);
  await el.updateComplete;
  const composer = el.shadowRoot!.querySelector('lr-chat-composer') as HTMLElement;
  expect((composer) != null, 'the composer renders by default').to.equal(true);

  composer.dispatchEvent(
    new CustomEvent('lr-input', { detail: { value: 'draft text' }, bubbles: true, composed: true }),
  );
  await el.updateComplete;
  expect((el as unknown as { composerValue: string }).composerValue).to.equal('draft text');
});

it('adopts the follow state from the embedded viewport\'s lr-follow-change', async () => {
  const el = await fixture<LyraAgentWorkspace>(html`<lr-agent-workspace .run=${run}></lr-agent-workspace>`);
  await el.updateComplete;
  const viewport = el.shadowRoot!.querySelector('lr-chat-viewport') as HTMLElement;
  expect(el.follow, 'follow defaults on').to.be.true;

  viewport.dispatchEvent(
    new CustomEvent('lr-follow-change', { detail: { following: false }, bubbles: true, composed: true }),
  );
  await el.updateComplete;
  expect(el.follow, 'scrolling away turns follow off').to.be.false;

  viewport.dispatchEvent(
    new CustomEvent('lr-follow-change', { detail: { following: true }, bubbles: true, composed: true }),
  );
  await el.updateComplete;
  expect(el.follow).to.be.true;
});
