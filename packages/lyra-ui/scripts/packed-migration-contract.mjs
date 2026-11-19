import { gunzipSync, gzipSync } from 'node:zlib';

export const MIGRATION_CONTRACT_FILE = 'migration-contract.json.gz';
const MAX_CONTRACT_BYTES = 32 * 1024 * 1024;

export function encodeMigrationContract(text) {
  if (Buffer.byteLength(text) > MAX_CONTRACT_BYTES) throw new Error('Migration contract exceeds size limit');
  return gzipSync(text, { level: 9 });
}

export function decodeMigrationContract(bytes) {
  if (bytes.length > MAX_CONTRACT_BYTES) throw new Error('Compressed migration contract exceeds size limit');
  return gunzipSync(bytes, { maxOutputLength: MAX_CONTRACT_BYTES });
}
