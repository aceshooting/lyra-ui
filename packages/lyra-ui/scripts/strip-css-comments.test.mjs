import assert from 'node:assert/strict';
import test from 'node:test';

import { stripCssCommentsFromModule, stripCssTemplateChunks } from './strip-css-comments.mjs';

const OPEN = '/*';
const CLOSE = '*/';
/** Written by concatenation so this file's own tagged templates never carry a CSS comment. */
const comment = (text) => `${OPEN} ${text} ${CLOSE}`;

test('removes a whole-line comment together with its indentation and newline', () => {
  const source = `import{css}from'lit';const s=css\`\n  .a { color: red; }\n  ${comment('why')}\n  .b { color: blue; }\n\`;`;

  const result = stripCssCommentsFromModule(source, 'a.js');

  assert.equal(
    result.code,
    `import{css}from'lit';const s=css\`\n  .a { color: red; }\n  .b { color: blue; }\n\`;`,
  );
  assert.equal(result.templates, 1);
  assert.ok(result.removedBytes > 0);
});

test('collapses to a single space only when no delimiter survives on either side', () => {
  const strip = (body) => stripCssTemplateChunks([body])[0];

  assert.equal(strip(`a${comment('x')}b`), 'a b');
  assert.equal(strip(`a ${comment('x')}b`), 'a b');
  assert.equal(strip(`a${comment('x')} b`), 'a b');
  // A comment owning a whole line takes that line with it; the previous line's newline survives.
  assert.equal(strip(`a\n${comment('x')}\nb`), 'a\nb');
  assert.equal(strip(`a\n  ${comment('x')}  \n  b`), 'a\n  b');
});

test('never welds tokens across an interpolation boundary', () => {
  // The comment sits at a chunk edge, so the only surviving neighbour is the interpolation.
  assert.deepEqual(stripCssTemplateChunks(['color:', `${comment('x')}red;`]), ['color:', ' red;']);
  assert.deepEqual(stripCssTemplateChunks([`a{b:c${comment('x')}`, 'd}']), ['a{b:c ', 'd}']);
  // A delimiter on the far side still makes removal free.
  assert.deepEqual(stripCssTemplateChunks(['color:', `${comment('x')} red;`]), ['color:', ' red;']);
});

test('reproduces every interpolation and all surrounding JavaScript byte for bytes', () => {
  const source =
    `import{css}from'lit';\n` +
    `import{formControlRequiredMarker}from'../form-control.styles.js';\n` +
    `const gap='4px';\n` +
    `const s=css\`\n  .a {\n    gap: \${gap};\n  }\n  ${comment('marker')}\n  \${formControlRequiredMarker}\n\`;\n` +
    `export{s};\n`;

  const { code } = stripCssCommentsFromModule(source, 'b.js');

  assert.ok(code.includes('${gap}'));
  assert.ok(code.includes('${formControlRequiredMarker}'));
  assert.equal(code.split('${').length, source.split('${').length);
  assert.ok(!code.includes('marker '.trim() + ' ' + CLOSE));
  assert.equal(code.startsWith(`import{css}from'lit';\n`), true);
  assert.equal(code.endsWith('export{s};\n'), true);
});

test('leaves JavaScript outside a css template untouched, including MIME strings', () => {
  // `dist/components/media/file-input/accept.js` really does ship `'*/*'` and `'/*'` as data; a
  // blanket regex over the emitted file corrupts both.
  const source =
    `const patterns=['image/*','*/*','/*'];\n` +
    `${OPEN} a real JavaScript comment ${CLOSE}\n` +
    `const s=css\`\n  .a { color: red; }\n  ${comment('gone')}\n\`;\n`;

  const { code } = stripCssCommentsFromModule(source, 'c.js');

  assert.ok(code.includes(`const patterns=['image/*','*/*','/*'];`));
  assert.ok(code.includes(`${OPEN} a real JavaScript comment ${CLOSE}`));
  assert.ok(!code.includes('gone'));
});

test('keeps a comment sequence that is CSS string or url() content', () => {
  const body =
    `\n  .a::after { content: '${OPEN}'; }\n` +
    `  .b::after { content: "x ${CLOSE} y"; }\n` +
    `  .c { background: url(data:image/svg+xml;utf8,<svg>${OPEN}</svg>); }\n` +
    `  .d { background: url( data:text/plain,${OPEN}${CLOSE} ); }\n` +
    `  ${comment('this one goes')}\n  .e { color: red; }\n`;

  const [stripped] = stripCssTemplateChunks([body]);

  assert.ok(stripped.includes(`content: '${OPEN}';`));
  assert.ok(stripped.includes(`content: "x ${CLOSE} y";`));
  assert.ok(stripped.includes(`url(data:image/svg+xml;utf8,<svg>${OPEN}</svg>)`));
  assert.ok(stripped.includes(`url( data:text/plain,${OPEN}${CLOSE} )`));
  assert.ok(!stripped.includes('this one goes'));
});

test('keeps a quoted url() as an ordinary string and still strips after it', () => {
  const body = `.a { background: url("data:text/plain,${OPEN}") ${comment('gone')}; }`;

  const [stripped] = stripCssTemplateChunks([body]);

  assert.equal(stripped, `.a { background: url("data:text/plain,${OPEN}") ; }`);
});

test('holds string context across an interpolation that splits a value', () => {
  const chunks = [`.a::after { content: "`, `${OPEN} still inside the string`, `"; }`];

  assert.deepEqual(stripCssTemplateChunks(chunks), chunks);
});

test('holds url() context across an interpolated URL', () => {
  const chunks = [`.a { background: url(`, `${OPEN}x${CLOSE}) ${comment('gone')}; }`];

  const stripped = stripCssTemplateChunks(chunks);

  assert.equal(stripped[0], chunks[0]);
  assert.equal(stripped[1], `${OPEN}x${CLOSE}) ; }`);
});

test('preserves escaped backticks outside a comment and drops them inside one', () => {
  const body = `.a::after { content: '\\\`'; }\n  ${OPEN} mentions a \\\` backtick ${CLOSE}\n  .b {}`;

  const [stripped] = stripCssTemplateChunks([body]);

  assert.ok(stripped.includes(`content: '\\\`';`));
  assert.ok(!stripped.includes('backtick'));
});

test('refuses a comment that spans an interpolation instead of guessing', () => {
  assert.throws(
    () => stripCssTemplateChunks([`.a {} ${OPEN} opens here`, ` closes there ${CLOSE}`], 'x'),
    /spans an interpolation/u,
  );
});

test('refuses a comment opener that a backslash escape may have neutralised', () => {
  assert.throws(
    () => stripCssTemplateChunks([`.a { color: red\\\\${OPEN}x${CLOSE} }`], 'x'),
    /backslash escape/u,
  );
});

test('is idempotent and leaves comment-free modules byte-identical', () => {
  const source = `const s=css\`\n  .a { color: red; }\n  ${comment('once')}\n\`;`;

  const first = stripCssCommentsFromModule(source, 'd.js');
  const second = stripCssCommentsFromModule(first.code, 'd.js');

  assert.equal(second.code, first.code);
  assert.equal(second.removedBytes, 0);
  assert.equal(second.chunksChanged, 0);
});

test('ignores html, svg, and other tagged templates', () => {
  const source =
    `const t=html\`<p>${OPEN} not a comment ${CLOSE}</p>\`;\n` +
    `const u=svg\`<title>${OPEN}${CLOSE}</title>\`;\n`;

  const result = stripCssCommentsFromModule(source, 'e.js');

  assert.equal(result.code, source);
  assert.equal(result.templates, 0);
});
