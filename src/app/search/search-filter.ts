import { D2ManifestDefinitions } from 'app/destiny2/d2-definitions';
import { customStatsSelector, languageSelector } from 'app/dim-api/selectors';
import { DimLanguage } from 'app/i18n';
import { TagValue } from 'app/inventory/dim-item-info';
import { Loadout } from 'app/loadout-drawer/loadout-types';
import { loadoutsSelector } from 'app/loadout-drawer/loadouts-selector';
import { fullyResolvedLoadoutsSelector } from 'app/loadout/ingame/selectors';
import { d2ManifestSelector } from 'app/manifest/selectors';
import { Settings } from 'app/settings/initial-settings';
import { errorLog } from 'app/utils/log';
import { filterMap } from 'app/utils/util';
import { WishListRoll } from 'app/wishlists/types';
import _, { stubTrue } from 'lodash';
import { createSelector } from 'reselect';
import { DimItem } from '../inventory/item-types';
import {
  allItemsSelector,
  currentStoreSelector,
  displayableBucketHashesSelector,
  getNotesSelector,
  getTagSelector,
  newItemsSelector,
  sortedStoresSelector,
} from '../inventory/selectors';
import { DimStore } from '../inventory/store-types';
import { LoadoutsByItem, loadoutsByItemSelector } from '../loadout-drawer/selectors';
import { querySelector } from '../shell/selectors';
import { wishListFunctionSelector, wishListsByHashSelector } from '../wishlists/selectors';
import { InventoryWishListRoll } from '../wishlists/wishlists';
import {
  FilterContext,
  FilterDefinition,
  FilterDomain,
  ItemFilter,
  ItemFilterDomain,
  LoadoutFilterDomain,
  canonicalFilterFormats,
} from './filter-types';
import { QueryAST, parseQuery } from './query-parser';
import { SearchConfig, loadoutSearchConfigSelector, searchConfigSelector } from './search-config';
import {
  ParseValidationBundle,
  parseAndValidateQuery,
  rangeStringToComparator,
} from './search-utils';

//
// Selectors
//

/**
 * A selector for the filterContext for a particular destiny version. This must
 * depend on every bit of data a filter might need to run, so that we regenerate the filter
 * functions whenever any of them changes.
 */
export const filterContextSelector = createSelector(
  sortedStoresSelector,
  allItemsSelector,
  currentStoreSelector,
  loadoutsByItemSelector,
  wishListFunctionSelector,
  wishListsByHashSelector,
  newItemsSelector,
  getTagSelector,
  getNotesSelector,
  languageSelector,
  customStatsSelector,
  d2ManifestSelector,
  makeFilterContext
);

function makeFilterContext(
  stores: DimStore[],
  allItems: DimItem[],
  currentStore: DimStore | undefined,
  loadoutsByItem: LoadoutsByItem,
  wishListFunction: (item: DimItem) => InventoryWishListRoll | undefined,
  wishListsByHash: _.Dictionary<WishListRoll[]>,
  newItems: Set<string>,
  getTag: (item: DimItem) => TagValue | undefined,
  getNotes: (item: DimItem) => string | undefined,
  language: DimLanguage,
  customStats: Settings['customStats'],
  d2Definitions: D2ManifestDefinitions | undefined
): FilterContext {
  return {
    stores,
    allItems,
    currentStore: currentStore!,
    loadoutsByItem,
    wishListFunction,
    newItems,
    getTag,
    getNotes,
    language,
    customStats,
    wishListsByHash,
    d2Definitions,
  };
}

const itemFilterBundleSelector = createSelector(
  searchConfigSelector,
  filterContextSelector,
  (config, filterContext): SearchFilterFactoryBundle<ItemFilterDomain> => ({
    domain: 'item',
    config,
    filterContext,
  })
);
const loadoutFilterBundleSelector = createSelector(
  loadoutSearchConfigSelector,
  languageSelector,
  loadoutsSelector,
  (config, language, loadouts): SearchFilterFactoryBundle<LoadoutFilterDomain> => ({
    domain: 'loadout',
    config,
    filterContext: { language, loadouts },
  })
);

/**
 * A selector for the search config for a particular destiny version.
 * Combines the searchConfig (list of filters),
 * and the filterContext (list of other stat information filters can use)
 * into a filter factory (for converting parsed strings into filter functions)
 */
export const filterFactorySelector = createSelector(
  itemFilterBundleSelector,
  makeSearchFilterFactory<ItemFilterDomain, []>
);

/** A selector for a function for searching items, given the current search query. */
export const searchFilterSelector = createSelector(
  querySelector,
  filterFactorySelector,
  (query, filterFactory) => filterFactory(query)
);

export const loadoutFilterFactorySelector = createSelector(
  itemFilterBundleSelector,
  loadoutFilterBundleSelector,
  fullyResolvedLoadoutsSelector,
  (itemBundle, loadoutBundle, fullyResolvedLoadouts) => {
    const frLoadoutsById = _.keyBy(fullyResolvedLoadouts.loadouts, (l) => l.loadout.id);

    return makeSearchFilterFactory<LoadoutFilterDomain, [ItemFilterDomain]>(loadoutBundle, {
      ...itemBundle,
      mapItems: (item: Loadout) => frLoadoutsById[item.id].resolvedLoadoutItems.map((l) => l.item),
    });
  }
);

/** A selector for all items filtered by whatever's currently in the search box. */
export const filteredItemsSelector = createSelector(
  allItemsSelector,
  searchFilterSelector,
  displayableBucketHashesSelector,
  (allItems, searchFilter, displayableBuckets) =>
    allItems.filter((i) => displayableBuckets.has(i.location.hash) && searchFilter(i))
);

const itemQueryValidationBundleSelector = createSelector(
  searchConfigSelector,
  filterContextSelector,
  (searchConfig, filterContext): ParseValidationBundle<ItemFilterDomain> => ({
    label: 'item',
    filtersMap: searchConfig.filtersMap,
    validationContext: filterContext,
  })
);

const loadoutValidationBundleSelector = createSelector(
  searchConfigSelector,
  filterContextSelector,
  (_searchConfig, filterContext): ParseValidationBundle<LoadoutFilterDomain> => ({
    label: 'loadout',
    filtersMap: { allFilters: [], isFilters: {}, kvFilters: {} },
    validationContext: { language: filterContext.language, loadouts: [] },
  })
);

/** A selector for a function for validating a query. */
export const validateQuerySelector = createSelector(
  itemQueryValidationBundleSelector,
  loadoutValidationBundleSelector,
  (itemBundle, loadoutBundle) => (query: string) =>
    parseAndValidateQuery(query, itemBundle, loadoutBundle)
);

/** Whether the current search query is valid. */
export const queryValidSelector = createSelector(
  querySelector,
  validateQuerySelector,
  (query, validateQuery) => validateQuery(query).valid
);

interface SearchFilterFactoryBundle<D extends FilterDomain> {
  domain: D['Label'];
  config: SearchConfig<D>;
  filterContext: D['FilterContext'];
}

interface AdditionalBundle<P extends FilterDomain, D extends FilterDomain>
  extends SearchFilterFactoryBundle<D> {
  mapItems: (item: P['Item']) => D['Item'][];
}

function makeSearchFilterFactory<D extends FilterDomain, A extends FilterDomain[]>(
  /** The primary bundle contains the data for the thing we want to filter, i.e. what we put into the resulting filter function. */
  primaryBundle: SearchFilterFactoryBundle<D>,
  /** Additional bundles can turn things for our primary filter item into more things to be filtered, i.e. Loadout -> DimItem[] */
  ...additionalBundles: { [Index in keyof A]: AdditionalBundle<D, A[Index]> }
) {
  const bundlesForDomain = (domain: string | undefined) => {
    const primary =
      domain === undefined || domain === primaryBundle.domain ? primaryBundle : undefined;
    const additional =
      domain === undefined
        ? additionalBundles
        : additionalBundles.filter((b) => b.domain === domain);
    return { primary, additional };
  };
  return (query: string): ItemFilter<D['Item']> => {
    query = query.trim().toLowerCase();
    if (!query.length) {
      // By default, show anything that doesn't have the archive tag
      return stubTrue;
    }

    const parsedQuery = parseQuery(query);

    // Transform our query syntax tree into a filter function by recursion.
    const transformAST = (ast: QueryAST): ItemFilter<D['Item']> | undefined => {
      switch (ast.op) {
        case 'and': {
          const fns = filterMap(ast.operands, transformAST);
          // Propagate filter errors
          return fns.length === ast.operands.length
            ? (item) => {
                for (const fn of fns) {
                  if (!fn(item)) {
                    return false;
                  }
                }
                return true;
              }
            : undefined;
        }
        case 'or': {
          const fns = filterMap(ast.operands, transformAST);
          // Propagate filter errors
          return fns.length === ast.operands.length
            ? (item) => {
                for (const fn of fns) {
                  if (fn(item)) {
                    return true;
                  }
                }
                return false;
              }
            : undefined;
        }
        case 'not': {
          const fn = transformAST(ast.operand);
          return fn && ((item) => !fn(item));
        }
        case 'filter': {
          const filterName = ast.type;
          const filterValue = ast.args;

          const { primary, additional } = bundlesForDomain(ast.domain);

          if (filterName === 'is') {
            try {
              // "is:" filters are slightly special cased and are accessed using the filterValue
              const primaryFilter =
                primary &&
                primaryBundle.config.filtersMap.isFilters[filterValue]?.filter({
                  lhs: filterName,
                  filterValue,
                  ...primaryBundle.filterContext,
                });
              const additionalFilters = filterMap(additional, (a) => {
                const filter = a.config.filtersMap.isFilters[filterValue];
                return (
                  filter &&
                  ([
                    a.config.filtersMap.isFilters[filterValue]?.filter({
                      lhs: filterName,
                      filterValue,
                      ...a.filterContext,
                    }),
                    a.mapItems,
                  ] as const)
                );
              });
              return (item: D['Item']) => {
                if (primaryFilter?.(item)) {
                  return true;
                } else {
                  for (const [filter, mapper] of additionalFilters) {
                    const items = mapper(item);
                    if (items.some(filter)) {
                      return true;
                    }
                  }
                }
              };
            } catch (e) {
              // An `is` filter really shouldn't throw an error on filter construction...
              errorLog(
                'search',
                'internal error: filter construction threw exception',
                filterName,
                filterValue,
                e
              );
            }
            return undefined;
          } else {
            try {
              const primaryFilter =
                primary &&
                primaryBundle.config.filtersMap.kvFilters[filterName]?.filter({
                  lhs: filterName,
                  filterValue,
                  ...primaryBundle.filterContext,
                });
              const additionalFilters = filterMap(additional, (a) => {
                const filterDef = a.config.filtersMap.kvFilters[filterName];
                const filter = matchFilter(filterDef, filterName, filterValue, a.filterContext);
                return filter && ([filter(a.filterContext), a.mapItems] as const);
              });
              return (item: D['Item']) => {
                if (primaryFilter?.(item)) {
                  return true;
                } else {
                  for (const [filter, mapper] of additionalFilters) {
                    const items = mapper(item);
                    if (items.some(filter)) {
                      return true;
                    }
                  }
                }
              };
            } catch (e) {
              // If this happens, a filter declares more syntax valid than it actually accepts, which
              // is a bug in the filter declaration.
              errorLog(
                'search',
                'internal error: filter construction threw exception',
                filterName,
                filterValue,
                e
              );
            }

            return undefined;
          }
        }
        case 'noop':
          return undefined;
      }
    };

    // If our filter has any invalid parts, the search filter should match no items
    return transformAST(parsedQuery) ?? (() => false);
  };
}

/** Matches a non-`is` filter syntax and returns a way to actually create the matched filter function. */
export function matchFilter<D extends FilterDomain>(
  filterDef: FilterDefinition<D>,
  lhs: string,
  filterValue: string,
  validationContext: D['ValidationContext']
): ((args: D['FilterContext']) => ItemFilter<D['Item']>) | undefined {
  for (const format of canonicalFilterFormats(filterDef.format)) {
    switch (format) {
      case 'simple': {
        break;
      }
      case 'query': {
        if (filterDef.suggestions!.includes(filterValue)) {
          return (filterContext) =>
            filterDef.filter({
              lhs,
              filterValue,
              ...filterContext,
            });
        } else {
          break;
        }
      }
      case 'freeform': {
        return (filterContext) => filterDef.filter({ lhs, filterValue, ...filterContext });
      }
      case 'range': {
        try {
          const compare = rangeStringToComparator(filterValue, filterDef.overload);
          return (filterContext) =>
            filterDef.filter({
              lhs,
              filterValue: '',
              compare,
              ...filterContext,
            });
        } catch {
          break;
        }
      }
      case 'stat': {
        const [stat, rangeString] = filterValue.split(':', 2);
        try {
          const compare = rangeStringToComparator(rangeString, filterDef.overload);
          const validator = filterDef.validateStat?.(validationContext);
          if (!validator || validator(stat)) {
            return (filterContext) =>
              filterDef.filter({
                lhs,
                filterValue: stat,
                compare,
                ...filterContext,
              });
          } else {
            break;
          }
        } catch {
          break;
        }
      }
      case 'custom':
        break;
    }
  }
}
