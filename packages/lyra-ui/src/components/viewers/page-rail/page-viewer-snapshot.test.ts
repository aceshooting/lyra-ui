import { expect } from '@open-wc/testing';
import { PageViewerSnapshotController } from './page-viewer-snapshot.js';

describe('PageViewerSnapshotController', () => {
  it('keeps atomic identity across ready pages and bumps it for replacement loads', () => {
    const state = new PageViewerSnapshotController();
    expect(state.value).to.deep.equal({ identity: 0, status: 'idle', page: 1, pageCount: 0 });
    state.advance();
    const ready = state.publish('ready', 2, 4);
    expect(ready).to.deep.equal({ identity: 1, status: 'ready', page: 2, pageCount: 4 });
    expect(state.publish('ready', 2, 4)).to.equal(null);
    const nextPage = state.publish('ready', 3, 4);
    expect(nextPage?.identity).to.equal(1);
    expect(nextPage?.page).to.equal(3);
    state.reset();
    expect(state.value).to.deep.equal({ identity: 2, status: 'idle', page: 1, pageCount: 0 });
    expect(state.publish('loading', 99, 99)).to.deep.equal({
      identity: 2, status: 'loading', page: 1, pageCount: 0,
    });
  });
});
