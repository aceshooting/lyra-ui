import { execFileSync } from 'node:child_process';
import test from 'node:test';

const reviewNames = ['collectReviewItems', 'collectRevisionSites', 'commentsOfPart', 'commentAnchorsOfStory',
  'threadStateOfPart', 'commentBodyText', 'reviewItemKey', 'commentPartNameOf', 'commentsExtendedPartNameOf', 'stylesPartOf'];
const imageNames = ['readZip', 'readOoxmlPart', 'TreePackageStore', 'writeOoxmlPackage'];

function checkEngine(body: string, missing: readonly string[] = []): void {
  const core = `let blankCalls = 0;
    ${missing.includes('createDocxEditor') ? '' : 'export let createDocxEditor = function originalEditor() {}; export function replaceEditor() { createDocxEditor = function replacedEditor() {}; }'}
    ${missing.includes('blankDocumentBytes') ? '' : 'export function blankDocumentBytes() { blankCalls++; return new Uint8Array([1]); }'}
    export function blankCallCount() { return blankCalls; }`;
  const implementations: Record<string, string> = {
    findNode: 'function originalFindNode() {}',
    parentNodeOf: 'function parentNodeOf() {}',
    readZip: "function readZip() { return { ok: true, entries: new Map([['/word/styles.xml', new TextEncoder().encode('<styles/>')]]) }; }",
    readOoxmlPart: "function readOoxmlPart() { return { ok: true, part: { name: '/word/styles.xml', root: { kind: 'element', attributes: [], namespaceBindings: {}, children: [] } } }; }",
    TreePackageStore: 'class TreePackageStore {}',
    writeOoxmlPackage: 'function writeOoxmlPackage() {}',
  };
  const names = ['findNode', 'parentNodeOf', ...imageNames, ...reviewNames];
  const store = names.filter(name => !missing.includes(name))
    .map(name => `export let ${name} = ${implementations[name] ?? 'function reader() {}'};`).join('\n') +
    (missing.includes('findNode') ? '' : '\nexport function replaceFindNode() { findNode = function replacedFindNode() {}; }');
  const source = `import assert from 'node:assert/strict';
    import { registerHooks } from 'node:module';
    const coreUrl = ${JSON.stringify(`data:text/javascript,${encodeURIComponent(core)}`)};
    const storeUrl = ${JSON.stringify(`data:text/javascript,${encodeURIComponent(store)}`)};
    let peerResolutions = 0;
    registerHooks({ resolve(specifier, context, nextResolve) {
      if (specifier === '@docx-editor.dev/core' || specifier === '@docx-editor.dev/core/store') peerResolutions++;
      if (specifier === '@docx-editor.dev/core') return { url: coreUrl, shortCircuit: true };
      if (specifier === '@docx-editor.dev/core/store') return { url: storeUrl, shortCircuit: true };
      return nextResolve(specifier, context);
    }});
    const { loadDocxEngine } = await import(${JSON.stringify(new URL('./engine-loader.js', import.meta.url).href)});
    assert.equal(peerResolutions, 0, 'Importing the loader must not resolve the engine');
    ${body}`;
  execFileSync(process.execPath, ['--input-type=module', '-e', source], { stdio: 'pipe', timeout: 15000 });
}

test('capability imports stay lazy and singleton facades preserve the image derivation cache', () => {
  checkEngine(`
    const core = await import(coreUrl);
    assert.equal(core.blankCallCount(), 0);
    const first = await loadDocxEngine();
    const second = await loadDocxEngine();
    assert(first.imageInsertion);
    assert.equal(first.imageInsertion, second.imageInsertion);
    assert.equal(core.blankCallCount(), 1);
    assert.equal(first.createDocxEditor, core.createDocxEditor);
    const store = await import(storeUrl);
    for (const name of ${JSON.stringify(reviewNames)}) assert.equal(first.review[name], store[name]);
    for (const name of ${JSON.stringify(imageNames)}) assert.equal(first.imageInsertion[name], store[name]);
    const coreFacade = await import(${JSON.stringify(new URL('./engine-core-capabilities.js', import.meta.url).href)});
    const storeFacade = await import(${JSON.stringify(new URL('./engine-store-capabilities.js', import.meta.url).href)});
    assert.equal((await import(${JSON.stringify(new URL('./engine-core-capabilities.js', import.meta.url).href)})).capabilities, coreFacade.capabilities);
    assert.equal((await import(${JSON.stringify(new URL('./engine-store-capabilities.js', import.meta.url).href)})).capabilities, storeFacade.capabilities);
    assert(Object.isFrozen(coreFacade.capabilities));
    assert(Object.isFrozen(storeFacade.capabilities));`);
});

test('capability getters forward updated engine bindings on subsequent loads', () => {
  checkEngine(`
    const core = await import(coreUrl), store = await import(storeUrl);
    const first = await loadDocxEngine();
    core.replaceEditor(); store.replaceFindNode();
    const second = await loadDocxEngine();
    assert.notEqual(first.createDocxEditor, second.createDocxEditor);
    assert.notEqual(first.tableReaders.findNode, second.tableReaders.findNode);
    assert.equal(second.createDocxEditor, core.createDocxEditor);
    assert.equal(second.tableReaders.findNode, store.findNode);
    assert.equal(core.blankCallCount(), 1);`);
});

for (const name of reviewNames) {
  test(`missing optional ${name} keeps editing, tables and images available`, () => {
    checkEngine(`const engine = await loadDocxEngine(); assert.equal(engine.review, undefined);
      assert.equal(typeof engine.createDocxEditor, 'function'); assert.equal(typeof engine.tableReaders.findNode, 'function');
      assert(engine.imageInsertion);`, [name]);
  });
}
for (const name of [...imageNames, 'blankDocumentBytes']) {
  test(`missing optional ${name} keeps editing, tables and review available`, () => {
    checkEngine(`const engine = await loadDocxEngine(); assert.equal(engine.imageInsertion, undefined);
      assert.equal(typeof engine.createDocxEditor, 'function'); assert.equal(typeof engine.tableReaders.findNode, 'function');
      assert(engine.review);`, [name]);
  });
}
for (const name of ['createDocxEditor', 'findNode', 'parentNodeOf']) {
  test(`missing required ${name} rejects the engine`, () => {
    checkEngine('await assert.rejects(loadDocxEngine(), /Engine unavailable/);', [name]);
  });
}
