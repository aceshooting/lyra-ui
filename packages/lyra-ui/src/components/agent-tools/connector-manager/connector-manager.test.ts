import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './connector-manager.js';
import type { AgentConnector, LyraConnectorManager } from './connector-manager.class.js';

const connectors: AgentConnector[] = [
  { id: 'files', name: 'Project files', description: 'Read selected project files.', kind: 'mcp', status: 'disconnected' },
  { id: 'calendar', name: 'Calendar', kind: 'connector', status: 'connected' },
  { id: 'broken', name: 'Issue tracker', kind: 'mcp', status: 'error', error: 'Authentication is required.' },
  { id: 'pending', name: 'Mail', kind: 'connector', status: 'connecting' },
];

describe('lr-connector-manager', () => {
  it('renders connector kind, status, caller-localized error, and status-appropriate actions', async () => {
    const el = await fixture<LyraConnectorManager>(html`<lr-connector-manager .connectors=${connectors}></lr-connector-manager>`);
    expect(el.shadowRoot!.querySelectorAll('[part="connector"]')).to.have.lengthOf(4);
    expect(el.shadowRoot!.textContent).to.contain('MCP server');
    expect(el.shadowRoot!.textContent).to.contain('Authentication is required.');
    expect(Boolean(el.shadowRoot!.querySelector('[data-connector-id="pending"] [part="action"]'))).to.be.false;
    expect(el.shadowRoot!.querySelector('[data-connector-id="broken"] [part="action"]')?.textContent).to.contain('Retry');
  });

  it('emits connect, disconnect, and retry requests with connector identity', async () => {
    const el = await fixture<LyraConnectorManager>(html`<lr-connector-manager .connectors=${connectors}></lr-connector-manager>`);
    const expected = [
      { id: 'files', action: 'connect' },
      { id: 'calendar', action: 'disconnect' },
      { id: 'broken', action: 'retry' },
    ];
    for (const item of expected) {
      const button = el.shadowRoot!.querySelector<HTMLButtonElement>(`[data-connector-id="${item.id}"] [part="action"]`)!;
      const emitted = oneEvent(el, 'lr-connector-action');
      button.click();
      expect((await emitted as CustomEvent).detail).to.deep.equal({ connectorId: item.id, action: item.action });
    }
  });

  it('normalizes identities first-wins and bounds rendered connector rows', async () => {
    const many: AgentConnector[] = Array.from({ length: 103 }, (_, index) => ({
      id: `connector-${index}`,
      name: `Connector ${index}`,
      kind: 'connector' as const,
      status: 'disconnected' as const,
    }));
    const input = [connectors[0]!, { ...connectors[0]!, name: 'duplicate should not render' }, { ...connectors[1]!, id: ' ' }, ...many];
    const el = await fixture<LyraConnectorManager>(html`<lr-connector-manager .connectors=${input}></lr-connector-manager>`);
    expect(el.shadowRoot!.querySelectorAll('[part="connector"]')).to.have.lengthOf(100);
    expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.contain('100');
    expect(el.shadowRoot!.textContent).not.to.contain('duplicate should not render');
  });

  it('keeps assigned collections detached and renders replaced or shrinking data', async () => {
    const source: AgentConnector[] = [{ ...connectors[0]! }];
    const el = await fixture<LyraConnectorManager>(html`<lr-connector-manager .connectors=${source}></lr-connector-manager>`);
    source[0]!.name = 'Outside mutation';
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).to.contain('Project files');
    el.connectors = [{ id: 'new', name: 'New connector', kind: 'connector', status: 'connected' }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="connector"]')).to.have.lengthOf(1);
    expect(el.shadowRoot!.textContent).to.contain('New connector');
    expect(el.shadowRoot!.textContent).not.to.contain('Project files');
  });

  it('gates every action when disabled and names the semantic group from the host', async () => {
    const el = await fixture<LyraConnectorManager>(html`
      <lr-connector-manager disabled aria-label="Workspace integrations" .connectors=${connectors}></lr-connector-manager>
    `);
    expect(el.shadowRoot!.querySelector('fieldset')?.getAttribute('aria-label')).to.equal('Workspace integrations');
    expect([...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="action"]')].every((button) => button.disabled)).to.be.true;
  });

  it('ignores stale actions after a connector starts connecting and after the host disables the control', async () => {
    const el = await fixture<LyraConnectorManager>(html`<lr-connector-manager .connectors=${connectors}></lr-connector-manager>`);
    let requests = 0;
    el.addEventListener('lr-connector-action', () => requests++);
    const stale = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-connector-id="files"] [part="action"]')!;
    el.connectors = [{ ...connectors[0]!, status: 'connecting' }];
    await el.updateComplete;
    stale.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(requests).to.equal(0);
    const current = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-connector-id="files"] [part="action"]');
    expect(Boolean(current)).to.be.false;
    el.connectors = [{ ...connectors[0]! }];
    await el.updateComplete;
    const enabledBeforeDisable = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-connector-id="files"] [part="action"]')!;
    el.disabled = true;
    await el.updateComplete;
    enabledBeforeDisable.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(requests).to.equal(0);
  });

  it('blocks synchronous recursive action requests while allowing a later click', async () => {
    const el = await fixture<LyraConnectorManager>(html`<lr-connector-manager .connectors=${connectors}></lr-connector-manager>`);
    const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-connector-id="files"] [part="action"]')!;
    let requests = 0;
    el.addEventListener('lr-connector-action', () => {
      requests++;
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    button.click();
    expect(requests).to.equal(1);
    button.click();
    expect(requests).to.equal(2);
  });

  it('is accessible empty and populated at a narrow width with long content', async () => {
    const empty = await fixture<LyraConnectorManager>(html`<lr-connector-manager></lr-connector-manager>`);
    await expect(empty).to.be.accessible();
    const populated = await fixture<LyraConnectorManager>(html`
      <lr-connector-manager dir="rtl" style="inline-size: 320px" .connectors=${[
        { id: 'long', name: 'A connector name '.repeat(8), description: 'Long text '.repeat(15), kind: 'mcp' as const, status: 'error' as const, error: 'An unbroken diagnostic: '.concat('detail'.repeat(16)) },
      ]}></lr-connector-manager>
    `);
    await expect(populated).to.be.accessible();
    expect(getComputedStyle(populated.shadowRoot!.querySelector('[part="name"]')!).overflowWrap).to.equal('anywhere');
    const hostWidth = populated.getBoundingClientRect().width;
    const fieldset = populated.shadowRoot!.querySelector('[part="base"]')!;
    expect(fieldset.getBoundingClientRect().width).to.be.at.most(hostWidth);
    expect(fieldset.scrollWidth).to.be.at.most(fieldset.clientWidth);
    const hostRect = populated.getBoundingClientRect();
    const row = populated.shadowRoot!.querySelector('[part="connector"]')!.getBoundingClientRect();
    const copy = populated.shadowRoot!.querySelector('[part="connector-copy"]')!.getBoundingClientRect();
    const controls = populated.shadowRoot!.querySelector('[part="connector-controls"]')!.getBoundingClientRect();
    expect(populated.scrollWidth).to.be.at.most(populated.clientWidth);
    expect(row.left).to.be.at.least(hostRect.left - 1);
    expect(row.right).to.be.at.most(hostRect.right + 1);
    expect(copy.left).to.be.at.least(controls.right - 1);
    expect(copy.right).to.be.at.most(hostRect.right + 1);
    expect(getComputedStyle(populated.shadowRoot!.querySelector('[part="connector"]')!).direction).to.equal('rtl');
  });

  it('allows a strings override to reach the visible component label', async () => {
    const el = await fixture<LyraConnectorManager>(html`
      <lr-connector-manager .strings=${{ connectorManagerLabel: 'Available integrations' }}></lr-connector-manager>
    `);
    expect(el.shadowRoot!.querySelector('legend')?.textContent).to.equal('Available integrations');
  });

  it('restores the localized visible label when the label attribute is removed', async () => {
    const el = await fixture<LyraConnectorManager>(html`<lr-connector-manager label="Custom integrations"></lr-connector-manager>`);
    el.removeAttribute('label');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="legend"]')?.textContent).to.equal('Connectors');
  });
});
