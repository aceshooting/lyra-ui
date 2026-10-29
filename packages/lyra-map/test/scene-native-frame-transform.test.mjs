import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createScratchPackage } from '../scripts/scratch-package.mjs';
import { relocateUpstream } from './relocated-upstream.mjs';
import { upstreamRoot } from './pinned-upstream.mjs';
import { loadTransformedNative, nativePaintFixture, nativeSources, nativeFrameSourcesMatch, newPlugin,
  sourcePaths, sourceHashes } from './fixtures/scene-native-frame-build.mjs';

const unavailable = { name: 'TypeError', message: 'Native frame authority unavailable.' };
const completed = (item, capture) => item.registry.readNativeFrameAuthority(capture.authority, item.gl, 'completed');
const queryCount = item => item.gpu.calls.filter(call => call[0] === 'createQuery').length;

test('actual transformed painter begins before native work and constructs no phase facts without demand', async () => {
  const native = await loadTransformedNative(), item = nativePaintFixture(native);
  assert.equal(item.registry.hasNativeFrameDemand(item.gl), false);
  const transportBefore = { ...native.transport };
  item.render(); assert.equal(item.captures.at(-1).status, 'unqualified');
  assert.equal(item.projectionReads, 0); assert.equal(queryCount(item), 0);
  const unchanged = await loadTransformedNative({ enabled: false }), baseline = nativePaintFixture(unchanged); baseline.render();
  assert.deepEqual(native.phaseReads, unchanged.phaseReads, 'dormant hooks do not read extra pass/layer facts');
  assert.deepEqual(item.layerReads, baseline.layerReads, 'dormant hooks do not collect ordered layer facts');
  assert.deepEqual(native.transport, transportBefore, 'dormant hooks allocate/write no frame transport');
  for (const name of ['beginNativeFrame', 'enterNativeCustomRender', 'registerNativeFrameDemand']) assert.equal(native.calls.get(name) ?? 0, 0, name);
  const release = item.enroll();
  try {
    const before = item.events.length; item.render(); const current = item.captures.at(-1);
    assert.equal(current.status, 'admitted'); assert.ok(completed(item, current)); assert.ok(item.projectionReads > 0);
    const sequence = item.events.slice(before);
    assert.ok(sequence.indexOf('beginNativeFrame') >= 0);
    assert.ok(sequence.indexOf('beginNativeFrame') < sequence.indexOf('uniform'));
    assert.ok(sequence.indexOf('beginNativeFrame') < sequence.indexOf('depth'));
    let checked = false;
    item.hooks.work = () => { checked = true; assert.throws(() => completed(item, current), unavailable); };
    item.render(); assert.equal(checked, true); item.hooks.work = undefined;
    release(); const facts = item.projectionReads, begins = native.calls.get('beginNativeFrame');
    const afterReleaseTransport = { ...native.transport }, afterReleaseReads = { ...item.layerReads }; item.render();
    assert.equal(item.projectionReads, facts); assert.equal(native.calls.get('beginNativeFrame'), begins);
    assert.equal(item.captures.at(-1).status, 'unqualified'); assert.equal(queryCount(item), 0);
    assert.deepEqual(native.transport, afterReleaseTransport);
    assert.deepEqual({ id: item.layerReads.id - afterReleaseReads.id, type: item.layerReads.type - afterReleaseReads.type }, baseline.layerReads);
  } finally { release(); }
});

test('actual transformed custom callbacks preserve original receiver arguments and branch control flow', async () => {
  const native = await loadTransformedNative(), item = nativePaintFixture(native);
  item.render(); assert.equal(item.renderingReads, 1, 'dormant native method lookup remains singular');
  const release = item.enroll();
  try {
    item.setOffscreen(true); let prerendered = 0;
    item.setRenderResult(Object.defineProperty({}, 'then', { get() { return assert.fail('native render return must not be inspected'); } }));
    item.hooks.prerender = () => { prerendered++;
      assert.notEqual(item.registry.captureNativeFrameAuthority(item.gl, item.implementation, item.originalRender, {}).status, 'admitted'); };
    const offset = item.events.length, reads = item.renderingReads, entries = native.calls.get('enterNativeCustomRender') ?? 0; item.render();
    const capture = item.captures.at(-1), args = item.renderInputs.at(-1);
    assert.equal(prerendered, 1); assert.equal(item.renderingReads - reads, 1);
    assert.equal((native.calls.get('enterNativeCustomRender') ?? 0) - entries, 1, 'only the translucent original render receives a scope');
    assert.equal(item.renderReceivers.at(-1), item.implementation); assert.equal(capture.status, 'admitted');
    item.registry.assertNativeFrameCompletedAuthority(capture.authority, item.gl, item.implementation, item.originalRender, args);
    assert.throws(() => item.registry.assertNativeFrameCompletedAuthority(capture.authority, item.gl, item.implementation,
      item.originalRender, { ...args }), unavailable);
    assert.notEqual(item.registry.captureNativeFrameAuthority(item.gl, item.implementation, item.originalRender, args).status, 'admitted');
    const sequence = item.events.slice(offset), render = sequence.indexOf('render');
    assert.ok(sequence.indexOf('prerender') < render);
    assert.ok(sequence.indexOf('leaveNativeCustomRender', render) < sequence.indexOf('dirty', render));
    assert.ok(sequence.indexOf('dirty', render) < sequence.indexOf('base', render));
    assert.ok(sequence.indexOf('base', render) < sequence.indexOf('framebuffer', render));
    assert.equal(sequence.slice(render).filter(value => value === 'framebuffer').length, 1);
    item.setOffscreen(false); item.setTile(true);
    const scopes = native.calls.get('enterNativeCustomRender') ?? 0; let tiles = 0;
    item.hooks.tile = () => { tiles++;
      assert.notEqual(item.registry.captureNativeFrameAuthority(item.gl, item.implementation, item.originalRender, {}).status, 'admitted'); };
    item.render(); assert.ok(tiles > 0); assert.equal(native.calls.get('enterNativeCustomRender') ?? 0, scopes);
  } finally { release(); }
});

test('completed authority seals only after actual painter tail and successful native reset return', async () => {
  const native = await loadTransformedNative(), item = nativePaintFixture(native), release = item.enroll();
  let inside, resetChecked = false;
  try {
    item.hooks.render = capture => { inside = capture; assert.equal(capture.status, 'admitted');
      assert.throws(() => completed(item, capture), unavailable); };
    item.hooks.reset = () => { resetChecked = true; assert.throws(() => completed(item, inside), unavailable);
      for (const event of [{ type: 'render' }, { ...inside }, { ...inside.authority }]) assert.equal(item.registry.sealNativeFrame(event), false); };
    item.render(); assert.equal(resetChecked, true);
    const facts = completed(item, inside);
    assert.deepEqual(facts.phase, { pass: 'translucent', currentLayer: 0 });
    assert.deepEqual(facts.frame.orderedLayers, [{ id: 'scene', type: 'custom' }]);
    assert.equal(facts.frame.projection, 'mercator'); assert.equal(facts.frame.terrainEnabled, false);
    assert.ok(item.events.indexOf('reset') < item.events.indexOf('sealNativeFrame'));
    assert.equal(item.registry.sealNativeFrame({ type: 'render' }), false); assert.deepEqual(completed(item, inside), facts);
    const offset = item.events.length; let tailChecked = false;
    item.data.showPadding = true; item.hooks.tail = () => { tailChecked = true; assert.throws(() => completed(item, inside), unavailable); };
    item.render(); assert.equal(tailChecked, true);
    const tailFacts = completed(item, inside); assert.equal(tailFacts.frame.debug, true); assert.equal(tailFacts.frame.tailDraws, true);
    const sequence = item.events.slice(offset);
    assert.ok(sequence.indexOf('render') < sequence.indexOf('leaveNativeCustomRender'));
    assert.ok(sequence.indexOf('leaveNativeCustomRender') < sequence.indexOf('tail'));
    assert.ok(sequence.indexOf('tail') < sequence.indexOf('reset'));
    assert.ok(sequence.indexOf('reset') < sequence.indexOf('sealNativeFrame'));
  } finally { release(); }
});

test('callback tail reset and nested native failures cannot leave a completed or replayable authority', async () => {
  for (const stage of ['render', 'tail', 'reset', 'nested', 'facts']) {
    const native = await loadTransformedNative(), item = nativePaintFixture(native), release = item.enroll();
    const failure = new Error(`native ${stage}`); let reached = 0;
    try {
      let old, workChecked = false;
      if (stage === 'facts') {
        item.render(); old = item.captures.at(-1); assert.ok(completed(item, old)); item.events.length = 0;
        item.hooks.projection = () => { reached++; throw failure; };
        item.hooks.work = () => { workChecked = true; assert.throws(() => completed(item, old), unavailable); };
      }
      if (stage === 'tail') item.data.showPadding = true;
      if (stage === 'nested') item.hooks.render = () => { if (reached++ === 0) item.render(); };
      else if (stage !== 'facts') item.hooks[stage] = () => { reached++; throw failure; };
      if (stage === 'nested' || stage === 'facts') item.render(); else assert.throws(() => item.render(), error => error === failure);
      assert.ok(reached > 0, stage);
      if (stage === 'tail') assert.equal(item.events.includes('reset'), false, 'throwing tail cannot reach native reset');
      if (stage === 'facts') {
        assert.equal(workChecked, true); assert.ok(item.events.includes('reset'), 'metadata refusal must preserve native painting');
        assert.notEqual(item.captures.at(-1).status, 'admitted');
      }
      for (const capture of item.captures.filter(value => value.status === 'admitted')) assert.throws(() => completed(item, capture), unavailable);
      assert.notEqual(item.registry.captureNativeFrameAuthority(item.gl, item.implementation, item.originalRender, item.renderInputs.at(-1)).status, 'admitted');
      for (const key of Object.keys(item.hooks)) delete item.hooks[key]; item.data.showPadding = false;
      item.render(); assert.equal(item.captures.at(-1).status, 'admitted'); assert.ok(completed(item, item.captures.at(-1)));
    } finally { release(); }
  }
});

test('source-pair admission and exact anchors are atomic while ordinary build integrity still refuses corrupt pins', async () => {
  const sources = await nativeSources();
  for (const name of Object.keys(sources)) assert.equal(createHash('sha256').update(sources[name]).digest('hex'), sourceHashes[name]);
  assert.equal(nativeFrameSourcesMatch(sources), true);
  for (const candidate of [{}, { painter: sources.painter }, { ...sources, painter: `${sources.painter}\n` },
    { ...sources, drawCustom: `${sources.drawCustom}\n` }]) assert.equal(nativeFrameSourcesMatch(candidate), false);
  for (const order of [[true, false], [false, true]]) for (const enabled of order) {
    const plugin = newPlugin(enabled); assert.ok(plugin.changed instanceof Map); assert.equal(plugin.changed.size, 0);
    for (const [name, relative] of Object.entries(sourcePaths)) {
      const result = await plugin.transform(sources[name], join(upstreamRoot, 'src', relative));
      assert.equal((result?.code ?? sources[name]) === sources[name], !enabled);
    }
    assert.deepEqual([...plugin.changed.keys()].sort(), enabled ? Object.values(sourcePaths).sort() : []);
  }
  const anchors = { painter: '        this.context.setDefault();', drawCustom: '        implementation.render(context.gl, customLayerArgs);' };
  for (const [name, anchor] of Object.entries(anchors)) for (const changed of [sources[name].replace(anchor, ''), sources[name].replace(anchor, `${anchor}\n${anchor}`)]) {
    const plugin = newPlugin(); await assert.rejects(async () => plugin.transform(changed, join(upstreamRoot, 'src', sourcePaths[name])));
  }
  const root = fileURLToPath(new URL('../', import.meta.url));
  for (const field of ['packageJsonSha256', 'sourceTreeSha256', 'license']) {
    const scratch = await createScratchPackage();
    try {
      const pin = JSON.parse(await readFile(join(scratch.directory, 'UPSTREAM.json'), 'utf8'));
      if (field === 'license') pin.license.sha256 = '0'.repeat(64); else pin[field] = '0'.repeat(64);
      await writeFile(join(scratch.directory, 'UPSTREAM.json'), JSON.stringify(pin));
      const run = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: scratch.directory, encoding: 'utf8' });
      assert.notEqual(run.status, 0); assert.match(run.stderr, /differs from the reviewed source pin/u);
    } finally { await scratch.remove(); }
  }
  const scratch = await createScratchPackage();
  try {
    const relocated = await relocateUpstream(scratch.directory, root);
    await relocated.edit('src/render/painter.ts', source => `${source}\n`); await relocated.repin();
    const run = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: scratch.directory, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const provenance = JSON.parse(await readFile(join(scratch.directory, 'dist/provenance.json'), 'utf8'));
    assert.equal(provenance.changedSourceFiles.includes('webgl/draw/draw_custom.ts'), false);
    for (const module of provenance.modules) if (/painter|draw_custom/u.test(module.file)) {
      assert.doesNotMatch(await readFile(join(scratch.directory, 'dist', module.file), 'utf8'), /native-frame|beginNativeFrame|enterNativeCustomRender/u);
    }
  } finally { await scratch.remove(); }
});
