export const enum EnergyType {
  Any = 0,
  Arc = 1,
  Solar = 2,
  Void = 3,
  Stasis = 4,
}

export interface ProcessItem {
  id: string;
  hash: number;
  name: string;
  isExotic: boolean;
  energy: {
    type: EnergyType;
    /** The maximum energy capacity for the item, e.g. if masterworked this will be 10. */
    capacity: number;
    /**
     * This is used to track the energy used by mods in a build. Using the name 'val' so that we can use the same sorting
     * function for ProcessItems and ProcessMods.
     */
    val: number;
  };
  power: number;
  stats: number[];
  compatibleModSeasons?: string[];
}

export interface StatFilter {
  min: number;
  max: number;
  ignored?: boolean;
}

export interface LockedProcessMods {
  generalMods: readonly ProcessMod[];
  combatMods: readonly ProcessMod[];
  activityMods: readonly ProcessMod[];
}

export interface ProcessArmorSet {
  /** The overall stats for the loadout as a whole. */
  readonly stats: readonly number[];
  /** For each armor type (see LockableBuckets), this is the list of items that could interchangeably be put into this loadout. */
  readonly armor: readonly string[];

  readonly mods: readonly number[];
}

export interface IntermediateProcessArmorSet {
  /** The overall stats for the loadout as a whole, in preferred order. */
  stats: number[];
  /** The first (highest-power) valid set from this stat mix. */
  armor: ProcessItem[];
}

export interface ProcessMod {
  hash: number;
  energy: {
    type: EnergyType;
    /** The energy cost of the mod. */
    val: number;
  };
  investmentStats: number[];
  /** This should only be available in legacy, combat and raid mods */
  tag?: string;
}
