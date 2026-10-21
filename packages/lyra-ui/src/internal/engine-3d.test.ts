import { expect } from '@open-wc/testing';
import {
  ENGINE_3D_DEFAULT_STRINGS,
  ENGINE_3D_PREFERENCE,
  Engine3dSelection,
  engine3dFailureReason,
  engine3dFallbackNotice,
  webgl2Available,
  type Engine3dFallbackDetail,
  type Engine3dFallbackReason,
  type Engine3dMessageKey,
  type Engine3dPreference,
  type Engine3dRenderer,
} from './engine-3d.js';
import { resolveLyraString } from './localization-runtime.js';
import '../translations/fr/shared.js';

describe('engine-3d', () => {
  it('normalizes the engine preference from attributes, reflection and direct writes', () => {
    expect(ENGINE_3D_PREFERENCE.fromAttribute?.('webgl', String)).to.equal('webgl');
    expect(ENGINE_3D_PREFERENCE.fromAttribute?.('WebGL', String)).to.equal('builtin');
    expect(ENGINE_3D_PREFERENCE.fromAttribute?.(null, String)).to.equal('builtin');
    // An untyped caller can reflect any string; the converter still writes a member.
    const untyped: unknown = 'canvas';
    expect(ENGINE_3D_PREFERENCE.toAttribute?.(untyped as Engine3dPreference, String)).to.equal('builtin');
    expect(ENGINE_3D_PREFERENCE.normalize('webgl')).to.equal('webgl');
    expect(ENGINE_3D_PREFERENCE.normalize(1)).to.equal('builtin');
    const host = document.createElement('div');
    host.setAttribute('engine', 'gpu');
    expect(ENGINE_3D_PREFERENCE.normalizeReflected(host, 'engine', 'gpu')).to.equal('builtin');
    expect(host.getAttribute('engine')).to.equal('builtin');
  });

  it('switches live and steps down the fallback chain one renderer at a time', () => {
    const selection = new Engine3dSelection(true);
    expect([selection.preference, selection.renderer]).to.deep.equal(['builtin', 'builtin']);
    expect(selection.prefer('webgl')).to.equal(true);
    expect(selection.renderer).to.equal('webgl');
    expect(selection.prefer('webgl')).to.equal(false);
    expect(selection.fail('context-lost')).to.deep.equal({ from: 'webgl', to: 'builtin', reason: 'context-lost' });
    expect(selection.restore()).to.equal(true);
    expect(selection.renderer).to.equal('webgl');
    expect(selection.fail('unavailable')).to.deep.equal({ from: 'webgl', to: 'builtin', reason: 'unavailable' });
    expect(selection.fail('error')).to.deep.equal({ from: 'builtin', to: 'list', reason: 'error' });
    expect(selection.fail('error')).to.equal(null);
    expect(selection.prefer('builtin')).to.equal(true);
    expect(selection.renderer).to.equal('builtin');
    expect(selection.restore()).to.equal(false, 'restoring never overrides a built-in preference');
    expect(selection.prefer('webgl')).to.equal(true, 'a fresh preference write retries WebGL');
  });

  it('skips the built-in step for elements that have none', () => {
    const selection = new Engine3dSelection(false);
    expect(selection.renderer).to.equal('list');
    selection.prefer('webgl');
    expect(selection.fail('unsupported')).to.deep.equal({ from: 'webgl', to: 'list', reason: 'unsupported' });
    expect(selection.prefer('unknown')).to.equal(false);
    expect(selection.preference).to.equal('builtin');
  });

  it('names a notice key for every fallback reason and destination', () => {
    const reasons: Engine3dFallbackReason[] = ['unavailable', 'unsupported', 'context-lost', 'error'];
    const destinations: Engine3dRenderer[] = ['builtin', 'list'];
    const keys = new Set<Engine3dMessageKey>();
    for (const reason of reasons) {
      for (const to of destinations) {
        const detail: Engine3dFallbackDetail = { from: 'webgl', to, reason };
        const notice = engine3dFallbackNotice(detail);
        keys.add(notice.reason).add(notice.showing);
      }
    }
    const preference: Engine3dPreference = 'webgl';
    expect([...keys].every((key) => typeof ENGINE_3D_DEFAULT_STRINGS[key] === 'string')).to.equal(true);
    expect(keys.size).to.equal(6);
    expect(preference).to.equal('webgl');
  });

  it('maps mount failures and fallback steps to notice keys', () => {
    expect(engine3dFailureReason({ code: 'webgl-unavailable', name: 'Lyra3dUnsupportedError' })).to.equal('unsupported');
    expect(engine3dFailureReason(new Error('shader compile failed'))).to.equal('error');
    expect(engine3dFailureReason(undefined)).to.equal('error');
    expect(engine3dFallbackNotice({ from: 'webgl', to: 'builtin', reason: 'context-lost' }))
      .to.deep.equal({ reason: 'engine3dContextLost', showing: 'engine3dShowingBuiltin' });
    expect(engine3dFallbackNotice({ from: 'builtin', to: 'list', reason: 'unavailable' }))
      .to.deep.equal({ reason: 'engine3dUnavailable', showing: 'engine3dShowingList' });
  });

  it('resolves notices in English without a locale, from overrides, and from a registered catalog', () => {
    const host = document.createElement('div');
    document.body.append(host);
    try {
      expect(resolveLyraString(host, 'engine3dContextLost', undefined, undefined, undefined, ENGINE_3D_DEFAULT_STRINGS))
        .to.equal('The 3D view lost its graphics context.');
      expect(resolveLyraString(host, 'engine3dShowingList', { engine3dShowingList: 'Liste' }, undefined, undefined, ENGINE_3D_DEFAULT_STRINGS))
        .to.equal('Liste');
      host.lang = 'fr';
      const french = resolveLyraString(host, 'engine3dUnsupported', undefined, undefined, undefined, ENGINE_3D_DEFAULT_STRINGS);
      expect(french.length > 0 && french !== ENGINE_3D_DEFAULT_STRINGS.engine3dUnsupported).to.equal(true);
    } finally {
      host.remove();
    }
  });

  it('probes WebGL2 without keeping a context and survives a throwing canvas', () => {
    let released = 0;
    const fakeCanvas = (context: unknown) => () => ({
      getContext: () => context,
    }) as unknown as HTMLCanvasElement;
    const context = { getExtension: () => ({ loseContext: () => { released += 1; } }) };
    expect(webgl2Available(fakeCanvas(context))).to.equal(true);
    expect(released).to.equal(1);
    expect(webgl2Available(fakeCanvas(null))).to.equal(false);
    expect(webgl2Available(() => { throw new Error('blocked'); })).to.equal(false);
    expect(typeof webgl2Available()).to.equal('boolean');
  });
});
