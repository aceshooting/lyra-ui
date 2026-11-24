import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { exportPrintableHtml, toCsv } from './data-export.js';

const parse = (csv: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i]!;
    if (quoted) { if (c === '"') { if (csv[i + 1] === '"') { field += '"'; i++; } else quoted = false; } else field += c; }
    else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r' && csv[i + 1] === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; }
    else field += c;
  }
  return rows;
};

test('CSV round-trips arbitrary text and never lets a cell start as a formula', () => {
  fc.assert(fc.property(fc.array(fc.array(fc.string({ maxLength: 20 }), { minLength: 2, maxLength: 2 }), { maxLength: 10 }), rows => {
    const result = toCsv({ columns: ['a', 'b'], rows });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const parsed = parse(result.value);
    assert.equal(parsed.length, rows.length + 1);
    parsed.slice(1).forEach((row, index) => row.forEach((value, column) => {
      assert.doesNotMatch(value, /^[=+\-@\t\r]/u);
      const original = rows[index]![column]!.replace(/\0/gu, '');
      assert.ok(value === original || value === `'${original}`);
    }));
  }), { seed: 41203, numRuns: 200 });
});

test('printable HTML never contains script, handlers or URLs for arbitrary markup', async () => {
  await fc.assert(fc.asyncProperty(fc.array(fc.constantFrom('<script>x</script>', '<a href="http://e.test">', '<div onclick="x">', '<img src=//e.test>', '<p>', '</p>', 'text', '<', '>', '"', '<style>a{}</style>', '<!--', '-->', '<svg onload=x>'), { maxLength: 12 }), async parts => {
    const result = await exportPrintableHtml(parts.join(''));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const body = result.value.slice(result.value.indexOf('<body>'));
    assert.doesNotMatch(body, /<script|<style|<a[ >]|<img|<svg|\son[a-z]+=|href=|src=|https?:/iu);
  }), { seed: 41204, numRuns: 200 });
});
