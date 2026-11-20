import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-mcp-app.js';
import type { LyraMcpApp, McpAppResource } from './mcp-app.class.js';
import { McpAppSession } from './mcp-app-protocol.js';

describe('lr-mcp-app on an insecure origin (no crypto.randomUUID)', () => {
  let original: PropertyDescriptor | undefined;
  beforeEach(() => {
    original = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
  });
  afterEach(() => {
    if (original) Object.defineProperty(crypto, 'randomUUID', original);
    else Reflect.deleteProperty(crypto, 'randomUUID');
  });

  it('renders the frame for a valid resource and tears down without throwing', async () => {
    const el = await fixture<LyraMcpApp>(html`<lr-mcp-app
      .resource=${{ uri: 'ui://weather/current', html: '<p>Weather</p>' } as McpAppResource}
    ></lr-mcp-app>`);
    expect(el.shadowRoot!.querySelector('iframe') !== null).to.equal(true);
    el.remove();
  });

  it('accepts the first host request in mcp-apps mode', () => {
    const requests: unknown[] = [];
    const session = new McpAppSession({ generation: 1, capabilities: { serverTools: {} }, context: {},
      send: () => {}, request: (request) => { requests.push(request); },
      initialized: () => {}, resize: () => {}, log: () => {},
    });
    const init = { protocolVersion: '2026-01-26', appInfo: { name: 'A', version: '1' }, appCapabilities: {} };
    session.receive({ jsonrpc: '2.0', id: 'init', method: 'ui/initialize', params: init });
    session.receive({ jsonrpc: '2.0', method: 'ui/notifications/initialized' });
    expect(() => session.receive({ jsonrpc: '2.0', id: 'r', method: 'tools/call', params: { name: 'lookup' } })).to.not.throw();
    expect(requests.length).to.equal(1);
    session.close();
  });
});

describe('lr-mcp-app bootstrap port delivery', () => {
  for (const missing of ['window', 'nonce'] as const) {
    it(`closes a transferred port that cannot be delivered without a ${missing}`, async () => {
      const resource = missing === 'window' ? { uri: 'ui://weather/current', html: '<p>Weather</p>' } : null;
      const el = await fixture<LyraMcpApp>(html`<lr-mcp-app .resource=${resource}></lr-mcp-app>`);
      const frame = document.createElement('iframe');
      const channel = new MessageChannel();
      const close = channel.port2.close.bind(channel.port2);
      let closed = 0;
      channel.port2.close = () => { closed++; close(); };
      if (missing === 'nonce') document.body.append(frame);
      try {
        (el as unknown as { post(m: unknown, f: HTMLIFrameElement, p: MessagePort): void })
          .post({ channel: 'lyra-mcp-app', version: 1, type: 'host-context', context: {} }, frame, channel.port2);
        expect(closed).to.equal(1);
      } finally {
        frame.remove();
        channel.port1.close();
        close();
      }
    });
  }
});

it('keeps the loading indicator out of the frame layout and permits a scoped frame height', async () => {
  const host = await fixture<LyraMcpApp>(html`<lr-mcp-app style="--lr-mcp-app-frame-height:234px"
    .resource=${{uri:'ui://weather/current',html:'<p>Weather</p>'}}></lr-mcp-app>`);
  const frame = host.shadowRoot!.querySelector('iframe')!;
  expect(getComputedStyle(frame).height).to.equal('234px');
  const base = host.shadowRoot!.querySelector('[part="base"]')!;
  expect(base.clientHeight).to.equal(frame.clientHeight);
});

it('shows the unavailable state if the browser cannot supply secure randomness', async () => {
  const original = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const uuid = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
  try {
    Object.defineProperty(crypto, 'getRandomValues', {configurable:true, value:() => { throw new Error('unavailable'); }});
    Object.defineProperty(crypto, 'randomUUID', {configurable:true, value:undefined});
    const el = await fixture<LyraMcpApp>(html`<lr-mcp-app .strings=${{ mcpAppUnavailable: 'Unavailable here' }}
      .resource=${{ uri: 'ui://weather/current', html: '<p>Weather</p>' }}></lr-mcp-app>`);
    expect(el.shadowRoot!.querySelector('iframe') === null).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Unavailable here');
    expect(() => el.postHostContext({})).not.to.throw();
  } finally {
    if (original) Object.defineProperty(crypto, 'getRandomValues', original);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
    if (uuid) Object.defineProperty(crypto, 'randomUUID', uuid);
    else Reflect.deleteProperty(crypto, 'randomUUID');
  }
});
