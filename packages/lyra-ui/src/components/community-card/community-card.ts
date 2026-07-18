export * from './community-card.class.js';
import { LyraCommunityCard } from './community-card.class.js';
import { defineElement } from '../../internal/prefix.js';
import '../chip/chip.js';
import '../button/button.js';
import '../empty/empty.js';
defineElement('community-card', LyraCommunityCard);
