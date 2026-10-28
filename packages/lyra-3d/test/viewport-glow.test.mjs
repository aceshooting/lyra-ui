import assert from 'node:assert/strict';
import test from 'node:test';
import { createLyra3dViewport } from '../dist/core/viewport.js';
import { installFakeBrowser } from './fake-browser.mjs';

function setup(t, load, options = {}, allocated = true) {
  const browser = installFakeBrowser(), calls = [], lost = [];
  const effects = [];
  const module = { createLyra3dGlow(renderer) {
    const effect = { prepare: () => calls.push(['prepare']), resize: (...args) => calls.push(['resize', ...args]), render: (scene, camera) => { calls.push(['effect']); renderer.render(scene, camera); },
      dispose: () => calls.push(['dispose']) };
    effects.push(effect); return effect;
  } };
  let viewport;
  t.after(() => { try { viewport?.dispose(); } finally { browser.restore(); } });
  viewport = createLyra3dViewport(browser.container, { hover() {}, pick() {}, camera() {},
    lost: reason => lost.push(reason), restored: () => calls.push(['restored']) }, options, {
    loadGlow: () => { calls.push(['load']); return load ? load(module) : Promise.resolve(module); },
  });
  if (allocated) viewport.resize(640,480);
  return { browser, viewport, calls, effects, lost, module };
}

test('default and explicit false keep glow code and targets unloaded', async t => {
  const { viewport, calls, browser } = setup(t);
  assert.equal(typeof viewport.setGlow, 'function');
  await viewport.setGlow(false); viewport.renderNow(); browser.flushFrames();
  assert.deepEqual(calls, []);
});

test('enable lazily loads once, renders through effect and clearing disposes it', async t => {
  const { viewport, calls } = setup(t);
  viewport.resize(640, 480);
  await viewport.setGlow(true); viewport.renderNow();
  assert.equal(calls.filter(call => call[0] === 'load').length, 1);
  assert.equal(calls.filter(call => call[0] === 'effect').length, 1);
  assert.ok(calls.some(call => call[0] === 'resize' && call[1] === 640 && call[2] === 480));
  await viewport.setGlow(false); viewport.renderNow();
  assert.equal(calls.filter(call => call[0] === 'dispose').length, 1);
  assert.equal(calls.filter(call => call[0] === 'effect').length, 1);
});

test('a stale load cannot restore disabled glow or retain an unowned effect', async t => {
  let complete;
  const { viewport, calls } = setup(t, module => new Promise(resolve => { complete = () => resolve(module); }));
  const pending = viewport.setGlow(true);
  const refused = assert.rejects(pending, { name: 'AbortError' });
  await viewport.setGlow(false); complete(); await refused; viewport.renderNow();
  assert.equal(calls.some(call => call[0] === 'effect'), false);
});

test('forced colors disposes glow and preserves static reduced-motion rendering', async t => {
  const { viewport, calls, browser } = setup(t);
  await viewport.setGlow(true);
  viewport.setStyle({ forcedColors: true, reducedMotion: true });
  viewport.renderNow();
  assert.equal(calls.filter(call => call[0] === 'dispose').length, 1);
  assert.equal(calls.filter(call => call[0] === 'effect').length, 0);
  browser.flushFrames(); browser.flushFrames();
  assert.equal(browser.pendingFrames(), 0);
});

test('load rejection is observable and does not prevent the ordinary renderer from being disposed', async t => {
  const { viewport, calls } = setup(t, () => Promise.reject(Error('synthetic module failure')));
  await assert.rejects(viewport.setGlow(true));
  viewport.dispose(); viewport.dispose();
  assert.equal(calls.some(call => call[0] === 'effect'), false);
});

test('context restoration waits for the current enabled effect before announcing ready', async t => {
  let release, loads = 0;
  const { viewport, browser, calls } = setup(t, module => ++loads === 1 ? Promise.resolve(module) : new Promise(resolve => { release = () => resolve(module); }));
  await viewport.setGlow(true); viewport.renderNow(); calls.length = 0;
  const context = viewport.canvas.contexts.at(-1);
  context.state.lose(); viewport.canvas.dispatchEvent(new Event('webglcontextlost'));
  context.state.lost = false; viewport.canvas.dispatchEvent(new Event('webglcontextrestored'));
  assert.equal(calls.some(call => call[0] === 'restored'), false);
  browser.flushFrames();
  assert.equal(calls.some(call => call[0] === 'effect'), false);
  release(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(calls.filter(call => call[0] === 'restored').length, 1);
  browser.flushFrames();
  assert.equal(calls.filter(call => call[0] === 'effect').length, 1);
});

test('restoration validates effect work before success and preparation failure disposes it', async t => {
  let loads=0;
  const f=setup(t,module=>{
    if(++loads===2){const original=module.createLyra3dGlow;module.createLyra3dGlow=renderer=>{const effect=original(renderer);effect.prepare=()=>{f.calls.push(['prepare-failed']);throw Error('synthetic preparation failure');};return effect;};}
    return Promise.resolve(module);
  });
  await f.viewport.setGlow(true);f.calls.length=0;
  const context=f.viewport.canvas.contexts.at(-1);context.state.lose();f.viewport.canvas.dispatchEvent(new Event('webglcontextlost'));
  context.state.lost=false;f.viewport.canvas.dispatchEvent(new Event('webglcontextrestored'));
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
  assert.equal(f.calls.some(call=>call[0]==='restored'),false);
  assert.equal(f.calls.filter(call=>call[0]==='prepare-failed').length,1);
  assert.equal(f.calls.filter(call=>call[0]==='dispose').length,2);
  assert.deepEqual(f.lost,['context-lost','error']);assert.equal(f.viewport.lost,true);
});
test('a failed visible effect releases resources and signals once without host disposal',async t=>{
  const f=setup(t);await f.viewport.setGlow(true);
  f.effects[0].render=()=>{throw Error('synthetic render failure');};
  f.viewport.renderNow();f.viewport.renderNow();f.browser.flushFrames();
  assert.deepEqual(f.lost,['error']);assert.equal(f.calls.filter(call=>call[0]==='dispose').length,1);
});
test('existing effect resize and throwing disposal both fail closed',async t=>{
  const f=setup(t);await f.viewport.setGlow(true);
  f.effects[0].resize=()=>{throw Error('synthetic resize failure');};
  f.effects[0].dispose=()=>{f.calls.push(['dispose']);throw Error('synthetic cleanup failure');};
  await assert.rejects(f.viewport.setGlow(true),/synthetic resize failure/);
  assert.deepEqual(f.lost,['error']);assert.equal(f.viewport.lost,true);
  assert.equal(f.calls.filter(call=>call[0]==='dispose').length,1);
});
test('restore resource callback failure is observable and prevents rendering or success',t=>{
  const original=EventTarget.prototype.addEventListener;let restored;
  EventTarget.prototype.addEventListener=function(type,listener,...args){if(type==='webglcontextrestored')restored=listener;return original.call(this,type,listener,...args);};
  let f;try{f=setup(t,undefined,{onRestore(){throw Error('synthetic restore failure');}});}finally{EventTarget.prototype.addEventListener=original;}
  const context=f.viewport.canvas.contexts.at(-1);context.state.lose();f.viewport.canvas.dispatchEvent(new Event('webglcontextlost'));context.state.lost=false;
  assert.throws(()=>restored.call(f.viewport.canvas,new Event('webglcontextrestored')),/synthetic restore failure/);
  assert.deepEqual(f.lost,['context-lost','error']);assert.equal(f.viewport.lost,true);
  assert.equal(f.calls.some(call=>call[0]==='restored'),false);
});
test('glow remains dormant before positive allocation and releases on owner zero allocation',async t=>{
  const f=setup(t,undefined,{},false);await f.viewport.setGlow(true);assert.deepEqual(f.calls,[]);
  f.viewport.resize(0,480);await Promise.resolve();assert.deepEqual(f.calls,[]);
  f.viewport.resize(640,480);await Promise.resolve();await Promise.resolve();assert.equal(f.calls.filter(call=>call[0]==='load').length,1);
  f.viewport.resize(0,0);await Promise.resolve();assert.equal(f.calls.filter(call=>call[0]==='dispose').length,1);
  f.viewport.resize(640,480);await Promise.resolve();await Promise.resolve();assert.equal(f.calls.filter(call=>call[0]==='load').length,2);
});
