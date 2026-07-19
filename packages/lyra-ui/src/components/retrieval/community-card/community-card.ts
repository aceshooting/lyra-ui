export * from './community-card.class.js';
import { LyraCommunityCard } from './community-card.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../overlays/chip/chip.js';
import '../../forms/button/button.js';
import '../../overlays/empty/empty.js';
defineElement('community-card', LyraCommunityCard);
