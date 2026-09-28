import assert from 'node:assert/strict';
import { render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';
import { html } from 'lit';

/** Populated first-render evidence for host-owned agent state, without browser globals. */
export async function assertAgenticSsrFixtures(elementRenderers) {
  assert.equal(globalThis.window, undefined, 'agent state SSR must run without a window shim');
  assert.equal(globalThis.document, undefined, 'agent state SSR must run without a document shim');
  const fixtures = [
    {
      tag: 'lr-agent-question',
      template: html`<lr-agent-question request-id="question-1" message="Choose a destination"
        .schema=${{ type: 'object', properties: { destination: { type: 'string', title: 'Destination' } } }}
        .value=${{ destination: 'Oslo' }}></lr-agent-question>`,
      patterns: [/Choose a destination/, /Destination/, /value="Oslo"/, /data-action="accept"/],
    },
    {
      tag: 'lr-background-runs',
      template: html`<lr-background-runs .runs=${[
        { id: 'run-1', label: 'Index documents', status: 'running' },
      ]}></lr-background-runs>`,
      patterns: [/Index documents/, /data-status="running"/, /part="cancel"/],
    },
    {
      tag: 'lr-budget-meter',
      template: html`<lr-budget-meter used="25" limit="100" unit="credits"></lr-budget-meter>`,
      patterns: [/aria-valuenow="25"/, /aria-valuemax="100"/, /25%/, /credits/],
    },
    {
      tag: 'lr-change-review',
      template: html`<lr-change-review .files=${[
        { id: 'file-1', path: 'sample.txt', hunks: [
          { id: 'hunk-1', before: 'Before review', after: 'After review', decision: 'keep' },
        ] },
      ]}></lr-change-review>`,
      patterns: [/sample\.txt/, /Before review/, /After review/, /aria-pressed="true"/],
    },
    {
      tag: 'lr-connector-manager',
      template: html`<lr-connector-manager .connectors=${[
        { id: 'connector-1', name: 'Document source', kind: 'mcp', status: 'connected' },
      ]}></lr-connector-manager>`,
      patterns: [/Document source/, /data-status="connected"/, /Disconnect/],
    },
    {
      tag: 'lr-permission-grant',
      template: html`<lr-permission-grant request-id="permission-1" scope="documents:read"
        description="Read selected documents"></lr-permission-grant>`,
      patterns: [/documents:read/, /Read selected documents/, /data-decision="allow-once"/],
    },
    {
      tag: 'lr-permission-rules',
      template: html`<lr-permission-rules .rules=${[
        { id: 'rule-1', label: 'Read documents', scope: 'documents', decision: 'deny' },
      ]}></lr-permission-rules>`,
      patterns: [/Read documents/, /<select\b/, /<option[^>]*value="deny"[^>]* selected/],
    },
    {
      tag: 'lr-research-progress',
      template: html`<lr-research-progress .steps=${[
        { id: 'step-1', label: 'Find sources', status: 'completed', sources: 3 },
        { id: 'step-2', label: 'Check sources', status: 'running' },
      ]}></lr-research-progress>`,
      patterns: [/Find sources/, /Check sources/, /aria-valuenow="50"/, /3 sources/],
    },
  ];
  for (const { tag, template, patterns } of fixtures) {
    const output = await collectResult(render(template, { elementRenderers }));
    assert.match(output, /<template shadowroot="open" shadowrootmode="open">/, `${tag}: missing server shadow DOM`);
    for (const pattern of patterns) assert.match(output, pattern, `${tag}: incomplete populated server output (${pattern})`);
    assert.doesNotMatch(output, /<(?:div|p|span)[^>]*part="empty"/, `${tag}: false empty state`);
  }
}
