import { nextId, srOnly } from '../src/utilities/a11y.js';
import {
  place,
  trackRect,
  virtualAnchorFromRect,
  type PlaceOptions,
  type VirtualAnchor,
} from '../src/utilities/positioner.js';
import {
  activateOverlay,
  suspendLyraModalsFor,
  type OverlayActivationOptions,
  type OverlayHandle,
} from '../src/utilities/overlay-manager.js';
import {
  FormAssociated,
  createStringArrayFormDataState,
  type FormValueAdapter,
} from '../src/utilities/form-associated.js';
import {
  LyraElement,
  type LyraEmitArgs,
  type LyraEventMap,
} from '../src/utilities/lyra-element.js';

// These helpers support the documented extension seams above. Implementation-only primitives that
// happened to leak through the former `export *` wrappers are intentionally absent in v9.
// @ts-expect-error hostAriaLabel is an internal component naming helper, not public a11y API.
import { hostAriaLabel as RemovedHostAriaLabel } from '../src/utilities/a11y.js';
// @ts-expect-error focus collectors are owned by the overlay manager implementation.
import { collectFocusableElements as RemovedCollectFocusableElements } from '../src/utilities/overlay-manager.js';
// @ts-expect-error placement style transactions are an internal controller seam.
import { createPlacementStyleTransaction as RemovedPlacementStyleTransaction } from '../src/utilities/positioner.js';
// @ts-expect-error validation barring is internal to FormAssociated and direct-internals controls.
import { isBarredFromValidation as RemovedIsBarredFromValidation } from '../src/utilities/form-associated.js';
// @ts-expect-error first-render seeding is an internal hydration controller seam.
import { SEED_FIRST_RENDER_STATE as RemovedSeedFirstRenderState } from '../src/utilities/lyra-element.js';

interface ProbeEvents extends LyraEventMap {
  'lr-probe': CustomEvent<{ readonly value: string }>;
}

declare const placeOptions: PlaceOptions;
declare const virtualAnchor: VirtualAnchor;
declare const overlayOptions: OverlayActivationOptions;
declare const overlayHandle: OverlayHandle;
declare const adapter: FormValueAdapter<readonly string[]>;
declare const emitArgs: LyraEmitArgs<ProbeEvents, 'lr-probe'>;

void [
  nextId,
  srOnly,
  place,
  trackRect,
  virtualAnchorFromRect,
  activateOverlay,
  suspendLyraModalsFor,
  FormAssociated,
  createStringArrayFormDataState,
  LyraElement,
  placeOptions,
  virtualAnchor,
  overlayOptions,
  overlayHandle,
  adapter,
  emitArgs,
  RemovedHostAriaLabel,
  RemovedCollectFocusableElements,
  RemovedPlacementStyleTransaction,
  RemovedIsBarredFromValidation,
  RemovedSeedFirstRenderState,
];
