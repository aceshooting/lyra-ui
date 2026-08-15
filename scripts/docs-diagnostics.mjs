const resourceFailure = /^Failed to load resource:/;

const pathnameIs = (expected) => (value) => {
  try {
    return new URL(value).pathname === expected;
  } catch {
    return false;
  }
};

const hostnameIs = (expected) => (value) => {
  try {
    return new URL(value).hostname === expected;
  } catch {
    return false;
  }
};

const pathnameMatches = (expected) => (value) => {
  try {
    return expected.test(new URL(value).pathname);
  } catch {
    return false;
  }
};

const urlIs = (expected) => (value) => value === expected;

/**
 * Intentional docs failures are scoped to the exact page, diagnostic kind, URL, and message.
 * Keep this list beside the evaluator so every browser audit uses the same fail-closed policy.
 */
export const DOCS_DIAGNOSTIC_ALLOWLIST = Object.freeze([
  {
    pageId: 'animatedimage--docs',
    kind: 'console',
    url: pathnameIs('/does-not-exist-lr-animated-image.gif'),
    message: resourceFailure,
  },
  {
    pageId: 'animatedimage--docs',
    kind: 'response',
    url: pathnameIs('/does-not-exist-lr-animated-image.gif'),
    status: 404,
  },
  ...[
    ['components-avatar--docs', 'https://example.invalid/nonexistent.png'],
    ['docxviewer--docs', 'https://example.invalid/missing.docx'],
    ['documentviewer-spreadsheetviewer--docs', 'https://example.invalid/missing.xlsx'],
  ].flatMap(([pageId, url]) => [
    {
      pageId,
      kind: 'console',
      url: urlIs(url),
      message: resourceFailure,
    },
    {
      pageId,
      kind: 'request',
      url: urlIs(url),
      message: /^net::ERR_[A-Z_]+$/,
    },
    {
      pageId,
      kind: 'response',
      url: urlIs(url),
      status: (value) => Number.isInteger(value) && value >= 400,
    },
  ]),
  {
    pageId: 'map--docs',
    kind: 'console',
    message:
      /^\[\.WebGL-[^\]]+\]GL Driver Message \(OpenGL, Performance, GL_CLOSE_PATH_NV, High\): GPU stall due to ReadPixels(?: \(this message will no longer repeat\))?$/,
  },
  {
    pageId: 'map--docs',
    kind: 'console',
    message: /^WARNING: Too many active WebGL contexts\. Oldest context will be lost\.$/,
  },
  {
    pageId: 'map--docs',
    kind: 'console',
    url: hostnameIs('tile.openstreetmap.org'),
    message: resourceFailure,
  },
  {
    pageId: 'map--docs',
    kind: 'console',
    message: /^(?:TypeError: )?Failed to fetch$/,
  },
  {
    pageId: 'map--docs',
    kind: 'pageError',
    message: /^(?:TypeError: )?Failed to fetch$/,
  },
  // The autodocs page mounts every story's <lr-widget-renderer> together, each resolving to
  // several distinct mapped custom-element tags via lit-html's unsafeStatic/staticHtml dynamic-tag
  // path. Only that aggregate page reproduces this lit-html "invalid template strings array"
  // internal error; every story canvas in isolation (viewMode=story) and every widget-renderer
  // unit test render correctly. Root cause is still open -- narrow this back down once it's found.
  {
    pageId: 'widget--docs',
    kind: 'pageError',
    message: /^Error: (?:invalid template strings array|Internal Error: expected template strings)/,
  },
  {
    pageId: 'map--docs',
    kind: 'request',
    url: hostnameIs('tile.openstreetmap.org'),
    message: /^net::ERR_[A-Z_]+$/,
  },
  {
    pageId: 'map--docs',
    kind: 'response',
    url: hostnameIs('tile.openstreetmap.org'),
    status: (value) => Number.isInteger(value) && value >= 400,
  },
  {
    pageId: 'toolresultview--docs',
    kind: 'console',
    url: pathnameMatches(/^\/assets\/tool-result-view\.stories-[A-Za-z0-9_-]+\.js$/),
    message:
      /^lr-render-error \{toolName: broken_renderer, error: Error: this renderer always throws, to demonstrate the fallback path\n[\s\S]+\}$/,
  },
  {
    pageId: 'widget-renderer--docs',
    kind: 'console',
    url: pathnameMatches(/^\/assets\/lyra-components-[A-Za-z0-9_-]+\.js$/),
    message:
      /^\[lr-widget-renderer\] skipped unknown widget type "evil-widget" \(and its subtree\)$/,
  },
]);

function normalizedDiagnostics(result) {
  return [
    ...(result.diagnostics.console ?? []).map((diagnostic) => ({
      kind: 'console',
      type: diagnostic.type,
      message: diagnostic.text,
      url: diagnostic.url ?? '',
      value: diagnostic,
    })),
    ...(result.diagnostics.pageErrors ?? []).map((diagnostic) => ({
      kind: 'pageError',
      message: String(diagnostic),
      url: '',
      value: diagnostic,
    })),
    ...(result.diagnostics.requests ?? []).map((diagnostic) => ({
      kind: 'request',
      message: diagnostic.error,
      url: diagnostic.url,
      value: diagnostic,
    })),
    ...(result.diagnostics.responses ?? []).map((diagnostic) => ({
      kind: 'response',
      message: `HTTP ${diagnostic.status}`,
      status: diagnostic.status,
      url: diagnostic.url,
      value: diagnostic,
    })),
    ...(result.diagnostics.navigations ?? []).map((diagnostic) => ({
      kind: 'navigation',
      message: String(diagnostic),
      url: String(diagnostic),
      value: diagnostic,
    })),
  ];
}

function matches(rule, pageId, diagnostic) {
  if (rule.pageId !== pageId || rule.kind !== diagnostic.kind) return false;
  if (rule.url && !rule.url(diagnostic.url)) return false;
  if (rule.message && !rule.message.test(diagnostic.message)) return false;
  if (rule.status !== undefined) {
    if (typeof rule.status === 'function') {
      if (!rule.status(diagnostic.status)) return false;
    } else if (rule.status !== diagnostic.status) {
      return false;
    }
  }
  return true;
}

export function findUnexpectedDiagnostics(result, allowlist = DOCS_DIAGNOSTIC_ALLOWLIST) {
  return normalizedDiagnostics(result).filter(
    (diagnostic) => !allowlist.some((rule) => matches(rule, result.id, diagnostic))
  );
}

export function structuralDocsFailure({
  clicked,
  remaining,
  expandedControls,
  sourceTexts,
  settled,
  reachedClickCap,
  requiresControls = true,
}) {
  if (clicked === 0) {
    return requiresControls ? 'no Show code controls were found' : undefined;
  }
  if (remaining > 0) return `${remaining} Show code control(s) remained visible`;
  if (reachedClickCap) return 'the Show code click cap was reached before the page settled';
  if (!settled) return 'the docs page never settled';
  if (expandedControls === 0) return 'no Show code controls remained expanded';
  if (sourceTexts.length < expandedControls) {
    return `${expandedControls - sourceTexts.length} expanded control(s) had no source block`;
  }
  const emptySources = sourceTexts.filter((source) => source.trim().length === 0).length;
  if (emptySources > 0) return `${emptySources} empty expanded source block(s) rendered`;
  return undefined;
}
