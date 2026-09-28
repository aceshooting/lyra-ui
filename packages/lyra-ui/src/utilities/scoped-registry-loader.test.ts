import { expect, fixture, html } from '@open-wc/testing';
import { loadScopedRegistry } from './scoped-registry-loader.js';
import { supportsScopedRegistries } from './scoped-registry.js';
import type { LyraApprovalQueue } from '../components/agent-tools/approval-queue/approval-queue.class.js';

describe('optional scoped dependency loader', () => {
  it('rejects unsupported environments without loading or registering components', async () => {
    if (supportsScopedRegistries()) return;
    const before = customElements.get('lr-approval-queue');
    let message = '';
    try { await loadScopedRegistry(['lr-approval-queue']); } catch (error) { message = String(error); }
    expect(message).to.include('Scoped custom element registries are not supported');
    expect(customElements.get('lr-approval-queue') === before).to.equal(true);
  });
  it('loads composed classes without globally registering them', async function () {
    if (!supportsScopedRegistries()) this.skip();
    const before = customElements.get('lr-approval-queue');
    const scope = await loadScopedRegistry(['lr-approval-queue']);
    expect(scope.registry.get('lr-tool-approval-dialog') !== undefined).to.equal(true);
    expect(customElements.get('lr-approval-queue') === before).to.equal(true);
    const host = await fixture<HTMLElement>(html`<div></div>`);
    const queue = scope.createElement('lr-approval-queue') as LyraApprovalQueue;
    queue.requests = [{ id: 'call', toolName: 'read_file', args: { path: 'example.txt' } }];
    scope.attachShadow(host).append(queue);
    await queue.updateComplete;
    expect(queue.shadowRoot!.querySelector('[part="request"]')?.textContent).to.include('read_file');
  });
  it('rejects unknown tags before loading any classes', async function () {
    if (!supportsScopedRegistries()) this.skip();
    let message = '';
    try { await loadScopedRegistry(['lr-unknown-component']); } catch (error) { message = String(error); }
    expect(message).to.include('Unknown Lyra scoped tag');
  });
});
