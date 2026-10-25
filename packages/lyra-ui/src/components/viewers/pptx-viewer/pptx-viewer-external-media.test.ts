import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import JSZip from 'jszip';
import './pptx-viewer.js';
import type { LyraPptxViewer } from './pptx-viewer.js';
import { loadPptxRenderer, type PptxViewerApi } from './pptx-loader.js';
import { twoFrames } from '../../../../test/frames.js';

const DRAWING = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const PRESENTATION = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const OFFICE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PACKAGE_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const SLIDE_COUNT = 40;
const IMAGE_SINKS = ['image', 'background', 'shape-fill', 'text-fill', 'video-poster', 'audio-poster'] as const;
type RenderPath = 'initial' | 'navigation' | 'thumbnail';

function relationship(id: string, kind: string, target: string, external = false): string {
  return `<Relationship Id="${id}" Type="${OFFICE_REL}/${kind}" Target="${target}"${external ? ' TargetMode="External"' : ''}/>`;
}
function relationships(content: string): string {
  return `<Relationships xmlns="${PACKAGE_REL}">${content}</Relationships>`;
}
function transform(x: number, y = 914400): string {
  return `<a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="914400" cy="914400"/></a:xfrm>`;
}
function fill(id: string): string {
  return `<a:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></a:blipFill>`;
}
function picture(id: number, reference: string, x: number, media?: 'audio' | 'video'): string {
  const mediaReference = media ? `<a:${media}File r:link="${media}"/>` : '';
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Picture ${id}"/><p:cNvPicPr/><p:nvPr>${mediaReference}</p:nvPr></p:nvPicPr><p:blipFill><a:blip r:embed="${reference}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${transform(x)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}
function shape(id: number, paint: string, text: string, textPaint = ''): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Shape ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>${transform(914400, id * 250000)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${paint}</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="1800">${textPaint}</a:rPr><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`;
}

/** External means outside the package: all network targets stay on this test server. */
async function presentation(targetSlide: number, marker: string): Promise<ArrayBuffer> {
  const zip = new JSZip();
  const imageUrl = new URL('./fixtures/media-positive.png', import.meta.url);
  const imageResponse = await fetch(imageUrl);
  expect(imageResponse.ok).to.equal(true);
  zip.file('ppt/media/positive.png', await imageResponse.arrayBuffer());
  const target = (kind: string): string => {
    const url = new URL(imageUrl);
    url.search = `?pptx-media=${marker}-${kind}`;
    return url.href;
  };
  zip.file('_rels/.rels', relationships(relationship('presentation', 'officeDocument', 'ppt/presentation.xml')));
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' + Array.from({ length: SLIDE_COUNT }, (_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('') + '</Types>');
  zip.file('ppt/presentation.xml', `<p:presentation xmlns:p="${PRESENTATION}" xmlns:a="${DRAWING}" xmlns:r="${OFFICE_REL}"><p:sldIdLst>` + Array.from({ length: SLIDE_COUNT }, (_, i) => `<p:sldId id="${256 + i}" r:id="slide${i + 1}"/>`).join('') + '</p:sldIdLst><p:sldSz cx="9144000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>');
  zip.file('ppt/_rels/presentation.xml.rels', relationships(Array.from({ length: SLIDE_COUNT }, (_, i) => relationship(`slide${i + 1}`, 'slide', `slides/slide${i + 1}.xml`)).join('')));
  for (let page = 1; page <= SLIDE_COUNT; page++) {
    const external = page === targetSlide;
    const background = external ? `<p:bg><p:bgPr>${fill('background')}<a:effectLst/></p:bgPr></p:bg>` : '';
    const content = picture(2, 'embedded', 914400) + shape(3, '', `Slide ${page}`) + (external
      ? picture(4, 'image', 2743200) + shape(5, fill('shape-fill'), '') + shape(6, '', 'Picture fill', fill('text-fill')) + picture(7, 'video-poster', 4572000, 'video') + picture(8, 'audio-poster', 6400800, 'audio')
      : '');
    zip.file(`ppt/slides/slide${page}.xml`, `<p:sld xmlns:p="${PRESENTATION}" xmlns:a="${DRAWING}" xmlns:r="${OFFICE_REL}"><p:cSld>${background}<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${content}</p:spTree></p:cSld></p:sld>`);
    zip.file(`ppt/slides/_rels/slide${page}.xml.rels`, relationships(relationship('embedded', 'image', '../media/positive.png') + (external
      ? IMAGE_SINKS.map(kind => relationship(kind, 'image', target(kind), true)).join('') + relationship('video', 'video', target('video'), true) + relationship('audio', 'audio', target('audio'), true)
      : '')));
  }
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
}

function observeRequests(marker: string): { names: string[]; disconnect(): void } {
  const names: string[] = [];
  const observer = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) if (entry.name.includes(`pptx-media=${marker}-`)) names.push(entry.name);
  });
  observer.observe({ entryTypes: ['resource'] });
  return { names, disconnect: () => observer.disconnect() };
}

function externalMediaBindings(root: ParentNode, marker: string): string[] {
  return [...root.querySelectorAll('*')].flatMap(element => ['src', 'poster', 'style', 'href', 'xlink:href']
    .map(name => element.getAttribute(name) ?? '')
    .filter(value => value.includes(`pptx-media=${marker}-`)));
}

async function embeddedImageRendered(root: ParentNode): Promise<void> {
  await waitUntil(() => [...root.querySelectorAll('img')].some(image => image.src.startsWith('blob:') && image.complete && image.naturalWidth === 2), 'the embedded image must decode', { timeout: 10_000 });
}

async function assertTargetNotRendered(root: ParentNode & Node, page: number, marker: string, requests: string[]): Promise<void> {
  await embeddedImageRendered(root);
  await settleMedia();
  expect(root.textContent?.includes(`Slide ${page}`), 'the target slide must remain outside the initial window').to.equal(false);
  expect(requests, 'target media must not be requested before the action').to.deep.equal([]);
  expect(externalMediaBindings(root, marker), 'target media must not be bound before the action').to.deep.equal([]);
}

async function settleMedia(): Promise<void> {
  await twoFrames();
  // wait-reason: give browser-created image/CSS requests and resource observers a complete task turn with margin.
  await aTimeout(500);
}

for (const path of ['initial', 'navigation', 'thumbnail'] satisfies RenderPath[]) {
  const page = path === 'initial' ? 1 : path === 'navigation' ? 21 : 40;
  describe(`lr-pptx-viewer external media during ${path}`, () => {
    it('observes real-peer allowed images, picture fills and posters on the local server', async function () {
      this.timeout(60_000);
      const marker = crypto.randomUUID();
      const observation = observeRequests(marker);
      const container = await fixture<HTMLDivElement>(html`<div style="width:720px;height:480px;overflow:auto"></div>`);
      const preview = document.createElement('div');
      document.body.append(preview);
      let viewer: PptxViewerApi | undefined;
      let thumbnail: ReturnType<PptxViewerApi['renderThumbnailToContainer']> = null;
      try {
        const module = await loadPptxRenderer();
        expect(module !== null).to.equal(true);
        viewer = await module!.PptxViewer.open(await presentation(page, marker), container, {
          externalMedia: 'allow', zipLimits: module!.RECOMMENDED_ZIP_LIMITS, listOptions: { windowed: true },
        });
        if (path !== 'initial') await assertTargetNotRendered(container, page, marker, observation.names);
        if (path === 'navigation') await viewer.goToSlide(page - 1);
        if (path === 'thumbnail') {
          thumbnail = viewer.renderThumbnailToContainer(page - 1, preview, { width: 240 });
          expect(thumbnail !== null).to.equal(true);
          await thumbnail!.ready;
        }
        const rendered = path === 'thumbnail' ? preview : container;
        await embeddedImageRendered(rendered);
        await waitUntil(() => rendered.textContent?.includes(`Slide ${page}`) === true, 'the requested slide must render');
        // Media is deliberately not played: this proves URL policy, not PNG audio/video decoding.
        for (const kind of ['audio', 'video']) {
          const mediaUrl = rendered.querySelector(kind)?.getAttribute('src') ?? '';
          expect(mediaUrl.endsWith(`=${marker}-${kind}`), `the allow control must retain the ${kind} URL`).to.equal(true);
        }
        await waitUntil(() => IMAGE_SINKS.every(kind => observation.names.some(name => name.endsWith(`=${marker}-${kind}`))), 'the allow control must request every image, picture fill and poster', { timeout: 10_000 });
        expect(externalMediaBindings(rendered, marker).length).to.be.greaterThan(0);
      } finally {
        thumbnail?.dispose();
        viewer?.destroy();
        preview.remove();
        observation.disconnect();
      }
    });

    it('blocks package-external media without losing embedded images', async function () {
      this.timeout(60_000);
      const marker = crypto.randomUUID();
      const bytes = await presentation(page, marker);
      const url = URL.createObjectURL(new Blob([bytes]));
      const observation = observeRequests(marker);
      const el = await fixture<LyraPptxViewer>(html`<lr-pptx-viewer max-height="480px" style="width:720px"></lr-pptx-viewer>`);
      const preview = document.createElement('div');
      document.body.append(preview);
      let thumbnail: Awaited<ReturnType<LyraPptxViewer['renderPageThumbnailToContainer']>> = false;
      try {
        const loaded = oneEvent(el, 'lr-load');
        el.src = url;
        await loaded;
        if (path !== 'initial') await assertTargetNotRendered(el.shadowRoot!, page, marker, observation.names);
        if (path === 'navigation') await el.goToSlide(page - 1);
        if (path === 'thumbnail') {
          thumbnail = await el.renderPageThumbnailToContainer(page, preview, { width: 240 });
          expect(thumbnail !== false).to.equal(true);
        }
        const rendered = path === 'thumbnail' ? preview : el.shadowRoot!;
        await embeddedImageRendered(rendered);
        await waitUntil(() => rendered.textContent?.includes(`Slide ${page}`) === true, 'the requested slide must render');
        await settleMedia();
        expect(observation.names, 'package-external media requests').to.deep.equal([]);
        expect(externalMediaBindings(rendered, marker), 'no pending external media URL may remain in the DOM').to.deep.equal([]);
      } finally {
        if (thumbnail) thumbnail.dispose();
        el.remove();
        preview.remove();
        observation.disconnect();
        URL.revokeObjectURL(url);
        await twoFrames();
      }
    });
  });
}
