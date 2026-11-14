import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './page-rail.js';
import type { LyraPageRail, LyraPageViewerSnapshot, PageThumbnailRenderHandle, PageThumbnailSource } from './page-rail.js';
import type { LyraVirtualList } from '../../layout/virtual-list/virtual-list.class.js';

interface PendingThumbnail {
  page: number;
  width: number | undefined;
  target: HTMLElement;
  disposals: number;
  finish(): void;
  fail(reject: boolean): void;
}

class ContainerViewer extends EventTarget implements PageThumbnailSource {
  page = 1;
  pageViewerSnapshot: LyraPageViewerSnapshot | undefined = {
    identity: 1, status: 'ready', page: 1, pageCount: 1,
  };
  readonly calls: PendingThumbnail[] = [];

  renderPageThumbnailToContainer(page: number, target: HTMLElement, options?: { width?: number }): Promise<PageThumbnailRenderHandle | false> {
    return new Promise((resolve, reject) => {
      const call: PendingThumbnail = {
        page, width: options?.width, target, disposals: 0,
        finish() {
          const preview = target.ownerDocument.createElement('span');
          preview.textContent = `Preview ${page}`;
          target.append(preview);
          resolve({ dispose() { call.disposals++; preview.remove(); } });
        },
        fail(throws) { if (throws) reject(new Error('Thumbnail decode failed')); else resolve(false); },
      };
      this.calls.push(call);
    });
  }

  publish(snapshot: LyraPageViewerSnapshot): void {
    this.pageViewerSnapshot = snapshot;
    this.dispatchEvent(new CustomEvent('lr-page-viewer-state-change', { detail: { snapshot } }));
  }
}

function listFor(rail: LyraPageRail): LyraVirtualList {
  return rail.shadowRoot!.querySelector('lr-virtual-list')!;
}

async function mount(viewer: ContainerViewer): Promise<LyraPageRail> {
  const rail = await fixture<LyraPageRail>(html`<lr-page-rail style="inline-size:240px" .viewer=${viewer}></lr-page-rail>`);
  await waitUntil(() => viewer.calls.length > 0, 'The initial thumbnail was not requested');
  return rail;
}

describe('page rail container thumbnail ownership', () => {
  for (const change of ['width', 'viewer', 'document', 'loading', 'disconnect'] as const) {
    it(`disposes a late thumbnail once after a ${change} change and keeps its replacement`, async () => {
      const viewer = new ContainerViewer();
      const rail = await mount(viewer);
      const parent = rail.parentElement!;
      const retired = viewer.calls[0]!;
      let currentViewer = viewer;
      if (change === 'width') rail.thumbWidth = 64;
      else if (change === 'viewer') {
        currentViewer = new ContainerViewer();
        rail.viewer = currentViewer;
      } else if (change === 'document') {
        viewer.publish({ identity: 2, status: 'ready', page: 1, pageCount: 1 });
      } else if (change === 'loading') {
        viewer.publish({ identity: 2, status: 'loading', page: 1, pageCount: 0 });
        await rail.updateComplete;
        await listFor(rail).updateComplete;
        expect(listFor(rail).renderedRows.length).to.equal(0);
      } else rail.remove();

      await rail.updateComplete;
      retired.finish();
      await waitUntil(() => retired.disposals === 1, 'The retired thumbnail handle was not disposed');
      expect(retired.target.isConnected).to.equal(false);
      expect(retired.target.textContent).to.equal('');

      if (change === 'loading') viewer.publish({ identity: 2, status: 'ready', page: 1, pageCount: 1 });
      if (change === 'disconnect') parent.append(rail);
      await rail.updateComplete;
      await listFor(rail).updateComplete;
      await waitUntil(() => currentViewer.calls.some(call => call !== retired && call.target.isConnected));
      const current = currentViewer.calls.filter(call => call !== retired && call.target.isConnected).at(-1)!;
      current.finish();
      await waitUntil(() => current.target.isConnected && current.target.textContent === 'Preview 1');
      await rail.updateComplete;
      await listFor(rail).updateComplete;
      expect(listFor(rail).shadowRoot!.querySelectorAll('[part~="thumbnail-target"]').length).to.equal(1);
      expect(listFor(rail).shadowRoot!.textContent).to.include('Preview 1');
      expect(current.disposals).to.equal(0);
      expect(retired.disposals).to.equal(1);
      if (change === 'width') expect(current.width).to.equal(64);
      rail.remove();
      expect(current.disposals).to.equal(1);
      expect(retired.disposals).to.equal(1);
    });
  }

  for (const pending of [false, true]) {
    it(`disposes a ${pending ? 'pending' : 'completed'} thumbnail when its row leaves the virtual window`, async () => {
      const viewer = new ContainerViewer();
      viewer.pageViewerSnapshot = { identity: 1, status: 'ready', page: 1, pageCount: 200 };
      const rail = await mount(viewer);
      const retired = viewer.calls.find(call => call.page === 1)!;
      if (!pending) {
        retired.finish();
        await rail.updateComplete;
        await listFor(rail).updateComplete;
      }
      listFor(rail).scrollToIndex(150, { align: 'start', behavior: 'auto' });
      await waitUntil(() => !retired.target.isConnected && viewer.calls.some(call => call.page === 151));
      if (pending) retired.finish();
      await waitUntil(() => retired.disposals === 1);
      expect(retired.target.textContent).to.equal('');
      const current = viewer.calls.find(call => call.page === 151)!;
      current.finish();
      await waitUntil(() => current.target.isConnected && current.target.textContent === 'Preview 151');
      rail.remove();
      expect(retired.disposals).to.equal(1);
      expect(current.disposals).to.equal(1);
    });
  }

  for (const rejects of [false, true]) {
    it(`keeps the page usable after a container thumbnail ${rejects ? 'rejects' : 'returns false'}`, async () => {
      const viewer = new ContainerViewer();
      const rail = await mount(viewer);
      viewer.calls[0]!.fail(rejects);
      const list = listFor(rail);
      await waitUntil(() => list.shadowRoot!.querySelector('lr-file-icon') !== null);
      expect(list.shadowRoot!.querySelectorAll('[part~="thumbnail-target"]').length).to.equal(0);
      const selected = oneEvent(rail, 'lr-page-select');
      list.shadowRoot!.querySelector<HTMLButtonElement>('[part~="page"]')!.click();
      expect((await selected).detail.page).to.equal(1);
      expect(viewer.page).to.equal(1);
      rail.label = 'Document pages';
      await rail.updateComplete;
      await list.updateComplete;
      expect(viewer.calls.length).to.equal(1);
      viewer.publish({ identity: 2, status: 'ready', page: 1, pageCount: 1 });
      await waitUntil(() => viewer.calls.length === 2);
      viewer.calls[1]!.finish();
      await waitUntil(() => list.shadowRoot!.textContent!.includes('Preview 1'));
      expect(list.shadowRoot!.querySelectorAll('lr-file-icon').length).to.equal(0);
    });
  }

  it('restores the default thumbnail width when its attribute is removed', async () => {
    const viewer = new ContainerViewer();
    const rail = await mount(viewer);
    rail.setAttribute('thumb-width', '64');
    await waitUntil(() => viewer.calls.some(call => call.width === 64));
    const narrow = viewer.calls.find(call => call.width === 64)!;
    narrow.finish();
    await rail.updateComplete;
    rail.removeAttribute('thumb-width');
    await waitUntil(() => narrow.disposals === 1 && viewer.calls.at(-1)!.width === 96);
    const current = viewer.calls.at(-1)!;
    current.finish();
    await waitUntil(() => current.target.isConnected && current.target.textContent === 'Preview 1');
    expect(rail.hasAttribute('thumb-width')).to.equal(false);
    expect(current.width).to.equal(96);
  });

  it('accepts event snapshots when the source no longer exposes a current snapshot', async () => {
    const viewer = new ContainerViewer();
    const rail = await mount(viewer);
    viewer.pageViewerSnapshot = undefined;
    viewer.dispatchEvent(new CustomEvent('lr-page-viewer-state-change', {
      detail: { snapshot: { identity: 2, status: 'ready', page: 2, pageCount: 3 } },
    }));
    await rail.updateComplete;
    await listFor(rail).updateComplete;
    expect(rail.page).to.equal(2);
    expect(listFor(rail).renderedRows.length).to.equal(3);
    viewer.dispatchEvent(new Event('lr-page-viewer-state-change'));
    await rail.updateComplete;
    expect(rail.page).to.equal(2);
    expect(listFor(rail).renderedRows.length).to.equal(3);
  });

  it('prefers the current source snapshot over a delayed event from an older document', async () => {
    const viewer = new ContainerViewer();
    const rail = await mount(viewer);
    viewer.publish({ identity: 2, status: 'ready', page: 2, pageCount: 3 });
    await rail.updateComplete;
    await listFor(rail).updateComplete;
    const requests = viewer.calls.length;
    viewer.dispatchEvent(new CustomEvent('lr-page-viewer-state-change', {
      detail: { snapshot: { identity: 1, status: 'error', page: 1, pageCount: 0 } },
    }));
    await rail.updateComplete;
    await listFor(rail).updateComplete;
    expect(rail.page).to.equal(2);
    expect(listFor(rail).renderedRows.length).to.equal(3);
    expect(viewer.calls.length).to.equal(requests);
  });
});
