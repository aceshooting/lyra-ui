import { expect } from '@open-wc/testing';
import { classifyOptionalPeerImportError } from './optional-peer-failure.js';

describe('classifyOptionalPeerImportError', () => {
  const withCode = (code: string, message = 'boom'): Error => Object.assign(new Error(message), { code });

  it('reports an unresolvable module as missing in this engine (a real bare-specifier import)', async () => {
    // A computed specifier reaches the browser untouched (the dev server only rewrites literals),
    // so this is the engine's own resolution error for a package that is not installed.
    const specifier = ['lyra-optional-peer', 'that-is-not-installed'].join('-');
    let caught: unknown;
    try {
      await import(/* @vite-ignore */ specifier);
    } catch (error) {
      caught = error;
    }
    expect(caught === undefined, 'the import must fail').to.be.false;
    expect(classifyOptionalPeerImportError(caught)).to.equal('missing');
  });

  it('reports the module-not-found codes and messages of Node, bundlers and every engine as missing', () => {
    for (const error of [
      withCode('ERR_MODULE_NOT_FOUND'),
      withCode('MODULE_NOT_FOUND'),
      new TypeError('Failed to resolve module specifier "emoji-picker-element-data/en/emojibase/data.json".'),
      new TypeError('The specifier \u201cemoji-picker-element-data\u201d was a bare specifier, but was not remapped to anything.'),
      new TypeError("Module name, 'emoji-picker-element-data' does not resolve to a valid URL."),
      new Error("Cannot find module 'emoji-picker-element-data/en/emojibase/data.json'"),
      new Error("Cannot find package 'emoji-picker-element-data' imported from /app/x.js"),
      new Error('Failed to resolve import "emoji-picker-element-data" from "src/x.ts". Does the file exist?'),
    ]) {
      expect(classifyOptionalPeerImportError(error), error.message).to.equal('missing');
    }
  });

  it('reports an installed peer that fails to load or validate as failed, never as missing', () => {
    for (const error of [
      new TypeError('Failed to fetch dynamically imported module: https://cdn.example/data.json'),
      new SyntaxError('Unexpected token < in JSON at position 0'),
      withCode('ERR_IMPORT_ATTRIBUTE_MISSING', 'needs an import attribute of "type: json"'),
      withCode('ERR_PACKAGE_PATH_NOT_EXPORTED', 'Package subpath is not defined by "exports"'),
      new TypeError('The peer does not expose the expected shape.'),
    ]) {
      expect(classifyOptionalPeerImportError(error), error.message).to.equal('failed');
    }
    for (const value of [undefined, null, 'Cannot find module', 42, {}]) {
      expect(classifyOptionalPeerImportError(value)).to.equal('failed');
    }
  });
});
