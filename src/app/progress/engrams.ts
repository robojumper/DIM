import { HashLookup } from 'app/utils/util-types';
import { D2CalculatedSeason, D2SeasonInfo } from 'data/d2/d2-season-info';
import _ from 'lodash';

/**
 * Logic for determining how much power bonus an engram can provide.
 */

const enum PowerCap {
  /** Pinnacle engrams can go up to +2 over the powerful cap, up to the hard cap */
  Pinnacle,
  /** Powerful engrams cannot go above the powerful cap */
  Powerful,
}

const engrams: HashLookup<{ cap: PowerCap; bonus: number }> = {
  // Pinnacle
  73143230 /* InventoryItem "Pinnacle Gear" */: {
    cap: PowerCap.Pinnacle,
    bonus: 5,
  },
  3114385605 /* InventoryItem "Powerful Gear (Tier 1)" */: {
    cap: PowerCap.Powerful,
    bonus: 3,
  },
  4039143015 /* InventoryItem "Powerful Gear" */: {
    cap: PowerCap.Powerful,
    bonus: 3,
  },
  // Tier 2
  3114385606 /* InventoryItem "Powerful Gear (Tier 2)" */: {
    cap: PowerCap.Powerful,
    bonus: 4,
  },
  // Rose (from Competitive)
  882778888 /* InventoryItem "Rose" */: {
    cap: PowerCap.Powerful,
    bonus: 4,
  },
  // Tier 3
  3114385607 /* InventoryItem "Powerful Gear (Tier 3)" */: {
    cap: PowerCap.Powerful,
    bonus: 5,
  },
};

/**
 * How much above the player's current max power will this reward drop?
 */
export function getEngramPowerBonus(itemHash: number, maxPower?: number, parentItemHash?: number) {
  // Hawthorne's Clan Rewards gives out a +2 pinnacle even though it's listed as a powerful
  if (parentItemHash === 3603098564 /* Milestone "It's in the Cards" */) {
    itemHash = 73143230 /* InventoryItem "Pinnacle Gear" */;
  }

  const engramInfo = engrams[itemHash];
  if (!engramInfo) {
    return undefined;
  }

  maxPower ||= 0;
  maxPower = Math.floor(maxPower);
  const season = D2SeasonInfo[D2CalculatedSeason];
  const powerfulCap = season.powerfulCap;
  if (engramInfo.cap === PowerCap.Powerful) {
    // Powerful engrams can't go above the powerful cap
    return _.clamp(powerfulCap - maxPower, 0, engramInfo.bonus);
  } else if (engramInfo.cap === PowerCap.Pinnacle) {
    // Once you're at or above the powerful cap, pinnacles only give +2, up to the hard cap
    const pinnacleCap = Math.min(season.pinnacleCap, Math.max(maxPower, powerfulCap) + 2);
    return _.clamp(pinnacleCap - maxPower, 0, engramInfo.bonus);
  }
}
