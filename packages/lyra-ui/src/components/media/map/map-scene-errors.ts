export type MapSceneAdmissionErrorCode = 'invalid' | 'limit';

const codes = new WeakMap<object, MapSceneAdmissionErrorCode>();

/** Create a sanitized internal failure without retaining caller messages or descriptors. */
export function createMapSceneAdmissionError(code: MapSceneAdmissionErrorCode): TypeError {
  const error = new TypeError(code === 'limit' ? 'Map scene input limit exceeded' : 'Invalid map scene descriptor');
  codes.set(error, code);
  return Object.freeze(error);
}

/** Recognize only failures created by this module, without reading caller properties. */
export function mapSceneAdmissionErrorCode(error: unknown): MapSceneAdmissionErrorCode | undefined {
  return error !== null && (typeof error === 'object' || typeof error === 'function') ? codes.get(error) : undefined;
}
