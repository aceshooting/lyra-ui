import { fixture, expect, html } from '@open-wc/testing';
import './tool-timeline.js';
import type { LyraToolTimeline } from './tool-timeline.js';

describe('lr-tool-timeline approval dialog registration', () => {
  it('registers lr-tool-approval-dialog only once an entry needs approval', async () => {
    const plain = (await fixture(html`<lr-tool-timeline .entries=${[{ id: 'a', name: 'search', status: 'success' }]}></lr-tool-timeline>`)) as LyraToolTimeline;
    await plain.updateComplete;
    expect(customElements.get('lr-tool-approval-dialog') === undefined).to.equal(true);
    plain.entries = [{ id: 'b', name: 'delete', status: 'pending', needsApproval: true, args: {} }];
    await plain.updateComplete;
    await customElements.whenDefined('lr-tool-approval-dialog');
    expect(customElements.get('lr-tool-approval-dialog') !== undefined).to.equal(true);
  });
});
