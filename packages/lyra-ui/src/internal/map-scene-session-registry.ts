import type { MapCameraFollowTargets } from './map-camera-follow-controller.js';
import type { MapSceneSessionAttachment, MapSceneSessionFacade } from './map-scene-contract.js';

type CreateSceneFacade = (options: { readonly connection: object }) => MapSceneSessionFacade;
type SceneAttachmentProvider = (create: CreateSceneFacade) => MapSceneSessionAttachment | undefined;

type GroundProvider = (objectId: string) => MapCameraFollowTargets | undefined;
const providers = new WeakMap<HTMLElement, { attachment: SceneAttachmentProvider; ground: GroundProvider }>();

/** The peer that first observes a map supplies the session implementation. */
export function registerSceneAttachmentProvider(host: HTMLElement, attachment: SceneAttachmentProvider, ground: GroundProvider): () => void {
  const provider = { attachment, ground };
  providers.set(host, provider);
  return () => { if (providers.get(host) === provider) providers.delete(host); };
}

export function resolveSceneAttachment(host: HTMLElement, create: CreateSceneFacade): MapSceneSessionAttachment | undefined {
  return providers.get(host)?.attachment(create);
}

export function resolveGroundFollowScene(host: HTMLElement, objectId: string): MapCameraFollowTargets | undefined {
  return providers.get(host)?.ground(objectId);
}
