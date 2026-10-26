import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './mcp-app.js';
import type { LyraMcpApp } from './mcp-app.class.js';

function assetProbe(official: boolean): string {
  const origin = JSON.stringify(window.location.origin);
  return `<script>
    const official = ${official};
    const origin = ${origin};
    const send = message => parent.postMessage({ jsonrpc: '2.0', ...message }, '*');
    async function loadAssets(report) {
      const script = document.createElement('script');
      script.src = origin + '/__lyra-mcp-app-csp-probe.js';
      const style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = origin + '/__lyra-mcp-app-sdk-fixture.css';
      const results = await Promise.all([script, style].map(element => new Promise(resolve => {
        element.onload = () => resolve('loaded');
        element.onerror = () => resolve('blocked');
        document.head.append(element);
      })));
      report({ results, executed: window.mcpExternalAssetExecuted === true,
        style: getComputedStyle(document.documentElement).getPropertyValue('--mcp-sdk-fixture').trim() });
    }
    addEventListener('message', event => {
      if (event.source !== parent) return;
      if (official && event.data?.id === 'initialize') {
        send({ method: 'ui/notifications/initialized' });
        void loadAssets(value => send({ method: 'notifications/message', params: { level: 'info', data: value } }));
      } else if (!official && event.data?.type === 'host-context' && event.ports[0]) {
        const port = event.ports[0];
        port.start();
        void loadAssets(value => port.postMessage({ channel: 'lyra-mcp-app', version: 1,
          type: 'log', nonce: event.data.nonce, level: 'info', value }));
      }
    });
    if (official) send({ id: 'initialize', method: 'ui/initialize', params: {
      protocolVersion: '2026-01-26', appInfo: { name: 'Asset probe', version: '1' }, appCapabilities: {}
    } });
  </script>`;
}

for (const scenario of [
  { name: 'official default deny', official: true, domains: [] },
  { name: 'official unapproved origin', official: true, domains: ['https://unapproved.example'] },
  { name: 'official malformed origin', official: true, domains: ['https://x;script-src.example'] },
  { name: 'legacy script and style restrictions', official: false, domains: [window.location.origin] },
]) {
  it(`preserves ${scenario.name} for external executable and stylesheet assets`, async () => {
    const el = await fixture<LyraMcpApp>(html`<lr-mcp-app
      .protocol=${scenario.official ? 'mcp-apps' : 'legacy'} .hostCapabilities=${{ logging: {} }}></lr-mcp-app>`);
    const reports: unknown[] = [];
    el.addEventListener('lr-mcp-log', event => reports.push(event.detail.value));
    el.resource = { uri: 'ui://csp/assets', html: assetProbe(scenario.official), csp: { resourceDomains: scenario.domains } };
    await waitUntil(() => reports.length === 1, 'the CSP probe must finish loading or rejecting both assets', { timeout: 5_000 });
    expect(reports).to.deep.equal([{ results: ['blocked', 'blocked'], executed: false, style: '' }]);
  });
}


for (const redirect of [false, true]) {
  it(`blocks ${redirect ? 'redirected' : 'direct'} self-navigation before a disallowed destination receives a request`, async () => {
    const token = crypto.randomUUID();
    const target = new URL('/__lyra-mcp-navigation-target', window.location.origin);
    target.searchParams.set('token', token);
    if (redirect) target.hostname = window.location.hostname === '127.0.0.1' ? 'localhost' : '127.0.0.1';
    const destination = redirect ? new URL('/__lyra-mcp-navigation-redirect', window.location.origin) : target;
    if (redirect) {
      destination.searchParams.set('token', token);
      destination.searchParams.set('target', target.href);
    }
    let attempted = false;
    const observe = (event: MessageEvent): void => { if (event.data?.token === token) attempted = true; };
    window.addEventListener('message', observe);
    const el = await fixture<LyraMcpApp>(html`<lr-mcp-app protocol="mcp-apps"></lr-mcp-app>`);
    try {
      el.resource = { uri: 'ui://csp/navigation',
        csp: { frameDomains: redirect ? [window.location.origin] : [] },
        html: `<script>top.postMessage({ token: ${JSON.stringify(token)} }, '*'); location.href = ${JSON.stringify(destination.href)};</script>`,
      };
      await waitUntil(() => attempted, 'the app must actually attempt navigation', { timeout: 5_000 });
      // wait-reason: Keep the live app mounted while local network and redirect tasks settle. The server,
      // rather than a post-navigation frame check, records whether the prohibited request arrived.
      await new Promise(resolve => setTimeout(resolve, 350));
      const response = await fetch(`/__lyra-mcp-navigation-count?token=${token}`);
      const counts = await response.json() as { target: number; redirect: number };
      if (redirect) expect(counts.redirect).to.be.greaterThan(0);
      expect(counts.target).to.equal(0);
    } finally {
      window.removeEventListener('message', observe);
      el.resource = null;
      await el.updateComplete;
    }
  });
}
