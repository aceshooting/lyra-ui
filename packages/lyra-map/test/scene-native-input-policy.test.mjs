import assert from 'node:assert/strict';
import test from 'node:test';
import { captureNativeTerrainBuildInputs } from '../scripts/native-terrain-contract.mjs';
import { createNativeTerrainInputsFixture } from './native-terrain-inputs-fixture.mjs';

const sourceTreeSha256 = 'a'.repeat(64);
async function fixtureFor(context) {
  const fixture = await createNativeTerrainInputsFixture();
  context.after(() => fixture.remove());
  return fixture;
}
function request(fixture, changes = {}) {
  return { packageRoot: fixture.directory, verifiedSourceTreeSha256: sourceTreeSha256,
    compilerOptions: fixture.compilerOptions, ...changes };
}
function disabled(result, reason = 'unsafe-input') {
  assert.deepEqual(result, { status: 'disabled', reason });
  assert.equal(Object.isFrozen(result), true);
}
function captured(result) {
  assert.equal(result.status, 'captured');
  assert.equal(result.sourceTreeSha256, sourceTreeSha256);
  assert.equal(Object.hasOwn(result, 'authority'), false);
  assert.equal(Object.hasOwn(result, 'enabled'), false);
  return result.records;
}

const patch = 'patches/braces@3.0.3.patch';
for (const [name, yaml] of [
  ['missing mapping', 'packages:\n  - packages/*\n'],
  ['duplicate headers', `patchedDependencies:\n  braces: ${patch}\npatchedDependencies:\n  other: ${patch}\n`],
  ['quoted header', `"patchedDependencies":\n  braces: ${patch}\n`],
  ['empty mapping', 'patchedDependencies:\n# No patch entries\npackages:\n  - packages/*\n'],
  ['duplicate package keys', `patchedDependencies:\n  braces: ${patch}\n  braces: ${patch}\n`],
  ['anchor declaration', `patchedDependencies:\n  braces: &patch ${patch}\n`],
  ['alias reference', 'patchedDependencies:\n  braces: *patch\n'],
  ['merge key', `patchedDependencies:\n  <<: ${patch}\n`],
  ['tab indentation', `patchedDependencies:\n\tbraces: ${patch}\n`],
  ['nested indentation', `patchedDependencies:\n    braces: ${patch}\n`],
  ['noncanonical patch path', 'patchedDependencies:\n  braces: patches//braces@3.0.3.patch\n'],
]) {
  test(`native input capture refuses ${name} rather than guessing the patch set`, async context => {
    const fixture = await fixtureFor(context);
    await fixture.write('pnpm-workspace.yaml', yaml);
    disabled(await captureNativeTerrainBuildInputs(request(fixture)));
  });
}

test('native input capture accepts quoted package keys and comments while recording shared patch bytes once', async context => {
  const fixture = await fixtureFor(context);
  await fixture.write('pnpm-workspace.yaml', `# Build patch inputs\npatchedDependencies: # Scalar mapping\n\n  'braces@3.0.3': ${patch} # Patch bytes\n  "other@1.0.0": ${patch}\n  plain: ${patch}\npackages:\n  - packages/*\n`);
  const records = captured(await captureNativeTerrainBuildInputs(request(fixture)));
  assert.deepEqual(records.filter(record => record.file.startsWith('patches/')).map(record => record.file), [patch]);
});

for (const [name, bytes] of [
  ['invalid JSON', '{'],
  ['array root', '[]'],
  ['null root', 'null'],
  ['array scripts', '{"scripts":[]}'],
  ['scalar scripts', '{"scripts":"node build.mjs"}'],
  ['array compiler dependencies', '{"devDependencies":[]}'],
  ['scalar compiler dependencies', '{"devDependencies":17}'],
  ['nonfinite resolver input', '{"exports":{".":1e400}}'],
]) {
  test(`native input capture refuses a manifest with ${name}`, async context => {
    const fixture = await fixtureFor(context);
    for (const file of ['package.json', 'packages/lyra-map/package.json']) {
      const original = await fixture.read(file);
      await fixture.write(file, bytes);
      disabled(await captureNativeTerrainBuildInputs(request(fixture)));
      await fixture.write(file, original);
    }
    captured(await captureNativeTerrainBuildInputs(request(fixture)));
  });
}

test('native input capture normalizes absent compiler declarations but preserves an explicitly empty build command', async context => {
  const fixture = await fixtureFor(context);
  await fixture.write('package.json', '{}');
  const omitted = captured(await captureNativeTerrainBuildInputs(request(fixture)));
  await fixture.write('package.json', '{"scripts":{},"devDependencies":{}}');
  const empty = captured(await captureNativeTerrainBuildInputs(request(fixture)));
  assert.deepEqual(empty, omitted, 'absent build and compiler declarations have the same projection');
  await fixture.write('package.json', '{"scripts":{"build":""},"devDependencies":{}}');
  const declared = captured(await captureNativeTerrainBuildInputs(request(fixture)));
  assert.notDeepEqual(declared, omitted, 'an explicitly empty build declaration remains present');
});

test('native input capture rejects proxy and accessor requests without evaluating caller code', async context => {
  const fixture = await fixtureFor(context);
  let calls = 0;
  const hostile = new Proxy(request(fixture), {
    get() { calls++; throw new Error('Caller property read'); },
    getPrototypeOf() { calls++; throw new Error('Caller prototype read'); },
    getOwnPropertyDescriptor() { calls++; throw new Error('Caller descriptor read'); },
    ownKeys() { calls++; throw new Error('Caller key read'); },
  });
  disabled(await captureNativeTerrainBuildInputs(hostile));
  const revoked = Proxy.revocable(request(fixture), {});
  revoked.revoke();
  disabled(await captureNativeTerrainBuildInputs(revoked.proxy));
  for (const field of ['packageRoot', 'verifiedSourceTreeSha256', 'compilerOptions']) {
    const value = request(fixture);
    Object.defineProperty(value, field, { enumerable: true, get() { calls++; throw new Error('Caller accessor'); } });
    disabled(await captureNativeTerrainBuildInputs(value), field === 'compilerOptions' ? 'compiler-config' : 'unsafe-input');
  }
  assert.equal(calls, 0);
  captured(await captureNativeTerrainBuildInputs(request(fixture)));
});

test('native input capture requires an absolute package root and an explicit lowercase SHA-256 identity', async context => {
  const fixture = await fixtureFor(context);
  for (const packageRoot of [null, 12, 'packages/lyra-map']) {
    disabled(await captureNativeTerrainBuildInputs(request(fixture, { packageRoot })));
  }
  for (const verifiedSourceTreeSha256 of [undefined, null, 12, '', 'a'.repeat(63), 'a'.repeat(65), 'A'.repeat(64), 'g'.repeat(64)]) {
    disabled(await captureNativeTerrainBuildInputs(request(fixture, { verifiedSourceTreeSha256 })));
  }
  const missing = request(fixture);
  delete missing.verifiedSourceTreeSha256;
  disabled(await captureNativeTerrainBuildInputs(missing));
  captured(await captureNativeTerrainBuildInputs(request(fixture)));
});

for (const field of ['cwd', 'tsconfig']) {
  test(`native input capture refuses a hidden compiler ${field} setting`, async context => {
    const fixture = await fixtureFor(context);
    const compilerOptions = { cwd: fixture.directory, tsconfig: false };
    Object.defineProperty(compilerOptions, field, { enumerable: false });
    Object.freeze(compilerOptions);
    disabled(await captureNativeTerrainBuildInputs(request(fixture, { compilerOptions })), 'compiler-config');
    captured(await captureNativeTerrainBuildInputs(request(fixture)));
  });
}
