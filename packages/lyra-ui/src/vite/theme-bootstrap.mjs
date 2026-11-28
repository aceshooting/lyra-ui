// Node-only Vite plugin for the classic no-flash theme bootstrap. Published as
// `@aceshooting/lyra-ui/vite/theme-bootstrap.js`; browser modules never import it, and Vite stays
// an application dependency: the plugin uses only the hook shapes it needs.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const AXES = ['look', 'surface', 'density', 'mode', 'accent'];
const CHARSET = /<meta\b[^>]*\bcharset\s*=[^>]*>/i;
const HEAD = /<head\b[^>]*>/i;

function escapeAttribute(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** The restore policy as the bootstrap's attribute value, or undefined to keep its default. */
function restoreAttribute(restore) {
  const tokens = Array.isArray(restore) ? restore : typeof restore === 'string' ? restore.trim().split(/\s+/) : [];
  if (tokens.includes('all')) return 'all';
  const axes = AXES.filter((axis) => tokens.includes(axis));
  return axes.length ? axes.join(' ') : undefined;
}

function defaultSource() {
  return createRequire(import.meta.url).resolve('@aceshooting/lyra-ui/theme-bootstrap.js');
}

/**
 * Serves, emits and references the package's classic `theme-bootstrap.js` asset, so a strict
 * Content-Security-Policy page loads it with `<script src>` placed right after `<meta charset>`.
 */
export function lyraThemeBootstrapPlugin({ storageKey, restore, modeAttributes, src, fileName = 'lyra-theme-bootstrap.js' } = {}) {
  let base = '/';
  let ssr = false;
  const name = String(fileName).replace(/^\/+/, '');
  const attributes = { src: '' };
  if (storageKey !== undefined) attributes['data-lr-theme-storage-key'] = String(storageKey);
  const policy = restoreAttribute(restore);
  if (policy) attributes['data-lr-theme-restore'] = policy;
  if (modeAttributes?.length) attributes['data-lr-theme-attributes'] = [...modeAttributes].join(' ');
  const read = () => {
    const source = src ?? defaultSource();
    return readFileSync(source instanceof URL ? fileURLToPath(source) : source, 'utf8');
  };
  const scriptAttributes = () => ({ ...attributes, src: `${base}${name}` });
  return {
    name: 'lyra-theme-bootstrap',
    configResolved(config) {
      base = typeof config.base === 'string' && config.base ? config.base : '/';
      if (!base.endsWith('/')) base += '/';
      ssr = Boolean(config.build?.ssr);
    },
    configureServer(server) {
      // The dev server serves an absolute base; a relative build base still serves from its root.
      const path = `${base.startsWith('/') ? base : '/'}${name}`;
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== path) return next();
        response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        response.setHeader('Cache-Control', 'no-cache');
        response.end(read());
      });
    },
    transformIndexHtml(html) {
      const tag = `<script${Object.entries(scriptAttributes()).map(([key, value]) => ` ${key}="${escapeAttribute(value)}"`).join('')}></script>`;
      const anchor = html.match(CHARSET) ?? html.match(HEAD);
      if (!anchor) return { html, tags: [{ tag: 'script', attrs: scriptAttributes(), injectTo: 'head-prepend' }] };
      const end = anchor.index + anchor[0].length;
      return html.slice(0, end) + tag + html.slice(end);
    },
    generateBundle() {
      if (ssr) return;
      this.emitFile({ type: 'asset', fileName: name, source: read() });
    },
  };
}
