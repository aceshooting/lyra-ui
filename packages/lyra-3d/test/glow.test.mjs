import assert from 'node:assert/strict';
import test from 'node:test';
import { Color, PerspectiveCamera, Scene, Vector4 } from 'three';
import { createLyra3dGlow, glowTargetSize } from '../dist/core/glow.js';

function renderer() {
  const calls = [], color = new Color('#123456'), viewport = new Vector4(3, 4, 640, 480), scissor = new Vector4(5, 6, 100, 200);
  const state = { target: null, alpha: 0.75, test: true, outputColorSpace: 'srgb', toneMapping: 0 };
  const value = { info: { programs: [{ program: {} }] }, getContext: () => ({ FRAMEBUFFER: 1, FRAMEBUFFER_COMPLETE: 2, LINK_STATUS: 3, checkFramebufferStatus: () => 2, getProgramParameter: () => { calls.push(['link']); return value.linkValid !== false; } }), autoClear: true, autoClearColor: true, autoClearDepth: true, autoClearStencil: false,
    get outputColorSpace() { return state.outputColorSpace; }, set outputColorSpace(next) { state.outputColorSpace = next; },
    get toneMapping() { return state.toneMapping; }, set toneMapping(next) { state.toneMapping = next; },
    getRenderTarget: () => state.target, setRenderTarget: target => { state.target = target; calls.push(['target', target]); },
    getClearColor: output => output.copy(color), getClearAlpha: () => state.alpha,
    setClearColor(next, alpha) { color.set(next); state.alpha = alpha; calls.push(['color', color.getHex(), alpha]); },
    getViewport: output => output.copy(viewport), setViewport: (...args) => { args.length === 1 ? viewport.copy(args[0]) : viewport.set(...args); },
    getScissor: output => output.copy(scissor), setScissor: (...args) => { args.length === 1 ? scissor.copy(args[0]) : scissor.set(...args); },
    getScissorTest: () => state.test, setScissorTest: next => { state.test = next; },
    clear: (...args) => calls.push(['clear', state.target, state.alpha, ...args, state.test]),
    compile: (scene, camera) => calls.push(['compile',scene,camera,state.target]),
    render(scene, camera) { calls.push(['render', scene, camera, state.target, this.autoClear,scene.children[0]?.material]); if (value.fail === calls.filter(call => call[0] === 'render').length) throw Error('synthetic render failure'); },
  };
  return { value, calls, state, color, viewport, scissor };
}

test('halo targets preserve aspect, half-resolution and all physical storage bounds', () => {
  assert.deepEqual(glowTargetSize(640, 480, 1), { width: 320, height: 240 });
  for (const [width, height, dpr] of [[8192, 8192, 4], [100000, 20, 4], [20, 100000, 4], [1, 1, 1]]) {
    const size = glowTargetSize(width, height, dpr);
    assert.ok(size.width >= 1 && size.height >= 1 && size.width <= 2048 && size.height <= 2048);
    assert.ok(size.width * size.height <= 1_048_576);
  }
  for (const args of [[NaN, 10, 1], [10, Infinity, 1], [10, 10, 0]]) assert.throws(() => glowTargetSize(...args), RangeError);
});

test('capture and blur precede one themed clear, then halo and base with auto-clear disabled', () => {
  const record = renderer(), scene = new Scene(), camera = new PerspectiveCamera(), effect = createLyra3dGlow(record.value);
  effect.resize(640, 480, 1); effect.render(scene, camera);
  const renders = record.calls.filter(call => call[0] === 'render');
  assert.equal(renders.length, 5);
  assert.equal(renders[0][1], scene); assert.notEqual(renders[0][3], null);
  assert.equal(renders[3][3], null); assert.equal(renders[4][1], scene); assert.equal(renders[4][3], null); assert.equal(renders[4][4], false);
  const mainClears = record.calls.filter(call => call[0] === 'clear' && call[1] === null);
  assert.equal(mainClears.length, 1); assert.equal(mainClears[0][2], 0.75);
  assert.equal(record.state.target, null); assert.equal(record.state.alpha, 0.75);
  assert.equal(record.color.getHex(), 0x123456); assert.equal(record.value.autoClear, true);
  assert.deepEqual(record.viewport.toArray(), [3, 4, 640, 480]); assert.deepEqual(record.scissor.toArray(), [5, 6, 100, 200]); assert.equal(record.state.test, true);
  assert.ok(effect.storageBytes <= 16 * 1024 * 1024); effect.dispose(); effect.dispose();
});

test('every failing pass restores borrowed target, clear, conversion and scissor state', () => {
  for (let failure = 1; failure <= 5; failure++) {
    const record = renderer(), effect = createLyra3dGlow(record.value);
    effect.resize(640, 480, 1); record.value.fail = failure;
    assert.throws(() => effect.render(new Scene(), new PerspectiveCamera()));
    assert.equal(record.state.target, null); assert.equal(record.state.alpha, 0.75); assert.equal(record.color.getHex(), 0x123456);
    assert.equal(record.value.autoClear, true); assert.equal(record.state.outputColorSpace, 'srgb'); assert.equal(record.state.test, true);
    effect.dispose();
  }
});

test('readiness exercises all passes offscreen and compiles direct-output programs',()=>{
  const r=renderer(),effect=createLyra3dGlow(r.value),scene=new Scene(),camera=new PerspectiveCamera();effect.resize(640,480,1);
  effect.prepare(scene,camera);
  const draws=r.calls.filter(call=>call[0]==='render');assert.equal(draws.length,5);assert.ok(draws.every(call=>call[3]!==null));
  assert.ok(r.calls.some(call=>call[0]==='compile'&&call[3]===null));assert.ok(r.calls.some(call=>call[0]==='link'));assert.equal(r.state.target,null);assert.equal(r.state.test,true);effect.dispose();
});
test('the themed background clear covers the full canvas before restoring drawing scissor',()=>{
  const r=renderer(),effect=createLyra3dGlow(r.value);effect.resize(640,480,1);effect.render(new Scene(),new PerspectiveCamera());
  const clear=r.calls.find(call=>call[0]==='clear'&&call[1]===null);assert.equal(clear[6],false);assert.equal(r.state.test,true);effect.dispose();
});
test('one throwing target disposer does not skip any independently owned resource',()=>{
  const r=renderer(),effect=createLyra3dGlow(r.value);effect.resize(640,480,1);effect.render(new Scene(),new PerspectiveCamera());
  const targets=[...new Set(r.calls.filter(call=>call[0]==='target'&&call[1]).map(call=>call[1]))];
  const scenes=r.calls.filter(call=>call[0]==='render').map(call=>call[1]);
  const fullscreen=scenes.find(scene=>scene.children[0]?.isMesh);
  const materials=[...new Set(r.calls.filter(call=>call[0]==='render'&&call[5]).map(call=>call[5]))];
  const resources=[...targets,fullscreen.children[0].geometry,...materials],disposed=[];
  resources.forEach((resource,index)=>resource.addEventListener('dispose',()=>{disposed.push(index);if(index===0)throw Error('synthetic dispose failure');}));
  assert.throws(()=>effect.dispose(),/synthetic dispose failure/);assert.equal(disposed.length,resources.length);assert.equal(effect.storageBytes,0);effect.dispose();
});
test('readiness rejects unsuccessful native direct-output program linkage',()=>{
  const r=renderer(),effect=createLyra3dGlow(r.value);effect.resize(640,480,1);r.value.linkValid=false;
  assert.throws(()=>effect.prepare(new Scene(),new PerspectiveCamera()),/compilation|link/i);assert.equal(r.state.target,null);assert.equal(r.state.test,true);effect.dispose();
});
test('shader failure callbacks let renderer internals unwind before the effect rejects',()=>{
  for(const stage of ['render','compile']){
    const r=renderer(),effect=createLyra3dGlow(r.value),previous=()=>{};
    r.value.debug={checkShaderErrors:false,onShaderError:previous};
    const operation=r.value[stage];let returned=false,invoked=false;
    r.value[stage]=function(...args){operation.apply(this,args);if(!invoked){invoked=true;this.debug.onShaderError();returned=true;}};
    effect.resize(640,480,1);
    assert.throws(()=>stage==='render'?effect.render(new Scene(),new PerspectiveCamera()):effect.prepare(new Scene(),new PerspectiveCamera()),/compilation|shader/i);
    assert.equal(returned,true,'the renderer finishes its own operation before the effect throws');
    assert.equal(r.value.debug.checkShaderErrors,false);assert.equal(r.value.debug.onShaderError,previous);assert.equal(r.state.target,null);effect.dispose();
  }
});
test('a borrowed shader-error callback remains observable after renderer unwinding',()=>{
  const r=renderer(),effect=createLyra3dGlow(r.value);let returned=false,observed=false;
  const previous=()=>{observed=true;assert.equal(returned,true);throw Error('external shader observer');};
  r.value.debug={checkShaderErrors:true,onShaderError:previous};
  const original=r.value.render;r.value.render=function(...args){original.apply(this,args);this.debug.onShaderError();returned=true;};
  effect.resize(640,480,1);
  assert.throws(()=>effect.render(new Scene(),new PerspectiveCamera()),/external shader observer/);
  assert.equal(observed,true);assert.equal(r.value.debug.onShaderError,previous);assert.equal(r.state.target,null);effect.dispose();
});
