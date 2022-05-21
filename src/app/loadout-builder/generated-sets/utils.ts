import { armorStats } from 'app/search/d2-known-values';
import _ from 'lodash';
import { ArmorStats } from '../types';
import { statTier } from '../utils';

/**
 * The "Tier" of a set takes into account that each stat only ticks over to a new effective value
 * every 10.
 */
export function calculateTotalTier(stats: ArmorStats) {
  return _.sum(Object.values(stats).map(statTier));
}

export function sumEnabledStats(stats: ArmorStats, enabledStats: Set<number>) {
  return _.sumBy(armorStats, (statHash) =>
    enabledStats.has(statHash) ? statTier(stats[statHash]) : 0
  );
}
