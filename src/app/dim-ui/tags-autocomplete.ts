import { StrategyProps, Textcomplete } from '@textcomplete/core';
import { TextareaEditor } from '@textcomplete/textarea';
import { getHashtagsFromNote } from 'app/inventory/note-hashtags';
import { RootState } from 'app/store/types';
import clsx from 'clsx';
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { createSymbolsAutocompleter, symbolsSelector } from './destiny-symbols/destiny-symbols';

import styles from './tags-autocomplete.m.scss';

function createTagsCompleter(
  textArea: React.RefObject<HTMLTextAreaElement | HTMLInputElement>,
  tags: string[]
): StrategyProps {
  return {
    match: /#(\w*)$/,
    search: (term, callback) => {
      const termLower = term.toLowerCase();
      // need to build this list from the element ref, because relying
      // on liveNotes state would re-instantiate Textcomplete every keystroke
      const existingTags = getHashtagsFromNote(textArea.current!.value).map((t) => t.toLowerCase());
      const possibleTags: string[] = [];
      for (const t of tags) {
        const tagLower = t.toLowerCase();
        // don't suggest duplicate tags
        if (existingTags.includes(tagLower)) {
          continue;
        }
        // favor startswith
        if (tagLower.startsWith('#' + termLower)) {
          possibleTags.unshift(t);
          // over full text search
        } else if (tagLower.includes(termLower)) {
          possibleTags.push(t);
        }
      }
      callback(possibleTags);
    },
    replace: (key) => `${key} `,
    // to-do: for major tags, gonna use this to show what the notes icon will change to
    // template: (key) => `<img src="${url}"/>&nbsp;<small>:${key}:</small>`,
  };
}

export function useAutocomplete(
  textArea: React.RefObject<HTMLTextAreaElement | HTMLInputElement>,
  tagsSelector: (state: RootState) => string[]
) {
  const tags = useSelector(tagsSelector);
  const symbols = useSelector(symbolsSelector);
  useEffect(() => {
    if (textArea.current) {
      const editor = new TextareaEditor(textArea.current as unknown as any);
      const textcomplete = new Textcomplete(
        editor,
        [createTagsCompleter(textArea, tags), createSymbolsAutocompleter(symbols)],
        {
          dropdown: {
            className: clsx(styles.dropdownMenu, 'textcomplete-dropdown'),
          },
        }
      );
      return () => {
        textcomplete.destroy();
      };
    }
  }, [symbols, tags, textArea]);
}
