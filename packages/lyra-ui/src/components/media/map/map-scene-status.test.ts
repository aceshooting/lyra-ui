import { expect } from '@open-wc/testing';
import { countSceneMembers, summarizeSceneRender } from './map-scene-status.js';
import type { SceneDrawOutcome } from './map-scene-status.js';

const none: SceneDrawOutcome = { state: 'none' };
const pending: SceneDrawOutcome = { state: 'pending' };
const drawn: SceneDrawOutcome = { state: 'drawn' };
const flat: SceneDrawOutcome = { state: 'drawn', approximate: true };
const failed = (code: 'engine' | 'limit' | 'context-lost'): SceneDrawOutcome => ({ state: 'failed', code });

describe('map scene render status', () => {
  it('counts accepted members by renderer', () => {
    expect(countSceneMembers([{ kind: 'marker' }, { kind: 'path' }, { kind: 'arc' }, { kind: 'model' }, { kind: 'marker' }]))
      .to.deep.equal({ markers: 2, lines: 2, models: 1 });
  });

  it('is ready only when every requested member is drawn exactly', () => {
    expect(summarizeSceneRender({ markers: 1, lines: 2, models: 0 }, drawn, drawn)).to.deep.equal({ state: 'ready' });
    expect(summarizeSceneRender({ markers: 1, lines: 0, models: 0 }, drawn, none)).to.deep.equal({ state: 'ready' });
    expect(summarizeSceneRender({ markers: 0, lines: 1, models: 0 }, none, drawn)).to.deep.equal({ state: 'ready' });
  });

  it('loads while any requested renderer is pending', () => {
    expect(summarizeSceneRender({ markers: 1, lines: 1, models: 1 }, pending, drawn)).to.deep.equal({ state: 'loading' });
    expect(summarizeSceneRender({ markers: 1, lines: 1, models: 0 }, failed('engine'), pending)).to.deep.equal({ state: 'loading' });
  });

  it('reports a partial scene with the most significant missing or approximate member code', () => {
    expect(summarizeSceneRender({ markers: 1, lines: 1, models: 0 }, drawn, flat)).to.deep.equal({ state: 'partial', code: 'altitude' });
    expect(summarizeSceneRender({ markers: 1, lines: 1, models: 1 }, drawn, flat)).to.deep.equal({ state: 'partial', code: 'model' });
    expect(summarizeSceneRender({ markers: 1, lines: 1, models: 1 }, failed('limit'), flat)).to.deep.equal({ state: 'partial', code: 'limit' });
    expect(summarizeSceneRender({ markers: 1, lines: 1, models: 1 }, failed('engine'), drawn)).to.deep.equal({ state: 'partial', code: 'engine' });
    expect(summarizeSceneRender({ markers: 1, lines: 1, models: 0 }, failed('engine'), failed('context-lost')))
      .to.deep.equal({ state: 'unavailable', code: 'context-lost' });
  });

  it('is unavailable when no requested member is drawn', () => {
    expect(summarizeSceneRender({ markers: 0, lines: 0, models: 2 }, none, none)).to.deep.equal({ state: 'unavailable', code: 'model' });
    expect(summarizeSceneRender({ markers: 2, lines: 0, models: 1 }, failed('engine'), none)).to.deep.equal({ state: 'unavailable', code: 'engine' });
    // A renderer that reports nothing for requested members never establishes them.
    expect(summarizeSceneRender({ markers: 1, lines: 0, models: 0 }, none, none)).to.deep.equal({ state: 'unavailable', code: 'engine' });
  });

  it('returns frozen results', () => {
    expect(Object.isFrozen(summarizeSceneRender({ markers: 1, lines: 1, models: 1 }, drawn, flat))).to.equal(true);
  });
});
