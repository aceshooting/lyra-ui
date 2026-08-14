import assert from 'node:assert/strict';
import test from 'node:test';

import { findUnexpectedDiagnostics, structuralDocsFailure } from './docs-diagnostics.mjs';

const resultWith = (pageId, kind, diagnostic) => ({
  id: pageId,
  diagnostics: {
    console: kind === 'console' ? [diagnostic] : [],
    pageErrors: kind === 'pageError' ? [diagnostic] : [],
    requests: kind === 'request' ? [diagnostic] : [],
    responses: kind === 'response' ? [diagnostic] : [],
    navigations: kind === 'navigation' ? [diagnostic] : [],
  },
});

test('allows only the documented page-scoped intentional diagnostics', () => {
  const fixtures = [
    resultWith('animatedimage--docs', 'console', {
      type: 'error',
      text: 'Failed to load resource: the server responded with a status of 404 (Not Found)',
      url: 'http://127.0.0.1:6006/does-not-exist-lr-animated-image.gif',
    }),
    resultWith('map--docs', 'pageError', 'TypeError: Failed to fetch'),
    resultWith('map--docs', 'console', {
      type: 'warning',
      text: '[.WebGL-0x123]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels',
      url: 'http://127.0.0.1:6006/iframe.html?id=map--docs&viewMode=docs',
    }),
    resultWith('components-avatar--docs', 'request', {
      url: 'https://example.invalid/nonexistent.png',
      error: 'net::ERR_NAME_NOT_RESOLVED',
    }),
    resultWith('docxviewer--docs', 'response', {
      url: 'https://example.invalid/missing.docx',
      status: 404,
    }),
    resultWith('animatedimage--docs', 'response', {
      url: 'http://127.0.0.1:6006/does-not-exist-lr-animated-image.gif',
      status: 404,
    }),
    resultWith('toolresultview--docs', 'console', {
      type: 'warning',
      text: 'lr-render-error {toolName: broken_renderer, error: Error: this renderer always throws, to demonstrate the fallback path\n    at Object.render (http://127.0.0.1:6006/assets/tool-result-view.stories-AbC123.js:1:1)}',
      url: 'http://127.0.0.1:6006/assets/tool-result-view.stories-AbC123.js',
    }),
    resultWith('widget-renderer--docs', 'console', {
      type: 'warning',
      text: '[lr-widget-renderer] skipped unknown widget type "evil-widget" (and its subtree)',
      url: 'http://127.0.0.1:6006/assets/lyra-components-AbC123.js',
    }),
  ];

  for (const fixture of fixtures) assert.deepEqual(findUnexpectedDiagnostics(fixture), []);
});

test('rejects every diagnostic kind that is not explicitly allowed', () => {
  const fixtures = [
    resultWith('checkbox--docs', 'console', {
      type: 'error',
      text: 'boom',
      url: '',
    }),
    resultWith('checkbox--docs', 'pageError', 'Error: boom'),
    resultWith('checkbox--docs', 'request', {
      url: 'https://assets.example.com/a.js',
      error: 'failed',
    }),
    resultWith('checkbox--docs', 'response', {
      url: 'https://assets.example.com/a.js',
      status: 500,
    }),
    resultWith('checkbox--docs', 'navigation', 'http://127.0.0.1:6006/iframe.html?id=other--docs'),
  ];

  for (const fixture of fixtures) assert.equal(findUnexpectedDiagnostics(fixture).length, 1);
});

test('does not allow an intentional diagnostic on the wrong docs page', () => {
  const fixture = resultWith('checkbox--docs', 'console', {
    type: 'error',
    text: 'Failed to load resource: the server responded with a status of 404 (Not Found)',
    url: 'http://127.0.0.1:6006/does-not-exist-lr-animated-image.gif',
  });

  assert.equal(findUnexpectedDiagnostics(fixture).length, 1);
});

test('does not allow an intentional warning from the wrong built module', () => {
  const fixture = resultWith('widget-renderer--docs', 'console', {
    type: 'warning',
    text: '[lr-widget-renderer] skipped unknown widget type "evil-widget" (and its subtree)',
    url: 'http://127.0.0.1:6006/assets/unrelated-AbC123.js',
  });

  assert.equal(findUnexpectedDiagnostics(fixture).length, 1);
});

test('fails a docs page with no Show code controls', () => {
  assert.match(
    structuralDocsFailure({
      clicked: 0,
      remaining: 0,
      expandedControls: 0,
      sourceTexts: [],
      settled: true,
      reachedClickCap: false,
    }),
    /no Show code controls/i
  );
});

test('allows a guide page that intentionally has no component canvas', () => {
  assert.equal(
    structuralDocsFailure({
      clicked: 0,
      remaining: 0,
      expandedControls: 0,
      sourceTexts: [],
      settled: true,
      reachedClickCap: false,
      requiresControls: false,
    }),
    undefined
  );
});

test('fails an expanded control whose rendered source is empty', () => {
  assert.match(
    structuralDocsFailure({
      clicked: 1,
      remaining: 0,
      expandedControls: 1,
      sourceTexts: ['   '],
      settled: true,
      reachedClickCap: false,
    }),
    /empty expanded source/i
  );
});
