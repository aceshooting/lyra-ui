import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';
import { captureNativeTerrainBuildInputs } from '../scripts/native-terrain-contract.mjs';
import { createNativeTerrainInputsFixture } from './native-terrain-inputs-fixture.mjs';

const sourceTreeSha256 = 'b'.repeat(64);
const request = fixture => ({ packageRoot: fixture.directory, verifiedSourceTreeSha256: sourceTreeSha256,
  compilerOptions: fixture.compilerOptions });

for (const phase of ['before open', 'during read', 'after read', 'between passes']) {
  test(`native input capture refuses an authored file changed ${phase} and closes its handles`, async context => {
    const fixture = await createNativeTerrainInputsFixture();
    context.after(() => fixture.remove());
    const target = join(fixture.workspace, '.nvmrc');
    const replacement = join(fixture.workspace, 'replacement-input');
    const bytes = await fs.readFile(target);
    await fs.writeFile(replacement, bytes);
    const originalOpen = fs.open;
    const opened = [];
    let changed = false;
    async function change() {
      changed = true;
      if (phase === 'before open' || phase === 'after read') await fs.rename(replacement, target);
      else await fs.appendFile(target, '\n');
    }
    // Coordinate real filesystem changes at the public I/O boundary, without timers or changing
    // collector internals. All non-target files and every stat/read remain real filesystem work.
    fs.open = async function (path, ...args) {
      const targetRead = path === target && !changed;
      if (targetRead && phase === 'before open') await change();
      const handle = await originalOpen.call(this, path, ...args);
      const read = handle.readFile, close = handle.close;
      const readDescriptor = Object.getOwnPropertyDescriptor(handle, 'readFile');
      const closeDescriptor = Object.getOwnPropertyDescriptor(handle, 'close');
      const record = { handle, closes: 0, restore() {
        if (readDescriptor) Object.defineProperty(handle, 'readFile', readDescriptor);
        else delete handle.readFile;
        if (closeDescriptor) Object.defineProperty(handle, 'close', closeDescriptor);
        else delete handle.close;
      } };
      opened.push(record);
      handle.readFile = async function (...readArgs) {
        const result = await read.apply(this, readArgs);
        if (targetRead && !changed && (phase === 'during read' || phase === 'after read')) await change();
        return result;
      };
      handle.close = async function (...closeArgs) {
        record.closes++;
        const result = await close.apply(this, closeArgs);
        if (targetRead && !changed && phase === 'between passes') await change();
        return result;
      };
      return handle;
    };
    syncBuiltinESMExports();
    try {
      const result = await captureNativeTerrainBuildInputs(request(fixture));
      assert.equal(changed, true, 'the real authored file must change during capture');
      assert.deepEqual(result, { status: 'disabled', reason: 'unsafe-input' });
      assert.ok(opened.length > 0);
      for (const record of opened) {
        assert.equal(record.closes, 1, 'each acquired handle is closed once even on refusal');
        assert.equal(record.handle.fd, -1, 'the operating-system descriptor is closed');
      }
    } finally {
      fs.open = originalOpen;
      syncBuiltinESMExports();
      for (const record of opened) {
        record.restore();
        if (record.handle.fd !== -1) await record.handle.close();
      }
    }
    // Replacement with identical bytes is safe once stable; changing bytes is also admissible in
    // a later, coherent capture. Neither previous refusal may poison subsequent capture state.
    const stable = await captureNativeTerrainBuildInputs(request(fixture));
    assert.equal(stable.status, 'captured');
    assert.equal(stable.sourceTreeSha256, sourceTreeSha256);
    assert.equal(Object.hasOwn(stable, 'authority'), false);
  });
}
