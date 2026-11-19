import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { LYRA_DEFAULT_STRINGS } from '../../../internal/localization.js';
import { sinkTexts } from '../../../../test/announcements.js';
import '../permission-grant/permission-grant.js';
import '../permission-rules/permission-rules.js';
import '../connector-manager/connector-manager.js';
import '../confirm-bar/confirm-bar.js';
import '../tool-select-dialog/tool-select-dialog.js';
import './tool-timeline.js';

const part = (host: HTMLElement, name: string) => host.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;

it('announces the count matching a search, including zero and clearing the search', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-tool-select-dialog']>(html`<lr-tool-select-dialog open
    .tools=${[{id:'a',name:'Map'}, {id:'b',name:'Mail'}]}></lr-tool-select-dialog>`);
  const input = part(el, 'search-input') as HTMLInputElement;
  for (const [query, message] of [['map','1 match'],['xyz','0 matches'],['','2 matches']] as const) {
    input.value = query;
    input.dispatchEvent(new Event('input'));
    await waitUntil(() => sinkTexts('polite').includes(message));
  }
});

it('the three decision panel legends use the same configurable type size', async () => {
  const group = await fixture<HTMLElement>(html`<div style="--lr-decision-legend-font-size:25px">
    <lr-permission-grant status="denied"></lr-permission-grant>
    <lr-permission-rules></lr-permission-rules>
    <lr-connector-manager .connectors=${[{id:'a',name:'File',kind:'mcp',status:'error'}]}></lr-connector-manager>
  </div>`);
  for (const panel of group.children) expect(getComputedStyle(part(panel as HTMLElement,'legend')).fontSize).to.equal('25px');
});

it('shares positive and negative status colors across decision panels', async () => {
  const group = await fixture<HTMLElement>(html`<div
    style="--lr-decision-positive-color:rgb(20, 81, 40);--lr-decision-negative-color:rgb(115, 30, 25)">
    <lr-permission-grant status="granted"></lr-permission-grant>
    <lr-connector-manager .connectors=${[{id:'a', name:'File', kind:'mcp', status:'connected'}]}></lr-connector-manager>
    <lr-confirm-bar decision="approved"></lr-confirm-bar>
  </div>`);
  const grant = group.querySelector('lr-permission-grant')!;
  const connectors = group.querySelector('lr-connector-manager')!;
  const confirm = group.querySelector('lr-confirm-bar')!;
  const colors = () => [grant, connectors, confirm].map(host => getComputedStyle(part(host, 'status')).color);
  expect(colors()).to.deep.equal(Array(3).fill('rgb(20, 81, 40)'));
  grant.status = 'approved';
  await grant.updateComplete;
  expect(getComputedStyle(part(grant, 'status')).color).to.equal('rgb(20, 81, 40)');
  grant.status = 'denied';
  connectors.connectors = [{id:'a', name:'File', kind:'mcp', status:'error'}];
  confirm.decision = 'denied';
  await Promise.all([grant.updateComplete, connectors.updateComplete, confirm.updateComplete]);
  expect(colors()).to.deep.equal(Array(3).fill('rgb(115, 30, 25)'));
});

it('offers a cancelable permission rule request before the existing notification', async () => {
  const host = await fixture<HTMLElement>(html`<lr-permission-rules .rules=${[{id:'a',label:'Read',scope:'files',decision:'ask'}]}></lr-permission-rules>`);
  const select = part(host,'decision') as HTMLSelectElement;
  const seen: string[] = [];
  host.addEventListener('lr-permission-rule-change-request', event => { seen.push(event.type); event.preventDefault(); }, {once:true});
  host.addEventListener('lr-permission-rule-change', event => seen.push(event.type));
  select.value = 'allow';
  select.dispatchEvent(new Event('change'));
  expect(seen).to.deep.equal(['lr-permission-rule-change-request']);
  expect(select.value).to.equal('ask');
  select.value = 'allow';
  select.dispatchEvent(new Event('change'));
  expect(seen).to.deep.equal(['lr-permission-rule-change-request','lr-permission-rule-change']);
});

for (const kind of ['result', 'approval'] as const) {
  it(`shows and announces a failed ${kind} load and retries on the next activation`, async () => {
    const container = await fixture<HTMLElement>(html`<div></div>`);
    const host = document.createElement('lr-tool-timeline');
    const loader = host as unknown as {loadSurface(kind: string): Promise<unknown>};
    let attempts = 0;
    loader.loadSurface = async () => {
      if (++attempts === 1) throw new Error('unavailable');
      return kind === 'approval' ? import('../tool-approval-dialog/tool-approval-dialog.js') : import('../tool-result-view/tool-result-view.js');
    };
    if (kind === 'approval') host.strings = { toolTimelineLoadError: 'Approval unavailable' };
    host.entries = [{ id: 'a', name: 'Read', args: {}, status: 'pending', needsApproval: kind === 'approval' }];
    container.append(host);
    await host.updateComplete;
    const details = host.shadowRoot!.querySelector('lr-details[part="entry-details"]') as HTMLElementTagNameMap['lr-details'];
    const activate = () => {
      if (kind === 'approval') host.shadowRoot!.querySelector('lr-tool-call-chip')!.click();
      else details.shadowRoot!.querySelector('summary')!.click();
    };
    if (kind === 'result') activate();
    await waitUntil(() => host.shadowRoot!.querySelector('[part="load-error"]') !== null);
    const error = part(host, 'load-error').textContent!.trim();
    expect(error).to.equal(kind === 'result' ? LYRA_DEFAULT_STRINGS.toolTimelineLoadError : 'Approval unavailable');
    await waitUntil(() => sinkTexts('assertive').includes(error));
    if (kind === 'result') {
      activate();
      await waitUntil(() => !details.open && !host.shadowRoot!.querySelector('[part="load-error"]'));
    }
    activate();
    await waitUntil(() => attempts === 2 && !host.shadowRoot!.querySelector('[part="load-error"]'));
  });
}

it('registers approval on reconnect after receiving entries while detached', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div><lr-tool-timeline></lr-tool-timeline></div>`);
  const el = wrapper.querySelector('lr-tool-timeline')!;
  el.remove();
  let loads = 0;
  (el as unknown as { loadSurface(kind: string): Promise<unknown> }).loadSurface = () => {
    loads++;
    return import('../tool-approval-dialog/tool-approval-dialog.js');
  };
  el.entries = [{ id: 'r', name: 'Read', status: 'pending', args: {}, needsApproval: true }];
  await el.updateComplete;
  expect(loads).to.equal(0);
  wrapper.append(el);
  await el.updateComplete;
  expect(loads).to.equal(1);
});

it('announces matches in the destination document after the catalog is adopted', async () => {
  const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const doc = frame.contentDocument!;
  const el = await fixture<HTMLElementTagNameMap['lr-tool-select-dialog']>(html`<lr-tool-select-dialog .tools=${[{id:'a', name:'Map'}]}></lr-tool-select-dialog>`);
  doc.body.append(doc.adoptNode(el));
  try {
    el.show();
    await el.updateComplete;
    const search = part(el, 'search-input') as HTMLInputElement;
    search.value = 'map';
    search.dispatchEvent(new Event('input'));
    await waitUntil(() => sinkTexts('polite', doc).includes('1 match'));
    expect(sinkTexts('polite')).not.to.include('1 match');
  } finally {
    el.close();
    el.remove();
  }
});
