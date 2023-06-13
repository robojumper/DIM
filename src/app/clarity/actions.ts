import { createAction } from 'typesafe-actions';
import type { ClarityCharacterStats } from './descriptions/character-stats';
import type { ClarityDescription } from './descriptions/descriptionInterface';

export const loadDescriptions = createAction('CLARITY/LOAD_DESCRIPTIONS')<
  ClarityDescription | undefined
>();

export const loadCharacterStats = createAction('CLARITY/LOAD_CHAR_STATS')<
  ClarityCharacterStats | undefined
>();
