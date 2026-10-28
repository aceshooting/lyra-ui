import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';
import { mat4 } from 'gl-matrix';
import { completePlugin, src } from '../scripts/complete-transform.mjs';

const id = join(src, 'webgl/draw/draw_terrain.ts');

test('globe terrain bypasses unsupported fog calculation and Mercator retains its matrix', async () => {
  const original = await readFile(id, 'utf8');
  const code = (await completePlugin.transform(original, id))?.code ?? original;
  const body = code.slice(code.indexOf('function drawTerrain('), code.indexOf('function drawTerrainHeightMap('));
  const calls = [];
  const drawTerrain = new Function('mat4', 'terrainUniformValues', 'StencilMode', 'CullFaceMode',
    stripTypeScriptTypes(body, { mode: 'transform' }) + '\nreturn drawTerrain;')(
    mat4, (...args) => { calls.push(args); return {}; }, { disabled: 0 }, { backCCW: 0 }
  );
  let fogCalls = 0;
  let globe = true;
  const mercatorMatrix = mat4.fromTranslation(mat4.create(), [1, 2, 3]);
  const frame = {
    data: { isRenderingGlobe: true },
    context: { gl: {}, bindFramebuffer: { set() {} }, viewport: { set() {} }, activeTexture: { set() {} } },
    transform: { zoom: 0, pitch: 0, calculateFogMatrix() {
      fogCalls++;
      assert.equal(globe, false, 'globe must not invoke the unsupported transform');
      return mercatorMatrix;
    } },
    colorModeForRenderPass() {}, getDepthModeFor3D() {}, getProjectionDataForTile() {},
    useProgram() { return { draw() {} }; }
  };
  const painter = { width: 10, height: 10, renderToTexture: { getTexture() { return { bind() {} }; } } };
  const terrain = { getTerrainMesh() { return {}; }, getTerrainData() {}, getSkirtLength() { return 0; } };
  const tiles = [{ tileID: { toUnwrapped() { return {}; } } }];
  drawTerrain(painter, terrain, tiles, frame);
  assert.equal(fogCalls, 0);
  assert.deepEqual(calls[0][1], mat4.create());
  assert.equal(calls[0][4], true);
  globe = false;
  frame.data.isRenderingGlobe = false;
  drawTerrain(painter, terrain, tiles, frame);
  assert.equal(fogCalls, 1);
  assert.equal(calls[1][1], mercatorMatrix);
  assert.equal(calls[1][4], false);
});

test('terrain fog transform rejects a changed upstream calculation anchor', async () => {
  const original = await readFile(id, 'utf8');
  await assert.rejects(completePlugin.transform(original.replace('const fogMatrix =', 'const changedFogMatrix ='), id),
    /Patch mismatch/u);
});
