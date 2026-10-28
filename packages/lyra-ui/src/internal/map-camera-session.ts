import type { MapViewpoint } from './map-camera-session-data.js';

export type CameraOwnerReason = 'user' | 'external' | 'style' | 'engine' | 'disconnect';
export type CameraActionToken = object;
export interface MapCameraSessionCallbacks {
  complete(action: CameraActionToken): void;
  interrupt(reason: CameraOwnerReason): void;
  motion(reduced: boolean): void;
}
export interface MapCameraPreparedCommand {
  readonly action: CameraActionToken;
  readonly view: MapViewpoint;
  readonly kind: 'jump' | 'ease' | 'fly';
  readonly duration?: number;
}
export interface MapCameraSessionLease {
  current(): boolean;
  capture(): MapViewpoint;
  reducedMotion(): boolean;
  /** Arm an admitted action before its first deferred camera delivery; never moves the camera. */
  start(action: CameraActionToken): boolean;
  prepare(action: CameraActionToken, view: MapViewpoint,
    transition: { readonly kind: 'jump' | 'ease' | 'fly'; readonly duration?: number }): MapCameraPreparedCommand;
  commit(prepared: MapCameraPreparedCommand): boolean;
  retire(action: CameraActionToken, stopAnimation: boolean): void;
  release(): void;
}
export interface MapCameraSessionAttachment {
  acquire(callbacks: MapCameraSessionCallbacks): MapCameraSessionLease;
}
const attachments = new WeakMap<HTMLElement, MapCameraSessionAttachment>();
/** Registers an instance capability without importing its component or any optional engine. */
export function registerMapCameraSession(host: HTMLElement, attachment: MapCameraSessionAttachment): () => void {
  attachments.set(host, attachment);
  return () => { if (attachments.get(host) === attachment) attachments.delete(host); };
}
export function mapCameraSessionAttachment(host: HTMLElement): MapCameraSessionAttachment | undefined {
  return attachments.get(host);
}
