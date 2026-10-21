import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';
import { completePlugin, src } from '../scripts/complete-transform.mjs';

async function protocolHarness() {
  const modules = [];
  for (const path of ['util/config.ts', 'source/protocol_crud.ts']) {
    const id = join(src, path);
    const original = await readFile(id, 'utf8');
    const result = await completePlugin.transform(original, id);
    const javascript = stripTypeScriptTypes(result?.code ?? original, { mode: 'transform' })
      .replace(/^import[\s\S]*?;\n/gm, '')
      .replace(/^export /gm, '');
    modules.push(javascript);
  }
  // Exercise the actual generated modules with their shared config, without worker or network setup.
  return new Function(modules.join('\n') + '\nreturn {config,getProtocol,addProtocol,removeProtocol};')();
}

test('does not resolve inherited protocol names unless they are explicitly registered', async () => {
  const protocol = await protocolHarness();
  for (const name of ['does-not-exist', 'toString', 'constructor', '__proto__', 'hasOwnProperty']) {
    assert.equal(protocol.getProtocol(name + '://resource'), undefined, name);
  }
  const inherited = async () => ({ data: 'inherited' });
  Object.setPrototypeOf(protocol.config.REGISTERED_PROTOCOLS, { inherited });
  assert.equal(protocol.getProtocol('inherited://resource'), undefined, 'prototype membership is not registration');
});

test('preserves explicit registration, replacement and removal including reserved object names', async () => {
  const protocol = await protocolHarness();
  for (const name of ['custom', 'toString', 'constructor', '__proto__', 'hasOwnProperty']) {
    const first = async (request) => ({ data: request.url });
    const second = async () => ({ data: 'replacement' });
    protocol.addProtocol(name, first);
    assert.equal(protocol.getProtocol(name + '://resource'), first, name + ' registered');
    assert.deepEqual(await protocol.getProtocol(name + '://resource')({ url: name + '://resource' }), {
      data: name + '://resource'
    });
    protocol.addProtocol(name, second);
    assert.equal(protocol.getProtocol(name + '://resource'), second, name + ' replaced');
    protocol.removeProtocol(name);
    assert.equal(protocol.getProtocol(name + '://resource'), undefined, name + ' removed');
  }
});
