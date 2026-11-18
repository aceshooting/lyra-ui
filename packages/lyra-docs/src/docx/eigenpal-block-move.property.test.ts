import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { docxFixture } from '../../test/admission-fixtures.js';
import { normalizeDocxBatch } from './document-operations.js';
import { prepareBlockMove } from './eigenpal-block-move.js';
import { WORD_NS } from './ooxml.js';

const engine = await import('@docx-editor.dev/core/store');
const require = createRequire(import.meta.url);
const coreRequire = createRequire(require.resolve('@aceshooting/lyra-ui/package.json'));
const fc = coreRequire('fast-check');
const { propertyRuns } = coreRequire('./test/property-options.ts');

test('each legal original fragment interval moves as a stable permutation', () => {
  fc.assert(fc.property(fc.integer({ min: 1, max: 12 }), fc.nat(12), fc.nat(12), fc.nat(13), fc.boolean(),
    (length: number, from: number, span: number, destination: number, section: boolean) => {
      const paragraphs = Array.from({ length }, (_, index) =>
        '<w:p><w:r><w:t>' + String(index % 3) + '</w:t></w:r></w:p>');
      const body = paragraphs.join('') + (section ? '<w:sectPr/>' : '');
      const xml = '<w:document xmlns:w="' + WORD_NS + '"><w:body>' + body + '</w:body></w:document>';
      const read = engine.readOoxmlPackage(docxFixture({ 'word/document.xml': xml }));
      assert(read.ok);
      const pkg = read.package;
      const root = pkg.parts.get(pkg.mainDocumentPart)!.root.children.find(node => node.kind === 'body');
      assert(root?.kind === 'body');
      const start = from % length, end = start + 1 + span % (length - start);
      const before = destination % (root.children.length + 1);
      const edit = { type: 'move-blocks' as const, start, end, before };
      const normalized = normalizeDocxBatch([{ edit }], { expectedRevision: { documentId: 'doc', value: 0 } });
      if (before > start && before < end) {
        assert.deepEqual(normalized, { ok: false, code: 'invalid-option', step: 0 });
        return;
      }
      assert(normalized.ok);
      const plan = prepareBlockMove(pkg, edit);
      assert(plan.ok);
      const destinationIndex = Math.min(before, length);
      if (destinationIndex === start || destinationIndex === end) {
        assert.equal(plan.value, null);
        return;
      }
      assert(plan.value);
      const initial = Array.from(root.children);
      const expected = initial.slice();
      const removed = expected.splice(start, end - start);
      const anchor = initial[destinationIndex];
      expected.splice(anchor ? expected.indexOf(anchor) : expected.length, 0, ...removed);
      const result = plan.value(pkg);
      const actual = result.parts.get(result.mainDocumentPart)!.root.children.find(node => node.kind === 'body');
      assert(actual?.kind === 'body');
      assert.equal(actual.children.length, initial.length);
      assert(actual.children.every((node, index) => node === expected[index]));
      assert(initial.every((node, index) => node === root.children[index]), 'original package stays unchanged');
    }), propertyRuns());
});
