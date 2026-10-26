import { html } from 'lit';
import { ref } from 'lit/directives/ref.js';
import '@aceshooting/lyra-ui/components/lr-button.js';
import '@aceshooting/lyra-gen/gen-view.js';
import { createCatalog, initialCatalog } from '@aceshooting/lyra-gen/catalog.js';
import { createReplayRecord, replayRecord } from '@aceshooting/lyra-gen/replay.js';
import { resolveReferences } from '@aceshooting/lyra-gen/references.js';
import packageMetadata from '../packages/lyra-gen/package.json';
import cadenceRecording from '../packages/lyra-gen/examples/recordings/chat-review.v1.json';
import { mountRecordedReplay } from '../packages/lyra-gen/examples/recorded-replay.ts';

export default {
  title: 'Generative UI/Synthetic replays',
  tags: ['!autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'Experimental Lyra Gen examples replay authored synthetic fixtures. They make no model or provider request; recorded timing fields remain unknown. Host applications own authorization, effects, field purposes, and source access.' } },
  },
};

const panelStyle = 'display:grid;gap:var(--lr-space-l);max-inline-size:56rem;min-inline-size:0';
const actionsStyle = 'display:flex;flex-wrap:wrap;gap:var(--lr-space-s)';
const outputStyle = 'white-space:pre-wrap;overflow-wrap:anywhere;padding:var(--lr-space-m);border:var(--lr-border-width-thin) solid var(--lr-color-border);border-radius:var(--lr-theme-border-radius-m);font:inherit';
const headingStyle = 'font-size:var(--lr-theme-font-size-xl);font-weight:var(--lr-theme-font-weight-semibold);margin-block-end:var(--lr-space-s)';

function record(id, root, catalog = initialCatalog, revision = 0) {
  const view = { version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: id, revision, root };
  return createReplayRecord({
    source: { kind: 'fixture', id }, model: null,
    package: { name: packageMetadata.name, version: packageMetadata.version },
    catalog: view.catalog, format: 'json', text: JSON.stringify(view), surfaceId: id, revision,
  });
}

function requireReplay(value, catalog = initialCatalog) {
  const result = replayRecord(value, catalog);
  if (!result.ok) throw new Error('Invalid authored replay fixture.');
  return result.value;
}

function replayInto(event, recording, catalog = initialCatalog) {
  const section = event.currentTarget.closest('[data-gen-replay]');
  const result = replayRecord(recording, catalog);
  const output = section.querySelector('[data-replay-output]');
  if (result.ok) {
    section.querySelector('lr-gen-view').document = result.value;
    output.textContent = `Accepted fixture revision ${result.value.revision}. No provider request was made.`;
  } else {
    output.textContent = `Rejected fixture; the last accepted view is retained.\n${result.diagnostics.map(item => `${item.code} ${item.path}: ${item.message}`).join('\n')}`;
  }
}

const initialReport = record('diagnostic-replay', {
  id: 'report', type: 'stack', children: [
    { id: 'heading', type: 'heading', text: 'Order review' },
    { id: 'summary', type: 'text', text: 'The last accepted report remains available when a new candidate fails validation.' },
    { id: 'total', type: 'stat', props: { label: 'Reviewed orders', value: '24', unit: 'orders' } },
  ],
});
const rejectedReport = record('diagnostic-replay', {
  id: 'report', type: 'slider', props: { label: 'Review threshold', value: { unexpected: 'object' } },
}, initialCatalog, 1);
const correctedReport = record('diagnostic-replay', {
  id: 'report', type: 'stack', children: [
    { id: 'heading', type: 'heading', text: 'Order review' },
    { id: 'summary', type: 'text', text: 'A separately authored valid revision has been accepted.' },
    { id: 'total', type: 'stat', props: { label: 'Reviewed orders', value: '27', unit: 'orders' } },
  ],
}, initialCatalog, 2);

export const Diagnostics = {
  render: () => html`<section data-gen-replay style=${panelStyle}>
    <header><h1 style=${headingStyle}>Validate a replay before replacing a view</h1><p>Synthetic fixture • No model request • No automatic semantic repair</p></header>
    <div style=${actionsStyle}>
      <lr-button @click=${event => replayInto(event, rejectedReport)}>Replay invalid candidate</lr-button>
      <lr-button @click=${event => replayInto(event, correctedReport)}>Replay corrected candidate</lr-button>
    </div>
    <lr-gen-view .document=${requireReplay(initialReport)}></lr-gen-view>
    <pre data-replay-output role="status" style=${outputStyle}>Accepted fixture revision 0. Replay the invalid candidate to inspect its diagnostic.</pre>
    <details><summary>Recorded provenance</summary><pre style=${outputStyle}>${JSON.stringify({ source: initialReport.source, model: initialReport.model, package: initialReport.package, timings: initialReport.timings }, null, 2)}</pre></details>
  </section>`,
};

const formCatalog = createCatalog({ ...initialCatalog, actions: {
  saveReview: { payload: { type: 'object', properties: { note: { type: 'string', maxLength: 4096 } }, required: ['note'], additionalProperties: false } },
} });
function reviewForm(revision) {
  return record('review-replay', {
    id: 'review', type: 'stack', children: [
      { id: 'heading', type: 'heading', text: 'Review the quarterly report' },
      { id: 'summary', type: 'text', text: revision === 0 ? 'Twenty-four orders are ready for review.' : 'The updated report contains twenty-seven orders. Your edited note stays in place.' },
      { id: 'form', type: 'form', props: { ariaLabel: 'Report review' }, action: { name: 'saveReview' }, children: [
        { id: 'note', type: 'textarea', props: { label: 'Review note', name: 'note', hint: 'Use synthetic information only.', value: 'Check the missing observation.', required: true }, bindings: { value: '/note' } },
        { id: 'save', type: 'button', props: { type: 'submit' }, text: 'Preview submitted values' },
        { id: 'reset', type: 'button', props: { type: 'reset' }, text: 'Reset note' },
      ] },
    ],
  }, formCatalog, revision);
}

export const Forms = {
  render: () => {
    let revision = 0;
    return html`<section data-gen-replay style=${panelStyle}>
      <header><h1 style=${headingStyle}>Keep user edits through a replayed revision</h1><p>Edit the note, replay the report update, and submit with the keyboard. The action is displayed locally; nothing is saved or sent.</p></header>
      <lr-button @click=${event => replayInto(event, reviewForm(++revision), formCatalog)}>Replay report update</lr-button>
      <lr-gen-view .catalog=${formCatalog} .enabledActions=${['saveReview']} .document=${requireReplay(reviewForm(0), formCatalog)}
        @lr-gen-action=${event => { event.currentTarget.closest('[data-gen-replay]').querySelector('[data-replay-output]').textContent = JSON.stringify(event.detail, null, 2); }}></lr-gen-view>
      <pre data-replay-output role="status" style=${outputStyle}>No action requested.</pre>
    </section>`;
  },
};

const allowedSources = new Map([['quarterly-report', { value: { total: 24, title: 'Quarterly operations report', excerpt: 'Synthetic rows: first quarter 8 orders, second quarter 16 orders.' }, revision: 1 }]]);
const resolved = resolveReferences({ $ref: '@data:quarterly-report#/total' }, { data: allowedSources });
if (!resolved.ok) throw new Error('Missing authored synthetic source.');
const sourcedReport = record('source-replay', {
  id: 'report', type: 'stack', children: [
    { id: 'heading', type: 'heading', text: 'Inspect the source behind a total' },
    { id: 'total', type: 'stat', props: { label: 'Reviewed orders', value: String(resolved.value), unit: 'orders', caption: 'Synthetic source revision 1' } },
    { id: 'citation', type: 'citation', props: { sourceId: 'quarterly-report', index: 1, label: 'Quarterly operations report' } },
    { id: 'source', type: 'source-card', props: { sourceId: 'quarterly-report', heading: 'Quarterly operations report' }, children: [
      { id: 'excerpt', type: 'text', slot: 'excerpt', text: 'First quarter: 8 orders. Second quarter: 16 orders.' },
      { id: 'full', type: 'text', slot: 'full', text: 'This authored fixture contains synthetic data only. Its host-owned source map contains one permitted record at revision 1.' },
    ] },
  ],
});

export const Provenance = {
  render: () => html`<section data-gen-replay style=${panelStyle}>
    <header><h1 style=${headingStyle}>Resolve only host-provided source references</h1><p>The displayed total is resolved from this example’s source map before rendering. Missing references produce an explicit diagnostic, never an invented value or verified badge.</p></header>
    <lr-gen-view .document=${requireReplay(sourcedReport)} @lr-citation-activate=${event => {
      const source = allowedSources.get(event.detail.sourceId);
      event.currentTarget.closest('[data-gen-replay]').querySelector('[data-replay-output]').textContent = source ? `Source revision ${source.revision}: ${source.value.excerpt}` : 'This source is unavailable to the current viewer.';
    }}></lr-gen-view>
    <lr-button @click=${event => {
      const result = resolveReferences({ $ref: '@data:unavailable-report#/total' }, { data: allowedSources });
      event.currentTarget.closest('[data-gen-replay]').querySelector('[data-replay-output]').textContent = result.ok ? 'Reference resolved.' : `Source unavailable. ${result.diagnostics.map(item => item.code).join(', ')}. No replacement value was generated.`;
    }}>Try an unavailable source</lr-button>
    <pre data-replay-output role="status" style=${outputStyle}>Activate citation 1 to inspect the permitted synthetic source.</pre>
  </section>`,
};

export const RecordedCadence = {
  parameters: { docs: { description: { story: 'A versioned authored synthetic recording replays its frozen chunk offsets through the interactive-chat example. Native controls support interruption, reset, and a rejected tail while retaining completed content. No model or provider request is made.' } } },
  render: () => {
    let demo;
    return html`<section aria-label="Recorded synthetic replay" ${ref(element => {
      demo?.dispose();
      demo = element ? mountRecordedReplay(element, cadenceRecording) : undefined;
    })}></section>`;
  },
};
