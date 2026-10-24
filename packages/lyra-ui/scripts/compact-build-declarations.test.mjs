import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ts } from '@custom-elements-manifest/analyzer';
import {
  compactBuildDeclarations,
  compactDeclarationText,
  stripPrivateMemberJsdoc,
} from './compact-build-declarations.mjs';

const privateDocs = `/** Class documentation. */
export declare class Documented {
  /** Public API documentation. */
  value: string;
  /** Protected extension documentation. */
  protected extension(): void;
  /** Private implementation documentation. */
  private cache;
  /** Private method documentation. */
  private refresh(): void;
  // A non-doc comment separates this private member from the earlier JSDoc.
  private separated;
}
`;
const strippedPrivateDocs = stripPrivateMemberJsdoc(privateDocs);
assert.match(strippedPrivateDocs, /Class documentation/);
assert.match(strippedPrivateDocs, /Public API documentation/);
assert.match(strippedPrivateDocs, /Protected extension documentation/);
assert.doesNotMatch(strippedPrivateDocs, /Private implementation documentation|Private method documentation/);
assert.match(strippedPrivateDocs, /private cache|private refresh|private separated/);
assert.equal(stripPrivateMemberJsdoc(strippedPrivateDocs), strippedPrivateDocs);

const source = `export declare class Example {
    /** IDE documentation remains available.
     * A nested line remains nested relative to the comment marker. */
    value: {
        nested: string;
    };
    template: \`first
        significant template indentation
    last\`;
}
export declare function use(value: string): Promise<readonly string[]>;
`;
const expected = `export declare class Example{
/** IDE documentation remains available.
* A nested line remains nested relative to the comment marker. */
value:{nested:string;};template:\`first
        significant template indentation
    last\`;}export declare function use(value:string):Promise<readonly string[]>;
`;
assert.equal(compactDeclarationText(source), expected);
assert.equal(compactDeclarationText(expected), expected, 'declaration compaction is idempotent');

function documentationSnapshot(text) {
  const parsed = ts.createSourceFile('documented.d.ts', text, ts.ScriptTarget.Latest, true);
  assert.equal(parsed.parseDiagnostics.length, 0);
  const documents = [];
  function visit(node) {
    for (const doc of node.jsDoc ?? []) {
      documents.push({
        comment: ts.getTextOfJSDocComment(doc.comment),
        tags: [...doc.tags ?? []].map(tag => ({
          tag: tag.tagName.text,
          name: tag.name?.getText(parsed),
          type: tag.typeExpression?.getText(parsed),
          comment: ts.getTextOfJSDocComment(tag.comment),
        })),
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  return documents;
}

function declarationTokens(text) {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, text);
  const tokens = [];
  while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken) tokens.push(scanner.getTokenText());
  return tokens;
}

const documented = `/** Public class with {@link Other} and a final marker *. */
export declare class Documented {
  /** Public value documentation. */
  value: string;
  /** Protected extension documentation. */
  protected extension(): void;
  /** @deprecated Use value instead. */
  oldValue: string;
  /** @example const result = item.run('input'); */
  run(value: string): string;
  /** @returns The current result. */
  result(): string;
}
/** @param value Input with {@link Documented} documentation. */
export declare function read(value: Documented): string;
/** @see Documented */
export declare class Other {}
`;
const compactedDocumentation = compactDeclarationText(documented);
const framingSpaces = documented.match(/ \*\//gu).length;
assert.equal(framingSpaces, 8);
assert.equal(compactedDocumentation.includes(' */'), false);
assert.deepEqual(documentationSnapshot(compactedDocumentation), documentationSnapshot(documented),
  'the TypeScript compiler must retain all public/protected JSDoc text, links and tags');
assert.equal(documentationSnapshot(compactedDocumentation).length, 8);
assert.deepEqual(declarationTokens(compactedDocumentation), declarationTokens(documented),
  'documentation compaction must retain every declaration token');
assert.equal(compactDeclarationText(compactedDocumentation), compactedDocumentation);

const preservedComments = `/** */
export declare const empty: string;
/** Two trailing spaces.  */
export declare const trailing: string;
/** Multiple lines.
 * Preserve this closing line. */
export declare const multiline: string;
/* Ordinary comment. */
export declare const ordinary: string;
export declare const literal: '/** Literal content. */';
export declare const template: \`/** Template content. */\`;
`;
const preserved = compactDeclarationText(preservedComments);
for (const text of ['/** */', '/** Two trailing spaces.  */', '* Preserve this closing line. */',
  '/* Ordinary comment. */', "'/** Literal content. */'", '`/** Template content. */`']) {
  assert.ok(preserved.includes(text), `preserves ${text}`);
}
assert.deepEqual(documentationSnapshot(preserved), documentationSnapshot(preservedComments));
assert.deepEqual(declarationTokens(preserved), declarationTokens(preservedComments));
assert.equal(compactDeclarationText(preserved), preserved);

const fixture = await mkdtemp(path.join(tmpdir(), 'lyra-compact-declarations-'));
try {
  const nested = path.join(fixture, 'nested');
  await mkdir(nested);
  await writeFile(path.join(nested, 'entry.d.ts'), source);
  await writeFile(path.join(nested, 'entry.js'), '    export const untouched = true;\n');
  const result = await compactBuildDeclarations(fixture);
  assert.equal(result.files, 1);
  assert.ok(result.afterBytes < result.beforeBytes);
  assert.equal(await readFile(path.join(nested, 'entry.d.ts'), 'utf8'), expected);
  assert.equal(await readFile(path.join(nested, 'entry.js'), 'utf8'), '    export const untouched = true;\n');
} finally {
  await rm(fixture, { recursive: true, force: true });
}

console.log('published declaration compaction test passed.');
