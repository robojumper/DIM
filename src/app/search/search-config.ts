import { DestinyVersion } from '@destinyitemmanager/dim-api-types';
import { destinyVersionSelector } from 'app/accounts/selectors';
import { languageSelector } from 'app/dim-api/selectors';
import { DimLanguage } from 'app/i18n';
import { loadoutNameFilter } from 'app/loadout/loadout-filters';
import memoizeOne from 'memoize-one';
import { createSelector } from 'reselect';
import {
  FilterDefinition,
  FilterDomain,
  ItemFilterDomain,
  canonicalFilterFormats,
} from './filter-types';
import advancedFilters from './search-filters/advanced';
import d1Filters from './search-filters/d1-filters';
import dupeFilters from './search-filters/dupes';
import freeformFilters, { plainString } from './search-filters/freeform';
import itemInfosFilters from './search-filters/item-infos';
import knownValuesFilters from './search-filters/known-values';
import loadoutFilters from './search-filters/loadouts';
import simpleRangeFilters from './search-filters/range-numeric';
import overloadedRangeFilters from './search-filters/range-overload';
import simpleFilters from './search-filters/simple';
import socketFilters from './search-filters/sockets';
import statFilters from './search-filters/stats';
import locationFilters from './search-filters/stores';
import wishlistFilters from './search-filters/wishlist';
import {
  generateSuggestionsForFilter,
  loadoutSuggestionsContextSelector,
  suggestionsContextSelector,
} from './suggestions-generation';

const allFilters = [
  ...dupeFilters,
  ...($featureFlags.wishLists ? wishlistFilters : []),
  ...freeformFilters,
  ...itemInfosFilters,
  ...knownValuesFilters,
  ...d1Filters,
  ...loadoutFilters,
  ...simpleRangeFilters,
  ...overloadedRangeFilters,
  ...simpleFilters,
  ...socketFilters,
  ...statFilters,
  ...locationFilters,
  ...advancedFilters,
];

//
// SearchConfig
//

export interface FiltersMap<D extends FilterDomain> {
  allFilters: FilterDefinition<D>[];
  /* `is:keyword` filters */
  isFilters: Record<string, FilterDefinition<D>>;
  /* `keyword:value` filters */
  kvFilters: Record<string, FilterDefinition<D>>;
}

export interface Suggestion {
  /** The original suggestion text. */
  rawText: string;
  /** The plainString'd version (with diacritics removed, if applicable). */
  plainText: string;
}

export interface SearchConfig<D extends FilterDomain> {
  filtersMap: FiltersMap<D>;
  language: DimLanguage;
  suggestions: Suggestion[];
}

const buildFiltersMapInternal = <D extends FilterDomain>(filters: FilterDefinition<D>[]) =>
  memoizeOne((destinyVersion: DestinyVersion): FiltersMap<D> => {
    const isFilters: Record<string, FilterDefinition<D>> = {};
    const kvFilters: Record<string, FilterDefinition<D>> = {};
    const allApplicableFilters: FilterDefinition<D>[] = [];
    for (const filter of filters) {
      if (!filter.destinyVersion || filter.destinyVersion === destinyVersion) {
        allApplicableFilters.push(filter);
        const filterKeywords = Array.isArray(filter.keywords) ? filter.keywords : [filter.keywords];
        const filterFormats = canonicalFilterFormats(filter.format);
        const hasSimple = filterFormats.some((f) => f === 'simple');
        const hasKv = filterFormats.some((f) => f !== 'simple');

        for (const keyword of filterKeywords) {
          if (hasSimple) {
            if ($DIM_FLAVOR === 'test' && isFilters[keyword]) {
              throw new Error(
                `Conflicting is:${keyword} filter -- only the last inserted filter will work.`
              );
            }
            isFilters[keyword] = filter;
          }
          if (hasKv) {
            if ($DIM_FLAVOR === 'test' && kvFilters[keyword]) {
              throw new Error(
                `Conflicting ${keyword}:value filter -- only the last inserted filter will work.`
              );
            }
            kvFilters[keyword] = filter;
          }
        }
      }
    }

    return {
      isFilters,
      kvFilters,
      allFilters: allApplicableFilters,
    };
  });

export const buildFiltersMap = buildFiltersMapInternal(allFilters);
export const buildLoadoutFiltersMap = buildFiltersMapInternal([loadoutNameFilter]);

/** Builds an object that describes the available search keywords and filter definitions. */
const buildSearchConfigInternal =
  <D extends FilterDomain>(filtersMapBuilder: (destinyVersion: DestinyVersion) => FiltersMap<D>) =>
  (
    destinyVersion: DestinyVersion,
    language: DimLanguage,
    suggestionsContext: D['SuggestionsContext']
  ) => {
    const suggestions = new Set<string>();
    const filtersMap = filtersMapBuilder(destinyVersion);
    for (const filter of filtersMap.allFilters) {
      for (const suggestion of generateSuggestionsForFilter<ItemFilterDomain>(
        filter,
        suggestionsContext
      )) {
        suggestions.add(suggestion);
      }
    }

    return {
      filtersMap,
      suggestions: Array.from(suggestions, (rawText) => ({
        rawText,
        plainText: plainString(rawText, language),
      })),
      language,
    };
  };

export const buildSearchConfig = buildSearchConfigInternal(buildFiltersMap);
export const buildLoadoutSearchConfig = buildSearchConfigInternal(buildLoadoutFiltersMap);

export const searchConfigSelector = createSelector(
  destinyVersionSelector,
  languageSelector,
  suggestionsContextSelector,
  buildSearchConfig
);

export const loadoutSearchConfigSelector = createSelector(
  destinyVersionSelector,
  languageSelector,
  loadoutSuggestionsContextSelector,
  buildLoadoutSearchConfig
);
