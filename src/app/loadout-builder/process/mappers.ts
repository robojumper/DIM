import { D2ManifestDefinitions } from 'app/destiny2/d2-definitions';
import { calculateAssumedItemEnergy } from 'app/loadout/armor-upgrade-utils';
import {
  activityModPlugCategoryHashes,
  knownModPlugCategoryHashes,
} from 'app/loadout/known-values';
import { getItemEnergyType } from 'app/loadout/mod-utils';
import { MAX_ARMOR_ENERGY_CAPACITY, modsWithConditionalStats } from 'app/search/d2-known-values';
import { chargedWithLightPlugCategoryHashes } from 'app/search/specialty-modslots';
import {
  DestinyClass,
  DestinyEnergyType,
  DestinyItemInvestmentStatDefinition,
} from 'bungie-api-ts/destiny2';
import { StatHashes } from 'data/d2/generated-enums';
import _ from 'lodash';
import { DimItem, PluggableInventoryItemDefinition } from '../../inventory/item-types';
import {
  getModTypeTagByPlugCategoryHash,
  getSpecialtySocketMetadatas,
} from '../../utils/item-utils';
import { EnergyType, ProcessArmorSet, ProcessItem, ProcessMod } from '../process-worker/types';
import { ArmorEnergyRules, ArmorSet, ArmorStats } from '../types';

const mapEnergy = {
  [DestinyEnergyType.Any]: EnergyType.Any,
  [DestinyEnergyType.Arc]: EnergyType.Arc,
  [DestinyEnergyType.Void]: EnergyType.Void,
  [DestinyEnergyType.Thermal]: EnergyType.Solar,
  [DestinyEnergyType.Stasis]: EnergyType.Stasis,
};

export function mapArmor2ModToProcessMod(
  mod: PluggableInventoryItemDefinition,
  statOrder: number[]
): ProcessMod {
  const stats = [0, 0, 0, 0, 0, 0];
  for (const investmentStat of mod.investmentStats) {
    const idx = statOrder.indexOf(investmentStat.statTypeHash);
    if (idx !== -1) {
      stats[idx] += investmentStat.value;
    }
  }
  const processMod: ProcessMod = {
    hash: mod.hash,
    energy: mod.plug.energyCost
      ? {
          type: mapEnergy[mod.plug.energyCost.energyType],
          val: mod.plug.energyCost.energyCost,
        }
      : {
          type: EnergyType.Any,
          val: 0,
        },
    investmentStats: stats,
  };

  if (
    activityModPlugCategoryHashes.includes(mod.plug.plugCategoryHash) ||
    !knownModPlugCategoryHashes.includes(mod.plug.plugCategoryHash)
  ) {
    processMod.tag = getModTypeTagByPlugCategoryHash(mod.plug.plugCategoryHash);
  }

  return processMod;
}

export function isModStatActive(
  characterClass: DestinyClass,
  plugHash: number,
  stat: DestinyItemInvestmentStatDefinition,
  lockedMods: PluggableInventoryItemDefinition[]
): boolean {
  if (!stat.isConditionallyActive) {
    return true;
  } else if (
    plugHash === modsWithConditionalStats.powerfulFriends ||
    plugHash === modsWithConditionalStats.radiantLight
  ) {
    // Powerful Friends & Radiant Light
    // True if another arc charged with light mod is found
    // Note the this is not entirely correct as another arc mod slotted into the same item would
    // also trigger it but we don't know that until we try to socket them. Basically it is too hard
    // to figure that condition out so lets leave it as a known issue for now.
    return Boolean(
      lockedMods.find(
        (mod) =>
          mod.plug.energyCost?.energyType === DestinyEnergyType.Arc &&
          chargedWithLightPlugCategoryHashes.includes(mod.plug.plugCategoryHash)
      )
    );
  } else if (
    plugHash === modsWithConditionalStats.chargeHarvester ||
    plugHash === modsWithConditionalStats.echoOfPersistence
  ) {
    // "-10 to the stat that governs your class ability recharge"
    return (
      (characterClass === DestinyClass.Hunter && stat.statTypeHash === StatHashes.Mobility) ||
      (characterClass === DestinyClass.Titan && stat.statTypeHash === StatHashes.Resilience) ||
      (characterClass === DestinyClass.Warlock && stat.statTypeHash === StatHashes.Recovery)
    );
  } else {
    return true;
  }
}

/**
 * This sums up the total stat contributions across mods passed in. These are then applied
 * to the loadouts after all the items base values have been summed. This mimics how mods
 * effect stat values in game and allows us to do some preprocessing.
 */
export function getTotalModStatChanges(
  lockedMods: PluggableInventoryItemDefinition[],
  subclassPlugs: PluggableInventoryItemDefinition[],
  characterClass: DestinyClass
) {
  const totals: ArmorStats = {
    [StatHashes.Mobility]: 0,
    [StatHashes.Recovery]: 0,
    [StatHashes.Resilience]: 0,
    [StatHashes.Intellect]: 0,
    [StatHashes.Discipline]: 0,
    [StatHashes.Strength]: 0,
  };

  for (const mod of lockedMods.concat(subclassPlugs)) {
    for (const stat of mod.investmentStats) {
      if (
        stat.statTypeHash in totals &&
        isModStatActive(characterClass, mod.hash, stat, lockedMods)
      ) {
        totals[stat.statTypeHash] += stat.value;
      }
    }
  }

  return totals;
}

/**
 * Turns a real DimItem, armor upgrade rules, and bucket specific mods into the bits of
 * information relevant for LO. This requires that bucket specific mods have been validated
 * before.
 */
export function mapDimItemToProcessItem({
  dimItem,
  armorEnergyRules,
  modsForSlot,
  statOrder,
}: {
  dimItem: DimItem;
  armorEnergyRules: ArmorEnergyRules;
  modsForSlot?: PluggableInventoryItemDefinition[];
  statOrder: number[];
}): ProcessItem {
  const { id, hash, name, isExotic, power, stats: dimItemStats, energy } = dimItem;

  const statMap: { [statHash: number]: number } = {};
  const capacity = calculateAssumedItemEnergy(dimItem, armorEnergyRules);

  if (dimItemStats) {
    for (const { statHash, base } of dimItemStats) {
      let value = base;
      if (capacity === MAX_ARMOR_ENERGY_CAPACITY) {
        value += 2;
      }
      statMap[statHash] = value;
    }
  }

  const modMetadatas = getSpecialtySocketMetadatas(dimItem);
  const modsCost = modsForSlot
    ? _.sumBy(modsForSlot, (mod) => mod.plug.energyCost?.energyCost || 0)
    : 0;

  // Bucket specific mods have been validated
  const energyType =
    getItemEnergyType(dimItem, armorEnergyRules, modsForSlot) ?? energy!.energyType;

  const type = mapEnergy[energyType];

  return {
    id,
    hash,
    name,
    isExotic,
    power,
    stats: statOrder.map((s) => statMap[s]),
    energy: {
      type,
      capacity,
      val: modsCost,
    },
    compatibleModSeasons: modMetadatas?.flatMap((m) => m.compatibleModTags),
  };
}

export function hydrateArmorSet(
  defs: D2ManifestDefinitions,
  processed: ProcessArmorSet,
  statOrder: number[],
  itemsById: Map<string, DimItem[]>
): ArmorSet {
  const armor: DimItem[][] = [];

  for (const itemId of processed.armor) {
    armor.push(itemsById.get(itemId)!);
  }

  return {
    armor,
    stats: statOrder.reduce((statObj, statHash, i) => {
      statObj[statHash] = processed.stats[i];
      return statObj;
    }, {}) as ArmorStats,
    mods: processed.mods.map((m) => defs.InventoryItem.get(m) as PluggableInventoryItemDefinition),
  };
}
