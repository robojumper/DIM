import type { FilterDefinition, ItemFilter } from './filter-types';
import { canonicalFilterFormats } from './filter-types';
import type { QueryAST } from './query-parser';
import { canonicalizeQuery, parseQuery } from './query-parser';
import type { FiltersMap } from './search-config';

const rangeStringRegex = /^([<=>]{0,2})(\d+(?:\.\d+)?)$/;
const overloadedRangeStringRegex = /^([<=>]{0,2})(\w+)$/;

// this turns a string like "<=2" into a function like (x)=>x <= 2
// the produced function returns false if it was fed undefined
export function rangeStringToComparator(
  rangeString?: string,
  overloads?: { [key: string]: number }
) {
  if (!rangeString) {
    throw new Error('Missing range comparison');
  }

  const [operator, comparisonValue] = extractOpAndValue(rangeString, overloads);

  switch (operator) {
    case '=':
    case '':
      return (compare: number | undefined) => compare !== undefined && compare === comparisonValue;
    case '<':
      return (compare: number | undefined) => compare !== undefined && compare < comparisonValue;
    case '<=':
      return (compare: number | undefined) => compare !== undefined && compare <= comparisonValue;
    case '>':
      return (compare: number | undefined) => compare !== undefined && compare > comparisonValue;
    case '>=':
      return (compare: number | undefined) => compare !== undefined && compare >= comparisonValue;
  }
  throw new Error('Unknown range operator ' + operator);
}

function extractOpAndValue(rangeString: string, overloads?: { [key: string]: number }) {
  const matchedOverloadString = rangeString.match(overloadedRangeStringRegex);
  if (matchedOverloadString && overloads && matchedOverloadString[2] in overloads) {
    return [matchedOverloadString[1], overloads[matchedOverloadString[2]]] as const;
  }

  const matchedRangeString = rangeString.match(rangeStringRegex);
  if (matchedRangeString) {
    return [matchedRangeString[1], parseFloat(matchedRangeString[2])] as const;
  }

  throw new Error("Doesn't match our range comparison syntax, or invalid overload");
}

export function parseAndValidateQuery<I, FilterCtx, SuggestionsCtx>(
  query: string,
  filtersMap: FiltersMap<I, FilterCtx, SuggestionsCtx>,
  filterContext?: FilterCtx
): {
  /** Is the query valid at all? */
  valid: boolean;
  /** Can the user save this query? */
  saveable: boolean;
  /** Should we automatically save this in search history? */
  saveInHistory: boolean;
  /** The canonicalized version of the query */
  canonical: string;
} {
  let valid = true;
  let saveable = true;
  let saveInHistory = true;
  let canonical = query;
  try {
    const ast = parseQuery(query);
    if (!validateQuery(ast, filtersMap, filterContext)) {
      valid = false;
    } else {
      if (ast.op === 'noop' || (ast.op === 'filter' && ast.type === 'keyword')) {
        // don't save "trivial" single-keyword filters
        saveInHistory = false;
      }
      // Some sites have people save big lists of item IDs. Even if these aren't too long, don't save them automatically
      if (ast.op === 'or' && ast.operands.every((op) => op.op === 'filter' && op.type === 'id')) {
        saveInHistory = false;
      }
      canonical = canonicalizeQuery(ast);
      saveable = canonical.length <= 2048;
    }
  } catch (e) {
    valid = false;
  }
  return {
    valid,
    saveable: valid && saveable,
    saveInHistory: valid && saveable && saveInHistory,
    canonical,
  };
}

/**
 * Return whether the query is completely valid - syntactically, and where every term matches a known filter
 * and every filter RHS matches the declared format and options for the filter syntax.
 */
function validateQuery<I, FilterCtx, SuggestionsCtx>(
  query: QueryAST,
  filtersMap: FiltersMap<I, FilterCtx, SuggestionsCtx>,
  filterContext?: FilterCtx
): boolean {
  if (query.error) {
    return false;
  }
  switch (query.op) {
    case 'filter': {
      const filterName = query.type;
      const filterValue = query.args;

      // "is:" filters are slightly special cased
      if (filterName === 'is') {
        return Boolean(filtersMap.isFilters[filterValue]);
      } else {
        const filterDef = filtersMap.kvFilters[filterName];
        return Boolean(filterDef && matchFilter(filterDef, filterName, filterValue, filterContext));
      }
    }
    case 'not':
      return validateQuery(query.operand, filtersMap, filterContext);
    case 'and':
    case 'or': {
      return query.operands.every((q) => validateQuery(q, filtersMap, filterContext));
    }
    case 'noop':
      return true;
  }
}

/** Matches a non-`is` filter syntax and returns a way to actually create the matched filter function. */
export function matchFilter<I, FilterCtx, SuggestionsCtx>(
  filterDef: FilterDefinition<I, FilterCtx, SuggestionsCtx>,
  lhs: string,
  filterValue: string,
  currentFilterContext?: FilterCtx
): ((args: FilterCtx) => ItemFilter<I>) | undefined {
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
          const validator = filterDef.validateStat?.(currentFilterContext);
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
