import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import jsonGrammar from 'shiki/langs/json.mjs';
import './code-block-core.js';
import type { LyraCodeBlockCore } from './code-block-core.js';

describe('lyra-code-block-core', () => {
  it('renders optional line numbers for plain code', async () => {
    const el = (await fixture(
      html`<lyra-code-block-core line-numbers .code=${'first\nsecond'}></lyra-code-block-core>`,
    )) as LyraCodeBlockCore;
    expect(el.lineNumbers).to.be.true;
    expect(el.shadowRoot!.querySelectorAll('[part="pre"] .line')).to.have.lengthOf(2);
  });

  it('forwards a host aria-label to the internal named code region and keeps it reactive', async () => {
    const el = (await fixture(
      html`<lyra-code-block-core aria-label="Response payload" language="json"></lyra-code-block-core>`,
    )) as LyraCodeBlockCore;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    expect(body.getAttribute('aria-label')).to.equal('Response payload');

    el.accessibleLabel = 'Updated response payload';
    await el.updateComplete;
    expect(body.getAttribute('aria-label')).to.equal('Updated response payload');
  });

  it('highlights code using a supplied languages map', async () => {
    const el = (await fixture(html`<lyra-code-block-core language="json"></lyra-code-block-core>`)) as LyraCodeBlockCore;
    el.languages = { json: jsonGrammar };
    el.code = '{"a":1}';
    await el.updateComplete;
    // timeout: 8000 -- same as code-block.test.ts's identical wait on the fine-grained
    // shiki/core + oniguruma-WASM dynamic import, which the default waitUntil timeout is
    // too tight for under load.
    await waitUntil(() => el.shadowRoot!.querySelector('.shiki') !== null, undefined, { timeout: 8000 });
    expect(el.shadowRoot!.querySelector('.shiki')).to.exist;
  });

  it('renders the plain-text fallback for a language absent from the supplied languages map, never hanging waiting on a default highlighter', async () => {
    const el = (await fixture(html`<lyra-code-block-core language="python"></lyra-code-block-core>`)) as LyraCodeBlockCore;
    el.languages = { json: jsonGrammar };
    el.code = 'print(1)';
    await el.updateComplete;
    const pre = el.shadowRoot!.querySelector('pre');
    expect(pre).to.exist;
    expect(pre!.textContent).to.include('print(1)');
  });

  it('is accessible', async () => {
    const el = (await fixture(html`<lyra-code-block-core language="json" copyable></lyra-code-block-core>`)) as LyraCodeBlockCore;
    el.languages = { json: jsonGrammar };
    el.code = '{"a":1}';
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});
