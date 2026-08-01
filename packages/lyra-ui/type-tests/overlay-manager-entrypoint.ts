import { suspendLyraModalsFor } from '../src/utilities/overlay-manager.js';

declare const externalModal: HTMLElement;

const release: () => void = suspendLyraModalsFor(externalModal);
release();
