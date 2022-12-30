import { symbolData, TranslateManually } from '../../../data/d2/symbol-name-sources';

import { StrategyProps } from '@textcomplete/core';
import { D2ManifestDefinitions } from 'app/destiny2/d2-definitions';
import { t, tl } from 'app/i18next-t';
import { d2ManifestSelector } from 'app/manifest/selectors';
import { FontGlyphs } from 'data/d2/d2-font-glyphs';
import { createSelector } from 'reselect';
import { conversionTableSelector } from './rich-destiny-text';

const manualTranslations: { [key in TranslateManually]: string } = {
  [FontGlyphs.gilded_title]: tl('Glyphs.Gilded'),
  [FontGlyphs.hunter_smoke]: tl('Glyphs.Smoke'),
  [FontGlyphs.environment_hazard]: tl('Glyphs.Misadventure'),
  [FontGlyphs.void_quickfall]: tl('Glyphs.Quickfall'),
};

type SymbolsMap = { glyph: string; name: string; fullName: string }[];

const getTableLoc = (defs: D2ManifestDefinitions, tableName: string, hash: number) => {
  switch (tableName) {
    case 'Trait':
      return defs.Trait.get(hash)?.displayProperties?.name;
    case 'InventoryItem':
      return defs.InventoryItem.get(hash)?.displayProperties?.name;
    case 'SandboxPerk':
      return defs.SandboxPerk.get(hash)?.displayProperties?.name;
    case 'ActivityMode':
      return defs.ActivityMode[hash]?.displayProperties?.name;
  }
};

const simplifyName = (name: string) =>
  name
    .toLowerCase()
    .replace(/\s/g, '_')
    .replace(/[^\p{L}]/gu, '');

export const symbolsSelector = createSelector(
  d2ManifestSelector,
  conversionTableSelector,
  (defs, richTextReplacements) => {
    const list: SymbolsMap = [];
    if (!defs) {
      return list;
    }

    for (const { codepoint, glyph, source } of symbolData) {
      const hardCodedName = t(manualTranslations[codepoint]);
      if (hardCodedName) {
        list.push({
          glyph,
          fullName: hardCodedName,
          name: simplifyName(hardCodedName),
        });
        continue;
      }
      if (source) {
        const defName = getTableLoc(defs, source.tableName, source.hash);
        if (defName) {
          list.push({ glyph, fullName: defName, name: simplifyName(defName) });
          continue;
        }
      }
      const richTextRepl = richTextReplacements[glyph];
      if (richTextRepl) {
        const fullName = richTextRepl.plaintext.slice(1, -1);
        list.push({ glyph, fullName, name: simplifyName(fullName) });
        continue;
      }

      list.push({
        glyph,
        fullName: t('Glyphs.Missing'),
        name: simplifyName(t('Glyphs.Missing')),
      });
    }
    return list;
  }
);

export function createSymbolsAutocompleter(symbols: SymbolsMap): StrategyProps {
  return {
    match: /\B:(\p{L}*)$/u,
    search: (term, callback) => {
      const termLower = term.toLowerCase();
      const possibleTags: [string, string][] = [];
      for (const t of symbols) {
        const tagLower = t.name;
        // favor startswith
        if (tagLower.startsWith(termLower)) {
          possibleTags.unshift([t.glyph, tagLower]);
          // over full text search
        } else if (tagLower.includes(termLower)) {
          possibleTags.push([t.glyph, tagLower]);
        }
      }
      callback(possibleTags);
    },
    template: ([glyph, name]) => `${glyph} :${name}:`,
    replace: ([glyph]) => `${glyph} `,
  };
}
