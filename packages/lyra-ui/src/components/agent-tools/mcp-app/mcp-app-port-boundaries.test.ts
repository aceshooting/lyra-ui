import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './mcp-app.js';
import type { LyraMcpApp } from './mcp-app.class.js';

describe('MCP app public port and resource boundaries', () => {
  it('rejects malformed messages and error replies over the real sandbox port while preserving a valid exchange', async () => {
    const el = await fixture<LyraMcpApp>(html`<lr-mcp-app height="280" max-height="not-a-length"></lr-mcp-app>`);
    const calls: string[] = [];
    const heights: number[] = [];
    const replies: unknown[] = [];
    el.addEventListener('lr-mcp-resize', event => heights.push(event.detail.height));
    el.addEventListener('lr-mcp-log', event => replies.push(event.detail.value));
    el.addEventListener('lr-mcp-tool-call', event => {
      calls.push(event.detail.name);
      const frameGeneration = event.detail.frameGeneration;
      for (const error of ['', '   ', 17]) {
        Reflect.apply(el.postToolResult, el, ['round-trip', { frameGeneration, error }]);
      }
      el.postToolResult('round-trip', { frameGeneration, result: { accepted: true } });
      el.postHostContext({ verifyReplies: true });
    });
    el.resource = {
      uri: 'ui://port-boundaries',
      html: `<script>
        window.addEventListener('message', event => {
          const initial = event.data;
          const port = event.ports[0];
          if (!port || initial?.type !== 'host-context') return;
          const envelope = { channel: 'lyra-mcp-app', version: 1, nonce: initial.nonce };
          const received = [];
          port.onmessage = reply => {
            if (reply.data.type === 'tool-result') received.push(reply.data.result);
            if (reply.data.type === 'host-context' && reply.data.context?.verifyReplies) {
              port.postMessage({ ...envelope, type: 'log', value: received });
            }
          };
          for (const malformed of [
            null,
            { ...envelope, nonce: 'incorrect', type: 'tool-call', name: 'wrong nonce' },
            { ...envelope, channel: 'other', type: 'tool-call', name: 'wrong channel' },
            { ...envelope, version: 2, type: 'tool-call', name: 'wrong version' },
            { ...envelope, type: 12, name: 'non-string type' }
          ]) port.postMessage(malformed);
          port.postMessage({ ...envelope, type: 'resize', height: 'automatic' });
          port.postMessage({ ...envelope, type: 'tool-call', requestId: 'round-trip', name: 'current', args: {} });
        });
      </script>`,
    };
    await waitUntil(() => replies.length === 1, 'the authenticated port must complete the response barrier', { timeout: 5_000 });
    await el.updateComplete;
    expect(calls).to.deep.equal(['current']);
    expect(heights).to.deep.equal([280]);
    expect(replies).to.deep.equal([[{ accepted: true }]]);
    expect(el.shadowRoot!.querySelector<HTMLIFrameElement>('iframe')!.style.height).to.equal('280px');
  });

  it('remounts equal-looking documents when cyclic metadata prevents proving document equivalence', async () => {
    const el = await fixture<LyraMcpApp>(html`<lr-mcp-app></lr-mcp-app>`);
    const first: Record<string, unknown> = { theme: 'light' };
    first['self'] = first;
    const second: Record<string, unknown> = { theme: 'light' };
    second['self'] = second;
    let ready = 0;
    el.addEventListener('lr-mcp-ready', () => { ready++; });
    el.resource = { uri: 'ui://cyclic-metadata', html: '<p>Current document</p>', metadata: first };
    await waitUntil(() => ready === 1, 'the original document must load', { timeout: 5_000 });
    const previous = el.shadowRoot!.querySelector('iframe')!;
    el.resource = { uri: 'ui://cyclic-metadata', html: '<p>Current document</p>', metadata: second };
    await waitUntil(() => ready === 2, 'the replacement document must load', { timeout: 5_000 });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('iframe') === previous).to.equal(false);
    expect(previous.isConnected).to.equal(false);
    expect(el.shadowRoot!.querySelector('[part="loading"]') === null).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="error"]') === null).to.equal(true);
  });

  it('rejects empty or non-string inline documents and restores default sizing when height attributes are removed', async () => {
    const el = await fixture<LyraMcpApp>(html`<lr-mcp-app height="240" max-height="400"
      .strings=${{ mcpAppUnavailable: 'Application unavailable' }}></lr-mcp-app>`);
    for (const content of ['', 17]) {
      Reflect.set(el, 'resource', { uri: 'ui://invalid-document', html: content });
      await el.updateComplete;
      expect(el.shadowRoot!.querySelectorAll('iframe').length).to.equal(0);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Application unavailable');
    }
    el.resource = { uri: 'ui://valid-document', html: '<p>Loaded</p>' };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector<HTMLIFrameElement>('iframe')!.style.height).to.equal('240px');
    el.removeAttribute('height');
    el.removeAttribute('max-height');
    await el.updateComplete;
    expect(el.height).to.equal(null);
    expect(el.maxHeight).to.equal(null);
    expect(el.shadowRoot!.querySelector<HTMLIFrameElement>('iframe')!.style.height).to.equal('320px');
  });
});
