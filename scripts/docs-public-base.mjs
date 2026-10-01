const DEFAULT_DOCS_PUBLIC_BASE = 'https://aceshooting.github.io/lyra-ui/';

const HTML_BASE_TOKEN = '__LYRA_DOCS_BASE_HTML__';
const JSON_BASE_TOKEN = '__LYRA_DOCS_BASE_JSON__';

/** Validate a public deployment URL without echoing possibly sensitive configuration. */
export function resolveDocsPublicBase(value) {
  if (value === undefined) return DEFAULT_DOCS_PUBLIC_BASE;
  const invalid = () => new Error('LYRA_DOCS_BASE_URL must be an absolute HTTPS URL without credentials, query, fragment, whitespace or markup');
  if (typeof value !== 'string' || !value || /[\s<>"'\\?#\u0000-\u001f\u007f]/u.test(value)) throw invalid();
  let url;
  try { url = new URL(value); } catch { throw invalid(); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.search || url.hash) throw invalid();
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url.href;
}

function escapeMarkup(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

/** Render before Storybook builds the manager, never patch a qualified artifact afterwards. */
export function renderDocsManagerHead(template, publicBase) {
  const base = resolveDocsPublicBase(publicBase);
  if (template.split(HTML_BASE_TOKEN).length !== 3 || template.split(JSON_BASE_TOKEN).length !== 2) {
    throw new Error('The documentation manager-head template must contain its canonical, Open Graph and JSON-LD base tokens');
  }
  return template.replaceAll(HTML_BASE_TOKEN, () => escapeMarkup(base))
    .replace(JSON_BASE_TOKEN, () => JSON.stringify(base).replaceAll('<', '\\u003c'));
}

export function renderDocsRobots(publicBase) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${resolveDocsPublicBase(publicBase)}sitemap.xml\n`;
}

export function renderDocsSitemap(docsIds, publicBase) {
  const base = resolveDocsPublicBase(publicBase);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!--',
    '  Best-effort sitemap: the docs home page plus each indexed docs route.',
    '  Storybook serves one index.html for all query-based routes, with one shared canonical.',
    '  The guide URLs are bookmarkable; separate indexing is not implied.',
    '  Generated from storybook-static/index.json by pnpm docs:build.',
    '-->',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    `  <url><loc>${escapeMarkup(base)}</loc></url>`,
    ...docsIds.map((id) => `  <url><loc>${escapeMarkup(`${base}?path=/docs/${encodeURIComponent(id)}`)}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n');
}

/** Check the manager metadata against the recorded artifact profile, independently of env. */
export function docsPublicMetadataErrors(head, publicBase) {
  const base = resolveDocsPublicBase(publicBase);
  const errors = [];
  if (!head.includes(`<link rel="canonical" href="${escapeMarkup(base)}"`)) errors.push('canonical');
  if (!head.includes(`<meta property="og:url" content="${escapeMarkup(base)}"`)) errors.push('Open Graph URL');
  const blocks = [...head.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)];
  let sourceCode;
  try {
    sourceCode = blocks.map((match) => JSON.parse(match[1])).find((value) => value['@type'] === 'SoftwareSourceCode');
  } catch { errors.push('invalid JSON-LD'); }
  if (sourceCode?.url !== base) errors.push('structured-data URL');
  if (head.includes('__LYRA_DOCS_BASE_')) errors.push('unrendered public-base token');
  return errors;
}
