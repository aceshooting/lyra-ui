import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  compactBuildDeclarations,
  compactDeclarationText,
} from './compact-build-declarations.mjs';

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
