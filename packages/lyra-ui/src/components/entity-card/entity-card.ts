export * from './entity-card.class.js';
import { LyraEntityCard } from './entity-card.class.js';
import { defineElement } from '../../internal/prefix.js';
import '../result-card/result-field.js';
import '../badge/badge.js';
import '../chip/chip.js';
import '../button/button.js';
import '../empty/empty.js';
defineElement('entity-card', LyraEntityCard);
