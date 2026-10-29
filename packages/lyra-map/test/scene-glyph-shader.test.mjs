import assert from 'node:assert/strict';
import test from 'node:test';
import { createObservationFixture } from './fixtures/scene-completion-observation.mjs';

// Models the shared integer uniform's link rule, not GLSL compilation or GPU pixels.
function modePrecision(source, stage) {
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    .replace(/^\s*#.*$/gm, '');
  const tokens = clean.match(/[A-Za-z_]\w*|[{};]/g) ?? [];
  let depth = 0, precision = stage === 'vertex' ? 'highp' : 'mediump', declaration;
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token === '{') { depth++; continue; }
    if (token === '}') { depth--; continue; }
    if (depth !== 0) continue;
    if (token === 'precision' && ['lowp', 'mediump', 'highp'].includes(tokens[index + 1]) &&
        tokens[index + 2] === 'int' && tokens[index + 3] === ';') precision = tokens[index + 1];
    if (token !== 'uniform') continue;
    let next = index + 1, explicit;
    if (['lowp', 'mediump', 'highp'].includes(tokens[next])) explicit = tokens[next++];
    if (tokens[next] === 'int' && tokens[next + 1] === 'u_lr_observation_mode' && tokens[next + 2] === ';') {
      assert.equal(declaration, undefined, 'one mode declaration per shader');
      declaration = explicit ?? precision;
    }
  }
  assert.ok(declaration, 'the linked shader declares its observation mode');
  return declaration;
}

function enforceModeLink(item) {
  const links = [];
  item.gpu.afterCall = (name, [program]) => {
    if (name !== 'linkProgram') return;
    const record = item.gpu.programs.get(program);
    const shaders = [...record.attached].map(shader => item.gpu.shaders.get(shader));
    const vertex = shaders.find(shader => shader.type === item.gl.VERTEX_SHADER);
    const fragment = shaders.find(shader => shader.type === item.gl.FRAGMENT_SHADER);
    assert.ok(vertex && fragment);
    const pair = [modePrecision(vertex.source, 'vertex'), modePrecision(fragment.source, 'fragment')];
    links.push(pair);
    record.linked = record.linked && pair[0] === pair[1];
  };
  return links;
}

test('ordinary glyph painting links shared integer uniforms with matching stage precision', () => {
  const declaration = 'uniform int u_lr_observation_mode;';
  assert.equal(modePrecision(declaration, 'vertex'), 'highp');
  assert.equal(modePrecision(declaration, 'fragment'), 'mediump');
  assert.equal(modePrecision(`precision lowp int; ${declaration}`, 'vertex'), 'lowp');
  assert.equal(modePrecision(`${declaration} precision lowp int;`, 'vertex'), 'highp');
  assert.equal(modePrecision(`void ignored() { precision lowp int; } ${declaration}`, 'vertex'), 'highp');
  assert.equal(modePrecision('precision lowp int; uniform highp int u_lr_observation_mode;', 'fragment'), 'highp');
  const item = createObservationFixture(), links = enforceModeLink(item), before = item.gpu.snapshot();
  try {
    assert.doesNotThrow(() => item.renderer.render(item.frame, [item.marker]));
    assert.equal(links.length, 1); assert.equal(links[0][0], links[0][1]);
    assert.equal(item.gpu.draws.length, 1);
    assert.deepEqual(item.gpu.draws[0].uniforms.u_lr_observation_mode, [0]);
    assert.equal(item.gpu.calls.filter(call => call[0] === 'createQuery').length, 0);
    assert.deepEqual(item.gpu.snapshot(), before);
  } finally { item.stop(); }
});

test('observation reuses a linked glyph program for object and anchor draws', () => {
  const item = createObservationFixture(), links = enforceModeLink(item), before = item.gpu.snapshot();
  try {
    assert.doesNotThrow(() => item.begin());
    assert.ok(item.issue()); item.finish(); item.settle();
    assert.equal(links.length, 1); assert.equal(links[0][0], links[0][1]);
    assert.deepEqual(item.gpu.draws.map(draw => draw.uniforms.u_lr_observation_mode[0]), [0, 1, 2]);
    assert.equal(item.completed.length, 1);
    assert.deepEqual(item.gpu.snapshot(), before);
  } finally { item.stop(); }
});
