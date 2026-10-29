import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
function runPublicImport(source) {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    cwd: packageRoot, encoding: 'utf8', timeout: 30000,
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test('the public XR entry has only approved exports and imports without browser renderer or native access', () => {
  runPublicImport(`
    import assert from 'node:assert/strict';
    import { registerHooks } from 'node:module';
    const loaded = [];
    registerHooks({ resolve(specifier, context, next) {
      const result = next(specifier, context);
      assert(!specifier.startsWith('three'), 'XR entry imports a renderer dependency');
      if (result.url.includes('/dist/')) {
        assert(/\\/dist\\/xr\\/(?:index|types|support)\\.js$/u.test(result.url), 'XR entry imports native or engine internals');
        loaded.push(result.url);
      }
      return result;
    } });
    for (const name of ['navigator', 'isSecureContext', 'document', 'window', 'XRSession', 'WebGLRenderingContext']) {
      Object.defineProperty(globalThis, name, { configurable: true, get() { throw new Error('Import accessed ' + name); } });
    }
    const entry = await import('@aceshooting/lyra-3d/xr');
    assert.deepEqual(Object.keys(entry).sort(), ['Lyra3dXrError', 'isLyra3dXrSupported']);
    assert.equal(typeof entry.isLyra3dXrSupported, 'function');
    const error = new entry.Lyra3dXrError('aborted');
    assert.equal(error.code, 'aborted');
    assert.equal(error.name, 'Lyra3dXrError');
    assert(loaded.some(url => url.endsWith('/dist/xr/index.js')));
  `);
});

test('the public XR support query preserves the native receiver and requests no session', () => {
  runPublicImport(`
    import assert from 'node:assert/strict';
    const { isLyra3dXrSupported } = await import('@aceshooting/lyra-3d/xr');
    let queries = 0, requests = 0;
    const xr = {
      isSessionSupported(mode) {
        assert.equal(this, xr); assert.equal(mode, 'immersive-vr'); queries++;
        return Promise.resolve(true);
      },
      requestSession() { requests++; throw new Error('Support requested a session'); },
    };
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { xr } });
    Object.defineProperty(globalThis, 'isSecureContext', { configurable: true, value: true });
    assert.equal(await isLyra3dXrSupported(), true);
    assert.equal(queries, 1); assert.equal(requests, 0);
  `);
});

test('private XR controllers native owners and resource records remain outside package exports', async () => {
  for (const entry of ['xr/controller', 'xr/three-native-owner', 'xr/coordinator', 'xr/document-scope', 'core/viewport-xr', 'points/xr', 'dist/xr/controller.js']) {
    await assert.rejects(import(`@aceshooting/lyra-3d/${entry}`), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
  }
});
