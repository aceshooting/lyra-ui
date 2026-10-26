import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, relative, sep, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const stable = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const identity = value => digest(stable(value));
const require = (condition, message) => { if (!condition) throw new TypeError(message); };
const fileDigest = async file => digest(await readFile(file));

export function profileBrowserResolution() {
  // Installed consumers resolve package imports without contributor-only source aliases.
  return { tsconfigRaw: { compilerOptions: {} }, conditions: ['browser', 'production'], define: { 'process.env.NODE_ENV': '"production"' } };
}

export function profileInputKey(file, workingDirectory = here, repositoryRoot = root) {
  const key = relative(repositoryRoot, resolve(workingDirectory, file)).split(sep).join('/');
  require(!key.startsWith('../'), 'Profile input must use built public exports: input is outside the repository.');
  require(!/^packages\/lyra-(?:gen|ui)\/src\//u.test(key), `Profile input must use built public exports: rejected ${key}.`);
  return key;
}

export function validateNativeAction(value) {
  require(value && ['click', 'fill', 'press'].includes(value.action) && typeof value.selector === 'string' && value.selector.length > 0 && value.selector.length <= 1024, 'Explicit native selector and action are required.');
  require(value.action === 'click' ? value.value === undefined : typeof value.value === 'string' && (value.action === 'fill' || value.value.length > 0) && value.value.length <= 4096, 'Invalid native action value.');
  require(Object.keys(value).every(key => ['action', 'selector', 'value'].includes(key)), 'Unexpected native action field.');
  return value;
}
export function requestAllowed({ url, method, origin, assets, routes }) {
  try {
    const parsed = new URL(url);
    return parsed.origin === origin && !parsed.search && !parsed.hash && !parsed.username && !parsed.password
      && ((['GET', 'HEAD'].includes(method) && assets.includes(parsed.pathname)) || routes.some(route => route.path === parsed.pathname && route.methods.includes(method)));
  } catch { return false; }
}
async function startHost(assets, hostRoutes) {
  const routes = new Map(), receipts = [];
  for (const route of hostRoutes) {
    require(/^\/host\/[a-zA-Z0-9/_-]+$/u.test(route.path) && !routes.has(route.path) && !assets.has(route.path)
      && Array.isArray(route.methods) && route.methods.length > 0 && route.methods.every(method => ['GET', 'POST', 'PUT', 'DELETE'].includes(method)) && typeof route.handle === 'function', 'Host routes must be unique, fixed and owned.');
    routes.set(route.path, route);
  }
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      if (url.search || url.hash) { response.writeHead(403).end(); return; }
      const asset = assets.get(url.pathname), route = routes.get(url.pathname);
      if (asset && ['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(200, { 'Content-Type': asset.contentType, 'Cache-Control': 'no-store' }); response.end(request.method === 'HEAD' ? undefined : asset.body); return;
      }
      if (!route || !route.methods.includes(request.method)) { response.writeHead(403).end(); return; }
      const chunks = []; let size = 0;
      for await (const chunk of request) { size += chunk.length; require(size <= 262144, 'Host request exceeded its byte limit.'); chunks.push(chunk); }
      const result = await route.handle({ method: request.method, body: new Uint8Array(Buffer.concat(chunks)), headers: { ...request.headers } });
      const body = Buffer.from(result.body);
      const metrics = result.metrics ?? {};
      require(Object.entries(metrics).every(([key, value]) => /^[a-zA-Z][a-zA-Z0-9]*$/u.test(key) && Number.isFinite(value) && value >= 0), 'Host metrics must be finite scalar durations/counts.');
      receipts.push({ path: url.pathname, method: request.method, status: result.status, metrics: { ...metrics } });
      require(body.length <= 262144 && Number.isInteger(result.status) && result.status >= 200 && result.status <= 599 && ['text/html', 'application/json'].includes(result.contentType), 'Invalid host response.');
      response.writeHead(result.status, { 'Content-Type': result.contentType, 'Cache-Control': 'no-store' }); response.end(body);
    } catch { response.writeHead(500).end(); }
  });
  await new Promise((accept, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', accept); });
  return { origin: `http://127.0.0.1:${server.address().port}`, receipts, close: () => new Promise((accept, reject) => server.close(error => error ? reject(error) : accept())) };
}

/** Every call owns a new service directory; callers decide when its process ends. */
export async function createProcessServices({ hostModules, loadLibrary, scratchDirectory, baseServices = {} }) {
  const directory = await mkdtemp(join(scratchDirectory, 'process-'));
  const instances = {}, routes = [], services = JSON.parse(JSON.stringify(baseServices));
  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    try {
      const results = await Promise.allSettled(Object.values(instances).map(service => service.dispose()));
      const failure = results.find(result => result.status === 'rejected'); if (failure) throw failure.reason;
    } finally { await rm(directory, { recursive: true, force: true }); }
  }
  try {
    for (const { name, url } of hostModules) {
      require(/^[a-z][a-z0-9-]*$/u.test(name) && !Object.hasOwn(instances, name), 'Host module names must be unique and fixed.');
      const serviceDirectory = join(directory, name); await mkdir(serviceDirectory);
      const service = await (await import(url.href)).createHostServices({ loadLibrary, scratchDirectory: serviceDirectory });
      require(service && Array.isArray(service.routes) && typeof service.dispose === 'function' && service.services && typeof service.services === 'object', 'Invalid workload host service.');
      instances[name] = service; routes.push(...service.routes);
      for (const key of Object.keys(service.services)) require(!Object.hasOwn(services, key), 'Duplicate host service.');
      Object.assign(services, JSON.parse(JSON.stringify(service.services)));
    }
    return { services, routes, serviceInstances: instances, close };
  } catch (error) { await close(); throw error; }
}

/** Builds public installed exports once. It never launches or measures a browser. */
export async function prepareProfileHost({ fixtureDirectory = new URL('./profile-fixture/', import.meta.url),
  hostModules = ['views', 'dashboards'].map(name => ({ name, url: new URL(`./profile-fixture/workloads/${name}-host.mjs`, import.meta.url) })) } = {}) {
  const { buildContext, builtExport } = await import('../../packages/lyra-gen/scripts/measure-bundles.mjs');
  const buildTools = await buildContext();
  const resolver = createRequire(join(root, 'packages/lyra-ui/package.json'));
  const loadLibrary = async specifier => {
    if (/^@aceshooting\/lyra-(?:ui|gen)(?:\/|$)/u.test(specifier)) {
      const name = specifier.startsWith('@aceshooting/lyra-gen') ? 'lyra-gen' : 'lyra-ui';
      const metadata = name === 'lyra-gen' ? buildTools.gen : buildTools.ui;
      return import(pathToFileURL(resolve(root, `packages/${name}`, builtExport(metadata, specifier))).href);
    }
    require(specifier === '@lit-labs/ssr' || specifier === '@lit-labs/ssr/lib/render-result.js', 'Host library is not allowed.');
    return import(pathToFileURL(resolver.resolve(specifier)).href);
  };
  const genResolver = createRequire(join(root, 'packages/lyra-gen/package.json'));
  const aiMetadata = JSON.parse(await readFile(genResolver.resolve('ai/package.json'), 'utf8'));
  require(aiMetadata.version === '7.0.153', 'The SDK workload requires its exact pinned peer.');
  const sdkPlugin = { name: 'profile-sdk-public-peer', setup(build) { build.onResolve({ filter: /^ai$/ }, () => ({ path: genResolver.resolve('ai') })); } };
  const scratch = await mkdtemp(join(tmpdir(), 'lyra-gen-profile-'));
  const processes = new Set(); let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    try {
      const results = await Promise.allSettled([...processes].map(host => host.close()));
      const failure = results.find(result => result.status === 'rejected'); if (failure) throw failure.reason;
    } finally { await rm(scratch, { recursive: true, force: true }); }
  }
  try {
    const build = await buildTools.esbuild.build({ absWorkingDir: here, entryPoints: [fileURLToPath(new URL('main.js', fixtureDirectory))], bundle: true,
      splitting: true, format: 'esm', platform: 'browser', target: 'es2022', outdir: join(scratch, 'assets'), minify: true, sourcemap: false,
      metafile: true, logLevel: 'silent', ...profileBrowserResolution(),
      plugins: [buildTools.plugin, sdkPlugin], external: buildTools.optionalPeers.flatMap(peer => [peer, `${peer}/*`]) });
    const inputs = {}, assets = new Map();
    for (const file of Object.keys(build.metafile.inputs).sort()) inputs[profileInputKey(file)] = await fileDigest(resolve(here, file));
    for (const file of Object.keys(build.metafile.outputs).sort()) {
      const path = resolve(here, file), name = `/${relative(join(scratch, 'assets'), path).split(sep).join('/')}`;
      require(!name.includes('..'), 'Unexpected bundle output.');
      assets.set(name, { body: await readFile(path), contentType: extname(name) === '.css' ? 'text/css' : 'text/javascript' });
    }
    let html = await readFile(new URL('index.html', fixtureDirectory), 'utf8');
    if (assets.has('/main.css')) html = html.replace('</head>', '<link rel="stylesheet" href="/main.css"></head>');
    assets.set('/', { body: Buffer.from(html), contentType: 'text/html' });
    const recording = await readFile(join(root, 'packages/lyra-gen/examples/recordings/chat-review.v1.json'));
    assets.set('/fixtures/chat-review.v1.json', { body: recording, contentType: 'application/json' });
    const baseServices = { chatRecording: { url: '/fixtures/chat-review.v1.json', sha256: digest(recording) } };
    const hostHashes = { 'profile-host.mjs': await fileDigest(new URL(import.meta.url)) };
    for (const { name, url } of hostModules) {
      require(!Object.hasOwn(hostHashes, `${name}-host.mjs`), 'Duplicate host module.');
      hostHashes[`${name}-host.mjs`] = await fileDigest(url);
    }
    const fixtureBuild = { bundleSha256: identity(Object.fromEntries([...assets].map(([name, value]) => [name, digest(value.body)]))),
      inputsSha256: identity(inputs), hostSha256: identity(hostHashes), recordingSha256: digest(recording) };
    return { fixtureBuild, esbuildVersion: buildTools.esbuild.version, scratchDirectory: scratch,
      async createProcessHost() {
        require(!closed, 'Artifact host is closed.');
        const service = await createProcessServices({ hostModules, loadLibrary, scratchDirectory: scratch, baseServices });
        let server;
        try { server = await startHost(assets, service.routes); }
        catch (error) { await service.close(); throw error; }
        let hostClosed = false;
        const host = { origin: server.origin, receipts: server.receipts, assets: [...assets.keys()], routes: service.routes,
          services: service.services, serviceInstances: service.serviceInstances,
          async close() {
            if (hostClosed) return;
            hostClosed = true;
            try { await server.close(); } finally { try { await service.close(); } finally { processes.delete(host); } }
          } };
        if (closed) { await host.close(); throw new Error('Artifact host closed during service creation.'); }
        processes.add(host); return host;
      }, close };
  } catch (error) { await close(); throw error; }
}

/** The caller owns the browser process, bindings, archive policy and CDP observations. */
export async function createOwnedPage({ browser, host, viewport, globalName, bindings = {}, collectDelivery = false, cdp = false }) {
  require(['__genProfile', '__memoryProfile'].includes(globalName), 'Unknown fixture browser interface.');
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1,
    colorScheme: 'light', reducedMotion: 'reduce', serviceWorkers: 'block', locale: 'en-US', timezoneId: 'UTC' });
  const state = { context, hostRequestStart: host.receipts.length, blocked: 0, errors: 0 };
  try {
    await context.route('**/*', async route => {
      const request = route.request();
      if (requestAllowed({ url: request.url(), method: request.method(), origin: host.origin, assets: host.assets, routes: host.routes })) await route.continue();
      else { state.blocked++; await route.abort(); }
    });
    await context.routeWebSocket(/.*/, socket => { state.blocked++; socket.close(); });
    const page = await context.newPage(); state.page = page; page.setDefaultTimeout(15000);
    page.on('pageerror', () => state.errors++);
    for (const [name, callback] of Object.entries(bindings)) await page.exposeBinding(name, callback);
    await page.goto(host.origin, { waitUntil: 'networkidle' });
    await page.waitForFunction(name => Boolean(window[name]), globalName);
    await page.evaluate(async () => {
      if (document.documentElement.dataset.lrMode !== 'light' || !matchMedia('(prefers-color-scheme: light)').matches || !document.fonts) throw new Error('Fixture theme or font readiness capability changed.');
      await document.fonts.ready;
    });
    if (collectDelivery) state.initialDelivery = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      return { resources: performance.getEntriesByType('resource').map(item => ({ path: new URL(item.name).pathname, encodedBytes: item.encodedBodySize, decodedBytes: item.decodedBodySize, durationMs: item.duration })),
        domContentLoadedMs: navigation.domContentLoadedEventEnd, loadMs: navigation.loadEventEnd };
    });
    require(!state.blocked && !state.errors, 'Fixture boot failed or requested an undeclared resource.');
    if (cdp) state.cdp = await context.newCDPSession(page);
    return state;
  } catch (error) { await context.close(); throw error; }
}

export async function activateNative(page, descriptor) {
  const native = validateNativeAction(descriptor);
  const locator = page.locator(native.selector);
  require(await locator.count() === 1 && await locator.isVisible() && await locator.isEnabled(), 'Native activation must select exactly one visible enabled control.');
  if (native.action === 'click') await locator.click();
  else if (native.action === 'fill') await locator.fill(native.value);
  else await locator.press(native.value);
}
