export type { FormOwnerValue } from '../internal/direct-form-associated.js';
export * from './overlays/rating/rating.class.js';
import { LyraRating } from './overlays/rating/rating.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('rating', LyraRating);
