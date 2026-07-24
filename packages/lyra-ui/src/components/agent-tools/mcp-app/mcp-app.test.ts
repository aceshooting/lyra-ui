import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './mcp-app.js';
import type { LyraMcpApp } from './mcp-app.class.js';

it('renders executable app HTML only inside a uniquely-origin sandbox with CSP metadata', async () => {
  const el = (await fixture(html`<lr-mcp-app
    .resource=${{
      uri: 'ui://weather/current',
      title: 'Weather',
      html: '<!doctype html><html><head></head><body><button>Refresh</button></body></html>',
      csp: { connectDomains: ['https://api.example.com'] },
      permissions: { clipboardWrite: true },
    }}
  ></lr-mcp-app>`)) as LyraMcpApp;
  const iframe = el.shadowRoot!.querySelector('iframe')!;
  expect(iframe.getAttribute('sandbox')).to.equal('allow-forms allow-scripts');
  expect(iframe.getAttribute('sandbox')).to.not.contain('allow-same-origin');
  expect(iframe.getAttribute('allow')).to.contain('clipboard-write *');
  expect(iframe.getAttribute('allow')).to.not.contain("'none'");
  expect(iframe.srcdoc).to.contain('Content-Security-Policy');
  expect(iframe.srcdoc).to.contain('https://api.example.com');
});

it('rejects executable frame URLs instead of navigating them', async () => {
  const el = (await fixture(html`<lr-mcp-app
    .resource=${{ uri: 'ui://unsafe', src: 'javascript:alert(1)' }}
  ></lr-mcp-app>`)) as LyraMcpApp;
  expect(el.shadowRoot!.querySelectorAll('iframe')).to.have.lengthOf(0);
  expect(el.shadowRoot!.querySelector('[role="alert"]')?.textContent?.trim()).to.not.equal('');
});

it('accepts messages only from its own frame and clamps resize requests', async () => {
  const el = (await fixture(html`<lr-mcp-app
    .resource=${{ uri: 'ui://weather/current', html: '<p>Weather</p>' }}
    max-height="500"
  ></lr-mcp-app>`)) as LyraMcpApp;
  const iframe = el.shadowRoot!.querySelector('iframe')!;
  const toolCall = oneEvent(el, 'lr-mcp-tool-call');
  window.dispatchEvent(new MessageEvent('message', {
    source: iframe.contentWindow,
    origin: 'null',
    data: {
      channel: 'lyra-mcp-app',
      version: 1,
      type: 'tool-call',
      requestId: 'request-1',
      name: 'refresh_weather',
      args: { city: 'Luxembourg' },
    },
  }));
  const event = await toolCall as CustomEvent<{ requestId: string; name: string; args: unknown }>;
  expect(event.detail.name).to.equal('refresh_weather');

  window.dispatchEvent(new MessageEvent('message', {
    source: iframe.contentWindow,
    origin: 'null',
    data: { channel: 'lyra-mcp-app', version: 1, type: 'resize', height: 50_000 },
  }));
  await el.updateComplete;
  expect(iframe.style.height).to.equal('500px');

  let leaked = false;
  el.addEventListener('lr-mcp-tool-call', () => {
    leaked = true;
  });
  window.dispatchEvent(new MessageEvent('message', {
    source: window,
    data: { channel: 'lyra-mcp-app', version: 1, type: 'tool-call', name: 'bad', args: {} },
  }));
  expect(leaked).to.be.false;
});

it('forwards typed message, link, and log requests while rejecting malformed link requests', async () => {
  const el = (await fixture(html`<lr-mcp-app
    .resource=${{ uri: 'ui://assistant/actions', html: '<p>Actions</p>' }}
  ></lr-mcp-app>`)) as LyraMcpApp;
  const iframe = el.shadowRoot!.querySelector('iframe')!;
  const dispatch = (data: Record<string, unknown>) => {
    window.dispatchEvent(new MessageEvent('message', {
      source: iframe.contentWindow,
      origin: 'null',
      data: { channel: 'lyra-mcp-app', version: 1, ...data },
    }));
  };

  const sendMessage = oneEvent(el, 'lr-mcp-send-message');
  dispatch({ type: 'send-message', message: { role: 'user', content: 'Continue' } });
  expect((await sendMessage).detail.message).to.deep.equal({ role: 'user', content: 'Continue' });

  const openLink = oneEvent(el, 'lr-mcp-open-link');
  dispatch({ type: 'open-link', href: 'https://example.test/details' });
  expect((await openLink).detail.href).to.equal('https://example.test/details');

  let linkCount = 0;
  el.addEventListener('lr-mcp-open-link', () => linkCount++);
  dispatch({ type: 'open-link', href: 42 });
  expect(linkCount).to.equal(0);

  const defaultLog = oneEvent(el, 'lr-mcp-log');
  dispatch({ type: 'log', value: { status: 'ready' } });
  expect((await defaultLog).detail).to.deep.equal({
    level: 'info',
    value: { status: 'ready' },
  });

  const warningLog = oneEvent(el, 'lr-mcp-log');
  dispatch({ type: 'log', level: 'warn', value: 'slow response' });
  expect((await warningLog).detail.level).to.equal('warn');
});

it('builds host-context and optional tool-result message envelopes through the public API', () => {
  const el = document.createElement('lr-mcp-app') as LyraMcpApp;
  const messages: unknown[] = [];
  (el as any).post = (message: unknown) => messages.push(message);

  el.postHostContext({ theme: 'dark' });
  el.postToolResult('request-1', { temperature: 18 });
  el.postToolResult('request-2', undefined, 'Permission denied');
  el.postToolResult('request-3');

  expect(messages).to.deep.equal([
    {
      channel: 'lyra-mcp-app',
      version: 1,
      type: 'host-context',
      context: { theme: 'dark' },
    },
    {
      channel: 'lyra-mcp-app',
      version: 1,
      type: 'tool-result',
      requestId: 'request-1',
      result: { temperature: 18 },
    },
    {
      channel: 'lyra-mcp-app',
      version: 1,
      type: 'tool-result',
      requestId: 'request-2',
      error: 'Permission denied',
    },
    {
      channel: 'lyra-mcp-app',
      version: 1,
      type: 'tool-result',
      requestId: 'request-3',
    },
  ]);
});

it('authenticates remote uniquely-origin sandbox messages by frame window and opaque origin', async () => {
  const el = (await fixture(html`<lr-mcp-app
    .resource=${{ uri: 'ui://remote/app', src: 'https://apps.example.test/weather' }}
  ></lr-mcp-app>`)) as LyraMcpApp;
  const iframe = el.shadowRoot!.querySelector('iframe')!;
  let calls = 0;
  el.addEventListener('lr-mcp-tool-call', () => calls++);
  const data = { channel: 'lyra-mcp-app', version: 1, type: 'tool-call', name: 'weather', args: {} };

  window.dispatchEvent(new MessageEvent('message', {
    source: iframe.contentWindow,
    origin: 'https://apps.example.test',
    data,
  }));
  expect(calls).to.equal(0);

  window.dispatchEvent(new MessageEvent('message', {
    source: window,
    origin: 'null',
    data,
  }));
  expect(calls).to.equal(0);

  window.dispatchEvent(new MessageEvent('message', {
    source: iframe.contentWindow,
    origin: 'null',
    data,
  }));
  expect(calls).to.equal(1);
});

it('applies per-instance strings to the unavailable state', async () => {
  const el = (await fixture(
    html`<lr-mcp-app
      .strings=${{ mcpAppUnavailable: 'Application interactive indisponible.' }}
    ></lr-mcp-app>`,
  )) as LyraMcpApp;
  expect(el.shadowRoot!.querySelector('[role="alert"]')?.textContent?.trim()).to.equal(
    'Application interactive indisponible.',
  );
});

it('is accessible with an app loaded', async () => {
  const el = await fixture(html`<lr-mcp-app
    .resource=${{ uri: 'ui://example/app', title: 'Example app', html: '<p>Example</p>' }}
  ></lr-mcp-app>`);
  expect(el.shadowRoot!.querySelectorAll('iframe')).to.have.lengthOf(1);
  await expect(el).to.be.accessible();
});

it('applies per-instance localized strings', async () => {
  const el = (await fixture(html`<lr-mcp-app
    .strings=${{ mcpAppLabel: 'Localized MCP application' }}
    .resource=${{ uri: 'ui://example/app', html: '<p>Example</p>' }}
  ></lr-mcp-app>`)) as LyraMcpApp;
  expect(el.shadowRoot!.querySelector('iframe')!.title).to.equal('Localized MCP application');
});
