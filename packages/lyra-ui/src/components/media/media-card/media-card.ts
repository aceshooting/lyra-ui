/** @deprecated Import @aceshooting/lyra-ui/components/lr-media-card.js to register this component. */
export * from './media-card.class.js';
import { LyraMediaCard } from './media-card.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('media-card', LyraMediaCard);
