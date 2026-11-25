import assert from 'node:assert/strict';
import test from 'node:test';
import { isDeepStrictEqual } from 'node:util';
import { dashboardCatalog } from './catalog.js';
import { LINES_HEADER, createLinesParser, encodeLines, parseLines } from './lines.js';
import { buildLinesPrompt } from './prompts-lines.js';
import { validateView } from './runtime.js';
import type { LyraGenNode, LyraGenView } from './types.js';

interface Scenario { readonly id: string; readonly root: LyraGenNode; readonly refinement?: { readonly node: LyraGenNode } }
// The benchmark corpus is plain authored data; a computed specifier keeps it out of the type graph.
const corpusUrl = new URL('../../../../benchmarks/generative-ui/dashboards/scenarios.mjs', import.meta.url).href;
const tokensUrl = new URL('../../../../benchmarks/generative-ui/dashboards/tokens.mjs', import.meta.url).href;
const { scenarios } = await import(corpusUrl) as { scenarios: readonly Scenario[] };
const { approximateTokens } = await import(tokensUrl) as { approximateTokens: (text: string) => number };
const catalog = dashboardCatalog();
const reference = { id: catalog.id, version: catalog.version };
const context = { surfaceId: 'bench', revision: 3 };
const viewOf = (root: LyraGenNode): LyraGenView => ({ version: '1', catalog: reference, surfaceId: 'bench', revision: 3, root });
const plain = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
const header = `${LINES_HEADER} ${catalog.id} ${catalog.version}`;
const codes = (result: { readonly diagnostics: readonly { readonly code: string }[] }): string[] => result.diagnostics.map(item => item.code);
const encoded = (view: LyraGenView, elideIds = false): string => {
  const result = encodeLines(view, catalog, { elideIds });
  assert.ok(result.ok, JSON.stringify(result.diagnostics));
  return result.value;
};

test('every benchmark scenario round-trips through Lines and validates', () => {
  assert.ok(scenarios.length >= 13);
  for (const scenario of scenarios) {
    for (const elideIds of [false, true]) {
      const view = viewOf(scenario.root);
      const text = encoded(view, elideIds);
      const parsed = parseLines(text, catalog, { ...context, elideIds });
      assert.ok(parsed.ok, `${scenario.id}: ${JSON.stringify(parsed.diagnostics)}`);
      assert.ok(isDeepStrictEqual(plain(parsed.value), plain(view)), `${scenario.id} (elideIds ${elideIds}) round-trips`);
      assert.ok(validateView(parsed.value, catalog).ok, `${scenario.id} validates`);
    }
  }
});

test('streaming in small chunks yields the batch result and growing validated previews', () => {
  for (const scenario of scenarios) {
    const view = viewOf(scenario.root);
    const text = encoded(view);
    for (const width of [1, 7, 24]) {
      const parser = createLinesParser(catalog, { ...context, progressive: { minCodeUnits: 0 } });
      let previews = 0;
      let lastNodes = 0;
      for (let offset = 0; offset < text.length; offset += width) {
        const step = parser.push(text.slice(offset, offset + width));
        assert.equal(step.status, 'incomplete', `${scenario.id}: ${JSON.stringify(step.diagnostics)}`);
        if (step.partial) {
          previews++;
          assert.ok(validateView(step.partial.view, catalog).ok);
          const nodes = JSON.stringify(step.partial.view).split('"id":').length;
          assert.ok(nodes >= lastNodes, 'previews only grow');
          lastNodes = nodes;
        }
      }
      const final = parser.finish();
      assert.ok(final.ok);
      assert.ok(isDeepStrictEqual(plain(final.value), plain(view)), `${scenario.id} streamed at ${width}`);
      if (width === 24) assert.ok(previews >= 1, `${scenario.id} shows a preview before the end`);
    }
  }
});

test('the first preview arrives well before the end of the stream', () => {
  const view = viewOf(scenarios.find(scenario => scenario.id === 'kpi-overview')!.root);
  const text = encoded(view);
  const parser = createLinesParser(catalog, { ...context, progressive: { minCodeUnits: 0 } });
  let first: number | undefined;
  for (let offset = 0; offset < text.length && first === undefined; offset += 8) if (parser.push(text.slice(offset, offset + 8)).partial) first = offset + 8;
  assert.ok(first !== undefined && first / text.length < 0.5, `first preview at ${first} of ${text.length}`);
});

test('the format is smaller than JSON and Markup on the corpus (heuristic tokens)', () => {
  let json = 0;
  let lines = 0;
  let elided = 0;
  for (const scenario of scenarios) {
    const view = viewOf(scenario.root);
    json += approximateTokens(JSON.stringify(view));
    lines += approximateTokens(encoded(view));
    const counters = new Map<string, number>();
    const rename = (node: LyraGenNode, depth: number): LyraGenNode => {
      const ordinal = (counters.get(node.type) ?? 0) + 1;
      counters.set(node.type, ordinal);
      return { ...node, id: depth === 0 ? 'root' : `${node.type}-${ordinal}`, ...(node.children ? { children: node.children.map(child => rename(child, depth + 1)) } : {}) };
    };
    elided += approximateTokens(encoded(viewOf(rename(view.root, 0)), true));
  }
  assert.ok(lines / json < 0.7, `explicit ids ${lines} vs json ${json}`);
  assert.ok(elided < lines, `elided ids ${elided} vs explicit ${lines}`);
});

test('explicit ids are required unless elision is enabled, and derived ids are deterministic', () => {
  const text = `${header}\nstack\n stat label="A" value="1"\n stat#kept label="B" value="2"\n stat label="C" value="3"\n`;
  const strict = parseLines(text, catalog, context);
  assert.ok(!strict.ok);
  assert.deepEqual(codes(strict), ['lines.id-required']);
  assert.match(strict.diagnostics[0]!.message, /line 2, column 1/u);
  const elided = parseLines(text, catalog, { ...context, elideIds: true });
  assert.ok(elided.ok);
  assert.deepEqual(elided.value.root.children!.map(node => node.id), ['stat-1', 'kept', 'stat-3']);
  assert.equal(elided.value.root.id, 'root');
  const collision = parseLines(`${header}\nstack\n stat label="A" value="1"\n stat#stat-1 label="B" value="2"\n`, catalog, { ...context, elideIds: true });
  assert.ok(!collision.ok);
  assert.deepEqual(codes(collision), ['lines.duplicate-id']);
});

test('the header pins the positional order to the catalog id and version', () => {
  const body = 'stack#root\n stat#a "Revenue" "1"\n';
  assert.ok(parseLines(`${header}\n${body}`, catalog, context).ok);
  assert.deepEqual(codes(parseLines(body, catalog, context)), ['lines.header']);
  assert.deepEqual(codes(parseLines(`${LINES_HEADER} ${JSON.stringify(catalog.id)} 999\n${body}`, catalog, context)), ['lines.catalog-mismatch']);
  assert.deepEqual(codes(parseLines(`${LINES_HEADER} other ${catalog.version}\n${body}`, catalog, context)), ['lines.catalog-mismatch']);
  assert.deepEqual(codes(parseLines(`lines/2 ${JSON.stringify(catalog.id)} ${catalog.version}\n${body}`, catalog, context)), ['lines.header']);
});

test('values: positional, named, enum bare words, JSON, members and text', () => {
  const text = `${header}\nstack#root\n stat#a "Revenue" "1.2M" unit="EUR" deltaPercent=4.2 goodDirection=up variant=success\n chart#c "Trend" ["Jan","Feb"] [{"label":"R","data":[1,2]}] type=line\n heading#h | Title with | pipes \\\\ and\\nbreak\n gauge#g "CPU" 0 @liveReads={"value":"/cpu"}\n`;
  const parsed = parseLines(text, catalog, context);
  assert.ok(parsed.ok, JSON.stringify(parsed.diagnostics));
  const [stat, chart, heading, gauge] = parsed.value.root.children!;
  assert.deepEqual(plain(stat!.props), { label: 'Revenue', value: '1.2M', unit: 'EUR', deltaPercent: 4.2, goodDirection: 'up', variant: 'success' });
  assert.deepEqual(plain(chart!.props), { label: 'Trend', labels: ['Jan', 'Feb'], datasets: [{ label: 'R', data: [1, 2] }], type: 'line' });
  assert.equal(heading!.text, 'Title with | pipes \\ and\nbreak');
  assert.deepEqual(plain(gauge!.liveReads), { value: '/cpu' });
  assert.ok(validateView(parsed.value, catalog).ok);
});

test('a bare word is only accepted where the property schema enumerates it', () => {
  const free = parseLines(`${header}\nstack#root\n stat#a Revenue "1"\n`, catalog, context);
  assert.deepEqual(codes(free), ['lines.bare-word']);
  const unknown = parseLines(`${header}\nstack#root\n stat#a "R" "1" variant=sparkly\n`, catalog, context);
  assert.deepEqual(codes(unknown), ['lines.bare-word']);
});

test('adversarial structure is rejected with line and column diagnostics', () => {
  const cases: readonly [string, string][] = [
    ['stack#root\n   stat#a "R" "1"\n  stat#b "R" "1"\n', 'lines.indent'],
    ['stack#root\n stack#s\n   stat#a "R" "1"\n', 'lines.indent'],
    ['stack#root\n\tstat#a "R" "1"\n', 'lines.indent'],
    [' stack#root\n', 'lines.indent'],
    ['stack#root\nstack#two\n', 'lines.multiple-roots'],
    ['stack#root\n blink#x\n', 'lines.unknown-type'],
    ['stack#root\n stat#a "R" "1" "extra"\n', 'lines.positional-count'],
    ['stack#root\n stat#a unit="x" "R"\n', 'lines.positional-order'],
    ['stack#root\n stat#a "R" "1" label="again"\n', 'lines.duplicate'],
    ['stack#root\n stat#a "R" "1" unit="x" unit="y"\n', 'lines.duplicate'],
    ['stack#root\n stat#a "R" "1" @bogus={}\n', 'lines.unknown-member'],
    ['stack#root\n stat#a "R" "1" __proto__={"x":1}\n', 'lines.unsafe-key'],
    ['stack#root\n stat#a "R" "1" @a11y={"label":"x","label":"y"}\n', 'lines.json'],
    ['stack#root\n stat#a "R\n', 'lines.unterminated'],
    ['stack#root\n stat#a ["R" "1"\n', 'lines.unterminated'],
    ['stack#root\n stat#a "R""1"\n', 'lines.separator'],
    ['stack#root\n heading#h |x\n', 'lines.separator'],
    ['stack#root\n heading#h | bad \\q escape\n', 'lines.escape'],
    ['stack#root\n stat#a "R" "1" unit="x\u0007"\n', 'lines.control-character'],
    ['stack#root\n stat#a "R" "1"\n stat#a "S" "2"\n', 'lines.duplicate-id'],
    ['stack#root\n stat#bad id "R" "1"\n', 'lines.bare-word'],
    ['stack#root\n stat#a 01 "1"\n', 'lines.value'],
  ];
  for (const [body, code] of cases) {
    const result = parseLines(`${header}\n${body}`, catalog, context);
    assert.ok(!result.ok, `${JSON.stringify(body)} is rejected`);
    assert.deepEqual(codes(result), [code], `${JSON.stringify(body)}: ${JSON.stringify(result.diagnostics)}`);
    assert.match(result.diagnostics[0]!.message, /line \d+, column \d+/u);
    assert.ok(result.diagnostics[0]!.source, 'carries a source range');
  }
});

test('strings cannot inject lines, members or text', () => {
  const tricky = 'a" @action={"name":"x"}\n stat#evil "x" "y" | z';
  const view = viewOf({ id: 'root', type: 'stack', children: [{ id: 's', type: 'stat', props: { label: tricky, value: '| \\n', caption: '#id @x=1' } }, { id: 'h', type: 'heading', text: '\n stat#evil "a" "b"\r\t\\' }] });
  const text = encoded(view);
  assert.equal(text.split('\n').filter(Boolean).length, 4, 'one header and three node lines');
  const parsed = parseLines(text, catalog, context);
  assert.ok(parsed.ok);
  assert.ok(isDeepStrictEqual(plain(parsed.value), plain(view)));
});

test('limits bound input size, line length, depth, nodes and fields', () => {
  const big = `${header}\nstack#root\n${Array.from({ length: 20 }, (_, index) => ` stat#s${index} "R" "1"`).join('\n')}\n`;
  assert.deepEqual(codes(parseLines(big, catalog, { ...context, limits: { maxLength: 100 } })), ['lines.limit-length']);
  assert.deepEqual(codes(parseLines(big, catalog, { ...context, limits: { maxNodes: 5 } })), ['lines.limit-nodes']);
  assert.deepEqual(codes(parseLines(`${header}\nstack#root\n stat#a "${'x'.repeat(200)}" "1"\n`, catalog, { ...context, limits: { maxLineLength: 100 } })), ['lines.limit-line']);
  const deep = `${header}\n${Array.from({ length: 6 }, (_, depth) => `${' '.repeat(depth)}stack#d${depth}`).join('\n')}\n`;
  assert.deepEqual(codes(parseLines(deep, catalog, { ...context, limits: { maxDepth: 4 } })), ['lines.limit-depth']);
  assert.deepEqual(codes(parseLines(`${header}\nstack#root\n stat#a "R" "1" unit="a" caption="b"\n`, catalog, { ...context, limits: { maxFields: 3 } })), ['lines.limit-fields']);
  // An over-long line is refused while streaming, before its newline arrives.
  const parser = createLinesParser(catalog, { ...context, limits: { maxLineLength: 50 } });
  assert.equal(parser.push(`${header}\n`).status, 'incomplete');
  assert.equal(parser.push(`stack#root "${'x'.repeat(80)}`).status, 'error');
  assert.ok(!parser.finish().ok);
  // Overrides can only lower the ceilings.
  assert.ok(parseLines(big, catalog, { ...context, limits: { maxNodes: 1e9 } }).ok);
});

test('stream lifecycle: empty, cancelled, closed and CRLF input', () => {
  assert.deepEqual(codes(parseLines(`${header}\n`, catalog, context)), ['lines.empty']);
  assert.deepEqual(codes(parseLines('', catalog, context)), ['lines.header']);
  const parser = createLinesParser(catalog, context);
  parser.push(`${header}\nstack#root\n`);
  assert.deepEqual(codes(parser.cancel()), ['lines.cancelled']);
  assert.equal(parser.push('x').status, 'error');
  const crlf = parseLines(`${header}\r\nstack#root\r\n stat#a "R" "1"\r\n`, catalog, context);
  assert.ok(crlf.ok);
  assert.deepEqual(codes(parseLines(`${header}\nstack#root\n`, catalog, { surfaceId: '', revision: 0 })), ['lines.context']);
});

test('the encoder refuses what the format cannot carry', () => {
  assert.deepEqual(codes(encodeLines(viewOf({ id: 'root', type: 'blink' }), catalog)), ['lines.encode.unknown-type']);
  assert.deepEqual(codes(encodeLines(viewOf({ id: 'root', type: 'stack', extra: 1 } as unknown as LyraGenNode), catalog)), ['lines.encode.member']);
  assert.deepEqual(codes(encodeLines({ ...viewOf({ id: 'root', type: 'stack' }), catalog: { id: 'other', version: '1' } }, catalog)), ['lines.encode.catalog']);
});

test('required props supplied by a binding fall back to named props after the gap', () => {
  const view = viewOf({ id: 'root', type: 'stack', children: [{ id: 'g', type: 'gauge', props: { value: 3 }, reads: { label: '/x' } }] });
  const text = encoded(view);
  assert.match(text, / gauge#g value=3 /u);
  const parsed = parseLines(text, catalog, context);
  assert.ok(parsed.ok);
  assert.ok(isDeepStrictEqual(plain(parsed.value), plain(view)));
});

test('the Lines prompt states the header, positional order and example syntax', () => {
  const prompt = buildLinesPrompt(catalog, { profile: 'compact', maxCharacters: 400000 });
  assert.ok(prompt.includes(header), 'states the exact header');
  assert.match(prompt, /stat label value/u);
  assert.match(prompt, /chart label labels datasets/u);
  assert.ok(!prompt.includes('Return one JSON LyraGenView'));
  assert.ok(prompt.includes('Use plain text.'), 'keeps the shared content rules');
  const signature = buildLinesPrompt(catalog, { elideIds: true });
  assert.ok(signature.length < prompt.length);
  assert.match(signature, /<type>-<n>/u);
  assert.throws(() => buildLinesPrompt(catalog, { maxCharacters: 100 }), RangeError);
  const withExamples = buildLinesPrompt(catalog, { profile: 'signature', examples: true });
  assert.ok(withExamples.includes('Examples:'));
});
