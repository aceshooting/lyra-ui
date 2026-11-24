import type { LyraGenComponent, LyraGenNode, LyraGenSchema } from '../types.js';
import { array, boolean, choice, count, documentation, label, number, object, string } from './shared.js';

/**
 * Technical-answer roles: code, JSON, diffs, test runs and traces. Content is plain text
 * or bounded JSON; copy-to-clipboard, search, editing, highlight anchors, remote sources and
 * callbacks stay host-owned.
 */
const example = (id: string, type: string, props: Record<string, unknown>): LyraGenNode => ({ id, type, props } as LyraGenNode);
const duration: LyraGenSchema = { type: 'number', minimum: 0, maximum: 1e9 };
const timestamp: LyraGenSchema = { type: 'number', minimum: 0, maximum: 1e12 };

/** Closed grammar ids the code block highlights; anything else renders as plain text. */
const codeLanguages = ['bash', 'c', 'cpp', 'csharp', 'css', 'diff', 'go', 'graphql', 'html', 'java', 'javascript', 'json', 'jsx', 'kotlin', 'markdown', 'php', 'python', 'ruby', 'rust', 'shell', 'sql', 'swift', 'toml', 'tsx', 'typescript', 'xml', 'yaml'];

/** JSON of bounded depth: scalars, arrays and string-keyed maps nested at most `depth` containers deep. */
function jsonValue(depth: number): LyraGenSchema {
  const leaf: LyraGenSchema = { anyOf: [string(1024), number, boolean, { type: 'null' }] };
  if (depth <= 0) return leaf;
  const inner = jsonValue(depth - 1);
  return { anyOf: [leaf, array(inner, 100), { type: 'object', properties: {}, additionalProperties: inner, maxProperties: 100, propertyNames: { type: 'string', maxLength: 128 } }] };
}

const spanStatus = choice('pending', 'running', 'success', 'error', 'denied', 'incomplete');
const span = object({
  id: { type: 'string', minLength: 1, maxLength: 128 },
  parentId: string(128),
  name: label,
  kind: choice('agent', 'llm', 'tool', 'retriever', 'embedding', 'other'),
  startMs: timestamp,
  endMs: timestamp,
  status: spanStatus,
  detail: string(512),
}, ['id', 'name', 'kind', 'startMs', 'status']);
const spans: LyraGenSchema = { ...array(span, 500), minItems: 1 } as LyraGenSchema;
const spanSize = choice('s', 'm', 'l');
const frame = choice('card', 'plain');

const testCase = object({
  id: { type: 'string', minLength: 1, maxLength: 128 },
  name: label,
  status: choice('passed', 'failed', 'skipped', 'running'),
  durationMs: duration,
  message: string(1024),
}, ['id', 'name', 'status']);
const testSuite = object({ id: { type: 'string', minLength: 1, maxLength: 128 }, name: label, tests: array(testCase, 100) }, ['id', 'name', 'tests']);

const sampleSpans = [
  { id: 'agent', name: 'Answer question', kind: 'agent', startMs: 0, endMs: 900, status: 'success' },
  { id: 'search', parentId: 'agent', name: 'Search docs', kind: 'tool', startMs: 40, endMs: 420, status: 'success' },
  { id: 'draft', parentId: 'agent', name: 'Draft reply', kind: 'llm', startMs: 430, endMs: 880, status: 'success' },
];

export const technicalAnswerRoles: Readonly<Record<string, LyraGenComponent>> = {
  'code-block': {
    tag: 'lr-code-block',
    properties: { label, code: string(16384), language: choice(...codeLanguages), filename: string(256), lineNumbers: boolean, wrap: boolean, collapsible: boolean, collapsed: boolean },
    required: ['label', 'code'],
    accessibleName: { required: true, properties: ['label'] },
    useWhen: 'Show a source or command snippet of at most 16384 characters, optionally highlighted for one listed language.',
    examples: [example('snippet', 'code-block', { label: 'Retry helper', code: 'const retry = (fn) => fn().catch(() => fn());', language: 'javascript', lineNumbers: true })],
    load: () => import('@aceshooting/lyra-ui/components/lr-code-block.js'),
    documentation: documentation('lr-code-block'),
  },
  'json-viewer': {
    tag: 'lr-json-viewer',
    properties: { data: jsonValue(4), expandDepth: count(10), layout: choice('auto', 'inline', 'stacked') },
    required: ['data'],
    useWhen: 'Inspect a raw JSON payload at most four containers deep, such as an API response or a configuration.',
    examples: [example('payload', 'json-viewer', { data: { status: 'ok', items: [{ id: 1, name: 'alpha' }], total: 1 }, expandDepth: 2 })],
    load: () => import('@aceshooting/lyra-ui/components/lr-json-viewer.js'),
    documentation: documentation('lr-json-viewer'),
  },
  'diff-view': {
    tag: 'lr-diff-view',
    properties: { oldText: string(16384), newText: string(16384), language: choice(...codeLanguages), layout: choice('unified', 'split'), contextLines: count(50), maxLines: count(5000, 1) },
    required: ['oldText', 'newText'],
    useWhen: 'Compare two versions of a text or source of at most 16384 characters each.',
    examples: [example('change', 'diff-view', { oldText: 'timeout: 30\nretries: 1\n', newText: 'timeout: 60\nretries: 3\n', language: 'yaml', layout: 'unified' })],
    load: () => import('@aceshooting/lyra-ui/components/lr-diff-view.js'),
    documentation: documentation('lr-diff-view'),
  },
  'test-results': {
    tag: 'lr-test-results',
    properties: { suites: { ...array(testSuite, 50), minItems: 1 } as LyraGenSchema, runState: choice('idle', 'running', 'complete'), runId: string(256), withoutAutoExpandFailures: boolean },
    required: ['suites'],
    useWhen: 'Summarise a finished or running test run as at most 50 suites of at most 100 tests with status and duration.',
    examples: [example('run', 'test-results', { runState: 'complete', suites: [{ id: 'unit', name: 'Unit', tests: [{ id: 'adds', name: 'adds numbers', status: 'passed', durationMs: 4 }, { id: 'parses', name: 'parses dates', status: 'failed', durationMs: 12, message: 'Expected 2026-11-24' }] }] })],
    load: () => import('@aceshooting/lyra-ui/components/lr-test-results.js'),
    documentation: documentation('lr-test-results'),
  },
  'trace-tree': {
    tag: 'lr-trace-tree',
    properties: { label, spans, frame, size: spanSize, withCost: boolean, withTokens: boolean, withoutBars: boolean, maxNodes: count(500, 1) },
    required: ['label', 'spans'],
    accessibleName: { required: true, properties: ['label'] },
    useWhen: 'Show at most 500 spans of an agent or request trace as a nested tree linked by parentId, with status and timing.',
    examples: [example('trace', 'trace-tree', { label: 'Request trace', spans: sampleSpans })],
    load: () => import('@aceshooting/lyra-ui/components/lr-trace-tree.js'),
    documentation: documentation('lr-trace-tree'),
  },
  'span-waterfall': {
    tag: 'lr-span-waterfall',
    properties: { label, spans, frame, size: spanSize, viewStartMs: timestamp, viewEndMs: timestamp, withoutAxis: boolean, maxNodes: count(500, 1) },
    required: ['label', 'spans'],
    accessibleName: { required: true, properties: ['label'] },
    useWhen: 'Show at most 500 spans on a shared time axis to compare when each started and how long it ran.',
    examples: [example('timeline', 'span-waterfall', { label: 'Request timeline', spans: sampleSpans })],
    load: () => import('@aceshooting/lyra-ui/components/lr-span-waterfall.js'),
    documentation: documentation('lr-span-waterfall'),
  },
};
