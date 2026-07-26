import { fixture, expect, html } from '@open-wc/testing';
import './knowledge-base-admin.js';
import type { LyraKnowledgeBaseAdmin } from './knowledge-base-admin.class.js';
import { styles } from './knowledge-base-admin.styles.js';

describe('lr-knowledge-base-admin', () => {
  it("wraps the internal [aria-selected='true'] tab rule in :where() so a consumer ::part(tab) override can win (regression)", () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='tab'\]:where\(\[aria-selected='true'\]\)/);
    // The old, over-specific unwrapped shape must be gone, not merely joined by the new one.
    expect(css).to.not.include("[part='tab'][aria-selected='true']");
  });

  it('lets a consumer retint the selected tab via scoped cssprops (regression)', async () => {
    const el = (await fixture(
      html`<lr-knowledge-base-admin
        style="--lr-knowledge-base-admin-tab-selected-color: rgb(1, 2, 3); --lr-knowledge-base-admin-tab-selected-border: rgb(4, 5, 6);"
      ></lr-knowledge-base-admin>`,
    )) as LyraKnowledgeBaseAdmin;
    await el.updateComplete;
    const secondTab = el.shadowRoot!.querySelectorAll('[part="tab"]')[1] as HTMLButtonElement;
    secondTab.click();
    await el.updateComplete;
    expect(secondTab.getAttribute('aria-selected')).to.equal('true');
    expect(getComputedStyle(secondTab).color).to.equal('rgb(1, 2, 3)');
    expect(getComputedStyle(secondTab).borderBottomColor).to.equal('rgb(4, 5, 6)');
  });

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

  it('associates each tab with the active panel and provides a single roving tab stop', async () => {
    const el = (await fixture(
      html`<lr-knowledge-base-admin></lr-knowledge-base-admin>`,
    )) as LyraKnowledgeBaseAdmin;
    const tabs = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const panel = el.shadowRoot!.querySelector<HTMLElement>('[role="tabpanel"]')!;
    expect(tabs.map((tab) => tab.tabIndex)).to.deep.equal([0, -1]);
    expect(tabs[0]!.getAttribute('aria-controls')).to.equal(panel.id);
    expect(panel.getAttribute('aria-labelledby')).to.equal(tabs[0]!.id);

    tabs[0]!.focus();
    tabs[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    const nextTabs = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(el.activeTab).to.equal('ingestion');
    expect(nextTabs.map((tab) => tab.tabIndex)).to.deep.equal([-1, 0]);
    expect(el.shadowRoot!.activeElement?.id).to.equal(nextTabs[1]!.id);
  });
});
