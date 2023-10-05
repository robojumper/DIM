import { tl } from 'app/i18next-t';
import { FilterDefinition, LoadoutFilterDomain } from 'app/search/filter-types';
import { plainString } from 'app/search/search-filters/freeform';
import { localizedIncludes } from 'app/utils/intl';

export const loadoutNameFilter: FilterDefinition<LoadoutFilterDomain> = {
  keywords: 'keyword',
  description: tl('Filter.PartialMatch'),
  format: 'freeform',
  filter: ({ filterValue, language }) => {
    filterValue = plainString(filterValue, language);
    const includes = localizedIncludes(language, filterValue);
    return (loadout) =>
      includes(loadout.name) || (loadout.notes?.length ? includes(loadout.notes) : false);
  },
};
