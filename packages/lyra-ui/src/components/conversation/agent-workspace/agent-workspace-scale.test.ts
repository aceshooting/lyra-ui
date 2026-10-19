import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { collectionTruncationWarningKey, publicCollectionTruncation } from '../../../internal/collection-snapshot.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import './agent-workspace.js';
import type { LyraAgentWorkspace } from './agent-workspace.class.js';

it('retains newest tools and maps unread source positions through the retained message tail', async function () {
  this.timeout(30000); // Budget for a heavily loaded multi-browser host; the asserted bounds are unchanged.
  for (const property of ['messages', 'tools']) expectDevWarning(collectionTruncationWarningKey('lr-agent-workspace', property));
  const messages = Array.from({ length: 12000 }, (_, i) => ({ id: `m${i}`, role: 'assistant', text: '' }));
  Object.defineProperty(messages, '11990', { get: () => { throw new Error('must not read accessor'); } });
  messages[11992] = { ...messages[11991]! };
  const tools = Array.from({ length: 12000 }, (_, i) => ({ id: `t${i}`, name: `Tool ${i}`, args: {}, status: 'success' }));
  const host = await fixture<LyraAgentWorkspace>(html`<lr-agent-workspace without-composer .messages=${messages} .tools=${tools} .unreadStartIndex=${11995}><div slot="details">Custom</div></lr-agent-workspace>`);
  const viewport = host.shadowRoot!.querySelector('lr-chat-viewport') as HTMLElement & { unreadStartIndex: number };
  expect(viewport.unreadStartIndex).to.equal(495);
  expect(host.tools.at(-1)?.id).to.equal('t11999');
  host.unreadStartIndex = 0; await host.updateComplete; expect(viewport.unreadStartIndex).to.equal(0);
  host.unreadStartIndex = 12000; await host.updateComplete; expect(viewport.unreadStartIndex).to.equal(500);
  const loss = publicCollectionTruncation(host, 'messages')!;
  expect(host.shadowRoot!.querySelector('[part="input-limit"]')?.textContent ?? '').to.contain('12,000');
  recordScaleMeasurement('lr-agent-workspace', 'n=12000 source offsets', { retained: loss.retained, mounted: host.shadowRoot!.querySelectorAll('lr-chat-message').length });
});

it('does not evaluate assigned slot fallbacks and restores them after removal and reconnect', async () => {
  const host = await fixture<LyraAgentWorkspace>(html`<lr-agent-workspace without-composer .messages=${[{ id: 'm', role: 'assistant', text: '' }]} .tools=${[{ id: 't', name: 'Tool', args: {}, status: 'success' }]}><div slot="messages">Custom messages</div><div slot="details">Custom details</div></lr-agent-workspace>`);
  expect(host.shadowRoot!.querySelectorAll('lr-chat-message,lr-tool-timeline').length).to.equal(0);
  host.querySelector('[slot="messages"]')!.remove(); host.querySelector('[slot="details"]')!.remove();
  await nextFrame(); await host.updateComplete;
  expect(host.shadowRoot!.querySelectorAll('lr-chat-message,lr-tool-timeline').length).to.equal(2);
  const parent = host.parentElement!; host.remove();
  const replacement = document.createElement('div'); replacement.slot = 'messages'; host.append(replacement); parent.append(host);
  await nextFrame(); await host.updateComplete;
  expect(host.shadowRoot!.querySelectorAll('lr-chat-message').length).to.equal(0);
});
