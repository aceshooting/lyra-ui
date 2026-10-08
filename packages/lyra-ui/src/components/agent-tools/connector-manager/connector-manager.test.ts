import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './connector-manager.js';
import type { AgentConnector, LyraConnectorManager } from './connector-manager.class.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';

function politeAnnouncements(): string[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"] > div`),
    (node) => node.textContent ?? '',
  );
}

function rowPart(el: LyraConnectorManager, id: string, part: string): HTMLElement | null {
  return el.shadowRoot!.querySelector<HTMLElement>(`[data-connector-id="${id}"] [part="${part}"]`);
}

const connectors: AgentConnector[] = [
  { id: 'files', name: 'Project files', description: 'Read selected project files.', kind: 'mcp', status: 'disconnected' },
  { id: 'calendar', name: 'Calendar', kind: 'connector', status: 'connected' },
  { id: 'broken', name: 'Issue tracker', kind: 'mcp', status: 'error', error: 'Authentication is required.' },
  { id: 'pending', name: 'Mail', kind: 'connector', status: 'connecting' },
];

describe('lr-connector-manager', () => {
  it('keeps each action bound to its own connector when the host re-sorts rows', async () => {
    const el = await fixture<LyraConnectorManager>(html`<lr-connector-manager style="--lr-button-radius: 7px" .connectors=${connectors}></lr-connector-manager>`);
    const filesAction = rowPart(el, 'files', 'action')!;
    await (filesAction as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
    expect(getComputedStyle(filesAction.shadowRoot!.querySelector('[part~="base"]')!).borderTopLeftRadius).to.equal('7px');
    el.connectors = [connectors[1]!, connectors[0]!, connectors[2]!, connectors[3]!];
    await el.updateComplete;
    expect(filesAction.getAttribute('aria-label')).to.equal('Connect Project files');
    expect(rowPart(el, 'files', 'action') === filesAction).to.be.true;
  });

  it('keeps focus on the acted connector and announces its status until it settles', async () => {
    const el = await fixture<LyraConnectorManager>(html`<lr-connector-manager .connectors=${connectors}></lr-connector-manager>`);
    const connect = rowPart(el, 'files', 'action')!;
    await focusByKeyboard(connect);
    const before = politeAnnouncements().length;
    el.addEventListener('lr-connector-action', () => {
      void Promise.resolve().then(() => {
        el.connectors = el.connectors.map((item) => (item.id === 'files' ? { ...item, status: 'connecting' as const } : item));
      });
    }, { once: true });
    connect.click();
    await Promise.resolve();
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement === rowPart(el, 'files', 'status')).to.be.true;
    expect(politeAnnouncements().slice(before)).to.deep.equal(['Connecting']);

    el.connectors = el.connectors.map((item) => (item.id === 'files' ? { ...item, status: 'connected' as const } : item));
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.activeElement === rowPart(el, 'files', 'action'), 'focus moves on to the returned action');
    expect(rowPart(el, 'files', 'action')?.textContent).to.contain('Disconnect');
    expect(politeAnnouncements().slice(before)).to.deep.equal(['Connecting', 'Connected']);

    // A settled connector's later, unrelated status changes stay silent.
    el.connectors = el.connectors.map((item) => (item.id === 'files' ? { ...item, status: 'disconnected' as const } : item));
    await el.updateComplete;
    expect(politeAnnouncements().slice(before)).to.deep.equal(['Connecting', 'Connected']);
  });

  it('announces the host-localized error of a failed connection', async () => {
    const el = await fixture<LyraConnectorManager>(html`<lr-connector-manager .connectors=${connectors}></lr-connector-manager>`);
    const before = politeAnnouncements().length;
    rowPart(el, 'broken', 'action')!.click();
    el.connectors = el.connectors.map((item) => (item.id === 'broken' ? { ...item, status: 'error' as const, error: 'Token expired.' } : item));
    await el.updateComplete;
    expect(politeAnnouncements().slice(before)).to.deep.equal(['Token expired.']);
  });

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
