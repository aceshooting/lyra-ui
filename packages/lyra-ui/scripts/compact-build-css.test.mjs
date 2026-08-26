import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  compactBuildCss,
  compactCssModule,
  collapseCssWhitespaceChunks,
} from './compact-build-css.mjs';

const source =
  `import{css}from'lit';\n` +
  `const gap='4px';\n` +
  `const plain=css\`\n  .a { color: red; padding: 0px 0px 0px 0px; }\n\`;\n` +
  `const interpolated=css\`\n  .b { gap: \${gap}; content: "a   b"; }\n\`;\n` +
  `export{plain,interpolated};\n`;

const compacted = compactCssModule(source, 'entry.js');
assert.ok(compacted.code.length < source.length);
assert.ok(compacted.code.includes('${gap}'), 'interpolation source stays byte-identical');
assert.ok(compacted.code.includes('content: "a   b"'), 'CSS string whitespace stays significant');
assert.ok(!compacted.code.includes('0px 0px 0px 0px'));
assert.equal(compactCssModule(compacted.code, 'entry.js').code, compacted.code);

assert.deepEqual(
  collapseCssWhitespaceChunks([
    '\n  .a   .b {\n    width: calc(100% - ',
    ');\n    content: "a   b";\n  }\n',
  ]),
  [' .a .b { width: calc(100% - ', '); content: "a   b"; } '],
);

const fixture = await mkdtemp(path.join(tmpdir(), 'lyra-compact-css-'));
try {
  const styles = path.join(fixture, 'styles');
  await mkdir(styles);
  await writeFile(path.join(fixture, 'entry.js'), source);
  await writeFile(
    path.join(styles, 'theme.css'),
    '/* published CSS comment */\n.a { margin: 0px 0px 0px 0px; }\n',
  );
  const result = await compactBuildCss(fixture);
  assert.equal(result.modules, 1);
  assert.equal(result.stylesheets, 1);
  assert.ok(result.removedBytes > 0);
  assert.doesNotMatch(await readFile(path.join(styles, 'theme.css'), 'utf8'), /published CSS comment|0px 0px/);
} finally {
  await rm(fixture, { recursive: true, force: true });
}

console.log('published CSS compaction test passed.');
