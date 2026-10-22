import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import test from 'node:test';
import { filesUnder, filesUnderSync, serveStatic } from './lib/static-files.mjs';

function tree(context, files) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'lyra-static-files-')));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), content);
  }
  return root;
}

const FILES = { 'b.txt': 'b', 'a/z.js': 'z', 'a/m/deep.css': 'd', 'a/a.js': 'a', 'c/.hidden': 'h' };
const SORTED = ['a/a.js', 'a/m/deep.css', 'a/z.js', 'b.txt', 'c/.hidden'];

test('lists every file below a directory, absolute and in sorted order, nested or not', async context => {
  const root = tree(context, FILES);
  const expected = SORTED.map(name => join(root, name)).sort();
  assert.deepEqual(await filesUnder(root), expected);
  assert.deepEqual(filesUnderSync(root), expected);
  assert.deepEqual(await filesUnder(join(root, 'a/m')), [join(root, 'a/m/deep.css')]);
  assert.deepEqual(filesUnderSync(join(root, 'a/m')), [join(root, 'a/m/deep.css')]);
});

test('an empty directory has no files and a missing one is an error', async context => {
  const root = tree(context, { 'empty/.keep': '' });
  rmSync(join(root, 'empty/.keep'));
  assert.deepEqual(await filesUnder(join(root, 'empty')), []);
  assert.deepEqual(filesUnderSync(join(root, 'empty')), []);
  await assert.rejects(filesUnder(join(root, 'missing')), { code: 'ENOENT' });
  assert.throws(() => filesUnderSync(join(root, 'missing')), { code: 'ENOENT' });
});

async function serve(context, files, options) {
  const root = tree(context, files);
  const server = serveStatic(root, options);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  context.after(() => new Promise(resolve => server.close(resolve)));
  return { root, base: `http://127.0.0.1:${server.address().port}` };
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript' };

test('serves files with their MIME type, never cached, and falls back to a generic type', async context => {
  const { base } = await serve(context, { 'index.html': '<p>home</p>', 'app.js': 'export {};', 'data.bin': 'xyz', 'nested/page.html': '<b>n</b>' },
    { index: '/index.html', mime: MIME });
  for (const [path, type, body] of [
    ['/app.js', 'text/javascript', 'export {};'],
    ['/nested/page.html', 'text/html', '<b>n</b>'],
    ['/data.bin', 'application/octet-stream', 'xyz'],
  ]) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get('content-type'), type, path);
    assert.equal(response.headers.get('cache-control'), 'no-store', path);
    assert.equal(await response.text(), body, path);
  }
});

test('serves the configured index for the root path', async context => {
  const { base } = await serve(context, { 'test/browser.html': '<main>fixture</main>' }, { index: '/test/browser.html', mime: MIME });
  const response = await fetch(`${base}/`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/html');
  assert.equal(await response.text(), '<main>fixture</main>');
});

test('answers the favicon with no content and unknown paths, directories and bad escapes with 404', async context => {
  const { base } = await serve(context, { 'index.html': 'home', 'sub/file.js': 'x' }, { index: '/index.html', mime: MIME });
  assert.equal((await fetch(`${base}/favicon.ico`)).status, 204);
  for (const path of ['/missing.js', '/sub', '/sub/', '/%E0%A4%A']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 404, path);
    assert.equal(await response.text(), '', path);
  }
});

test('never serves a file outside the root, however the path is spelled', async context => {
  const { root, base } = await serve(context, { 'index.html': 'home' }, { index: '/index.html', mime: MIME });
  const beside = `${root}-beside.txt`;
  const sibling = `${root}-sibling`;
  writeFileSync(beside, 'beside');
  mkdirSync(sibling);
  writeFileSync(join(sibling, 'x.txt'), 'sibling');
  context.after(() => {
    rmSync(beside, { force: true });
    rmSync(sibling, { recursive: true, force: true });
  });
  const name = basename(root);
  // A sibling whose name merely starts with the root's name is outside the root too.
  for (const path of [`/..%2F${name}-beside.txt`, `/%2e%2e%2f${name}-beside.txt`, `/a%2F..%2F..%2F${name}-beside.txt`, `/..%2F${name}-sibling%2Fx.txt`]) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 403, path);
    assert.equal(await response.text(), '', path);
  }
});
