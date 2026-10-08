import { fixture, expect, html } from '@open-wc/testing';
import './approval-queue/approval-queue.js';
import './permission-rules/permission-rules.js';
import './policy-summary/policy-summary.js';

type Normalized = Record<string, unknown[]>;

describe('derived row lists are normalized once per owned snapshot', () => {
  it('lr-approval-queue reuses its normalized requests', async () => {
    const el = await fixture(html`<lr-approval-queue .requests=${[{ id: 'a', toolName: 'search', args: {} }, { id: 'a', toolName: 'dup', args: {} }]}></lr-approval-queue>`);
    const internal = el as unknown as Normalized;
    expect(internal['normalizedRequests'] === internal['normalizedRequests']).to.equal(true);
    expect(internal['normalizedRequests']!.length).to.equal(1);
  });

  it('lr-permission-rules reuses its normalized rules', async () => {
    const el = await fixture(html`<lr-permission-rules .rules=${[{ id: 'r', label: 'Read', scope: 's', decision: 'ask' }]}></lr-permission-rules>`);
    const internal = el as unknown as Normalized;
    expect(internal['normalizedRules'] === internal['normalizedRules']).to.equal(true);
  });

  it('lr-policy-summary reuses its normalized decisions', async () => {
    const el = await fixture(html`<lr-policy-summary .decisions=${[{ id: 'd', category: 'guardrail', state: 'allow', label: 'L' }]}></lr-policy-summary>`);
    const internal = el as unknown as Normalized;
    expect(internal['normalizedDecisions'] === internal['normalizedDecisions']).to.equal(true);
  });
});
