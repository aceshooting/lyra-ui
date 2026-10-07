import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
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
