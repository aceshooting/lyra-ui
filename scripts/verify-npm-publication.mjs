import { pathToFileURL } from 'node:url';

// publication-verifier:start
export async function verifyNpmPublication({ tag, tarball, expectedSha256, timeoutMs = 1200000, retryMs = 30000, requestTimeoutMs = 30000 },
  { fetch: request = globalThis.fetch, now = Date.now, sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)) } = {}) {
  const { createHash } = await import('node:crypto');
  const { open } = await import('node:fs/promises');
  const { constants } = await import('node:fs');
  class InvalidPublication extends Error { code = 'npm.publication'; }
  class TransientResponse extends Error {}
  const fail = message => { throw new InvalidPublication(message); };
  const match = /^lyra-(ui|flags|docs|ide|translations|map|3d|gen)@((?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*))$/u.exec(tag);
  if (!match || typeof tarball !== 'string' || !tarball || !/^[a-f0-9]{64}$/u.test(expectedSha256)) fail('A verified stable release tag, tarball and SHA-256 are required.');
  if (![timeoutMs, retryMs, requestTimeoutMs].every(value => Number.isSafeInteger(value) && value > 0)
    || timeoutMs > 1200000 || requestTimeoutMs > 30000 || typeof request !== 'function') fail('Invalid publication verification limits.');
  const directory = `lyra-${match[1]}`, version = match[2], packageName = `@aceshooting/${directory}`;
  const metadataUrl = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/${version}`;
  const tarballUrl = `https://registry.npmjs.org/${packageName}/-/${directory}-${version}.tgz`;
  let expectedBytes, expectedIntegrity, file;
  try {
    file = await open(tarball, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const info = await file.stat();
    if (!info.isFile() || !Number.isSafeInteger(info.size) || info.size <= 0) fail('The verified release tarball must be a nonempty regular file.');
    expectedBytes = info.size;
    const sha256 = createHash('sha256'), sha512 = createHash('sha512');
    let bytes = 0;
    for await (const chunk of file.createReadStream({ autoClose: false })) { bytes += chunk.length; sha256.update(chunk); sha512.update(chunk); }
    if (bytes !== expectedBytes || sha256.digest('hex') !== expectedSha256) fail('The local tarball differs from the verified release artifact.');
    expectedIntegrity = `sha512-${sha512.digest('base64')}`;
  } catch (error) {
    if (error instanceof InvalidPublication) throw error;
    fail('The verified release tarball could not be read.');
  } finally { await file?.close(); }
  const started = now(), deadline = started + timeoutMs;
  if (!Number.isFinite(started)) fail('Invalid publication verification clock.');
  const remaining = () => {
    const current = now();
    if (!Number.isFinite(current) || current < started) fail('Invalid publication verification clock.');
    return deadline - current;
  };
  const download = async (url, limit, hash) => {
    const budget = Math.min(requestTimeoutMs, remaining());
    if (budget <= 0) throw new TransientResponse();
    const controller = new AbortController();
    let reader, response, timer;
    const cancel = () => {
      controller.abort();
      if (reader) void reader.cancel().catch(() => {});
      else if (response?.body) void response.body.cancel().catch(() => {});
    };
    const timeout = new Promise((_resolve, reject) => { timer = setTimeout(() => { cancel(); reject(new TransientResponse()); }, budget); });
    try {
      return await Promise.race([timeout, (async () => {
        response = await request(url, { redirect: 'manual', credentials: 'omit', signal: controller.signal,
          headers: { accept: hash ? 'application/octet-stream' : 'application/json', 'accept-encoding': 'identity' } });
        if (controller.signal.aborted) throw new TransientResponse();
        if (response.status === 404 || response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500) throw new TransientResponse();
        if (response.status !== 200 || response.url && response.url !== url) fail('The npm registry returned an unsupported response or URL.');
        const length = response.headers.get('content-length');
        if (length !== null && (!/^[0-9]+$/u.test(length) || !Number.isSafeInteger(Number(length)) || Number(length) > limit)) fail('The npm registry response exceeds its byte ceiling.');
        if (hash && length !== null && Number(length) !== expectedBytes) fail('The npm tarball length differs from the verified artifact.');
        const encoding = response.headers.get('content-encoding');
        if (encoding && encoding !== 'identity') fail('The npm registry returned an unsupported content encoding.');
        const chunks = [];
        let bytes = 0;
        if (response.body) {
          reader = response.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (controller.signal.aborted) throw new TransientResponse();
            if (done) break;
            if (!(value instanceof Uint8Array)) fail('The npm registry returned invalid body bytes.');
            bytes += value.byteLength;
            if (bytes > limit) fail('The npm registry response exceeds its byte ceiling.');
            if (hash) hash.update(value); else chunks.push(value);
          }
        }
        if (length !== null && bytes !== Number(length)) fail('The npm registry response was truncated.');
        return { bytes, body: hash ? undefined : Buffer.concat(chunks, bytes).toString('utf8') };
      })()]);
    } catch (error) {
      if (error instanceof InvalidPublication) throw error;
      throw new TransientResponse();
    } finally { clearTimeout(timer); cancel(); }
  };
  while (remaining() > 0) {
    try {
      const metadata = await download(metadataUrl, 1048576);
      let record;
      try { record = JSON.parse(metadata.body); } catch { throw new TransientResponse(); }
      if (!record || typeof record !== 'object' || !record.dist?.integrity) throw new TransientResponse();
      if (record.name !== packageName || record.version !== version) fail('The npm metadata does not match the verified release identity.');
      if (record.dist.integrity !== expectedIntegrity) fail('The npm metadata integrity differs from the verified release artifact.');
      if (record.dist.tarball !== tarballUrl) fail('The npm metadata does not name the canonical release tarball URL.');
      const hash = createHash('sha512');
      const downloaded = await download(tarballUrl, expectedBytes, hash);
      if (downloaded.bytes !== expectedBytes) fail('The npm tarball was truncated.');
      if (`sha512-${hash.digest('base64')}` !== expectedIntegrity) fail('The downloaded npm tarball integrity differs from the verified release artifact.');
      if (remaining() <= 0) throw new TransientResponse();
      return { packageName, version, byteLength: expectedBytes, integrity: expectedIntegrity };
    } catch (error) {
      if (error instanceof InvalidPublication) throw error;
      if (!(error instanceof TransientResponse)) fail('Publication verification failed.');
    }
    if (remaining() > 0) await sleep(Math.min(retryMs, remaining()));
  }
  fail('The npm registry still does not serve the verified tarball 20 minutes after publish. Check publication promotion and registry propagation before retrying.');
}
// publication-verifier:end

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await verifyNpmPublication({ tag: process.env.TAG, tarball: process.env.TARBALL, expectedSha256: process.env.EXPECTED_SHA256 });
    console.log(`npm serves ${result.packageName}@${result.version} with the released bytes and integrity.`);
  } catch (error) {
    console.error(`::error::${error?.code === 'npm.publication' ? error.message : 'Publication verification failed.'}`);
    process.exitCode = 1;
  }
}
