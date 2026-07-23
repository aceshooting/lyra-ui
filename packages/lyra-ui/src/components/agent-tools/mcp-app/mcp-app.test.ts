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
  expect(iframe.getAttribute('allow')).to.contain('clipboard-write');
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

it('is accessible with an app loaded', async () => {
  const el = await fixture(html`<lr-mcp-app
    .resource=${{ uri: 'ui://example/app', title: 'Example app', html: '<p>Example</p>' }}
  ></lr-mcp-app>`);
  expect(el.shadowRoot!.querySelectorAll('iframe')).to.have.lengthOf(1);
  await expect(el).to.be.accessible();
});
