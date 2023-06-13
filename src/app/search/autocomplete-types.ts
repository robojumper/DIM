/** The autocompleter/dropdown will suggest different types of searches */
export const enum SearchItemType {
  /** Searches from your history */
  Recent,
  /** Explicitly saved searches */
  Saved,
  /** Searches suggested by DIM Sync but not part of your history */
  Suggested,
  /** Generated autocomplete searches */
  Autocomplete,
  /** Open help */
  Help,
  /** Open the armory view for a page */
  ArmoryEntry,
}

export interface SearchQuery {
  /** The full text of the query */
  fullText: string;
  /** The query's top-level comment */
  header?: string;
  /** The query text excluding the top-level comment */
  body: string;
  /** Help text */
  helpText?: string;
}

interface BaseSearchItem {
  type: SearchItemType;
  /** The suggested query */
  query: SearchQuery;
  /** An optional part of the query that will be highlighted */
  highlightRange?: {
    section: 'header' | 'body';
    /** The indices of the first and last character that should be highlighted */
    range: [number, number];
  };
}

export interface ArmorySearchItem extends BaseSearchItem {
  type: SearchItemType.ArmoryEntry;
  armoryItem: ArmoryEntry;
}

/** An item in the search autocompleter */
export type SearchItem =
  | ArmorySearchItem
  | (BaseSearchItem & {
      type: Exclude<SearchItemType, SearchItemType.ArmoryEntry>;
    });

export interface ArmoryEntry {
  name: string;
  /** The plainString'd version (with diacritics removed, if applicable). */
  plainName: string;
  icon: string;
  hash: number;
  seasonName: string | undefined;
  season: number;
  year: number | undefined;
}
