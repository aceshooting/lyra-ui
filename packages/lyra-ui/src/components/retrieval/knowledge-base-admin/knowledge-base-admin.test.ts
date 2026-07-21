import { fixture, expect, html } from '@open-wc/testing';
import './knowledge-base-admin.js';
import type { LyraKnowledgeBaseAdmin } from './knowledge-base-admin.class.js';

describe('lr-knowledge-base-admin', () => {
  it('composes source and ingestion panels and switches tabs', async () => {
    const el = (await fixture(html`<lr-knowledge-base-admin .strings=${{ knowledgeBaseAdminLabel: 'KB admin' }}></lr-knowledge-base-admin>`)) as LyraKnowledgeBaseAdmin;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('lr-knowledge-base')).to.exist;
    (el.shadowRoot!.querySelectorAll('[part="tab"]')[1] as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.activeTab).to.equal('ingestion');
    expect(el.shadowRoot!.querySelector('lr-ingestion-queue')).to.exist;
  });

  it('forwards source actions under namespaced events', async () => {
    const el = (await fixture(html`<lr-knowledge-base-admin></lr-knowledge-base-admin>`)) as LyraKnowledgeBaseAdmin;
    await el.updateComplete;
    let fired = false;
    el.addEventListener('lr-source-create', () => (fired = true));
    el.shadowRoot!.querySelector('lr-knowledge-base')!.dispatchEvent(new CustomEvent('lr-kb-create', { bubbles: true, composed: true }));
    expect(fired).to.be.true;
  });

  it('is accessible in both tabs', async () => {
    const el = (await fixture(html`<lr-knowledge-base-admin></lr-knowledge-base-admin>`)) as LyraKnowledgeBaseAdmin;
    await expect(el).to.be.accessible();
    (el.shadowRoot!.querySelectorAll('[part="tab"]')[1] as HTMLButtonElement).click();
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});
