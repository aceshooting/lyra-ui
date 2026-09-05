import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import DOMPurify from 'dompurify';
import { sanitizePassiveMarkup } from './passive-markup.js';
import './html-viewer/html-viewer.js';
import './email-viewer/email-viewer.js';
import './notebook-viewer/notebook-viewer.js';
import './docx-viewer/docx-viewer.js';
import './svg-viewer/svg-viewer.js';
import './include/include.js';
import type { LyraHtmlViewer } from './html-viewer/html-viewer.js';
import type { LyraEmailViewer } from './email-viewer/email-viewer.js';
import type { LyraNotebookViewer } from './notebook-viewer/notebook-viewer.js';
import type { LyraDocxViewer } from './docx-viewer/docx-viewer.js';
import type { LyraSvgViewer } from './svg-viewer/svg-viewer.js';
import type { LyraInclude } from './include/include.js';
import type { DocxDeps } from './docx-viewer/docx-loader.js';
import { MINIMAL_DOCX_BASE64 } from './docx-viewer/fixtures/minimal-docx-fixture.js';
import { __clearIncludeResourceCacheForTesting } from './include/include-resource.js';

describe('sanitizePassiveMarkup', () => {
  it('makes a passive document network-silent and non-interactive after the real sanitizer', () => {
    const clean = sanitizePassiveMarkup(DOMPurify, `
      <style>@import url(https://example.test/a.css)</style>
      <img src="https://example.test/pixel.png" srcset="https://example.test/2x.png 2x">
      <a href="https://example.test/nav" target="_blank">link</a>
      <form action="https://example.test/post"><input autofocus><button>send</button></form>
      <div style="background:url(https://example.test/bg.png)" tabindex="0">body</div>
      <x-active>custom text</x-active>
    `, document);
    const template = document.createElement('template');
    template.innerHTML = clean;
    expect(template.content.querySelectorAll('style,a,form,input,button,x-active')).to.have.lengthOf(0);
    expect(template.content.querySelector('img')).to.exist;
    expect(template.content.querySelectorAll('[src],[srcset],[href],[action],[style],[tabindex]')).to.have.lengthOf(0);
    expect(template.content.textContent).to.contain('link');
    expect(template.content.textContent).to.contain('send');
    expect(template.content.textContent).to.contain('custom text');
  });

  it('strips shadow-part styling hooks without removing passive content or ordinary data attributes', () => {
    const clean = sanitizePassiveMarkup(
      DOMPurify,
      '<p part="error body" exportparts="base:error" data-record-id="42">Ordinary content</p>',
      document,
    );
    const template = document.createElement('template');
    template.innerHTML = clean;
    const paragraph = template.content.querySelector('p')!;
    expect(paragraph.hasAttribute('part')).to.equal(false);
    expect(paragraph.hasAttribute('exportparts')).to.equal(false);
    expect(paragraph.getAttribute('data-record-id')).to.equal('42');
    expect(paragraph.textContent).to.equal('Ordinary content');
  });

  it('retains only unescaped local SVG fragment references', () => {
    const clean = sanitizePassiveMarkup(DOMPurify, `
      <svg>
        <defs><linearGradient id="paint"></linearGradient></defs>
        <use id="local" href="#paint"></use>
        <use id="remote" href="https://example.test/a.svg#paint"></use>
        <image id="inline-raster" href="data:image/png;base64,AA=="></image>
        <image id="script-raster" href="data:image/svg+xml;base64,AA=="></image>
        <rect id="fill" fill="URL( '#paint' )"></rect>
        <rect id="escaped" fill="u\\72l(#paint)"></rect>
        <rect id="external" filter="url(https://example.test/filter.svg#x)"></rect>
      </svg>
    `, document, 'passive-svg');
    const template = document.createElement('template');
    template.innerHTML = clean;
    const [local, remote] = template.content.querySelectorAll('use');
    const inlineRaster = template.content.querySelector('#inline-raster');
    const scriptRaster = template.content.querySelector('#script-raster');
    const [fill, escaped, external] = template.content.querySelectorAll('rect');
    expect(local?.getAttribute('href')).to.equal('#paint');
    expect(remote?.hasAttribute('href')).to.equal(false);
    expect(inlineRaster?.getAttribute('href')).to.equal('data:image/png;base64,AA==');
    expect(scriptRaster?.hasAttribute('href')).to.equal(false);
    expect(fill?.getAttribute('fill')).to.match(/paint/i);
    expect(escaped?.hasAttribute('fill')).to.equal(false);
    expect(external?.hasAttribute('filter')).to.equal(false);
  });

  it('retains only inline raster data sources on passive document images', () => {
    const clean = sanitizePassiveMarkup(
      { sanitize: (value: string) => value },
      '<img id="inline" src="data:image/png;base64,AA=="><img id="remote" src="https://example.test/image.png">',
      document,
    );
    const template = document.createElement('template');
    template.innerHTML = clean;
    expect(template.content.querySelector('#inline')?.getAttribute('src')).to.equal(
      'data:image/png;base64,AA==',
    );
    expect(template.content.querySelector('#remote')?.hasAttribute('src')).to.equal(false);
  });

  it('removes SVG animation elements while preserving passive shape siblings', () => {
    const clean = sanitizePassiveMarkup(DOMPurify, `
      <svg xmlns="http://www.w3.org/2000/svg">
        <circle id="shape"><animate attributeName="r" values="1;10"></animate></circle>
        <set attributeName="display" to="none"></set>
      </svg>
    `, document, 'passive-svg');
    const template = document.createElement('template');
    template.innerHTML = clean;
    expect(template.content.querySelector('#shape') !== null).to.equal(true);
    expect(template.content.querySelector('animate, set') === null).to.equal(true);
  });

  it('keeps only resolvable-by-caller local anchors in the transclusion profile', () => {
    const clean = sanitizePassiveMarkup(DOMPurify, `
      <a id="local" href="#section" target="_blank">local</a>
      <a id="remote" href="https://example.test/a">remote</a>
      <form><button>submit</button></form>
    `, document, 'transclusion');
    const template = document.createElement('template');
    template.innerHTML = clean;
    const local = template.content.querySelector('#local')!;
    const remote = template.content.querySelector('#remote')!;
    expect(local.getAttribute('href')).to.equal('#section');
    expect(local.hasAttribute('target')).to.equal(false);
    expect(remote.hasAttribute('href')).to.equal(false);
    expect(template.content.querySelectorAll('form,button')).to.have.lengthOf(0);
    expect(template.content.textContent).to.contain('submit');
  });

  it('remains fail-closed when a sanitizer leaves custom and foreign SVG markup intact', () => {
    const clean = sanitizePassiveMarkup(
      { sanitize: (value: string) => value },
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
        <defs><path id="shape" /></defs>
        <use id="local-use" xlink:href="#shape"></use>
        <image id="inline-image" src="data:image/png;base64,AA=="></image>
        <foreignObject>
          <div xmlns="http://www.w3.org/1999/xhtml"><x-active>preserved text</x-active></div>
        </foreignObject>
      </svg>`,
      document,
      'passive-svg',
    );
    const template = document.createElement('template');
    template.innerHTML = clean;

    expect(template.content.querySelectorAll('x-active, div')).to.have.lengthOf(0);
    expect(template.content.textContent).to.contain('preserved text');
    expect(template.content.querySelector('#local-use')?.getAttribute('xlink:href')).to.equal('#shape');
    expect(template.content.querySelector('#inline-image')?.getAttribute('src'))
      .to.equal('data:image/png;base64,AA==');
  });
});

// Ordinary text, presentation attributes, inert forms and a tiny inline raster only.
const passiveRaster = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const passiveLeaf = `<h2 id="passive-heading">Passive heading</h2><p data-record-id="42" style="color:blue" part="sample" exportparts="sample:sample">Preserved paragraph</p><form><span>Preserved form text</span><input type="hidden" value="sample"></form><a href="#passive-heading">Local heading</a><img alt="Passive raster" src="${passiveRaster}">`;
const passiveTemplates = (depth: number) => `<main><p>Visible document text</p>${'<template>'.repeat(depth)}${passiveLeaf}${'</template>'.repeat(depth)}</main>`;
const passiveSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><defs><linearGradient id="paint"><stop stop-color="blue"></stop></linearGradient></defs><rect id="shape" width="20" height="20" fill="url(#paint)" style="opacity:1" part="sample" exportparts="sample:sample"></rect><image id="raster" width="1" height="1" href="${passiveRaster}"></image></svg>`;

function passiveTemplateLeaf(root: ParentNode, depth: number): ParentNode {
  let current = root;
  for (let index = 0; index < depth; index++) {
    const template = current.querySelector<HTMLTemplateElement>('template');
    expect(template !== null, `passive template level ${index + 1} remains available`).to.equal(true);
    current = template!.content;
  }
  return current;
}

function expectPassiveLeaf(root: ParentNode, profile: 'passive-document' | 'transclusion'): void {
  expect(root.querySelectorAll('form,input,[style],[part],[exportparts]').length).to.equal(0);
  expect(root.querySelector('[data-record-id="42"]')?.textContent).to.equal('Preserved paragraph');
  expect(root.querySelector('span')?.textContent).to.equal('Preserved form text');
  expect(root.querySelector('img')?.getAttribute('src')).to.equal(profile === 'passive-document' ? passiveRaster : null);
  if (profile === 'passive-document') expect(root.querySelectorAll('a').length).to.equal(0);
  else expect(root.querySelector('a')?.getAttribute('href')).to.equal('#passive-heading');
}

function expectPassiveSvg(root: ParentNode): void {
  expect(root.querySelectorAll('[style],[part],[exportparts]').length).to.equal(0);
  expect(root.querySelector('#shape')?.getAttribute('fill')).to.equal('url(#paint)');
  expect(root.querySelector('#raster')?.getAttribute('href')).to.equal(passiveRaster);
}

function minimalPassiveDocx(): ArrayBuffer {
  return Uint8Array.from(atob(MINIMAL_DOCX_BASE64), character => character.charCodeAt(0)).buffer;
}

describe('passive markup through real viewer routes', () => {
  const originalFetch = window.fetch;
  afterEach(() => {
    window.fetch = originalFetch;
    __clearIncludeResourceCacheForTesting();
  });

  for (const profile of ['passive-document', 'transclusion'] as const) {
    it(`preserves 32 passive template levels while enforcing the ${profile} rules at their leaf`, () => {
      const cleaned = sanitizePassiveMarkup(DOMPurify, passiveTemplates(32), document, profile);
      const parsed = document.createElement('template');
      parsed.innerHTML = cleaned;
      expectPassiveLeaf(passiveTemplateLeaf(parsed.content, 32), profile);
    });
  }

  it('sanitizes nested template contents through the actual remote HTML viewer', async () => {
    window.fetch = (async () => new Response(passiveTemplates(8))) as typeof fetch;
    const viewer = await fixture<LyraHtmlViewer>(html`<lr-html-viewer src="/passive-document.html"></lr-html-viewer>`);
    await waitUntil(() => viewer.shadowRoot!.querySelector('[part="html"] template') !== null, 'HTML document rendered');
    const body = viewer.shadowRoot!.querySelector('[part="html"]')!;
    expect(body.textContent).to.include('Visible document text');
    expectPassiveLeaf(passiveTemplateLeaf(body, 8), 'passive-document');
  });

  it('sanitizes nested template contents through the real email parser and viewer', async () => {
    const email = ['From: Reader <reader@example.test>', 'Subject: Passive document', 'Content-Type: text/html; charset=utf-8', '', passiveTemplates(8), ''].join('\r\n');
    window.fetch = (async () => new Response(email)) as typeof fetch;
    const viewer = await fixture<LyraEmailViewer>(html`<lr-email-viewer src="/passive-document.eml"></lr-email-viewer>`);
    await waitUntil(() => viewer.shadowRoot!.querySelector('[part="body-html"] template') !== null, 'parsed HTML email rendered');
    const body = viewer.shadowRoot!.querySelector('[part="body-html"]')!;
    expect(body.textContent).to.include('Visible document text');
    expectPassiveLeaf(passiveTemplateLeaf(body, 8), 'passive-document');
  });

  it('sanitizes cached HTML template outputs and preserves passive SVG output in the actual notebook', async () => {
    const viewer = await fixture<LyraNotebookViewer>(html`<lr-notebook-viewer></lr-notebook-viewer>`);
    viewer.notebook = {
      nbformat: 4, nbformat_minor: 5, metadata: {},
      cells: [{ cell_type: 'code', id: 'passive-output', source: '', execution_count: 1, metadata: {}, outputs: [
        { output_type: 'display_data', data: { 'text/html': passiveTemplates(8) } },
        { output_type: 'display_data', data: { 'image/svg+xml': passiveSvg } },
      ] }],
    };
    const rows = () => viewer.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot;
    await waitUntil(() => !!rows()?.querySelector('template') && !!rows()?.querySelector('svg #shape'), 'notebook HTML and SVG outputs rendered');
    expectPassiveLeaf(passiveTemplateLeaf(rows()!, 8), 'passive-document');
    expectPassiveSvg(rows()!.querySelector('svg')!);
    viewer.name = 'Updated notebook label';
    await viewer.updateComplete;
    expectPassiveLeaf(passiveTemplateLeaf(rows()!, 8), 'passive-document');
  });

  it('applies the passive rules to converted DOCX template output with real DOMPurify', async () => {
    window.fetch = (async () => new Response(minimalPassiveDocx())) as typeof fetch;
    const viewer = await fixture<LyraDocxViewer>(html`<lr-docx-viewer></lr-docx-viewer>`);
    // Isolate converter output admission; the actual viewer still fetches and checks a valid DOCX archive.
    // DOMPurify is the real peer. A separate control below exercises the real Mammoth converter too.
    (viewer as unknown as { loadLibrary: () => Promise<DocxDeps> }).loadLibrary = async () => ({
      mammoth: { convertToHtml: async () => ({ value: passiveTemplates(8), messages: [] }) }, DOMPurify,
    });
    viewer.src = '/passive-conversion.docx';
    await waitUntil(() => viewer.shadowRoot!.querySelector('[part="content"] template') !== null, 'converted DOCX output rendered');
    expectPassiveLeaf(passiveTemplateLeaf(viewer.shadowRoot!.querySelector('[part="content"]')!, 8), 'passive-document');
  });

  it('keeps an ordinary document renderable through the actual Mammoth and DOMPurify peers', async () => {
    window.fetch = (async () => new Response(minimalPassiveDocx())) as typeof fetch;
    const viewer = await fixture<LyraDocxViewer>(html`<lr-docx-viewer src="/passive-real-converter.docx"></lr-docx-viewer>`);
    await waitUntil(() => viewer.shadowRoot!.querySelector('[part="content"]') !== null, 'real DOCX conversion rendered', { timeout: 5000 });
    const body = viewer.shadowRoot!.querySelector('[part="content"]')!;
    expect(body.textContent).to.include('Lyra UI Test Fixture');
    expect(body.textContent).to.include('This is a tiny fixture document');
  });

  it('preserves allowed paint and inline raster references through the actual SVG viewer', async () => {
    window.fetch = (async () => new Response(passiveSvg)) as typeof fetch;
    const viewer = await fixture<LyraSvgViewer>(html`<lr-svg-viewer src="/passive-document.svg"></lr-svg-viewer>`);
    await waitUntil(() => viewer.shadowRoot!.querySelector('[part="svg"] #shape') !== null, 'passive SVG rendered');
    expectPassiveSvg(viewer.shadowRoot!.querySelector('[part="svg"] svg')!);
  });

  it('reuses only sanitized remote include templates on reconnect while rebasing local anchors', async () => {
    let requests = 0;
    window.fetch = (async () => { requests++; return new Response(`<main><template id="chosen">${passiveLeaf}</template></main>`); }) as typeof fetch;
    const wrapper = await fixture<HTMLDivElement>(html`<div><lr-include>Fallback</lr-include></div>`);
    const viewer = wrapper.querySelector<LyraInclude>('lr-include')!;
    const loaded = oneEvent(viewer, 'lr-load');
    viewer.src = '/passive-reconnect.html#chosen';
    await loaded;
    const check = () => {
      expect(viewer.querySelectorAll('form,input,[style],[part],[exportparts],[src]').length).to.equal(0);
      expect(viewer.querySelector('[data-record-id="42"]')?.textContent).to.equal('Preserved paragraph');
      const heading = viewer.querySelector('h2')!.id;
      expect(heading).not.to.equal('passive-heading');
      expect(viewer.querySelector('a')?.getAttribute('href')).to.equal(`#${heading}`);
    };
    check();
    viewer.remove();
    const reloaded = oneEvent(viewer, 'lr-load');
    wrapper.append(viewer);
    await reloaded;
    check();
    expect(requests).to.equal(1);
  });
});
