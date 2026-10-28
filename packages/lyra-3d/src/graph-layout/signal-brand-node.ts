/// <reference types="node" />
import { types } from 'node:util';

const isProxy = types.isProxy;

/** Complements AbortSignal's native getter on runtimes whose getter accepts proxies. */
export function isSignalProxy(value: unknown): boolean {
  return isProxy(value);
}
