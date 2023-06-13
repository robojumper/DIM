import { armorStats, TOTAL_STAT_HASH } from 'app/search/d2-known-values';
import type { DestinyStatDisplayDefinition } from 'bungie-api-ts/destiny2';
import { StatHashes } from 'data/d2/generated-enums';
import type { DimStat } from '../item-types';

/**
 * Which stats to display, and in which order.
 */
const itemStatAllowList = [
  StatHashes.RoundsPerMinute,
  StatHashes.ChargeTime,
  StatHashes.DrawTime,
  StatHashes.BlastRadius,
  StatHashes.Velocity,
  StatHashes.SwingSpeed,
  StatHashes.Impact,
  StatHashes.Range,
  StatHashes.ShieldDuration,
  StatHashes.GuardEfficiency,
  StatHashes.GuardResistance,
  StatHashes.Accuracy,
  StatHashes.Stability,
  StatHashes.Handling,
  StatHashes.ChargeRate,
  StatHashes.GuardEndurance,
  StatHashes.ReloadSpeed,
  StatHashes.AimAssistance,
  StatHashes.AirborneEffectiveness,
  StatHashes.Zoom,
  StatHashes.RecoilDirection,
  StatHashes.Magazine,
  StatHashes.AmmoCapacity,
  ...armorStats,
  TOTAL_STAT_HASH,
];
export function getStatSortOrder(statHash: number) {
  const order = itemStatAllowList.indexOf(statHash);
  return order === -1 ? 999999 + Math.abs(statHash) : order;
}

export function isAllowedItemStat(statHash: number) {
  return itemStatAllowList.includes(statHash) || statHash < 0;
}

/**
 * Stats that are allowed for plugs, in addition to stats their items own.
 */
const plugStatAllowList = [StatHashes.AspectEnergyCapacity];

export function isAllowedPlugStat(statHash: number) {
  return plugStatAllowList.includes(statHash);
}

/** Stats that are measured in milliseconds. */
export const statsMs = [StatHashes.DrawTime, StatHashes.ChargeTime];

/** Stats that should be forced to display without a bar (just a number). */
export const statsNoBar = [
  StatHashes.RoundsPerMinute,
  StatHashes.Magazine,
  StatHashes.RecoilDirection,
  ...statsMs,
];

/** Show these stats in addition to any "natural" stats */
export const hiddenStatsAllowList = [
  StatHashes.AimAssistance,
  StatHashes.Zoom,
  StatHashes.RecoilDirection,
  StatHashes.AirborneEffectiveness,
];

/** a dictionary to look up StatDisplay info by statHash */
export interface StatDisplayLookup {
  [statHash: number]: DestinyStatDisplayDefinition | undefined;
}

/** a dictionary to look up an item's DimStats by statHash */
export interface StatLookup {
  [statHash: number]: DimStat | undefined;
}

/**
 * Some stats have an item-specific interpolation table, which is defined as
 * a piecewise linear function mapping input stat values to output stat values.
 */
export function interpolateStatValue(value: number, statDisplay: DestinyStatDisplayDefinition) {
  // right now, we are not doing stat interpolation for armor.
  // they're 1:1 in effects, and we are ignoring the clamping
  if (armorStats.includes(statDisplay.statHash)) {
    return value;
  }
  const interp = statDisplay.displayInterpolation;
  // Clamp the value to prevent overfilling
  value = Math.min(value, statDisplay.maximumValue);

  let endIndex = interp.findIndex((p) => p.value > value);

  // value < 0 is for mods with negative stats
  if (endIndex < 0) {
    endIndex = interp.length - 1;
  }
  const startIndex = Math.max(0, endIndex - 1);

  const start = interp[startIndex];
  const end = interp[endIndex];
  const range = end.value - start.value;
  if (range === 0) {
    return start.weight;
  }

  const t = (value - start.value) / (end.value - start.value);

  const interpValue = start.weight + t * (end.weight - start.weight);

  // vthorn has a hunch that magazine size doesn't use banker's rounding, but the rest definitely do:
  // https://github.com/Bungie-net/api/issues/1029#issuecomment-531849137
  return statDisplay.statHash === StatHashes.Magazine
    ? Math.round(interpValue)
    : bankersRound(interpValue);
}

/**
 * "Banker's rounding" rounds numbers that perfectly fall halfway between two integers to the nearest
 * even integer, instead of always rounding up.
 */
function bankersRound(x: number) {
  const r = Math.round(x);
  return (x > 0 ? x : -x) % 1 === 0.5 ? (0 === r % 2 ? r : r - 1) : r;
}

export function keyByStatHash(stats: DimStat[]): StatLookup;
export function keyByStatHash(stats: DestinyStatDisplayDefinition[]): StatDisplayLookup;
export function keyByStatHash(stats: (DimStat | DestinyStatDisplayDefinition)[]): {
  [statHash: number]: DimStat | DestinyStatDisplayDefinition | undefined;
} {
  const keyed: { [statHash: number]: any } = {};
  for (const stat of stats) {
    keyed[stat.statHash] = stat;
  }
  return keyed;
}
